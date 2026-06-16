/**
 * 关卡配置
 * 每个关卡定义波次数量、Boss、背景等参数
 * 支持无限扩展新关卡
 */

export const STAGES = [
  {
    id: 1,
    name: '暗影荒原',
    subtitle: 'Shadow Wasteland',
    background: 'assets/bg/ground.png',
    waveCount: 6,
    bossId: 'shadow_amalgam',
  },
  {
    id: 2,
    name: '熔岩深渊',
    subtitle: 'Molten Abyss',
    background: 'assets/bg/stage2/ground.png',
    waveCount: 10,
    bossId: 'molten_behemoth',
  },
];

/**
 * 跨关卡等级加成方案
 * 通关时角色等级 → 下一关全属性百分比加成
 * 主属性(HP/ATK): 每级 +0.5%
 * 副属性(速度/闪避/范围): 每级 +0.3%
 */
export const STAGE_BONUS_RATES = {
  major: 0.005,  // 0.5% per level (HP, damage)
  minor: 0.003,  // 0.3% per level (speed, dodge, range)
};

/**
 * 根据完成关卡时的等级计算下一关的属性加成
 * @param {number} level - 完成上一关时的角色等级
 * @returns {{ hpMult, atkMult, spdMult, dodgeMult, rangeMult }}
 */
export function calculateStageBonus(level) {
  return {
    hpMult: 1 + level * STAGE_BONUS_RATES.major,
    atkMult: 1 + level * STAGE_BONUS_RATES.major,
    spdMult: 1 + level * STAGE_BONUS_RATES.minor,
    dodgeMult: 1 + level * STAGE_BONUS_RATES.minor,
    rangeMult: 1 + level * STAGE_BONUS_RATES.minor,
  };
}

/**
 * Buff上限随关卡增长的配置
 * 公式: base + (stageIndex - 1) * perStage
 */
export const CAP_SCALING = {
  MAX_HP: { base: 500, perStage: 150 },
  MAX_SWORD_COUNT: { base: 8, perStage: 2 },
  MAX_SWORD_LENGTH: { base: 80, perStage: 15 },
  MAX_SWORD_RADIUS: { base: 200, perStage: 50 },
  MAX_CRIT_CHANCE: { base: 0.60, perStage: 0.10 },
  MAX_ROTATION_SPEED: { base: 540, perStage: 60 },
  MAX_SWORD_HIT_RADIUS: { base: 40, perStage: 5 },
};

/**
 * 获取指定关卡的Buff上限
 * @param {string} capName - 上限名称（CAP_SCALING的key）
 * @param {number} stageIndex - 关卡索引（1-based）
 * @returns {number} 上限值
 */
export function getCapForStage(capName, stageIndex) {
  const scaling = CAP_SCALING[capName];
  if (!scaling) return undefined;
  return scaling.base + (stageIndex - 1) * scaling.perStage;
}
