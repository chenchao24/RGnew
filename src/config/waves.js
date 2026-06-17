/**
 * 波次配置
 * 每波的怪物数量、倍率等参数
 * 支持多关卡波次配置
 */

// === 第一关波次配置（硬编码，保持平衡不变） ===
export const WAVE_CONFIG = [
  { // 第1波
    wave: 1,
    monsterCount: 23,
    specialRatio: 0,
    hpMultiplier: 1.0,
    damageMultiplier: 1.0,
    speedMultiplier: 1.0,
    expMultiplier: 1.0,
  },
  { // 第2波
    wave: 2,
    monsterCount: 30,
    specialRatio: 0.15,
    hpMultiplier: 1.2,
    damageMultiplier: 1.1,
    speedMultiplier: 1.05,
    expMultiplier: 1.1,
  },
  { // 第3波
    wave: 3,
    monsterCount: 38,
    specialRatio: 0.30,
    hpMultiplier: 1.5,
    damageMultiplier: 1.2,
    speedMultiplier: 1.1,
    expMultiplier: 1.2,
  },
  { // 第4波
    wave: 4,
    monsterCount: 45,
    specialRatio: 0.40,
    hpMultiplier: 1.8,
    damageMultiplier: 1.35,
    speedMultiplier: 1.15,
    expMultiplier: 1.3,
  },
  { // 第5波
    wave: 5,
    monsterCount: 57,
    specialRatio: 0.50,
    hpMultiplier: 2.2,
    damageMultiplier: 1.5,
    speedMultiplier: 1.2,
    expMultiplier: 1.4,
  },
  { // 第6波
    wave: 6,
    monsterCount: 68,
    specialRatio: 0.60,
    hpMultiplier: 2.8,
    damageMultiplier: 1.7,
    speedMultiplier: 1.25,
    expMultiplier: 1.5,
  },
];

// === 第二关波次配置 ===
// 初始强度+20%，增强比率+10%，共10波
export const STAGE2_WAVE_CONFIG = [
  { wave: 1,  monsterCount: 28,  specialRatio: 0.10, hpMultiplier: 1.20, damageMultiplier: 1.20, speedMultiplier: 1.10, expMultiplier: 1.20 },
  { wave: 2,  monsterCount: 38,  specialRatio: 0.17, hpMultiplier: 1.42, damageMultiplier: 1.31, speedMultiplier: 1.16, expMultiplier: 1.31 },
  { wave: 3,  monsterCount: 48,  specialRatio: 0.24, hpMultiplier: 1.75, damageMultiplier: 1.42, speedMultiplier: 1.21, expMultiplier: 1.42 },
  { wave: 4,  monsterCount: 58,  specialRatio: 0.31, hpMultiplier: 2.08, damageMultiplier: 1.59, speedMultiplier: 1.27, expMultiplier: 1.53 },
  { wave: 5,  monsterCount: 68,  specialRatio: 0.38, hpMultiplier: 2.52, damageMultiplier: 1.75, speedMultiplier: 1.32, expMultiplier: 1.64 },
  { wave: 6,  monsterCount: 78,  specialRatio: 0.45, hpMultiplier: 3.18, damageMultiplier: 1.97, speedMultiplier: 1.38, expMultiplier: 1.75 },
  { wave: 7,  monsterCount: 88,  specialRatio: 0.52, hpMultiplier: 3.62, damageMultiplier: 2.15, speedMultiplier: 1.43, expMultiplier: 1.86 },
  { wave: 8,  monsterCount: 98,  specialRatio: 0.59, hpMultiplier: 4.12, damageMultiplier: 2.35, speedMultiplier: 1.49, expMultiplier: 1.97 },
  { wave: 9,  monsterCount: 108, specialRatio: 0.66, hpMultiplier: 4.70, damageMultiplier: 2.57, speedMultiplier: 1.54, expMultiplier: 2.08 },
  { wave: 10, monsterCount: 118, specialRatio: 0.73, hpMultiplier: 5.38, damageMultiplier: 2.81, speedMultiplier: 1.60, expMultiplier: 2.19 },
];

