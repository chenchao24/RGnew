/**
 * 游戏主状态机
 * 管理所有子系统、实体、游戏流程
 * 支持多关卡流转
 */

import { BALANCE } from '../config/balance.js';
import { PLAYER_CONFIG } from '../config/player.js';
import { getWaveConfigsForStage, getWaveCountForStage } from '../config/waves.js';
import { getBossConfigForStage } from '../config/boss.js';
import { MONSTER_TYPES } from '../config/monsters.js';
import { STAGES, calculateStageBonus } from '../config/stages.js';
import { InputManager } from './InputManager.js';
import { CollisionSystem } from './CollisionSystem.js';
import { Player } from '../entities/Player.js';
import { Monster } from '../entities/Monster.js';
import { RotatingSword } from '../entities/RotatingSword.js';
import { Boss } from '../entities/Boss.js';
import { WaveManager } from '../systems/WaveManager.js';
import { BuffSystem } from '../systems/BuffSystem.js';
import { LevelSystem } from '../systems/LevelSystem.js';
import { DamageSystem } from '../systems/DamageSystem.js';
import { DropSystem } from '../systems/DropSystem.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';
import { distance } from '../utils/MathUtils.js';
import { getSprite } from '../utils/SpriteManager.js';

const STATE = {
  TITLE: 'title',
  SELECT_HERO: 'select_hero',
  PLAYING: 'playing',
  PAUSED: 'paused',
  LEVEL_UP: 'level_up',
  GAME_OVER: 'game_over',
  VICTORY: 'victory',
  STAGE_TRANSITION: 'stage_transition',
  TEST_MODE: 'test_mode',
};

