/**
 * Boss 实体 - 通用数据驱动Boss
 * 支持多阶段AI，根据配置决定可用技能
 */

import { BOSS_STATES } from '../config/boss.js';
import { BALANCE } from '../config/balance.js';
import { distance, angleTo } from '../utils/MathUtils.js';
import { drawBossPlaceholder, getSprite } from '../utils/SpriteManager.js';

export class Boss {
  constructor(x, y, config) {
    this.config = config;
    this.x = x;
    this.y = y;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.damage = config.damage;
    this.speed = config.speed;
    this.collisionRadius = config.collisionRadius;
    this.attackRange = config.attackRange;
    this.exp = config.exp;
    this.name = config.name;
    this.bodyRadius = config.bodyRadius;

    this.facingAngle = 0;
    this.alive = true;
    this.phase = 1;
    this.state = BOSS_STATES.SPAWNING;
    this.stateTimer = 0;

    // 技能冷却
    const pc = this._getPhaseConfig();
    this.dashCooldownTimer = pc.dash ? pc.dash.cooldown : 999;
    this.barrageCooldownTimer = pc.barrage ? pc.barrage.cooldown : 999;
    this.rayCooldownTimer = pc.ray ? pc.ray.cooldown : 999;
    this.summonTimer = 0;

    // 冲刺
    this.dashDirX = 0;
    this.dashDirY = 0;

    // 射线
    this.rayDirX = 0;
    this.rayDirY = 0;
    this.rayTimer = 0;
    this.rayDamageTimer = 0;

    // 无敌
    this.invincible = false;

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
  }

  _getPhaseConfig() {
    return this.config[`phase${this.phase}`] || {};
  }

  _getPhaseSpeedMult() {
    return this._getPhaseConfig().speedMultiplier || 1;
  }

  _getPhaseDamageMult() {
    return this._getPhaseConfig().damageMultiplier || 1;
  }

