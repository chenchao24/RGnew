/**
 * Boss 配置
 * 包含所有Boss的定义，数据驱动设计
 */

// ============================================================
// 暗影聚合体 (Shadow Amalgam) - 第一关Boss，三阶段
// ============================================================
export const BOSS_CONFIG = {
  name: '暗影聚合体',
  hp: 2500,
  damage: 108,
  speed: 70,
  collisionRadius: 36,
  attackRange: 50,
  attackWindup: 0.5,
  attackCooldown: 1.0,
  exp: 200,
  dodgeChance: 0,

  // 视觉
  color: '#6622aa',
  bodyRadius: 36,
  coreColor: '#9944dd',

  // 登场
  spawnDuration: 1.5,

  // 阶段阈值（HP百分比，从高到低）
  phaseThresholds: [0.60, 0.25],

  // 阶段转换
  phaseTransition: {
    invincibleTime: 0.5,
    shakeDuration: 0.3,
    shakeIntensity: 8,
  },

  // 阶段1: 100% → 60% 追逐+冲刺
  phase1: {
    speedMultiplier: 1.0,
    damageMultiplier: 1.0,
    dash: { speed: 400, duration: 1, windup: 0.8, pause: 0.5, cooldown: 5 },
  },

  // 阶段2: 60% → 25% 追逐+冲刺+弹幕
  phase2: {
    speedMultiplier: 1.0,
    damageMultiplier: 1.0,
    dash: { speed: 400, duration: 1, windup: 0.8, pause: 0.5, cooldown: 3 },
    barrage: { count: 6, speed: 200, damage: 15, radius: 8, cooldown: 8, windup: 0.6 },
  },

  // 阶段3: 25% → 0% 狂暴
  phase3: {
    speedMultiplier: 1.3,
    damageMultiplier: 1.5,
    dash: { speed: 400, duration: 1, windup: 0.8, pause: 0.5, cooldown: 2.5 },
    barrage: { count: 8, speed: 200, damage: 15, radius: 8, cooldown: 8, windup: 0.6 },
    summon: { interval: 12, count: 4 },
    color: '#992222',
    smokeColor: 'rgba(50,0,0,0.6)',
  },

  // 精灵路径
  sprites: {
    1: 'assets/sprites/boss/boss_idle.png',
    2: 'assets/sprites/boss/boss_phase2.png',
    3: 'assets/sprites/boss/boss_phase3.png',
  },
};

// ============================================================
// 熔岩巨兽 (Molten Behemoth) - 第二关Boss，两阶段
// 高血量、高攻击、中速、弹幕+射线
// ============================================================
export const BOSS2_CONFIG = {
  name: '熔岩巨兽',
  hp: 8000,
  damage: 280,
  speed: 85,
  collisionRadius: 40,
  attackRange: 55,
  attackWindup: 0.5,
  attackCooldown: 0.9,
  exp: 400,
  dodgeChance: 0,

  // 视觉
  color: '#cc4400',
  bodyRadius: 40,
  coreColor: '#ff6600',

  // 登场
  spawnDuration: 1.5,

  // 阶段阈值
  phaseThresholds: [0.40],

  // 阶段转换
  phaseTransition: {
    invincibleTime: 0.5,
    shakeDuration: 0.3,
    shakeIntensity: 10,
  },

  // 阶段1: 100% → 40% 追逐+弹幕+召唤
  phase1: {
    speedMultiplier: 1.0,
    damageMultiplier: 1.0,
    barrage: { count: 10, speed: 220, damage: 35, radius: 10, cooldown: 4.5, windup: 0.8 },
    summon: { interval: 10, count: 10, intervalDecay: 0.5, minInterval: 3 },
  },

  // 阶段2: 40% → 0% 加速+弹幕+射线+召唤
  phase2: {
    speedMultiplier: 1.5,
    damageMultiplier: 1.8,
    barrage: { count: 16, speed: 240, damage: 45, radius: 12, cooldown: 3, windup: 0.6 },
    ray: { cooldown: 8, windup: 1.2, duration: 2.0, width: 36, damage: 70, range: 600 },
    summon: { interval: 8, count: 12, intervalDecay: 0.5, minInterval: 2 },
    color: '#ff2200',
  },

  // 精灵路径
  sprites: {
    1: 'assets/sprites/boss2/boss_idle.png',
    2: 'assets/sprites/boss2/boss_phase2.png',
  },
};

