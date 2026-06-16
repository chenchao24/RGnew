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

/**
 * 获取指定关卡的Boss配置
 * @param {number} stageIndex - 关卡索引（1-based）
 * @returns {object} Boss配置
 */
export function getBossConfigForStage(stageIndex) {
  const bossMap = {
    1: BOSS_CONFIG,
    2: BOSS2_CONFIG,
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
  PHASE_TRANSITION: 'phase_transition',
  SUMMON: 'summon',
  DEAD: 'dead',
};