// 角色配置
const HEROES = [
  {
    id: 'paladin',
    name: '圣骑士',
    subtitle: 'Paladin',
    desc: '手持圣剑，以旋转剑刃荡涤黑暗。攻守兼备的全能战士。',
    available: true,
    color: '#4488ff',
    accentColor: '#88ccff',
    iconChar: '圣',
    stats: { atk: '★★★', def: '★★★', spd: '★★☆', range: '★★★' },
  },
  {
    id: 'assassin',
    name: '暗影刺客',
    subtitle: 'Shadow Assassin',
    desc: '来去如风，致命一击。高攻速高暴击的暗杀者。',
    available: false,
    color: '#9944cc',
    accentColor: '#cc88ff',
    iconChar: '影',
    stats: { atk: '★★★★', def: '★☆☆', spd: '★★★★', range: '★★☆' },
  },
  {
    id: 'mage',
    name: '法师',
    subtitle: 'Mage',
    desc: '掌控奥术之力，右键瞬移穿梭战场。攻击范围更广但移速稍慢。',
    available: true,
    color: '#cc4444',
    accentColor: '#ff8866',
    iconChar: '法',
    stats: { atk: '★★★', def: '★★☆', spd: '★★☆', range: '★★★★' },
  },
];

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;

    this.state = STATE.TITLE;
    this.input = new InputManager(canvas);
    this.collision = new CollisionSystem(this.width, this.height);

    this.currentStage = 1;
    this.waveManager = new WaveManager(getWaveConfigsForStage(1), 1);
    this.buffSystem = new BuffSystem();
    this.levelSystem = new LevelSystem();
    this.damageSystem = new DamageSystem();
    this.dropSystem = new DropSystem();
    this.particles = new ParticleSystem();

    this.player = null;
    this.swords = [];
    this.monsters = [];
    this.projectiles = [];
    this.boss = null;

    this.gameTime = 0;
    this.survivalTime = 0;
    this.trailTimer = 0;
    this.waveTransitionTimer = 0;
    this.bossSpawnTimer = 0;
    this.waitingForBoss = false;
    this.buffChoices = [];
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.selectedHero = null;

    // 关卡过渡
    this.stageTransitionTimer = 0;
    this.stageTransitionDuration = 2.0;

    // Boss关小怪刷新（第三关Boss）
    this.bossMinionTimer = 0;

    // 怒吼文字
    this.bossRoarTimer = 0;

    this._initBackground();
  }

  _initBackground() {
    this.bgCanvas = document.createElement('canvas');
    this.bgCanvas.width = this.width;
    this.bgCanvas.height = this.height;
    const bgCtx = this.bgCanvas.getContext('2d');

    const stageConfig = STAGES[this.currentStage - 1];
    const bgPath = stageConfig ? stageConfig.background : 'assets/bg/ground.png';

    // 尝试使用背景图片
    const bgImg = getSprite(bgPath);
    if (bgImg) {
      // 平铺背景图
      const pattern = bgCtx.createPattern(bgImg, 'repeat');
      bgCtx.fillStyle = pattern;
      bgCtx.fillRect(0, 0, this.width, this.height);
    } else {
      // 无图片时使用关卡主题色网格背景
      const isStage2 = this.currentStage >= 2;
      const isStage3 = this.currentStage >= 3;
      const bgColor = isStage3 ? '#0a0508' : isStage2 ? '#1a0a08' : '#111118';
      const gridColor = isStage3 ? 'rgba(60,15,10,0.5)' : isStage2 ? 'rgba(80,30,20,0.5)' : 'rgba(40,40,60,0.5)';

      bgCtx.fillStyle = bgColor;
      bgCtx.fillRect(0, 0, this.width, this.height);
      bgCtx.strokeStyle = gridColor;
      bgCtx.lineWidth = 1;
      for (let x = 0; x <= this.width; x += 50) {
        bgCtx.beginPath(); bgCtx.moveTo(x, 0); bgCtx.lineTo(x, this.height); bgCtx.stroke();
      }
      for (let y = 0; y <= this.height; y += 50) {
        bgCtx.beginPath(); bgCtx.moveTo(0, y); bgCtx.lineTo(this.width, y); bgCtx.stroke();
      }

      // 第二关额外装饰：熔岩裂纹
      if (isStage2) {
        bgCtx.strokeStyle = 'rgba(200,60,20,0.15)';
        bgCtx.lineWidth = 2;
        for (let i = 0; i < 30; i++) {
          const sx = Math.random() * this.width;
          const sy = Math.random() * this.height;
          bgCtx.beginPath();
          bgCtx.moveTo(sx, sy);
          for (let j = 0; j < 5; j++) {
            bgCtx.lineTo(sx + (Math.random() - 0.5) * 120, sy + (Math.random() - 0.5) * 120);
          }
          bgCtx.stroke();
        }
      }
    }
  }

  startGame() {
    this.state = STATE.PLAYING;
    this.currentStage = 1;
    const heroId = this.selectedHero ? this.selectedHero.id : 'paladin';
    this.player = new Player(this.width / 2, this.height / 2, heroId);
    this.player.currentStage = 1;
    this.swords = [];
    this.monsters = [];
    this.projectiles = [];
    this.boss = null;
    this.gameTime = 0;
    this.survivalTime = 0;
    this.trailTimer = 0;
    this.waveTransitionTimer = 0;
    this.bossSpawnTimer = 0;
    this.waitingForBoss = false;
    this.buffChoices = [];

    this.waveManager = new WaveManager(getWaveConfigsForStage(this.currentStage), this.currentStage);
    this.buffSystem = new BuffSystem();
    this.levelSystem = new LevelSystem();
    this.damageSystem = new DamageSystem();
    this.dropSystem = new DropSystem();
    this.particles.clear();

    this._initBackground();
    this._rebuildSwords();
    this.waveManager.startNextWave();
  }

  // ============ 测试模式 ============

  /**
   * 显示测试模式UI（密码验证 + 关卡选择）
   */
  _showTestModeUI() {
    const container = document.getElementById('ui-layer');
    container.innerHTML = '';

    const overlay = document.createElement('div');
    overlay.id = 'test-overlay';
    overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;z-index:100;';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:rgba(20,25,40,0.95);border:2px solid rgba(68,136,255,0.5);border-radius:12px;padding:30px 40px;width:380px;text-align:center;color:#ccc;font-family:"Segoe UI","Microsoft YaHei",sans-serif;';

    // 密码输入阶段
    panel.innerHTML = `
      <h3 style="color:#88ccff;margin-bottom:20px;font-size:20px;">🔒 测试通道</h3>
      <p style="color:#8899aa;font-size:14px;margin-bottom:15px;">请输入测试密码</p>
      <input id="test-password" type="password" placeholder="输入密码" style="width:200px;padding:10px 15px;border:1px solid rgba(68,136,255,0.4);border-radius:6px;background:rgba(30,35,50,0.9);color:#fff;font-size:16px;text-align:center;outline:none;" />
      <div style="margin-top:15px;">
        <button id="test-verify" style="padding:8px 30px;background:rgba(68,136,255,0.3);border:1px solid rgba(68,136,255,0.6);border-radius:6px;color:#88ccff;cursor:pointer;font-size:14px;">验证</button>
        <button id="test-cancel" style="padding:8px 20px;background:rgba(100,60,60,0.3);border:1px solid rgba(180,100,100,0.4);border-radius:6px;color:#aa8888;cursor:pointer;font-size:14px;margin-left:10px;">取消</button>
      </div>
      <p id="test-error" style="color:#ff6644;font-size:12px;margin-top:10px;min-height:16px;"></p>
    `;

    overlay.appendChild(panel);
    container.appendChild(overlay);

    document.getElementById('test-verify').onclick = () => {
      const pwd = document.getElementById('test-password').value;
      if (pwd === '1111') {
        this._showTestSelector(panel);
      } else {
        document.getElementById('test-error').textContent = '密码错误，请重新输入';
        document.getElementById('test-password').value = '';
      }
    };

    document.getElementById('test-cancel').onclick = () => {
      this._hideTestModeUI();
      this.state = STATE.TITLE;
    };
  }

  /**
   * 密码验证成功后显示关卡选择器
   */
  _showTestSelector(panel) {
    const stage1Waves = getWaveCountForStage(1);
    const stage2Waves = getWaveCountForStage(2);
    const stage3Waves = getWaveCountForStage(3);

    panel.innerHTML = `
      <h3 style="color:#88ccff;margin-bottom:20px;font-size:20px;">🧪 测试模式</h3>
      <div style="margin-bottom:15px;">
        <label style="color:#aabbcc;font-size:14px;display:block;margin-bottom:5px;">选择关卡</label>
        <select id="test-stage" style="width:200px;padding:8px 12px;border:1px solid rgba(68,136,255,0.4);border-radius:6px;background:rgba(30,35,50,0.9);color:#fff;font-size:14px;outline:none;">
          <option value="1">第一关 - 暗影森林</option>
          <option value="2">第二关 - 熔岩深渊</option>
          <option value="3">第三关 - 地狱裂隙</option>
        </select>
      </div>
      <div style="margin-bottom:15px;">
        <label style="color:#aabbcc;font-size:14px;display:block;margin-bottom:5px;">选择波次</label>
        <select id="test-wave" style="width:200px;padding:8px 12px;border:1px solid rgba(68,136,255,0.4);border-radius:6px;background:rgba(30,35,50,0.9);color:#fff;font-size:14px;outline:none;">
          ${this._buildWaveOptions(1, stage1Waves)}
        </select>
      </div>
      <div style="margin-bottom:15px;">
        <label style="color:#aabbcc;font-size:14px;display:block;margin-bottom:5px;">是否直接打Boss</label>
        <select id="test-boss" style="width:200px;padding:8px 12px;border:1px solid rgba(68,136,255,0.4);border-radius:6px;background:rgba(30,35,50,0.9);color:#fff;font-size:14px;outline:none;">
          <option value="0">正常波次</option>
          <option value="1">直接Boss</option>
        </select>
      </div>
      <p style="color:#ffcc00;font-size:12px;margin-bottom:15px;">⚠ 测试模式：HP=1000 攻击力=1000</p>
      <div style="margin-top:5px;">
        <button id="test-start" style="padding:10px 40px;background:rgba(68,136,255,0.4);border:1px solid rgba(68,136,255,0.7);border-radius:6px;color:#88ccff;cursor:pointer;font-size:16px;font-weight:bold;">开始测试</button>
        <button id="test-back" style="padding:8px 20px;background:rgba(100,60,60,0.3);border:1px solid rgba(180,100,100,0.4);border-radius:6px;color:#aa8888;cursor:pointer;font-size:14px;margin-left:10px;">返回</button>
      </div>
    `;

    // 关卡切换时更新波次下拉列表
    document.getElementById('test-stage').onchange = (e) => {
      const stage = parseInt(e.target.value);
      const waveSelect = document.getElementById('test-wave');
      waveSelect.innerHTML = this._buildWaveOptions(stage, getWaveCountForStage(stage));
    };

    document.getElementById('test-start').onclick = () => {
      const stage = parseInt(document.getElementById('test-stage').value);
      const wave = parseInt(document.getElementById('test-wave').value);
      const isBoss = parseInt(document.getElementById('test-boss').value) === 1;
      this._hideTestModeUI();
      this.startTestGame(stage, wave, isBoss);
    };

    document.getElementById('test-back').onclick = () => {
      this._hideTestModeUI();
      this.state = STATE.TITLE;
    };
  }

  _buildWaveOptions(stage, totalWaves) {
    let options = '';
    for (let i = 1; i <= totalWaves; i++) {
      options += `<option value="${i}">第 ${i} 波</option>`;
    }
    options += `<option value="${totalWaves + 1}">Boss</option>`;
    return options;
  }

  _hideTestModeUI() {
    const container = document.getElementById('ui-layer');
    container.innerHTML = '';
  }

  /**
   * 测试模式启动游戏
   * @param {number} stage - 关卡（1或2）
   * @param {number} wave - 波次（1-based，如果超过总波数则直接Boss）
   * @param {boolean} isBoss - 是否直接打Boss
   */
  startTestGame(stage, wave, isBoss) {
    this.currentStage = stage;
    this.state = STATE.PLAYING;

    // 默认圣骑士
    this.selectedHero = HEROES[0];
    const heroId = this.selectedHero.id;

    // 创建玩家并设置测试属性
    this.player = new Player(this.width / 2, this.height / 2, heroId);
    this.player.hp = 1000;
    this.player.maxHp = 1000;
    this.player.currentStage = stage;

    // 测试模式攻击力：剑基础伤害设为1000
    this.player.swordDamage = 1000;
    this.player.isTestMode = true;

    this.swords = [];
    this.monsters = [];
    this.projectiles = [];
    this.boss = null;
    this.gameTime = 0;
    this.survivalTime = 0;
    this.trailTimer = 0;
    this.waveTransitionTimer = 0;
    this.bossSpawnTimer = 0;
    this.waitingForBoss = false;
    this.buffChoices = [];

    this.waveManager = new WaveManager(getWaveConfigsForStage(stage), stage);
    this.buffSystem = new BuffSystem();
    this.levelSystem = new LevelSystem();
    this.damageSystem = new DamageSystem();
    this.dropSystem = new DropSystem();
    this.particles.clear();

    this._initBackground();
    this._rebuildSwords();

    const totalWaves = this.waveManager.totalWaves;

    if (isBoss || wave > totalWaves) {
      // 直接跳到Boss：跳过所有波次
      this.waveManager.currentWave = totalWaves;
      this.waveManager.allWavesComplete = true;
      this.waveManager.waveActive = false;
      this.waveManager.bossSpawned = true;
      this.waitingForBoss = false;
      this.bossSpawnTimer = 0;
      this.monsters = [];

      // 立即生成Boss
      const bossConfig = getBossConfigForStage(stage);
      this.boss = new Boss(this.width / 2, this.height * 0.3, bossConfig);
      // Boss进场怒吼
      if (this.boss.config.roars && this.boss.config.roars.spawn) {
        this.boss.triggerSpawnRoar();
      }
    } else {
      // 跳到指定波次：先跳过前面的波次
      this.waveManager.currentWave = wave - 1;
      this.waveManager.startNextWave();
    }

    this.isTestMode = true;
  }
  startNextStage() {
    // 保存当前等级用于计算加成
    const completedLevel = this.levelSystem.getLevel();

    // 计算跨关卡加成
    this.player.stageBonus = calculateStageBonus(completedLevel);
    this.player.currentStage = this.currentStage + 1;

    // 推进关卡
    this.currentStage++;

    // 重置关卡特定状态
    this.monsters = [];
    this.projectiles = [];
    this.boss = null;
    this.waveTransitionTimer = 0;
    this.bossSpawnTimer = 0;
    this.waitingForBoss = false;
    this.buffChoices = [];
    this.survivalTime = 0;

    // 重建波次管理器
    this.waveManager = new WaveManager(getWaveConfigsForStage(this.currentStage), this.currentStage);
    this.dropSystem = new DropSystem();
    this.particles.clear();

    // 应用关卡加成并满血
    this.buffSystem._applyToPlayer(this.player);
    this.player.hp = this.player.maxHp;

    // 清除临时buff
    this.player.tempSwords = [];
    this.player.atkUpTimer = 0;
    this.player.atkUpMultiplier = 1;
    this.player.spdUpTimer = 0;
    this.player.spdUpMultiplier = 1;
    this.player.tempShieldTimer = 0;
    this.player.tempShieldActive = false;

    // 重建背景和剑
    this._initBackground();
    this._rebuildSwords();

    // 开始第一波
    this.waveManager.startNextWave();
    this.state = STATE.PLAYING;
  }

  update(dt) {
    if (this.input.pausePressed && this.state === STATE.PLAYING) {
      this.state = STATE.PAUSED;
      this.input.resetFrame();
      return;
    }
    if (this.input.pausePressed && this.state === STATE.PAUSED) {
      this.state = STATE.PLAYING;
      this.input.resetFrame();
      return;
    }

    // 关卡过渡
    if (this.state === STATE.STAGE_TRANSITION) {
      this.stageTransitionTimer -= dt;
      if (this.stageTransitionTimer <= 0) {
        this.startNextStage();
      }
      this.input.resetFrame();
      return;
    }

    if (this.state !== STATE.PLAYING) {
      this.input.resetFrame();
      return;
    }

    this.gameTime += dt;
    this.survivalTime += dt;

    // === 玩家更新 ===
    this.player.update(dt, this.input, this.width, this.height);

    // 测试模式：锁定HP和攻击力
    if (this.isTestMode) {
      this.player.maxHp = 1000;
      this.player.hp = 1000;
      this.player.swordDamage = 1000;
    }

    // 右键瞬移（法师技能）
    if (this.input.rightMouseClicked && this.player.heroId === 'mage') {
      this.player.tryBlink(this.width, this.height);
    }

    this.trailTimer += dt;
    if (this.trailTimer >= 0.05 && (Math.abs(this.player.vx) > 10 || Math.abs(this.player.vy) > 10)) {
      this.trailTimer = 0;
      this.particles.spawnTrailParticle(this.player.x, this.player.y);
    }

    // === 旋转剑 ===
    const totalSwords = this.player.getTotalSwordCount();
    if (this.swords.length !== totalSwords) {
      this._rebuildSwords();
    }
    for (const sword of this.swords) {
      sword.update(dt, this.player.x, this.player.y, this.player.swordRadius, this.player.swordRotationSpeed);
    }

    // === 剑碰撞检测 ===
    const swordHits = this.damageSystem.processSwordHits(this.player, this.monsters, this.swords);
    for (const hit of swordHits) {
      if (hit.killed) {
        this._onMonsterKilled(hit.monster);
      }
      this.particles.spawnHitParticles(hit.monster.x, hit.monster.y);
      if (hit.isCrit) {
        this.particles.spawnCritParticles(hit.monster.x, hit.monster.y);
      }
    }

    // 元素DOT
    this.damageSystem.processElementalDOTs(this.monsters, dt);

    // 斩杀检查
    for (const monster of this.monsters) {
      if (monster.alive && monster.hp > 0 && monster.hp / monster.maxHp <= BALANCE.EXECUTE_THRESHOLD && this.player.hasExecute) {
        monster.hp = 0;
        monster.alive = false;
        this._onMonsterKilled(monster);
      }
    }

    // === 怪物更新 ===
    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const monster = this.monsters[i];
      if (!monster.alive) {
        this.monsters.splice(i, 1);
        continue;
      }

      const result = monster.update(dt, this.player.x, this.player.y);

      // 怪物攻击判定
      if (result && result.attack) {
        const dist = distance(monster.x, monster.y, this.player.x, this.player.y);
        if (dist <= monster.attackRange + this.player.collisionRadius) {
          const hitResult = this.player.takeDamage(result.damage);
          if (hitResult.dodged) {
            this.damageSystem._addDamageNumber(this.player.x, this.player.y - 20, 0, 'dodge');
          } else if (hitResult.damage > 0) {
            this.damageSystem._addDamageNumber(this.player.x, this.player.y - 20, hitResult.damage, 'player_hit');
            this.shakeTimer = 0.15;
            this.shakeIntensity = 3;
          }
          if (hitResult.shieldBroken) {
            this.damageSystem._addDamageNumber(this.player.x, this.player.y - 20, 0, 'shield');
          }
          if (hitResult.died) {
            this.state = STATE.GAME_OVER;
            this.input.resetFrame();
            return;
          }
          if (hitResult.revived) {
            this.damageSystem._addDamageNumber(this.player.x, this.player.y - 20, 0, 'heal');
            this.shakeTimer = 0.5;
            this.shakeIntensity = 10;
          }
        }
      }

      // 远程怪射击
      if (result && result.shoot) {
        const dx = this.player.x - monster.x;
        const dy = this.player.y - monster.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          this.projectiles.push({
            x: monster.x, y: monster.y,
            dirX: dx / len, dirY: dy / len,
            speed: MONSTER_TYPES.RANGED.projectileSpeed,
            damage: monster.damage,
            radius: MONSTER_TYPES.RANGED.projectileRadius,
            alive: true, lifetime: 3, isBoss: false,
          });
          monster.shootFlashTimer = 0.15;
        }
      }

      // 震荡怪震荡波减速
      if (result && result.shockWave) {
        const dist = distance(this.player.x, this.player.y, result.x, result.y);
        if (dist <= result.radius + this.player.collisionRadius) {
          this.player.applySlow(result.slowPercent, result.slowDuration);
          this.damageSystem._addDamageNumber(this.player.x, this.player.y - 20, 0, 'dodge');
        }
      }

      // 自爆怪爆炸
      if (result && result.exploded) {
        const dist = distance(this.player.x, this.player.y, result.x, result.y);
        if (dist <= 60 + this.player.collisionRadius) {
          const hitResult = this.player.takeDamage(result.damage);
          if (hitResult.damage > 0) {
            this.damageSystem._addDamageNumber(this.player.x, this.player.y - 20, hitResult.damage, 'player_hit');
          }
          if (hitResult.died) {
            this.state = STATE.GAME_OVER;
            this.input.resetFrame();
            return;
          }
        }
        this.particles.spawnExplosionParticles(result.x, result.y, 60);
        this.shakeTimer = 0.3;
        this.shakeIntensity = 5;
        this.monsters.splice(i, 1);
        continue;
      }

      // 边界
      const m = monster.collisionRadius;
      monster.x = Math.max(m, Math.min(this.width - m, monster.x));
      monster.y = Math.max(m, Math.min(this.height - m, monster.y));
    }

    // === Boss 更新 ===
    if (this.boss && this.boss.alive) {
      const bossResult = this.boss.update(dt, this.player.x, this.player.y);
      if (bossResult) {
        if (bossResult.meleeAttack) {
          const dist = distance(this.boss.x, this.boss.y, this.player.x, this.player.y);
          if (dist <= this.boss.attackRange + this.player.collisionRadius) {
            const hitResult = this.player.takeDamage(bossResult.damage);
            if (hitResult.damage > 0) {
              this.damageSystem._addDamageNumber(this.player.x, this.player.y - 20, hitResult.damage, 'player_hit');
              this.shakeTimer = 0.2;
              this.shakeIntensity = 5;
            }
            if (hitResult.died) { this.state = STATE.GAME_OVER; this.input.resetFrame(); return; }
          }
        }
        if (bossResult.dashing) {
          const dist = distance(this.boss.x, this.boss.y, this.player.x, this.player.y);
          if (dist <= this.boss.collisionRadius + this.player.collisionRadius) {
            const hitResult = this.player.takeDamage(bossResult.damage);
            if (hitResult.damage > 0) {
              this.damageSystem._addDamageNumber(this.player.x, this.player.y - 20, hitResult.damage, 'player_hit');
              this.shakeTimer = 0.2; this.shakeIntensity = 5;
            }
            if (hitResult.died) { this.state = STATE.GAME_OVER; this.input.resetFrame(); return; }
          }
        }
        if (bossResult.projectiles) {
          for (const proj of bossResult.projectiles) {
            this.projectiles.push({ ...proj, alive: true, lifetime: 5 });
          }
        }
        // Boss3 十字光波光柱伤害
        if (bossResult.crossWaveBeams) {
          for (const beam of bossResult.crossWaveBeams) {
            if (beam.damage > 0) {
              const rayResult = { dirX: beam.dirX, dirY: beam.dirY, width: beam.width, range: beam.range };
              if (this._isPlayerInRay(rayResult)) {
                const hitResult = this.player.takeDamage(beam.damage);
                if (hitResult.damage > 0) {
                  this.damageSystem._addDamageNumber(this.player.x, this.player.y - 20, hitResult.damage, 'player_hit');
                  this.shakeTimer = 0.1;
                  this.shakeIntensity = 3;
                }
                if (hitResult.died) { this.state = STATE.GAME_OVER; this.input.resetFrame(); return; }
              }
            }
          }
        }
        // Boss射线伤害
        if (bossResult.ray && bossResult.damage > 0) {
          if (this._isPlayerInRay(bossResult)) {
            const hitResult = this.player.takeDamage(bossResult.damage);
            if (hitResult.damage > 0) {
              this.damageSystem._addDamageNumber(this.player.x, this.player.y - 20, hitResult.damage, 'player_hit');
              this.shakeTimer = 0.1;
              this.shakeIntensity = 3;
            }
            if (hitResult.died) { this.state = STATE.GAME_OVER; this.input.resetFrame(); return; }
          }
        }
        if (bossResult.summon) {
          const count = bossResult.count;
          const waveCfg = this.waveManager.getCurrentWaveConfig() || { hpMultiplier: 2.8, damageMultiplier: 1.7, speedMultiplier: 1.25, expMultiplier: 1.5 };
          for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const spawnX = this.boss.x + Math.cos(angle) * 80;
            const spawnY = this.boss.y + Math.sin(angle) * 80;
            const nm = new Monster('NORMAL',
              Math.max(20, Math.min(this.width - 20, spawnX)),
              Math.max(20, Math.min(this.height - 20, spawnY)),
              waveCfg, this.currentStage);
            this.monsters.push(nm);
          }
        }
        // Boss3 陨石雨伤害
        if (bossResult.meteorHits) {
          for (const hit of bossResult.meteorHits) {
            const hitResult = this.player.takeDamage(hit.damage);
            if (hitResult.damage > 0) {
              this.damageSystem._addDamageNumber(this.player.x, this.player.y - 20, hitResult.damage, 'player_hit');
            }
            if (hitResult.died) { this.state = STATE.GAME_OVER; this.input.resetFrame(); return; }
          }
        }
        // Boss3 陨石雨震动
        if (bossResult.shake) {
          this.shakeTimer = bossResult.shake.duration || 0.3;
          this.shakeIntensity = bossResult.shake.intensity || 8;
        }
        // Boss3 烈焰伤害
        if (bossResult.flameAura && bossResult.damage > 0) {
          const hitResult = this.player.takeDamage(bossResult.damage);
          if (hitResult.damage > 0) {
            this.damageSystem._addDamageNumber(this.player.x, this.player.y - 20, hitResult.damage, 'player_hit');
          }
          if (hitResult.died) { this.state = STATE.GAME_OVER; this.input.resetFrame(); return; }
        }
      }

      // Boss 被剑击中
      for (const sword of this.swords) {
        const tip = sword.getTipPosition();
        const dist = distance(tip.x, tip.y, this.boss.x, this.boss.y);
        if (dist <= this.player.swordHitRadius + this.boss.collisionRadius && sword.canHit(-1, this.player.swordCooldown)) {
          sword.registerHit(-1, this.player.swordCooldown);
          let dmg = this.player.getTotalDamage();
          if (Math.random() < this.player.critChance) {
            dmg = Math.round(dmg * BALANCE.CRIT_MULTIPLIER);
            this.damageSystem._addDamageNumber(this.boss.x, this.boss.y - 40, dmg, 'crit');
          } else {
            this.damageSystem._addDamageNumber(this.boss.x, this.boss.y - 40, dmg, 'normal');
          }
          this.boss.takeDamage(dmg);
          this.particles.spawnHitParticles(this.boss.x, this.boss.y, this.boss.config.color || '#aa44ff');

          if (!this.boss.alive) {
            this.dropSystem.onBossKilled(this.boss);
            this.waveManager.totalKills++;
            this.shakeTimer = 0.5; this.shakeIntensity = 10;
            this.state = STATE.VICTORY;
            this.input.resetFrame();
            return;
          }
        }
      }

      // Boss 边界
      const br = this.boss.collisionRadius;
      this.boss.x = Math.max(br, Math.min(this.width - br, this.boss.x));
      this.boss.y = Math.max(br, Math.min(this.height - br, this.boss.y));
    }

    // === 弹道更新 ===
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.x += proj.dirX * proj.speed * dt;
      proj.y += proj.dirY * proj.speed * dt;
      proj.lifetime -= dt;
      if (proj.lifetime <= 0 || proj.x < -50 || proj.x > this.width + 50 || proj.y < -50 || proj.y > this.height + 50) {
        this.projectiles.splice(i, 1);
        continue;
      }
      const dist = distance(proj.x, proj.y, this.player.x, this.player.y);
      if (dist <= proj.radius + this.player.collisionRadius) {
        const hitResult = this.player.takeDamage(proj.damage);
        if (hitResult.dodged) {
          this.damageSystem._addDamageNumber(this.player.x, this.player.y - 20, 0, 'dodge');
        } else if (hitResult.damage > 0) {
          this.damageSystem._addDamageNumber(this.player.x, this.player.y - 20, hitResult.damage, 'player_hit');
        }
        if (hitResult.died) { this.state = STATE.GAME_OVER; this.input.resetFrame(); return; }
        this.projectiles.splice(i, 1);
      }
    }

    // === 波次管理 ===
    const totalWaves = this.waveManager.totalWaves;
    const newMonsters = this.waveManager.update(dt, this.player.x, this.player.y, this.collision, this.monsters.length);
    this.monsters.push(...newMonsters);

    const aliveCount = this.monsters.filter(m => m.alive).length;
    if (this.waveManager.isWaveComplete(aliveCount)) {
      // 清除未刷出的怪物和增援
      this.waveManager.clearPendingSpawns();
      this.waveTransitionTimer = BALANCE.WAVE_TRANSITION_DELAY;
    }

    if (this.waveTransitionTimer > 0) {
      this.waveTransitionTimer -= dt;
      if (this.waveTransitionTimer <= 0) {
        if (this.waveManager.currentWave < totalWaves) {
          this.waveManager.startNextWave();
        } else {
          this.waveManager.allWavesComplete = true;
          this.waitingForBoss = true;
          this.bossSpawnTimer = BALANCE.BOSS_SPAWN_DELAY;
        }
      }
    }

    if (this.waitingForBoss && this.bossSpawnTimer > 0) {
      this.bossSpawnTimer -= dt;
      if (this.bossSpawnTimer <= 0) {
        const bossConfig = getBossConfigForStage(this.currentStage);
        this.boss = new Boss(this.width / 2, this.height / 2, bossConfig);
        this.waitingForBoss = false;
        // Boss3进场怒吼（进场前5秒显示）
        if (this.boss.config.roars && this.boss.config.roars.spawn) {
          this.boss.triggerSpawnRoar();
        }
      }
    }

    // Boss关小怪刷新（第三关Boss）
    if (this.boss && this.boss.alive && this.boss.config.bossMinion) {
      this.bossMinionTimer -= dt;
      if (this.bossMinionTimer <= 0) {
        const bm = this.boss.config.bossMinion;
        this.bossMinionTimer = bm.interval;
        const waveCfg = this.waveManager.getCurrentWaveConfig() || { hpMultiplier: 5, damageMultiplier: 2, speedMultiplier: 1.3, expMultiplier: 1.5 };
        for (let i = 0; i < bm.count; i++) {
          const type = bm.types[i % bm.types.length];
          const side = Math.floor(Math.random() * 4);
          const margin = 30;
          let sx, sy;
          switch (side) {
            case 0: sx = Math.random() * this.width; sy = margin; break;
            case 1: sx = Math.random() * this.width; sy = this.height - margin; break;
            case 2: sx = margin; sy = Math.random() * this.height; break;
            default: sx = this.width - margin; sy = Math.random() * this.height; break;
          }
          const nm = new Monster(type, sx, sy, waveCfg, this.currentStage);
          this.monsters.push(nm);
        }
      }
    }

    // Boss怒吼文字更新
    if (this.boss && this.boss.alive) {
      this.boss.updateRoar(dt);
    }



    // === 道具拾取 ===
    const pickupResults = this.dropSystem.processPickup(this.player);
    for (const result of pickupResults) {
      switch (result.type) {
        case 'exp': {
          const levelUps = this.levelSystem.addExp(result.value);
          if (levelUps > 0) this._triggerLevelUp();
          break;
        }
        case 'heal':
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + result.value);
          this.damageSystem._addDamageNumber(this.player.x, this.player.y - 20, result.value, 'heal');
          break;
        case 'atk_up':
          this.player.atkUpTimer = result.duration;
          this.player.atkUpMultiplier = result.multiplier;
          break;
        case 'spd_up':
          this.player.spdUpTimer = result.duration;
          this.player.spdUpMultiplier = result.multiplier;
          break;
        case 'sword_plus':
          if (this.player.tempSwords.length < 3) {
            this.player.tempSwords.push({ timer: result.duration });
            this._rebuildSwords();
          }
          break;
        case 'shield':
          this.player.tempShieldTimer = result.duration;
          this.player.tempShieldActive = true;
          break;
      }
      this.particles.spawnPickupParticles(this.player.x, this.player.y, '#4488ff');
    }

    this.dropSystem.update(dt);
    this.damageSystem.updateDamageNumbers(dt);
    this.particles.update(dt);
    if (this.shakeTimer > 0) this.shakeTimer -= dt;

    // === 升级界面快捷键 ===
    if (this.levelSystem.hasPendingLevelUp() && this.state === STATE.PLAYING) {
      this._triggerLevelUp();
    }

    this.input.resetFrame();
  }

  /**
   * 检测玩家是否在Boss射线范围内
   */
  _isPlayerInRay(rayResult) {
    if (!this.boss) return false;
    const dx = this.player.x - this.boss.x;
    const dy = this.player.y - this.boss.y;
    // 投影到射线方向
    const projLen = dx * rayResult.dirX + dy * rayResult.dirY;
    if (projLen < 0 || projLen > rayResult.range) return false;
    // 垂直距离
    const perpDist = Math.abs(dx * rayResult.dirY - dy * rayResult.dirX);
    return perpDist <= (rayResult.width / 2 + this.player.collisionRadius);
  }

  _onMonsterKilled(monster) {
    this.waveManager.onMonsterKilled();
    this.dropSystem.onMonsterKilled(monster, this.waveManager.getCurrentWaveConfig());
  }

  _triggerLevelUp() {
    this.buffChoices = this.buffSystem.generateChoices(this.levelSystem.getLevel());
    if (this.buffChoices.length > 0) {
      this.state = STATE.LEVEL_UP;
      this.levelSystem.consumeLevelUp();
    } else {
      this.levelSystem.consumeLevelUp();
    }
  }

  selectBuff(buffId) {
    const choice = this.buffChoices ? this.buffChoices.find(c => c.id === buffId) : null;
    const quality = choice ? choice._assignedQuality : undefined;
    this.buffSystem.applyBuff(buffId, this.player, quality);
    this._rebuildSwords();

    if (this.levelSystem.hasPendingLevelUp()) {
      this.buffChoices = this.buffSystem.generateChoices(this.levelSystem.getLevel());
      if (this.buffChoices.length > 0) {
        this.levelSystem.consumeLevelUp();
        return;
      }
    }

    this.buffChoices = [];
    this.state = STATE.PLAYING;
  }

  _rebuildSwords() {
    let baseAngle = 0;
    if (this.swords.length > 0) {
      const old = this.swords[0];
      baseAngle = old.currentAngle - old.angleOffset;
    }

    this.swords = [];
    const total = this.player.getTotalSwordCount();
    const permCount = this.player.swordCount;
    for (let i = 0; i < total; i++) {
      const sword = new RotatingSword(i, total, i >= permCount);
      sword.currentAngle = baseAngle;
      this.swords.push(sword);
    }
  }

  // ============ 渲染 ============

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    switch (this.state) {
      case STATE.TITLE: this._renderTitle(ctx); break;
      case STATE.TEST_MODE: this._renderTitle(ctx); break;
      case STATE.SELECT_HERO: this._renderSelectHero(ctx); break;
      case STATE.PLAYING: case STATE.PAUSED:
        this._renderGame(ctx);
        if (this.state === STATE.PAUSED) this._renderPauseOverlay(ctx);
        break;
      case STATE.LEVEL_UP:
        this._renderGame(ctx);
        this._renderLevelUp(ctx);
        break;
      case STATE.GAME_OVER:
        this._renderGame(ctx);
        this._renderGameOver(ctx);
        break;
      case STATE.VICTORY:
        this._renderGame(ctx);
        this._renderVictory(ctx);
        break;
      case STATE.STAGE_TRANSITION:
        this._renderGame(ctx);
        this._renderStageTransition(ctx);
        break;
    }
  }

  _renderTitle(ctx) {
    const titleBg = getSprite('assets/bg/title/bg.png');
    if (titleBg) {
      ctx.drawImage(titleBg, 0, 0, this.width, this.height);
    } else {
      ctx.drawImage(this.bgCanvas, 0, 0);
    }

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, this.width, this.height);

    const cx = this.width / 2;
    const cy = this.height / 2;

    // 装饰剑光效
    const t = performance.now() * 0.001;
    ctx.save();
    ctx.translate(cx, cy - 100);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + t * 0.3;
      const r = 70 + Math.sin(t + i) * 8;
      ctx.strokeStyle = `rgba(68,136,255,${0.15 + Math.sin(t + i * 0.8) * 0.08})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 20, Math.sin(angle) * 20);
      ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('勇者之剑', cx, cy - 70);

    ctx.fillStyle = '#6688aa';
    ctx.font = '18px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.fillText('Sword of the Brave', cx, cy - 38);

    const lineW = 200;
    const grad = ctx.createLinearGradient(cx - lineW, cy - 18, cx + lineW, cy - 18);
    grad.addColorStop(0, 'rgba(68,136,255,0)');
    grad.addColorStop(0.5, 'rgba(68,136,255,0.6)');
    grad.addColorStop(1, 'rgba(68,136,255,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - lineW, cy - 18);
    ctx.lineTo(cx + lineW, cy - 18);
    ctx.stroke();

    ctx.fillStyle = '#8899aa';
    ctx.font = '14px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.fillText('按住 R + 鼠标方向移动 | 鼠标直接移动 | Esc 暂停', cx, cy + 10);

    const btnW = 240, btnH = 50;
    const btnX = cx - btnW / 2, btnY = cy + 50;
    const pulse = 0.85 + Math.sin(performance.now() * 0.003) * 0.15;

    ctx.fillStyle = `rgba(68,136,255,${0.25 * pulse})`;
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = `rgba(68,136,255,${0.8 * pulse})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(btnX, btnY, btnW, btnH);

    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.fillText('点击开始', cx, btnY + 33);
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#556677';
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillText('v1.0', cx, this.height - 20);

    // 测试通道按钮（右下角小按钮）
    const testBtnW = 100, testBtnH = 28;
    const testBtnX = this.width - testBtnW - 15, testBtnY = this.height - 50;
    const testPulse = 0.7 + Math.sin(performance.now() * 0.004) * 0.15;
    ctx.fillStyle = `rgba(100,60,60,${testPulse})`;
    ctx.fillRect(testBtnX, testBtnY, testBtnW, testBtnH);
    ctx.strokeStyle = 'rgba(180,100,100,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(testBtnX, testBtnY, testBtnW, testBtnH);
    ctx.fillStyle = '#aa8888';
    ctx.font = '12px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('测试通道', testBtnX + testBtnW / 2, testBtnY + 18);
    ctx.textAlign = 'left';
  }

  _renderSelectHero(ctx) {
    const selectBg = getSprite('assets/bg/select_hero/bg.png');
    if (selectBg) {
      ctx.drawImage(selectBg, 0, 0, this.width, this.height);
    } else {
      ctx.drawImage(this.bgCanvas, 0, 0);
    }

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, this.width, this.height);

    const cx = this.width / 2;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('选择你的英雄', cx, 80);

    const cardW = 280, cardH = 420, gap = 40;
    const totalW = HEROES.length * cardW + (HEROES.length - 1) * gap;
    const startX = (this.width - totalW) / 2;
    const startY = 120;
    const mouse = this.input.getMousePosition();

    for (let i = 0; i < HEROES.length; i++) {
      const hero = HEROES[i];
      const cardX = startX + i * (cardW + gap);
      const hovered = mouse.x >= cardX && mouse.x <= cardX + cardW && mouse.y >= startY && mouse.y <= startY + cardH;

      ctx.save();

      const bgAlpha = hero.available ? (hovered ? 0.95 : 0.85) : 0.5;
      ctx.fillStyle = `rgba(20,25,40,${bgAlpha})`;
      const r = 12;
      ctx.beginPath();
      ctx.moveTo(cardX + r, startY);
      ctx.lineTo(cardX + cardW - r, startY);
      ctx.quadraticCurveTo(cardX + cardW, startY, cardX + cardW, startY + r);
      ctx.lineTo(cardX + cardW, startY + cardH - r);
      ctx.quadraticCurveTo(cardX + cardW, startY + cardH, cardX + cardW - r, startY + cardH);
      ctx.lineTo(cardX + r, startY + cardH);
      ctx.quadraticCurveTo(cardX, startY + cardH, cardX, startY + cardH - r);
      ctx.lineTo(cardX, startY + r);
      ctx.quadraticCurveTo(cardX, startY, cardX + r, startY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = hero.available ? hero.color : '#555555';
      ctx.beginPath();
      ctx.moveTo(cardX + r, startY);
      ctx.lineTo(cardX + cardW - r, startY);
      ctx.quadraticCurveTo(cardX + cardW, startY, cardX + cardW, startY + r);
      ctx.lineTo(cardX + cardW, startY + 6);
      ctx.lineTo(cardX, startY + 6);
      ctx.lineTo(cardX, startY + r);
      ctx.quadraticCurveTo(cardX, startY, cardX + r, startY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = hovered && hero.available ? '#ffffff' : (hero.available ? hero.color : '#444444');
      ctx.lineWidth = hovered && hero.available ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(cardX + r, startY);
      ctx.lineTo(cardX + cardW - r, startY);
      ctx.quadraticCurveTo(cardX + cardW, startY, cardX + cardW, startY + r);
      ctx.lineTo(cardX + cardW, startY + cardH - r);
      ctx.quadraticCurveTo(cardX + cardW, startY + cardH, cardX + cardW - r, startY + cardH);
      ctx.lineTo(cardX + r, startY + cardH);
      ctx.quadraticCurveTo(cardX, startY + cardH, cardX, startY + cardH - r);
      ctx.lineTo(cardX, startY + r);
      ctx.quadraticCurveTo(cardX, startY, cardX + r, startY);
      ctx.closePath();
      ctx.stroke();

      const iconCX = cardX + cardW / 2;
      const iconCY = startY + 90;
      const iconR = 50;

      ctx.fillStyle = hero.available ? `rgba(${hero.color === '#4488ff' ? '68,136,255' : hero.color === '#9944cc' ? '153,68,204' : '204,68,68'},0.15)` : 'rgba(80,80,80,0.15)';
      ctx.beginPath();
      ctx.arc(iconCX, iconCY, iconR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = hero.available ? hero.accentColor : '#666666';
      ctx.font = 'bold 44px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(hero.iconChar, iconCX, iconCY + 15);

      ctx.fillStyle = hero.available ? '#ffffff' : '#888888';
      ctx.font = 'bold 24px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.fillText(hero.name, iconCX, startY + 175);

      ctx.fillStyle = hero.available ? '#8899aa' : '#555555';
      ctx.font = '14px "Segoe UI", sans-serif';
      ctx.fillText(hero.subtitle, iconCX, startY + 198);

      ctx.font = '14px "Segoe UI", "Microsoft YaHei", sans-serif';
      const stats = hero.stats;
      let statY = startY + 235;
      const statLabels = { atk: '攻击', def: '防御', spd: '速度', range: '范围' };
      for (const [key, label] of Object.entries(statLabels)) {
        ctx.fillStyle = hero.available ? '#aabbcc' : '#555555';
        ctx.textAlign = 'left';
        ctx.fillText(label, cardX + 40, statY);
        ctx.fillStyle = hero.available ? '#ffdd66' : '#555555';
        ctx.textAlign = 'right';
        ctx.fillText(stats[key], cardX + cardW - 40, statY);
        statY += 24;
      }

      ctx.fillStyle = hero.available ? '#99aabb' : '#555555';
      ctx.font = '13px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      const desc = hero.desc;
      const maxDescW = cardW - 50;
      let dLine = '', dLineY = startY + 345;
      for (const char of desc) {
        const test = dLine + char;
        if (ctx.measureText(test).width > maxDescW) {
          ctx.fillText(dLine, iconCX, dLineY);
          dLine = char; dLineY += 18;
        } else { dLine = test; }
      }
      if (dLine) ctx.fillText(dLine, iconCX, dLineY);

      if (hero.available) {
        const btnW = 140, btnH = 38;
        const btnX = cardX + (cardW - btnW) / 2;
        const btnY = startY + cardH - 55;
        const btnPulse = 0.85 + Math.sin(performance.now() * 0.003) * 0.15;
        ctx.fillStyle = `rgba(68,136,255,${0.3 * btnPulse})`;
        ctx.fillRect(btnX, btnY, btnW, btnH);
        ctx.strokeStyle = `rgba(68,136,255,${0.8 * btnPulse})`;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(btnX, btnY, btnW, btnH);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px "Segoe UI", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('选择', cardX + cardW / 2, btnY + 25);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(cardX + 10, startY + cardH - 65, cardW - 20, 50);
        ctx.fillStyle = '#888888';
        ctx.font = 'bold 18px "Segoe UI", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('即将开放', iconCX, startY + cardH - 33);
      }

      ctx.restore();
    }

    ctx.textAlign = 'left';
  }

  _renderGame(ctx) {
    ctx.save();
    if (this.shakeTimer > 0) {
      const intensity = this.shakeIntensity * (this.shakeTimer / 0.5);
      ctx.translate((Math.random() - 0.5) * intensity, (Math.random() - 0.5) * intensity);
    }
    ctx.drawImage(this.bgCanvas, 0, 0);

    ctx.strokeStyle = 'rgba(68,136,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.player.x, this.player.y, this.player.swordRadius, 0, Math.PI * 2);
    ctx.stroke();

    this.dropSystem.render(ctx);
    for (const monster of this.monsters) monster.render(ctx);
    if (this.boss && this.boss.alive) this.boss.render(ctx);
    const swordSprite = this.player.heroId === 'mage' ? 'assets/sprites/swords/mage/sword_blade.png' : 'assets/sprites/swords/sword_blade.png';
    for (const sword of this.swords) sword.render(ctx, this.player.swordLength, PLAYER_CONFIG.SWORD_WIDTH, swordSprite);
    this.player.render(ctx);

    // 弹道
    for (const proj of this.projectiles) {
      ctx.save();
      ctx.translate(proj.x, proj.y);
      ctx.fillStyle = proj.isBoss ? '#8844cc' : '#9944cc';
      ctx.shadowColor = proj.isBoss ? '#aa66ff' : '#bb66ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, proj.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    this.particles.render(ctx);
    this.damageSystem.renderDamageNumbers(ctx);
    ctx.restore();
    this._renderHUD(ctx);
    // Boss怒吼文字渲染
    if (this.boss && this.boss.alive) {
      this.boss.renderRoar(ctx, this.width, this.height);
    }
  }

  _renderHUD(ctx) {
    const p = this.player;
    // HP条
    const hpW = 300, hpH = 20, hpX = (this.width - hpW) / 2, hpY = 15;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(hpX - 2, hpY - 2, hpW + 4, hpH + 4);
    ctx.fillStyle = '#333';
    ctx.fillRect(hpX, hpY, hpW, hpH);
    let hpR = p.maxHp > 0 ? p.hp / p.maxHp : 0;
    if (isNaN(hpR)) hpR = 0;
    ctx.fillStyle = hpR > 0.5 ? '#44cc44' : hpR > 0.25 ? '#ccaa22' : '#cc4444';
    ctx.fillRect(hpX, hpY, hpW * hpR, hpH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.hp} / ${p.maxHp}`, this.width / 2, hpY + 15);

    // 经验条
    const eW = 200, eH = 8, eX = (this.width - eW) / 2, eY = hpY + hpH + 6;
    ctx.fillStyle = '#222';
    ctx.fillRect(eX, eY, eW, eH);
    ctx.fillStyle = '#4488ff';
    ctx.fillRect(eX, eY, eW * this.levelSystem.getExpProgress(), eH);
    ctx.fillStyle = '#aabbcc';
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillText(`Lv.${this.levelSystem.getLevel()}`, this.width / 2, eY + eH + 14);

    // 底部栏
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, this.height - 35, this.width, 35);
    ctx.fillStyle = '#ccccdd';
    ctx.font = '14px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    const totalWaves = this.waveManager.totalWaves;
    const waveText = this.waitingForBoss || this.boss ? 'BOSS 战' : `波次: ${this.waveManager.currentWave}/${totalWaves}`;
    ctx.fillText(waveText, 20, this.height - 13);
    ctx.fillText(`击杀: ${this.waveManager.totalKills}`, 160, this.height - 13);
    const min = Math.floor(this.survivalTime / 60), sec = Math.floor(this.survivalTime % 60);
    ctx.fillText(`时间: ${min}:${sec.toString().padStart(2, '0')}`, 300, this.height - 13);
    if (this.waveManager.waveActive) {
      const rem = Math.ceil(this.waveManager.getRemainingTime());
      ctx.fillStyle = rem <= 10 ? '#ff6644' : '#ccccdd';
      ctx.fillText(`${rem}s`, 440, this.height - 13);
    }

    // 关卡标识
    const stageName = STAGES[this.currentStage - 1] ? STAGES[this.currentStage - 1].name : `第${this.currentStage}关`;
    ctx.fillStyle = '#8899aa';
    ctx.font = '12px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${stageName}`, this.width - 20, this.height - 13);
    ctx.textAlign = 'left';

    // 右上角 Buff 图标
    const buffDisplay = this.buffSystem.getBuffDisplayList();
    const iconS = 32;
    const iconGap = 3;
    const iconsPerRow = 10;
    const startX = this.width - 15;
    const startY = 50;
    for (let i = 0; i < buffDisplay.length; i++) {
      const b = buffDisplay[i];
      const row = Math.floor(i / iconsPerRow);
      const col = i % iconsPerRow;
      const bx = startX - (col + 1) * (iconS + iconGap);
      const by = startY + row * (iconS + iconGap);

      const qColors = { white: '#cccccc', blue: '#4488ff', purple: '#aa44ff', gold: '#ffcc00' };
      const schoolBg = b.school === 'WEAPON' ? 'rgba(255,68,68,0.7)' :
                        b.school === 'ELEMENT' ? 'rgba(68,136,255,0.7)' :
                        b.school === 'SURVIVAL' ? 'rgba(68,204,68,0.7)' : 'rgba(255,204,0,0.7)';

      ctx.fillStyle = schoolBg;
      ctx.fillRect(bx, by, iconS, iconS);

      ctx.strokeStyle = qColors[b.quality] || '#cccccc';
      ctx.lineWidth = b.quality === 'gold' ? 3 : b.quality === 'purple' ? 2 : 1;
      ctx.strokeRect(bx, by, iconS, iconS);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.name.substring(0, 2), bx + iconS / 2, by + iconS / 2 - 2);

      if (b.level > 0) {
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Lv.${b.level}`, bx + iconS / 2, by + iconS - 3);
      }
    }
    ctx.textAlign = 'left';

    // 法师瞬移技能图标
    if (this.player.heroId === 'mage') {
      const skillX = this.width - 55;
      const skillY = this.height / 2 - 30;
      const skillS = 50;

      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(skillX, skillY, skillS, skillS);
      ctx.strokeStyle = this.player.blinkCooldown > 0 ? '#666666' : '#ff8844';
      ctx.lineWidth = 2;
      ctx.strokeRect(skillX, skillY, skillS, skillS);

      ctx.fillStyle = this.player.blinkCooldown > 0 ? '#888888' : '#ff8844';
      ctx.font = 'bold 22px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('瞬', skillX + skillS / 2, skillY + skillS / 2 + 8);

      if (this.player.blinkCooldown > 0) {
        const cd = this.player.blinkCooldown;
        const maxCd = this.player.heroConfig.SKILL_BLINK_COOLDOWN;
        const ratio = cd / maxCd;

        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.beginPath();
        ctx.moveTo(skillX + skillS / 2, skillY + skillS / 2);
        ctx.arc(
          skillX + skillS / 2,
          skillY + skillS / 2,
          skillS / 2,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * ratio,
          false
        );
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(Math.ceil(cd) + 's', skillX + skillS / 2, skillY + skillS / 2 + 5);
      }

      if (this.player.blinkCasting) {
        const pulse = 0.5 + Math.sin(performance.now() * 0.01) * 0.3;
        ctx.strokeStyle = `rgba(100,180,255,${pulse})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(skillX - 2, skillY - 2, skillS + 4, skillS + 4);
      }

      ctx.fillStyle = '#aaaaaa';
      ctx.font = '10px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('右键瞬移', skillX + skillS / 2, skillY + skillS + 14);

      ctx.restore();
    }

    // 波次提示
    const ann = this.waveManager.getWaveAnnouncement();
    if (ann) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, this.waveManager.announcementTimer);
      ctx.fillText(ann, this.width / 2, this.height / 2 - 40);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }
    if (this.waitingForBoss) {
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 28px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Boss 即将出现...', this.width / 2, this.height / 2 - 40);
      ctx.textAlign = 'left';
    }
  }

  _renderPauseOverlay(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('暂停', this.width / 2, this.height / 2 - 20);
    ctx.fillStyle = '#aaaacc';
    ctx.font = '18px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.fillText('按 Esc 或 P 继续', this.width / 2, this.height / 2 + 20);
    const buffs = this.buffSystem.getOwnedBuffs();
    if (buffs.length > 0) {
      ctx.fillStyle = '#888899';
      ctx.font = '14px "Segoe UI", sans-serif';
      ctx.fillText('当前 Buff:', this.width / 2, this.height / 2 + 60);
      for (let i = 0; i < buffs.length; i++) {
        const stacks = this.buffSystem.getBuffStacks(buffs[i].id);
        ctx.fillText(`${buffs[i].name}${stacks > 1 ? ` x${stacks}` : ''}`, this.width / 2, this.height / 2 + 82 + i * 20);
      }
    }
    ctx.textAlign = 'left';
  }

  _renderLevelUp(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 30px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`升级! Lv.${this.levelSystem.getLevel()}`, this.width / 2, 100);

    if (this.buffChoices.length === 0) {
      this.state = STATE.PLAYING;
      return;
    }

    const cW = 200, cH = 280, gap = 40;
    const totalW = this.buffChoices.length * cW + (this.buffChoices.length - 1) * gap;
    const startX = (this.width - totalW) / 2;
    const startY = (this.height - cH) / 2 - 20;
    const mouse = this.input.getMousePosition();

    const qColors = {
      white: { bg: 'rgba(60,60,70,0.9)', border: '#cccccc' },
      blue: { bg: 'rgba(30,40,80,0.9)', border: '#4488ff' },
      purple: { bg: 'rgba(50,20,70,0.9)', border: '#aa44ff' },
      gold: { bg: 'rgba(60,50,20,0.9)', border: '#ffcc00' },
    };
    const schoolColors = { WEAPON: '#ff4444', ELEMENT: '#4488ff', SURVIVAL: '#44cc44', CONTROL: '#ffcc00' };
    const qNames = { white: '普通', blue: '稀有', purple: '史诗', gold: '传说' };

    for (let i = 0; i < this.buffChoices.length; i++) {
      const buff = this.buffChoices[i];
      const cx = startX + i * (cW + gap);
      const quality = buff._assignedQuality || buff.quality;
      const qc = qColors[quality] || qColors.white;
      const hovered = mouse.x >= cx && mouse.x <= cx + cW && mouse.y >= startY && mouse.y <= startY + cH;

      ctx.fillStyle = hovered ? qc.bg.replace('0.9', '1') : qc.bg;
      ctx.fillRect(cx, startY, cW, cH);
      ctx.strokeStyle = hovered ? '#ffffff' : qc.border;
      ctx.lineWidth = hovered ? 3 : 2;
      ctx.strokeRect(cx, startY, cW, cH);

      ctx.fillStyle = schoolColors[buff.school] || '#888';
      ctx.fillRect(cx, startY, cW, 4);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(buff.name, cx + cW / 2, startY + 40);

      ctx.fillStyle = qc.border;
      ctx.font = '14px "Segoe UI", sans-serif';
      ctx.fillText(qNames[quality] || '普通', cx + cW / 2, startY + 62);

      if (buff._isUpgrade) {
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 14px "Segoe UI", sans-serif';
        ctx.fillText(`Lv.${buff._currentLevel} → Lv.${buff._currentLevel + 1}`, cx + cW / 2, startY + 82);
      } else {
        ctx.fillStyle = '#88cc88';
        ctx.font = '14px "Segoe UI", sans-serif';
        ctx.fillText('新获取', cx + cW / 2, startY + 82);
      }

      ctx.fillStyle = '#ccccdd';
      ctx.font = '14px "Segoe UI", "Microsoft YaHei", sans-serif';
      const desc = buff.description;
      const maxW = cW - 30;
      let line = '', lineY = startY + 108;
      for (const char of desc) {
        const test = line + char;
        if (ctx.measureText(test).width > maxW) {
          ctx.fillText(line, cx + cW / 2, lineY);
          line = char; lineY += 20;
        } else { line = test; }
      }
      if (line) ctx.fillText(line, cx + cW / 2, lineY);

      ctx.fillStyle = '#888899';
      ctx.font = '14px "Segoe UI", sans-serif';
      ctx.fillText(`按 ${i + 1} 或点击选择`, cx + cW / 2, startY + cH - 20);
    }
    ctx.textAlign = 'left';
  }

  _renderGameOver(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 42px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('游戏结束', this.width / 2, this.height / 2 - 80);
    ctx.fillStyle = '#ccccdd';
    ctx.font = '20px "Segoe UI", "Microsoft YaHei", sans-serif';
    const min = Math.floor(this.survivalTime / 60), sec = Math.floor(this.survivalTime % 60);
    ctx.fillText(`存活时间: ${min}分${sec}秒`, this.width / 2, this.height / 2 - 20);
    ctx.fillText(`等级: ${this.levelSystem.getLevel()}`, this.width / 2, this.height / 2 + 15);
    ctx.fillText(`击杀数: ${this.waveManager.totalKills}`, this.width / 2, this.height / 2 + 50);
    ctx.globalAlpha = 0.6 + Math.sin(performance.now() * 0.003) * 0.4;
    ctx.fillStyle = '#44aaff';
    ctx.font = 'bold 22px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.fillText('点击返回角色选择', this.width / 2, this.height / 2 + 120);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  _renderVictory(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, this.width, this.height);

    const cx = this.width / 2;
    const cy = this.height / 2;
    const stageConfig = STAGES[this.currentStage - 1];
    const stageName = stageConfig ? stageConfig.name : `第${this.currentStage}关`;
    const hasNextStage = this.currentStage < STAGES.length;

    // 关卡通关标题
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 42px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${stageName} - 通关!`, cx, cy - 100);

    // 评级
    const t = this.survivalTime;
    let grade = 'S'; if (t > 300) grade = 'A'; if (t > 360) grade = 'B'; if (t > 420) grade = 'C';
    ctx.fillStyle = grade === 'S' ? '#FFD700' : '#ffffff';
    ctx.font = 'bold 60px "Segoe UI", sans-serif';
    ctx.fillText(grade, cx, cy - 20);

    // 统计
    ctx.fillStyle = '#ccccdd';
    ctx.font = '20px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.fillText(`通关时间: ${Math.floor(t / 60)}分${Math.floor(t % 60)}秒`, cx, cy + 30);
    ctx.fillText(`等级: ${this.levelSystem.getLevel()}  |  击杀: ${this.waveManager.totalKills}`, cx, cy + 60);

    // 按钮
    if (hasNextStage) {
      // 继续冒险按钮
      const btnW = 260, btnH = 50;
      const btnX = cx - btnW / 2, btnY = cy + 95;
      const pulse = 0.85 + Math.sin(performance.now() * 0.003) * 0.15;
      ctx.fillStyle = `rgba(255,170,0,${0.3 * pulse})`;
      ctx.fillRect(btnX, btnY, btnW, btnH);
      ctx.strokeStyle = `rgba(255,170,0,${0.9 * pulse})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(btnX, btnY, btnW, btnH);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px "Segoe UI", "Microsoft YaHei", sans-serif';
      const nextStage = STAGES[this.currentStage];
      ctx.fillText(`继续冒险 → ${nextStage.name}`, cx, btnY + 33);
    } else {
      // 返回首页
      ctx.globalAlpha = 0.6 + Math.sin(performance.now() * 0.003) * 0.4;
      ctx.fillStyle = '#44aaff';
      ctx.font = 'bold 22px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.fillText('点击返回首页', cx, cy + 120);
      ctx.globalAlpha = 1;
    }

    ctx.textAlign = 'left';
  }

  _renderStageTransition(ctx) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const nextStage = STAGES[this.currentStage]; // currentStage还没+1，所以这是下一关
    if (!nextStage) return;

    const elapsed = this.stageTransitionDuration - this.stageTransitionTimer;
    const progress = Math.min(1, elapsed / this.stageTransitionDuration);

    // 渐入渐出
    let alpha;
    if (progress < 0.3) {
      alpha = progress / 0.3;
    } else if (progress > 0.7) {
      alpha = (1 - progress) / 0.3;
    } else {
      alpha = 1;
    }

    // 第三关特殊过渡：暗红色 + 警告文字
    const isStage3 = nextStage.id === 3;
    if (isStage3) {
      ctx.fillStyle = `rgba(30,5,5,${0.9 * alpha})`;
      ctx.fillRect(0, 0, this.width, this.height);
    } else {
      ctx.fillStyle = `rgba(0,0,0,${0.85 * alpha})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    ctx.globalAlpha = alpha;

    if (isStage3 && nextStage.warningText) {
      // 第三关：恐怖警告风格
      ctx.fillStyle = '#ff2200';
      ctx.font = 'bold 42px "Microsoft YaHei", "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      const jitter = Math.sin(performance.now() * 0.02) * 3;
      ctx.fillText(nextStage.warningText, cx, cy - 30 + jitter);

      ctx.fillStyle = '#ff6644';
      ctx.font = 'bold 36px "Microsoft YaHei", "Segoe UI", sans-serif';
      ctx.fillText(nextStage.name, cx, cy + 30);

      ctx.fillStyle = '#884422';
      ctx.font = '16px "Microsoft YaHei", sans-serif';
      ctx.fillText(`等级 ${this.levelSystem.getLevel()} 加成已应用`, cx, cy + 75);
    } else {
      // 普通过渡
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 48px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`第 ${nextStage.id} 关`, cx, cy - 40);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.fillText(nextStage.name, cx, cy + 20);

      const completedLevel = this.levelSystem.getLevel();
      const bonus = calculateStageBonus(completedLevel);
      ctx.fillStyle = '#88cc88';
      ctx.font = '16px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.fillText(`等级 ${completedLevel} 加成: 生命+${Math.round((bonus.hpMult - 1) * 100)}% 攻击+${Math.round((bonus.atkMult - 1) * 100)}%`, cx, cy + 65);
    }

    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  handleClick(x, y) {
    if (this.state === STATE.TITLE || this.state === STATE.TEST_MODE) {
      // 检测测试通道按钮
      const testBtnW = 100, testBtnH = 28;
      const testBtnX = this.width - testBtnW - 15, testBtnY = this.height - 50;
      if (x >= testBtnX && x <= testBtnX + testBtnW && y >= testBtnY && y <= testBtnY + testBtnH) {
        this.state = STATE.TEST_MODE;
        this._showTestModeUI();
        return;
      }
      // 标题页点击进入选英雄（测试模式下不响应普通点击）
      if (this.state === STATE.TITLE) {
        this.state = STATE.SELECT_HERO;
      }
    } else if (this.state === STATE.SELECT_HERO) {
      this._handleHeroClick(x, y);
    } else if (this.state === STATE.GAME_OVER) {
      this.selectedHero = null;
      this.state = STATE.SELECT_HERO;
    } else if (this.state === STATE.VICTORY) {
      this._handleVictoryClick(x, y);
    } else if (this.state === STATE.LEVEL_UP) {
      this._handleBuffCardClick(x, y);
    }
  }

  _handleVictoryClick(x, y) {
    const hasNextStage = this.currentStage < STAGES.length;
    if (hasNextStage) {
      // 检测"继续冒险"按钮点击
      const cx = this.width / 2;
      const cy = this.height / 2;
      const btnW = 260, btnH = 50;
      const btnX = cx - btnW / 2, btnY = cy + 95;
      if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
        // 进入关卡过渡
        const nextStage = STAGES[this.currentStage];
        this.stageTransitionTimer = (nextStage && nextStage.id === 3) ? 2.5 : this.stageTransitionDuration;
        this.state = STATE.STAGE_TRANSITION;
      }
    } else {
      // 返回首页
      this.selectedHero = null;
      this.currentStage = 1;
      this.state = STATE.TITLE;
    }
  }

  _handleHeroClick(x, y) {
    const cardW = 280, cardH = 420, gap = 40;
    const totalW = HEROES.length * cardW + (HEROES.length - 1) * gap;
    const startX = (this.width - totalW) / 2;
    const startY = 120;

    for (let i = 0; i < HEROES.length; i++) {
      const hero = HEROES[i];
      if (!hero.available) continue;
      const cardX = startX + i * (cardW + gap);
      if (x >= cardX && x <= cardX + cardW && y >= startY && y <= startY + cardH) {
        this.selectedHero = hero;
        this.startGame();
        return;
      }
    }
  }

  _handleBuffCardClick(x, y) {
    if (this.buffChoices.length === 0) return;
    const cW = 200, cH = 280, gap = 40;
    const totalW = this.buffChoices.length * cW + (this.buffChoices.length - 1) * gap;
    const startX = (this.width - totalW) / 2;
    const startY = (this.height - cH) / 2 - 20;
    for (let i = 0; i < this.buffChoices.length; i++) {
      const cx = startX + i * (cW + gap);
      if (x >= cx && x <= cx + cW && y >= startY && y <= startY + cH) {
        this.selectBuff(this.buffChoices[i].id);
        return;
      }
    }
  }

  getState() { return this.state; }
}
