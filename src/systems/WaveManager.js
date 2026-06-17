/**
 * 波次管理系统
 */

import { SPECIAL_MONSTER_TYPES, getSpecialTypesForWave } from '../config/waves.js';
import { BALANCE } from '../config/balance.js';
import { Monster } from '../entities/Monster.js';

export class WaveManager {
  constructor(waveConfigs, stageIndex) {
    this.waveConfigs = waveConfigs;
    this.stageIndex = stageIndex || 1;
    this.totalWaves = waveConfigs.length;
    this.currentWave = 0;
    this.waveTimer = 0;
    this.waveActive = false;
    this.allWavesComplete = false;
    this.bossSpawned = false;

    // 当前波次的怪物生成队列
    this.spawnQueue = [];
    this.spawnTimer = 0;

    // 外围增援队列（第三关1-6波）
    this.reinforcementQueue = [];
    this.reinforcementTimer = 0;
    this.reinforcementTriggered = false;

    // 波次提示
    this.waveAnnouncement = null;
    this.announcementTimer = 0;

    // 统计
    this.totalKills = 0;
    this.waveKills = 0;
    this.waveMonsterCount = 0;
  }

  /**
   * 开始下一波
   */
  startNextWave() {
    this.currentWave++;
    if (this.currentWave > this.totalWaves) {
      this.allWavesComplete = true;
      return;
    }

    const config = this.waveConfigs[this.currentWave - 1];
    this.waveActive = true;
    this.waveTimer = BALANCE.WAVE_DURATION;
    this.waveKills = 0;
    this.waveMonsterCount = config.monsterCount;

    // 生成怪物队列
    this.spawnQueue = [];
    const specialCount = Math.floor(config.monsterCount * config.specialRatio);
    const normalCount = config.monsterCount - specialCount;

    for (let i = 0; i < normalCount; i++) {
      this.spawnQueue.push({ type: 'NORMAL', delay: Math.random() * 0.5 });
    }

    for (let i = 0; i < specialCount; i++) {
      const types = getSpecialTypesForWave(this.stageIndex, this.currentWave);
      const type = types[i % types.length];
      this.spawnQueue.push({ type, delay: Math.random() * 0.5 });
    }

    // 打乱顺序
    for (let i = this.spawnQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]];
    }

    // 波次提示
    this.waveAnnouncement = `第 ${this.currentWave} 波`;
    this.announcementTimer = 2;

    this.spawnTimer = 0;

    // 第三关外围增援初始化
    this.reinforcementQueue = [];
    this.reinforcementTimer = 0;
    this.reinforcementTriggered = false;
    this.reinforcementSpawned = false;
  }

  /**
   * 每帧更新
   * @returns {Array} 新生成的怪物列表
   */
  update(dt, playerX, playerY, collisionSystem, activeMonsters) {
    const newMonsters = [];

    // 波次提示倒计时
    if (this.announcementTimer > 0) {
      this.announcementTimer -= dt;
      if (this.announcementTimer <= 0) {
        this.waveAnnouncement = null;
      }
    }

    // 波次计时
    if (this.waveActive) {
      this.waveTimer -= dt;
    }

    // 生成怪物
    if (this.spawnQueue.length > 0) {
      this.spawnTimer += dt;
      const toSpawn = [];
      for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
        this.spawnQueue[i].delay -= dt;
        if (this.spawnQueue[i].delay <= 0 && activeMonsters < BALANCE.MAX_MONSTERS_ON_SCREEN) {
          toSpawn.push(this.spawnQueue.splice(i, 1)[0]);
        }
      }

      for (const spawn of toSpawn) {
        const pos = collisionSystem.getSafeSpawnPosition(playerX, playerY, BALANCE.SAFE_SPAWN_DISTANCE);
        const monster = new Monster(spawn.type, pos.x, pos.y, this.waveConfigs[this.currentWave - 1], this.stageIndex);
        newMonsters.push(monster);
      }
    }

    // 第三关外围增援检测（1-6波，主波次刷完后间隔delay秒再刷一波外围）
    // 只触发一次：用 reinforcementSpawned 标记是否已刷过增援
    if (this.waveActive && this.spawnQueue.length === 0 && !this.reinforcementSpawned) {
      const waveConfig = this.waveConfigs[this.currentWave - 1];
      if (waveConfig.reinforcement && !this.reinforcementTriggered) {
        this.reinforcementTriggered = true;
        this.reinforcementTimer = waveConfig.reinforcement.delay;
      }
    }

    // 外围增援计时
    if (this.reinforcementTriggered && this.reinforcementTimer > 0) {
      this.reinforcementTimer -= dt;
      if (this.reinforcementTimer <= 0) {
        const waveConfig = this.waveConfigs[this.currentWave - 1];
        if (waveConfig.reinforcement && activeMonsters < BALANCE.MAX_MONSTERS_ON_SCREEN) {
          const rCount = waveConfig.reinforcement.count;
          for (let i = 0; i < rCount; i++) {
            const type = Math.random() < 0.3 ? 'FAST' : 'NORMAL';
            // 从地图边缘生成
            const pos = this._getEdgeSpawnPosition();
            const monster = new Monster(type, pos.x, pos.y, waveConfig, this.stageIndex);
            newMonsters.push(monster);
          }
        }
        this.reinforcementTriggered = false;
        this.reinforcementSpawned = true; // 标记增援已刷，防止重复触发
      }
    }

    return newMonsters;
  }

  /**
   * 记录击杀
   */
  onMonsterKilled() {
    this.totalKills++;
    this.waveKills++;
  }

  /**
   * 检查当前波次是否结束
   * 新规则：所有已刷出的怪全部死亡即算波次完成
   * 未刷出的不再刷新
   */
  isWaveComplete(aliveMonsterCount) {
    return this.waveActive && aliveMonsterCount === 0;
  }

  /**
   * 清除当前波次未刷出的怪物和增援
   */
  clearPendingSpawns() {
    this.spawnQueue = [];
    this.reinforcementQueue = [];
    this.reinforcementTriggered = false;
    this.reinforcementTimer = 0;
    this.reinforcementSpawned = false;
    this.waveActive = false;
  }

  /**
   * 检查是否应该开始Boss战
   */
  shouldSpawnBoss(aliveMonsterCount) {
    return this.allWavesComplete && !this.bossSpawned && aliveMonsterCount === 0;
  }

  getCurrentWaveConfig() {
    if (this.currentWave < 1 || this.currentWave > this.totalWaves) return null;
    return this.waveConfigs[this.currentWave - 1];
  }

  getRemainingTime() {
    return Math.max(0, this.waveTimer);
  }

  getWaveAnnouncement() {
    return this.waveAnnouncement;
  }

  /**
   * 从地图边缘获取生成位置
   */
  _getEdgeSpawnPosition() {
    const side = Math.floor(Math.random() * 4);
    const margin = 30;
    switch (side) {
      case 0: return { x: Math.random() * 1200, y: margin };           // 上
      case 1: return { x: Math.random() * 1200, y: 800 - margin };     // 下
      case 2: return { x: margin, y: Math.random() * 800 };            // 左
      case 3: return { x: 1200 - margin, y: Math.random() * 800 };    // 右
      default: return { x: margin, y: margin };
    }
  }
}