  update(dt, playerX, playerY) {
    if (!this.alive) return null;

    this._checkPhaseTransition();

    // 击退/眩晕
    if (this.stunDuration > 0) {
      this.stunDuration -= dt;
      this.x += this.knockbackVx * dt;
      this.y += this.knockbackVy * dt;
      this.knockbackVx *= 0.9;
      this.knockbackVy *= 0.9;
      return null;
    }

    // 元素效果
    this._updateElements(dt);

    // 朝向玩家
    this.facingAngle = angleTo(this.x, this.y, playerX, playerY);
    const dist = distance(this.x, this.y, playerX, playerY);
    const effectiveSpeed = this.speed * this.slowMultiplier;
    const phaseSpeedMult = this._getPhaseSpeedMult();
    const phaseDamageMult = this._getPhaseDamageMult();

    switch (this.state) {
      case BOSS_STATES.SPAWNING:
        this.stateTimer += dt;
        if (this.stateTimer >= this.config.spawnDuration) {
          this.state = BOSS_STATES.CHASE;
          this.stateTimer = 0;
        }
        break;

      case BOSS_STATES.PHASE_TRANSITION:
        this.stateTimer += dt;
        if (this.stateTimer >= this.config.phaseTransition.invincibleTime) {
          this.invincible = false;
          this.state = BOSS_STATES.CHASE;
          this.stateTimer = 0;
          // 重置新阶段的冷却
          const pc = this._getPhaseConfig();
          if (pc.dash) this.dashCooldownTimer = pc.dash.cooldown;
          if (pc.barrage) this.barrageCooldownTimer = pc.barrage.cooldown;
          if (pc.ray) this.rayCooldownTimer = pc.ray.cooldown;
        }
        break;

      case BOSS_STATES.CHASE: {
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          this.x += (dx / len) * effectiveSpeed * phaseSpeedMult * dt;
          this.y += (dy / len) * effectiveSpeed * phaseSpeedMult * dt;
        }

        const pc = this._getPhaseConfig();

        // 冲刺检测
        if (pc.dash) {
          this.dashCooldownTimer -= dt;
          if (this.dashCooldownTimer <= 0) {
            this.state = BOSS_STATES.DASH_WINDUP;
            this.stateTimer = 0;
            const len2 = Math.sqrt(dx * dx + dy * dy);
            this.dashDirX = len2 > 0 ? dx / len2 : 1;
            this.dashDirY = len2 > 0 ? dy / len2 : 0;
            break;
          }
        }

        // 弹幕检测
        if (pc.barrage) {
          this.barrageCooldownTimer -= dt;
          if (this.barrageCooldownTimer <= 0) {
            this.state = BOSS_STATES.BARRAGE_WINDUP;
            this.stateTimer = 0;
            break;
          }
        }

        // 射线检测
        if (pc.ray) {
          this.rayCooldownTimer -= dt;
          if (this.rayCooldownTimer <= 0) {
            this.state = BOSS_STATES.RAY_WINDUP;
            this.stateTimer = 0;
            // 锁定射线方向
            this.rayDirX = len > 0 ? dx / len : 1;
            this.rayDirY = len > 0 ? dy / len : 0;
            break;
          }
        }

        // 召唤检测
        if (pc.summon) {
          this.summonTimer += dt;
          if (this.summonTimer >= pc.summon.interval) {
            this.summonTimer = 0;
            return { summon: true, count: pc.summon.count };
          }
        }

        // 近战攻击
        if (dist <= this.attackRange) {
          this.state = BOSS_STATES.ATTACK_WINDUP;
          this.stateTimer = 0;
        }
        break;
      }

      case BOSS_STATES.DASH_WINDUP:
        this.stateTimer += dt;
        if (this.stateTimer >= this.config.phase1.dash.windup) {
          this.state = BOSS_STATES.DASHING;
          this.stateTimer = 0;
        }
        break;

      case BOSS_STATES.DASHING:
        this.stateTimer += dt;
        this.x += this.dashDirX * this.config.phase1.dash.speed * dt;
        this.y += this.dashDirY * this.config.phase1.dash.speed * dt;
        if (this.stateTimer >= this.config.phase1.dash.duration) {
          this.state = BOSS_STATES.DASH_PAUSE;
          this.stateTimer = 0;
        }
        return { dashing: true, damage: Math.round(this.damage * phaseDamageMult) };

      case BOSS_STATES.DASH_PAUSE:
        this.stateTimer += dt;
        if (this.stateTimer >= this.config.phase1.dash.pause) {
          this.state = BOSS_STATES.CHASE;
          this.stateTimer = 0;
          const pc = this._getPhaseConfig();
          this.dashCooldownTimer = pc.dash ? pc.dash.cooldown : 999;
        }
        break;

      case BOSS_STATES.ATTACK_WINDUP:
        this.stateTimer += dt;
        if (this.stateTimer >= this.config.attackWindup) {
          this.state = BOSS_STATES.COOLDOWN;
          this.stateTimer = 0;
          return { meleeAttack: true, damage: Math.round(this.damage * phaseDamageMult) };
        }
        break;

      case BOSS_STATES.COOLDOWN:
        this.stateTimer += dt;
        if (this.stateTimer >= this.config.attackCooldown) {
          this.state = BOSS_STATES.CHASE;
          this.stateTimer = 0;
        }
        break;

      case BOSS_STATES.BARRAGE_WINDUP:
        this.stateTimer += dt;
        {
          const barrage = this._getPhaseConfig().barrage;
          if (this.stateTimer >= barrage.windup) {
            this.state = BOSS_STATES.BARRAGE;
            this.stateTimer = 0;
          }
        }
        break;

      case BOSS_STATES.BARRAGE: {
        const barrage = this._getPhaseConfig().barrage;
        const projectiles = [];
        for (let i = 0; i < barrage.count; i++) {
          const angle = (i / barrage.count) * Math.PI * 2;
          projectiles.push({
            x: this.x,
            y: this.y,
            dirX: Math.cos(angle),
            dirY: Math.sin(angle),
            speed: barrage.speed,
            damage: barrage.damage,
            radius: barrage.radius,
            isBoss: true,
          });
        }
        this.barrageCooldownTimer = barrage.cooldown;
        this.state = BOSS_STATES.CHASE;
        this.stateTimer = 0;
        return { projectiles };
      }

      case BOSS_STATES.RAY_WINDUP:
        this.stateTimer += dt;
        {
          const ray = this._getPhaseConfig().ray;
          if (this.stateTimer >= ray.windup) {
            this.state = BOSS_STATES.RAY;
            this.stateTimer = 0;
            this.rayTimer = ray.duration;
            this.rayDamageTimer = 0;
          }
        }
        break;

      case BOSS_STATES.RAY: {
        const ray = this._getPhaseConfig().ray;
        this.rayTimer -= dt;
        this.rayDamageTimer += dt;

        // 每0.2秒造成一次伤害
        let rayDamage = 0;
        if (this.rayDamageTimer >= 0.2) {
          this.rayDamageTimer -= 0.2;
          rayDamage = Math.round(ray.damage * phaseDamageMult);
        }

        if (this.rayTimer <= 0) {
          this.rayCooldownTimer = ray.cooldown;
          this.state = BOSS_STATES.CHASE;
          this.stateTimer = 0;
        }

        return {
          ray: true,
          dirX: this.rayDirX,
          dirY: this.rayDirY,
          width: ray.width,
          range: ray.range,
          damage: rayDamage,
        };
      }
    }

