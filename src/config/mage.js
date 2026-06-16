/**
 * 法师角色属性配置
 * 基于圣骑士配置，速度降低20%，攻击范围提高20%
 */

export const MAGE_CONFIG = {
  // === 基础属性 ===
  HP: 100,
  MOVE_SPEED: 160,         // 圣骑士200 * 0.8 = 160
  DODGE_CHANCE: 0.05,
  COLLISION_RADIUS: 12,

  // === 旋转剑（法师专属法杖） ===
  SWORD_COUNT: 1,
  SWORD_RADIUS: 60,        // 圣骑士50 * 1.2 = 60
  SWORD_ROTATION_SPEED: 180,
  SWORD_DAMAGE: 10,
  SWORD_COOLDOWN: 0.5,
  SWORD_LENGTH: 36,
  SWORD_WIDTH: 8,
  SWORD_HIT_RADIUS: 16,

  // === 拾取 ===
  PICKUP_RANGE: 30,

  // === 移动手感 ===
  MOVE_ACCEL: 1200,
  MOVE_DECEL: 800,
  TURN_SPEED: 15,
  MOUSE_FOLLOW_SMOOTH: 8,

  // === 专属技能：瞬移 ===
  SKILL_BLINK_COOLDOWN: 40,   // 40秒冷却
  SKILL_BLINK_CAST_TIME: 1,   // 1秒读条
  SKILL_BLINK_MIN_DISTANCE: 200, // 最小传送距离
  SKILL_BLINK_MAX_DISTANCE: 400, // 最大传送距离

  // === 角色标识 ===
  HERO_ID: 'mage',
  SWORD_SPRITE: 'assets/sprites/swords/mage/sword_blade.png',
  PLAYER_SPRITES: {
    front: 'assets/sprites/mage/mage_front.png',
    back: 'assets/sprites/mage/mage_back.png',
    side: 'assets/sprites/mage/mage_side.png',
  },
};
