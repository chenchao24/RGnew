/**
 * 角色属性配置
 * 所有基础值和上限集中管理，方便调整平衡
 */

export const PLAYER_CONFIG = {
  // === 基础属性 ===
  HP: 100,
  MOVE_SPEED: 200,        // px/s
  DODGE_CHANCE: 0.05,
  COLLISION_RADIUS: 12,

  // === 旋转剑 ===
  SWORD_COUNT: 1,
  SWORD_RADIUS: 50,       // 角色到剑的距离
  SWORD_ROTATION_SPEED: 180, // 度/秒
  SWORD_DAMAGE: 10,
  SWORD_COOLDOWN: 0.5,    // 同一把剑对同一怪物的CD
  SWORD_LENGTH: 36,       // 剑的可视长度
  SWORD_WIDTH: 8,         // 剑的可视宽度
  SWORD_HIT_RADIUS: 16,   // 剑尖碰撞半径

  // === 拾取 ===
  PICKUP_RANGE: 30,

  // === 移动手感 ===
  MOVE_ACCEL: 1200,       // 加速度 px/s²
  MOVE_DECEL: 800,        // 减速度 px/s²
  TURN_SPEED: 15,         // 转向插值因子(越大越快)
  MOUSE_FOLLOW_SMOOTH: 8, // 纯鼠标模式跟随平滑度

  // === 属性上限 ===
  MAX_HP: 500,
  MAX_MOVE_SPEED: 500,
  MAX_DODGE: 0.75,
  MAX_SWORD_COUNT: 8,
  MAX_SWORD_LENGTH: 80,
  MAX_SWORD_HIT_RADIUS: 40,
  MAX_SWORD_RADIUS: 200,
  MAX_ROTATION_SPEED: 540,
  MAX_CRIT_CHANCE: 0.60,
  MAX_MULTI_TARGET: 4,
  MAX_HP_REGEN: 15,       // 每5秒
  MAX_LIFESTEAL: 0.30,
  MAX_SHIELD_STACKS: 3,
  MAX_KNOCKBACK: 150,
  MAX_ELEMENT_MASTERY: 1.5, // +150%
};
