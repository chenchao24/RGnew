/**
 * 怪物实体
 * 包含AI状态机和朝向系统
 */

import { MONSTER_TYPES, MONSTER_STATES } from '../config/monsters.js';
import { BALANCE } from '../config/balance.js';
import { distance, angleTo } from '../utils/MathUtils.js';
import { drawMonsterPlaceholder, getSprite } from '../utils/SpriteManager.js';

let nextMonsterId = 1;

export class Monster {
  constructor(type, x, y, waveConfig) {
    this.id = nextMonsterId++;
    this.template = MONSTER_TYPES[type];
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;

    // 应用波次倍率
    this.hp = Math.round(this.template.hp * waveConfig.hpMultiplier);
    this.maxHp = this.hp;
    this.damage = Math.round(this.template.damage * waveConfig.damageMultiplier);
    this.speed = this.template.speed * waveConfig.speedMultiplier;
    this.exp = Math.round(this.template.exp * waveConfig.expMultiplier);
    this.collisionRadius = this.template.collisionRadius;
    this.attackRange = this.template.attackRange;

    // 朝向
    this.facingAngle = 0;

    // AI状态
    this.state = MONSTER_STATES.IDLE;
    this.stateTimer = 0;
    this.idleDuration = 0.2 + Math.random() * 0.3;

    // 攻击相关
    this.attackWindup = this.template.attackWindup;
    this.attackCooldown = this.template.attackCooldown;

    // 特殊怪参数
    this.dashTimer = 0;
    this.dashCooldownTimer = type === 'TANK' ? this.template.dashCooldown : 0;
    this.dashDirX = 0;
    this.dashDirY = 0;
    this.stunTimer = 0;

    this.explosionTimer = 0;
    this.shootTimer = 0;
    this.shootFlashTimer = 0;

    // 元素状态
    this.fireTimer = 0;
    this.frostTimer = 0;
    this.poisonStacks = 0;
    this.poisonTimer = 0;
    this.slowMultiplier = 1;

    // 击退
    this.knockbackVx = 0;
    this.knockbackVy = 0;
    this.stunDuration = 0;

    // 标记
    this.alive = true;
    this.isSpecial = type !== 'NORMAL';
    this.type = type;
  }

  update(dt, playerX, playerY) {
    if (!this.alive) return;

    // 元素效果tick
    this._updateElements(dt);

    // 击退/眩晕处理
    if (this.stunDuration > 0) {
      this.stunDuration -= dt;
      this.x += this.knockbackVx * dt;
      this.y += this.knockbackVy * dt;
      this.knockbackVx *= 0.9;
      this.knockbackVy *= 0.9;
      return;
    }

    // 射击闪光
    if (this.shootFlashTimer > 0) {
      this.shootFlashTimer -= dt;
    }

    // 朝向玩家
    const dist = distance(this.x, this.y, playerX, playerY);
    this.facingAngle = angleTo(this.x, this.y, playerX, playerY);

    const effectiveSpeed = this.speed * this.slowMultiplier;

    switch (this.state) {
      case MONSTER_STATES.IDLE:
        this.stateTimer += dt;
        if (this.stateTimer >= this.idleDuration) {
          this.state = MONSTER_STATES.CHASE;
        }
        break;

      case MONSTER_STATES.CHASE:
        this._chase(dt, playerX, playerY, effectiveSpeed, dist);
        break;

      case MONSTER_STATES.ATTACK_WINDUP:
        this.stateTimer += dt;
        if (this.stateTimer >= this.attackWindup) {
          this.state = MONSTER_STATES.COOLDOWN;
          this.stateTimer = 0;
          return { attack: true, damage: this.getAttackDamage() };
        }
        break;

      case MONSTER_STATES.ATTACK:
        // 快速怪（windup=0）由 _chase 直接进入此状态
        this.state = MONSTER_STATES.COOLDOWN;
        this.stateTimer = 0;
        return { attack: true, damage: this.getAttackDamage() };

      case MONSTER_STATES.COOLDOWN:
        this.stateTimer += dt;
        if (this.stateTimer >= this.attackCooldown) {
          if (dist <= this.attackRange) {
            this.state = MONSTER_STATES.ATTACK_WINDUP;
          } else {
            this.state = MONSTER_STATES.CHASE;
          }
          this.stateTimer = 0;
        }
        break;

      case MONSTER_STATES.DASHING:
        this.stateTimer += dt;
        this.x += this.dashDirX * this.template.dashSpeed * dt;
        this.y += this.dashDirY * this.template.dashSpeed * dt;
        if (this.stateTimer >= this.template.dashDuration) {
          this.state = MONSTER_STATES.DASH_STUN;
          this.stateTimer = 0;
        }
        break;

      case MONSTER_STATES.DASH_STUN:
        this.stateTimer += dt;
        if (this.stateTimer >= this.template.dashStunDuration) {
          this.state = MONSTER_STATES.CHASE;
          this.stateTimer = 0;
        }
        break;

      case MONSTER_STATES.EXPLODING:
        this.explosionTimer += dt;
        if (this.explosionTimer >= this.template.explosionDelay) {
          this.alive = false;
          return { exploded: true, x: this.x, y: this.y, damage: this.damage };
        }
        break;
    }

    // 坦克怪冲刺逻辑
    if (this.type === 'TANK' && this.state === MONSTER_STATES.CHASE) {
      this.dashCooldownTimer -= dt;
      if (this.dashCooldownTimer <= 0) {
        this._startDash(playerX, playerY);
      }
    }

    // 自爆怪自爆逻辑
    if (this.type === 'BOMBER' && this.state === MONSTER_STATES.CHASE) {
      if (dist <= this.template.triggerDistance) {
        this.state = MONSTER_STATES.EXPLODING;
        this.explosionTimer = 0;
      }
    }

    // 远程怪射击逻辑
    if (this.type === 'RANGED' && this.state === MONSTER_STATES.CHASE) {
      if (dist <= this.template.stopDistance) {
        this.shootTimer += dt;
        if (this.shootTimer >= this.template.attackCooldown) {
          this.shootTimer = 0;
          return { shoot: true, targetX: playerX, targetY: playerY };
        }
      } else {
        this.shootTimer = 0;
      }
    }

    return null;
  }