    return null;
  }

  _checkPhaseTransition() {
    const hpRatio = this.hp / this.maxHp;
    const thresholds = this.config.phaseThresholds;
    let newPhase = 1;
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (hpRatio <= thresholds[i]) {
        newPhase = i + 2; // threshold[0] → phase2, threshold[1] → phase3
      }
    }

    if (newPhase > this.phase) {
      this.phase = newPhase;
      this.state = BOSS_STATES.PHASE_TRANSITION;
      this.stateTimer = 0;
      this.invincible = true;

      const pc = this._getPhaseConfig();
      if (pc.speedMultiplier) this.speed = this.config.speed * pc.speedMultiplier;
      if (pc.damageMultiplier) this.damage = Math.round(this.config.damage * pc.damageMultiplier);
    }
  }

  _updateElements(dt) {
    if (this.fireTimer > 0) this.fireTimer -= dt;
    if (this.frostTimer > 0) {
      this.frostTimer -= dt;
      this.slowMultiplier = 1 - BALANCE.FROST_SLOW_PERCENT;
    } else {
      this.slowMultiplier = 1;
    }
  }

  takeDamage(amount) {
    if (this.invincible) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
  }

  applyKnockback(dist, duration) {
    this.stunDuration = duration * 0.5;
  }

  render(ctx) {
    if (!this.alive) return;

    const sprites = this.config.sprites || {};
    const img = getSprite(sprites[this.phase]);

    if (img) {
      const r = this.bodyRadius;
      const drawSize = r * 2.8;
      ctx.save();
      ctx.translate(this.x, this.y);

      // 阶段转换闪烁
      if (this.invincible) {
        ctx.globalAlpha = 0.5 + Math.sin(performance.now() * 0.015) * 0.3;
      }

      ctx.rotate(this.facingAngle);
      ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
      ctx.rotate(-this.facingAngle);

      // 血条
      const barWidth = 80;
      const barHeight = 6;
      const barY = -drawSize / 2 - 8;
      ctx.fillStyle = '#333';
      ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);
      const hpRatio = this.hp / this.maxHp;
      const bossColor = this.config.color || '#aa44ff';
      ctx.fillStyle = hpRatio > 0.6 ? bossColor : hpRatio > 0.25 ? '#ff8844' : '#ff2222';
      ctx.fillRect(-barWidth / 2, barY, barWidth * hpRatio, barHeight);
      ctx.strokeStyle = bossColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(-barWidth / 2, barY, barWidth, barHeight);

      ctx.globalAlpha = 1;
      ctx.restore();
    } else {
      drawBossPlaceholder(ctx, this);
    }

    // 冲刺方向指示线
    if (this.state === BOSS_STATES.DASH_WINDUP) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,100,100,0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + this.dashDirX * 200, this.y + this.dashDirY * 200);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 射线蓄力指示
    if (this.state === BOSS_STATES.RAY_WINDUP) {
      const ray = this._getPhaseConfig().ray;
      const progress = Math.min(1, this.stateTimer / ray.windup);
      const indicatorWidth = ray.width * progress * 0.3;
      const indicatorLength = ray.range * progress;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.atan2(this.rayDirY, this.rayDirX));
      ctx.fillStyle = `rgba(255,${Math.floor(100 - 80 * progress)},0,${0.15 + 0.3 * progress})`;
      ctx.fillRect(0, -indicatorWidth / 2, indicatorLength, indicatorWidth);
      ctx.restore();
    }

    // 射线光束
    if (this.state === BOSS_STATES.RAY) {
      const ray = this._getPhaseConfig().ray;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.atan2(this.rayDirY, this.rayDirX));

      // 主光束
      const grad = ctx.createLinearGradient(0, 0, ray.range, 0);
      grad.addColorStop(0, 'rgba(255,60,0,0.9)');
      grad.addColorStop(0.5, 'rgba(255,120,0,0.7)');
      grad.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, -ray.width / 2, ray.range, ray.width);

      // 核心高光
      const coreGrad = ctx.createLinearGradient(0, 0, ray.range * 0.8, 0);
      coreGrad.addColorStop(0, 'rgba(255,200,100,0.6)');
      coreGrad.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.fillStyle = coreGrad;
      ctx.fillRect(0, -ray.width / 4, ray.range * 0.8, ray.width / 2);

      ctx.restore();
    }
  }
}