// === 第三关波次配置 ===
// 大幅强化，1-6波有外围增援，经验倍率最高2.0
export const STAGE3_WAVE_CONFIG = [
  { wave: 1,  monsterCount: 48,  specialRatio: 0.20, hpMultiplier: 2.50, damageMultiplier: 1.60, speedMultiplier: 1.20, expMultiplier: 1.30, reinforcement: { count: 8, delay: 3.5 } },
  { wave: 2,  monsterCount: 58,  specialRatio: 0.25, hpMultiplier: 3.00, damageMultiplier: 1.80, speedMultiplier: 1.25, expMultiplier: 1.40, reinforcement: { count: 10, delay: 3.5 } },
  { wave: 3,  monsterCount: 70,  specialRatio: 0.30, hpMultiplier: 3.60, damageMultiplier: 2.00, speedMultiplier: 1.30, expMultiplier: 1.50, reinforcement: { count: 12, delay: 3.5 } },
  { wave: 4,  monsterCount: 83,  specialRatio: 0.35, hpMultiplier: 4.30, damageMultiplier: 2.25, speedMultiplier: 1.35, expMultiplier: 1.60, reinforcement: { count: 14, delay: 3.5 } },
  { wave: 5,  monsterCount: 96,  specialRatio: 0.40, hpMultiplier: 5.20, damageMultiplier: 2.55, speedMultiplier: 1.40, expMultiplier: 1.70, reinforcement: { count: 16, delay: 3.5 } },
  { wave: 6,  monsterCount: 110, specialRatio: 0.45, hpMultiplier: 6.20, damageMultiplier: 2.85, speedMultiplier: 1.45, expMultiplier: 1.80, reinforcement: { count: 18, delay: 3.5 } },
  { wave: 7,  monsterCount: 125, specialRatio: 0.50, hpMultiplier: 7.40, damageMultiplier: 3.20, speedMultiplier: 1.50, expMultiplier: 1.85 },
  { wave: 8,  monsterCount: 138, specialRatio: 0.55, hpMultiplier: 8.80, damageMultiplier: 3.60, speedMultiplier: 1.55, expMultiplier: 1.90 },
  { wave: 9,  monsterCount: 152, specialRatio: 0.60, hpMultiplier: 10.50, damageMultiplier: 4.05, speedMultiplier: 1.60, expMultiplier: 1.95 },
  { wave: 10, monsterCount: 168, specialRatio: 0.65, hpMultiplier: 12.50, damageMultiplier: 4.55, speedMultiplier: 1.65, expMultiplier: 2.00 },
];

// 所有关卡波次配置表（按关卡索引，1-based）
const ALL_STAGE_WAVES = [WAVE_CONFIG, STAGE2_WAVE_CONFIG, STAGE3_WAVE_CONFIG];

/**
 * 获取指定关卡的波次配置
 * @param {number} stageIndex - 关卡索引（1-based）
 * @returns {Array} 波次配置数组
 */
export function getWaveConfigsForStage(stageIndex) {
  if (stageIndex >= 1 && stageIndex <= ALL_STAGE_WAVES.length) {
    return ALL_STAGE_WAVES[stageIndex - 1];
  }
  // 超出已有配置时，使用最后一关配置
  return ALL_STAGE_WAVES[ALL_STAGE_WAVES.length - 1];
}

/**
 * 获取指定关卡的总波数
 */
export function getWaveCountForStage(stageIndex) {
  const configs = getWaveConfigsForStage(stageIndex);
  return configs.length;
}

// 向后兼容
export const TOTAL_WAVES = WAVE_CONFIG.length;

// 特殊怪类型列表（从普通怪中替换）
export const SPECIAL_MONSTER_TYPES = ['FAST', 'TANK', 'BOMBER', 'RANGED', 'SHOCKER', 'GOLEM'];

/**
 * 获取指定关卡/波次的特殊怪类型池
 * @param {number} stageIndex - 关卡索引（1-based）
 * @param {number} wave - 波次（1-based）
 * @returns {Array} 可用特殊怪类型列表
 */
export function getSpecialTypesForWave(stageIndex, wave) {
  if (stageIndex <= 1) {
    return ['FAST', 'TANK', 'BOMBER', 'RANGED'];
  }
  if (stageIndex === 2) {
    return ['FAST', 'TANK', 'BOMBER', 'RANGED'];
  }
  // 第三关：根据波次递增开放
  if (wave <= 3) return ['FAST', 'TANK', 'BOMBER', 'RANGED', 'SHOCKER'];
  if (wave <= 6) return ['FAST', 'TANK', 'BOMBER', 'RANGED', 'SHOCKER'];
  return ['FAST', 'TANK', 'BOMBER', 'RANGED', 'SHOCKER', 'GOLEM'];
}