  _chase(dt, playerX, playerY, speed, dist) {
    // 远程怪在射程内停止
    if (this.type === 'RANGED' && dist <= this.template.stopDistance) {
      return;
    }

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      this.vx = (dx / len) * speed;
      this.vy = (dy / len) * speed;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    // 检测是否进入攻击距离
    if (this.type !== 'RANGED' && this.type !== 'BOMBER' && dist <= this.attackRange) {
      if (this.attackWindup > 0) {
        this.state = MONSTER_STATES.ATTACK_WINDUP;
      } else {
        // 快速怪：接触即伤害
        this.state = MONSTER_STATES.ATTACK;
      }
      this.stateTimer = 0;
    }
  }

  _startDash(playerX, playerY) {
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      this.dashDirX = dx / len;
      this.dashDirY = dy / len;
      this.facingAngle = Math.atan2(dy, dx);
    }
    this.state = MONSTER_STATES.DASHING;
    this.stateTimer = 0;
    this.dashCooldownTimer = this.template.dashCooldown;
  }

  _updateElements(dt) {
    // 灼烧
    if (this.fireTimer > 0) {
      this.fireTimer -= dt;
    }
    // 冰霜减速
    if (this.frostTimer > 0) {
      this.frostTimer -= dt;
      this.slowMultiplier = 1 - BALANCE.FROST_SLOW_PERCENT;
    } else {
      this.slowMultiplier = 1;
    }
    // 中毒
    if (this.poisonStacks > 0) {
      this.poisonTimer -= dt;
      if (this.poisonTimer <= 0) {
        this.poisonTimer = 1; // 每秒tick
      }
    }
  }

  /**
   * 受到伤害
   */
  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
  }

  /**
   * 应用击退
   */
  applyKnockback(distance, duration) {
    const angle = this.facingAngle + Math.PI; // 向后推
    this.knockbackVx = Math.cos(angle) * distance / 0.2;
    this.knockbackVy = Math.sin(angle) * distance / 0.2;
    this.stunDuration = duration;
  }

  /**
   * 检查是否在攻击范围且处于可攻击状态
   */
  isInAttackRange(playerX, playerY) {
    const dist = distance(this.x, this.y, playerX, playerY);
    return dist <= this.attackRange;
  }

  /**
   * 获取当前可造成的伤害
   */
  getAttackDamage() {
    if (this.type === 'TANK' && this.state === MONSTER_STATES.DASHING) {
      return Math.round(this.damage * this.template.dashDamageMultiplier);
    }
    return this.damage;
  }

  render(ctx) {
    if (!this.alive) return;

    // 怪物图片映射：template.id -> { front, back }
    const SPRITE_MAP = {
      normal: { front: 'assets/sprites/monsters/normal_front.png', back: 'assets/sprites/monsters/normal_back.png' },
      fast:   { front: 'assets/sprites/monsters/fast_front.png' },
      tank:   { front: 'assets/sprites/monsters/tank_front.png' },
      bomber: { front: 'assets/sprites/monsters/bomber_front.png' },
      ranged: { front: 'assets/sprites/monsters/ranged_front.png' },
    };

    const spriteInfo = SPRITE_MAP[this.template.id];
    if (spriteInfo) {
      const frontImg = spriteInfo.front ? getSprite(spriteInfo.front) : null;
      const backImg = spriteInfo.back ? getSprite(spriteInfo.back) : null;
      const img = frontImg || backImg;
      if (img) {
        const r = this.template.bodyRadius;
        const drawSize = r * 2.8;
        ctx.save();
        ctx.translate(this.x, this.y);

        // 自爆怪脉冲效果
        if (this.template.id === 'bomber' && this.state === 'exploding') {
          ctx.globalAlpha = 0.5 + Math.sin(performance.now() * 0.01 * (3 + this.explosionTimer * 2)) * 0.5;
        }

        // 朝向玩家，旋转图片
        ctx.rotate(this.facingAngle);
        ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
        ctx.rotate(-this.facingAngle);

        // 血条（受伤后显示，不旋转）
        if (this.hp < this.maxHp) {
          const barWidth = r * 2;
          const barHeight = 3;
          const barY = -drawSize / 2 - 4;
          ctx.fillStyle = '#333';
          ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);
          ctx.fillStyle = this.hp > this.maxHp * 0.3 ? '#44cc44' : '#cc4444';
          ctx.fillRect(-barWidth / 2, barY, barWidth * (this.hp / this.maxHp), barHeight);
        }

        ctx.restore();
        return;
      }
    }

    // 无图片资源，使用占位绘制
    drawMonsterPlaceholder(ctx, this);
  }
}