// ============================================================
// 地狱领主 (Hell Lord) - 第三关Boss，两阶段
// 超高血量、高速度、高伤害、三大技能随机轮转
// ============================================================
export const BOSS3_CONFIG = {
  name: '地狱领主',
  hp: 15000,
  damage: 350,
  speed: 100,
  collisionRadius: 45,
  attackRange: 55,
  attackWindup: 0.5,
  attackCooldown: 0.8,
  exp: 800,
  dodgeChance: 0,

  // 视觉
  color: '#aa1100',
  bodyRadius: 45,
  coreColor: '#ff4400',

  // 登场
  spawnDuration: 2.0,

  // 阶段阈值
  phaseThresholds: [0.20],

  // 阶段转换
  phaseTransition: {
    invincibleTime: 1.0,
    shakeDuration: 0.5,
    shakeIntensity: 15,
  },

  // 阶段1: 100% → 20% 追逐+三大技能轮转
  phase1: {
    speedMultiplier: 1.0,
    damageMultiplier: 1.0,
    skillCooldown: 6,
    crossWave: {
      beamCount: 4, beamWidth: 38, beamRange: 900, beamDuration: 2.0,
      beamDamage: 55, tickInterval: 0.3, windup: 1.0,
      projectileCount: 16, projectileSpeed: 260, projectileDamage: 30, projectileRadius: 10,
    },
    meteorRain: { count: 6, damage: 55, aoeRadius: 55, warnTime: 1.2, interval: 0.25, spreadRadius: 130, shakeIntensity: 8, shakeDuration: 0.15, sprite: 'assets/sprites/effects/meteor/meteor_fall.png' },
    flameAura: { duration: 4, radius: 100, dps: 25, tickInterval: 0.5 },
  },

  // 阶段2: 20% → 0% 狂暴，体型变大，技能更强更快
  phase2: {
    speedMultiplier: 1.6,
    damageMultiplier: 2.0,
    skillCooldown: 4,
    crossWave: {
      beamCount: 8, beamWidth: 44, beamRange: 900, beamDuration: 2.5,
      beamDamage: 75, tickInterval: 0.25, windup: 0.8,
      projectileCount: 24, projectileSpeed: 300, projectileDamage: 40, projectileRadius: 12,
    },
    meteorRain: { count: 10, damage: 75, aoeRadius: 65, warnTime: 1.0, interval: 0.18, spreadRadius: 160, shakeIntensity: 12, shakeDuration: 0.15, sprite: 'assets/sprites/effects/meteor/meteor_fall.png' },
    flameAura: { duration: 5, radius: 140, dps: 40, tickInterval: 0.5 },
    color: '#ff0000',
    bodyRadius: 70,
  },

  // Boss关小怪刷新
  bossMinion: {
    interval: 6,
    count: 10,
    types: ['NORMAL', 'NORMAL', 'NORMAL', 'FAST', 'FAST', 'SHOCKER'],
  },

  // 怒吼语言（每隔一个技能喊一次）
  roars: {
    spawn: { text: '体验绝望吧，冒险者，你将葬身于此！', duration: 5.5 },
    crossWave: { text: '凡人，颤抖吧，审判之光！', duration: 4.0 },
    meteorRain: { text: '感受地狱的愤怒吧，该死的蝼蚁！', duration: 4.0 },
    flameAura: { text: '死远点，该死的臭虫！', duration: 4.0 },
  },

  // 精灵路径
  sprites: {
    1: 'assets/sprites/boss3/boss_idle.png',
    2: 'assets/sprites/boss3/boss_phase2.png',
  },
};

/**
 * 获取指定关卡的Boss配置
 * @param {number} stageIndex - 关卡索引（1-based）
 * @returns {object} Boss配置
 */
export function getBossConfigForStage(stageIndex) {
  const bossMap = {
    1: BOSS_CONFIG,
    2: BOSS2_CONFIG,
    3: BOSS3_CONFIG,
  };
  return bossMap[stageIndex] || BOSS_CONFIG;
}

// Boss AI 状态
export const BOSS_STATES = {
  SPAWNING: 'spawning',
  CHASE: 'chase',
  DASH_WINDUP: 'dash_windup',
  DASHING: 'dashing',
  DASH_PAUSE: 'dash_pause',
  ATTACK_WINDUP: 'attack_windup',
  ATTACK: 'attack',
  COOLDOWN: 'cooldown',
  BARRAGE_WINDUP: 'barrage_windup',
  BARRAGE: 'barrage',
  RAY_WINDUP: 'ray_windup',
  RAY: 'ray',
  CROSSWAVE_WINDUP: 'crosswave_windup',
  CROSSWAVE: 'crosswave',
  METEOR_WINDUP: 'meteor_windup',
  METEOR: 'meteor',
  FLAME_AURA: 'flame_aura',
  PHASE_TRANSITION: 'phase_transition',
  SUMMON: 'summon',
  DEAD: 'dead',
};
