/**
 * 怪物模板配置
 * 每种怪物的基础数值，波次倍率在 waves.js 中
 */

export const MONSTER_TYPES = {
  NORMAL: {
    id: 'normal',
    name: '普通小怪',
    hp: 20,
    damage: 9,
    speed: 80,
    collisionRadius: 14,
    exp: 5,
    attackRange: 30,
    attackWindup: 0.3,
    attackCooldown: 0.5,
    color: '#888888',
    bodyRadius: 14,
    hasFrontFace: true,
  },
  FAST: {
    id: 'fast',
    name: '快速怪',
    hp: 10,
    damage: 6,
    collisionRadius: 10,
    exp: 8,
    attackRange: 30,
    attackWindup: 0,    // 无前摇，接触即伤害
    attackCooldown: 0.3,
    color: '#ddcc22',
    bodyRadius: 10,
    hasFrontFace: true,
  },
  TANK: {
    id: 'tank',
    name: '坦克怪',
    hp: 50,
    damage: 15,
    speed: 50,
    collisionRadius: 20,
    exp: 12,
    attackRange: 35,
    attackWindup: 0.3,
    attackCooldown: 0.5,
    color: '#cc3333',
    bodyRadius: 20,
    hasFrontFace: true,
    // 冲刺参数
    dashSpeed: 350,
    dashDuration: 0.5,
    dashCooldown: 5,
    dashDamageMultiplier: 1.5,
    dashStunDuration: 1,
    dashStunSpeed: 10,
  },
  BOMBER: {
    id: 'bomber',
    name: '自爆怪',
    hp: 15,
    damage: 36,
    speed: 120,
    collisionRadius: 14,
    exp: 15,
    attackRange: 10,     // 自爆触发距离
    attackWindup: 0,
    attackCooldown: 0,
    color: '#ff8800',
    bodyRadius: 14,
    hasFrontFace: true,
    // 自爆参数
    explosionRadius: 60,
    explosionDelay: 3,
    triggerDistance: 30,
  },
  RANGED: {
    id: 'ranged',
    name: '远程怪',
    hp: 12,
    damage: 12,
    speed: 60,
    collisionRadius: 14,
    exp: 10,
    attackRange: 120,    // 射程
    attackWindup: 0.3,
    attackCooldown: 1.5,
    color: '#9944cc',
    bodyRadius: 14,
    hasFrontFace: true,
    // 弹道参数
    projectileSpeed: 300,
    projectileRadius: 8,
    stopDistance: 120,
  },
};

// 怪物AI状态
export const MONSTER_STATES = {
  IDLE: 'idle',
  CHASE: 'chase',
  ATTACK_WINDUP: 'attack_windup',
  ATTACK: 'attack',
  COOLDOWN: 'cooldown',
  DASHING: 'dashing',
  DASH_STUN: 'dash_stun',
  EXPLODING: 'exploding',
  DEAD: 'dead',
};
