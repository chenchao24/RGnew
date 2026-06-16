/**
 * 波次管理系统
 */

import { SPECIAL_MONSTER_TYPES } from '../config/waves.js';
import { BALANCE } from '../config/balance.js';
import { Monster } from '../entities/Monster.js';

export class WaveManager {
  constructor(waveConfigs) {
    this.waveConfigs = waveConfigs;
    this.totalWaves = waveConfigs.length;
    this.currentWave = 0;
    this.waveTimer = 0;
    this.waveActive = false;
    this.allWavesComplete = false;
    this.bossSpawned = false;

    // 当前波次的怪物生成队列
    this.spawnQueue = [];
    this.spawnTimer = 0;

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
      const type = SPECIAL_MONSTER_TYPES[i % SPECIAL_MONSTER_TYPES.length];
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
        const monster = new Monster(spawn.type, pos.x, pos.y, this.waveConfigs[this.currentWave - 1]);
        newMonsters.push(monster);
      }
    }

    // 波次结束检测
    if (this.waveActive && this.waveTimer <= 0 && this.spawnQueue.length === 0) {
      this.waveActive = false;
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
   * 检查当前波次是否结束（所有怪物清完）
   */
  isWaveComplete(aliveMonsterCount) {
    return this.waveActive && this.spawnQueue.length === 0 && aliveMonsterCount === 0;
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
}
