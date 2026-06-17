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
    this.summonWaveCount = 0;

    // 冲刺
    this.dashDirX = 0;
    this.dashDirY = 0;

    // 射线
    this.rayDirX = 0;
    this.rayDirY = 0;
    this.rayTimer = 0;
    this.rayDamageTimer = 0;

    // Boss3技能系统
    this.skillCooldownTimer = pc.skillCooldown || 999;
    this.availableSkills = [];
    this.currentSkillIndex = -1;
    this.crossWaveUseCount = 0;
    this.meteorRainUseCount = 0;
    this.flameAuraUseCount = 0;
    this.totalSkillUseCount = 0;

    // 十字光波（光柱模式）
    this.crossWaveBeamDirs = [];
    this.crossWaveBeamTimer = 0;
    this.crossWaveBeamDamageTimer = 0;
    this.crossWaveProjectilesFired = false;

    // 陨石雨
    this.meteors = [];
    this.meteorWarnings = [];

    // 烈焰
    this.flameTimer = 0;
    this.flameDamageTimer = 0;

    // 怒吼
    this.roarText = null;
    this.roarTimer = 0;
    this.spawnRoarShown = false;

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
          const currentInterval = Math.max(
            pc.summon.minInterval || 2,
            pc.summon.interval - (pc.summon.intervalDecay || 0) * this.summonWaveCount
          );
          if (this.summonTimer >= currentInterval) {
            this.summonTimer = 0;
            this.summonWaveCount++;
            return { summon: true, count: pc.summon.count };
          }
        }

        // Boss3技能轮转检测
        if (pc.crossWave || pc.meteorRain || pc.flameAura) {
          this.skillCooldownTimer -= dt;
          if (this.skillCooldownTimer <= 0) {
            this._selectNextSkill(pc);
            break;
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

      // ===== Boss3: 十字光波（全场光柱） =====
      case BOSS_STATES.CROSSWAVE_WINDUP: {
        this.stateTimer += dt;
        const cw = this._getPhaseConfig().crossWave;
        if (this.stateTimer >= cw.windup) {
          // 生成光柱方向
          this.crossWaveBeamDirs = [];
          for (let i = 0; i < cw.beamCount; i++) {
            const angle = (i / cw.beamCount) * Math.PI * 2;
            this.crossWaveBeamDirs.push({ dirX: Math.cos(angle), dirY: Math.sin(angle) });
          }
          this.crossWaveBeamTimer = cw.beamDuration;
          this.crossWaveBeamDamageTimer = 0;
          this.crossWaveProjectilesFired = false;
          this.state = BOSS_STATES.CROSSWAVE;
          this.stateTimer = 0;
        }
        break;
      }

      case BOSS_STATES.CROSSWAVE: {
        const cw = this._getPhaseConfig().crossWave;
        this.crossWaveBeamTimer -= dt;
        this.crossWaveBeamDamageTimer += dt;

        // 伤害tick
        let beamDamage = 0;
        if (this.crossWaveBeamDamageTimer >= cw.tickInterval) {
          this.crossWaveBeamDamageTimer -= cw.tickInterval;
          beamDamage = Math.round(cw.beamDamage * phaseDamageMult);
        }

        // 首帧发射环形弹幕
        let result = {
          crossWaveBeams: this.crossWaveBeamDirs.map(d => ({
            dirX: d.dirX,
            dirY: d.dirY,
            width: cw.beamWidth,
            range: cw.beamRange,
            damage: beamDamage,
          })),
        };

        if (!this.crossWaveProjectilesFired) {
          this.crossWaveProjectilesFired = true;
          const projectiles = [];
          for (let i = 0; i < cw.projectileCount; i++) {
            const angle = (i / cw.projectileCount) * Math.PI * 2;
            projectiles.push({
              x: this.x, y: this.y,
              dirX: Math.cos(angle), dirY: Math.sin(angle),
              speed: cw.projectileSpeed,
              damage: cw.projectileDamage,
              radius: cw.projectileRadius,
              isBoss: true,
              isCrossWave: true,
            });
          }
          result.projectiles = projectiles;
        }

        if (this.crossWaveBeamTimer <= 0) {
          this.crossWaveUseCount++;
          this.totalSkillUseCount++;
          this._checkSkillRoar('crossWave');
          this.skillCooldownTimer = this._getPhaseConfig().skillCooldown || 6;
          this.state = BOSS_STATES.CHASE;
          this.stateTimer = 0;
          this.crossWaveBeamDirs = [];
        }

        return result;
      }

      // ===== Boss3: 陨石雨 =====
      case BOSS_STATES.METEOR_WINDUP: {
        this.stateTimer += dt;
        const mr = this._getPhaseConfig().meteorRain;
        if (this.stateTimer >= mr.warnTime && this.meteorWarnings.length === 0) {
          // 生成预警圈（以玩家当前位置为中心）
          const warnings = [];
          for (let i = 0; i < mr.count; i++) {
            const ox = (Math.random() - 0.5) * 2 * mr.spreadRadius;
            const oy = (Math.random() - 0.5) * 2 * mr.spreadRadius;
            warnings.push({
              x: playerX + ox,
              y: playerY + oy,
              radius: mr.aoeRadius,
              delay: i * mr.interval,
              fallen: false,
            });
          }
          this.meteorWarnings = warnings;
        }
        if (this.stateTimer >= mr.warnTime) {
          this.state = BOSS_STATES.METEOR;
          this.stateTimer = 0;
        }
        break;
      }

      case BOSS_STATES.METEOR: {
        const mr = this._getPhaseConfig().meteorRain;
        this.stateTimer += dt;

        // 逐颗落下陨石
        for (const w of this.meteorWarnings) {
          if (!w.fallen && this.stateTimer >= w.delay) {
            w.fallen = true;
            this.meteors.push({
              x: w.x, y: w.y,
              radius: mr.aoeRadius,
              damage: mr.damage,
              timer: 0.3,  // 视觉残留时间
            });
          }
        }

        // 所有陨石落下完毕
        if (this.meteorWarnings.length > 0 && this.meteorWarnings.every(w => w.fallen)) {
          // 检测玩家碰撞并返回伤害
          const hits = [];
          for (const m of this.meteors) {
            const d = distance(m.x, m.y, playerX, playerY);
            if (d <= m.radius + 20) {
              hits.push({ x: m.x, y: m.y, damage: Math.round(m.damage * phaseDamageMult), radius: m.radius });
            }
          }
          this.meteorRainUseCount++;
          this.totalSkillUseCount++;
          // 怒吼检测
          this._checkSkillRoar('meteorRain');
          this.meteorWarnings = [];
          this.meteors = [];
          this.skillCooldownTimer = this._getPhaseConfig().skillCooldown || 6;
          this.state = BOSS_STATES.CHASE;
          this.stateTimer = 0;
          if (hits.length > 0) {
            return { meteorHits: hits, shake: { intensity: mr.shakeIntensity, duration: mr.shakeDuration * mr.count } };
          }
          return { meteorVisual: true, shake: { intensity: mr.shakeIntensity, duration: mr.shakeDuration * mr.count } };
        }
        break;
      }

      // ===== Boss3: 烈焰光环 =====
      case BOSS_STATES.FLAME_AURA: {
        const fa = this._getPhaseConfig().flameAura;
        this.flameTimer += dt;
        this.flameDamageTimer += dt;

        // 持续伤害检测
        let flameDamage = 0;
        if (this.flameDamageTimer >= fa.tickInterval) {
          this.flameDamageTimer -= fa.tickInterval;
          const d = distance(this.x, this.y, playerX, playerY);
          if (d <= fa.radius + 20) {
            flameDamage = Math.round(fa.dps * fa.tickInterval * phaseDamageMult);
          }
        }

        if (this.flameTimer >= fa.duration) {
          this.flameTimer = 0;
          this.flameDamageTimer = 0;
          this.flameAuraUseCount++;
          this.totalSkillUseCount++;
          // 怒吼检测
          this._checkSkillRoar('flameAura');
          this.skillCooldownTimer = this._getPhaseConfig().skillCooldown || 6;
          this.state = BOSS_STATES.CHASE;
          this.stateTimer = 0;
        }

        return {
          flameAura: true,
          x: this.x,
          y: this.y,
          radius: fa.radius,
          damage: flameDamage,
          progress: this.flameTimer / fa.duration,
        };
      }
    }

    return null;
  }

  /**
   * Boss3技能随机选择
   */
  _selectNextSkill(pc) {
    const skills = [];
    if (pc.crossWave) skills.push('crossWave');
    if (pc.meteorRain) skills.push('meteorRain');
    if (pc.flameAura) skills.push('flameAura');
    if (skills.length === 0) return;

    // 随机选择一个技能（避免连续相同）
    let chosen;
    if (skills.length === 1) {
      chosen = skills[0];
    } else {
      do {
        chosen = skills[Math.floor(Math.random() * skills.length)];
      } while (chosen === this.currentSkillIndex && skills.length > 1);
    }
    this.currentSkillIndex = chosen;

    switch (chosen) {
      case 'crossWave':
        this.state = BOSS_STATES.CROSSWAVE_WINDUP;
        break;
      case 'meteorRain':
        this.state = BOSS_STATES.METEOR_WINDUP;
        this.meteorWarnings = [];
        this.meteors = [];
        break;
      case 'flameAura':
        this.state = BOSS_STATES.FLAME_AURA;
        this.flameTimer = 0;
        this.flameDamageTimer = 0;
        break;
    }
    this.stateTimer = 0;
  }

  /**
   * 检测技能怒吼触发
   */
  _checkSkillRoar(skillName) {
    if (!this.config.roars || !this.config.roars[skillName]) return;
    // 每隔一个技能喊一次（第2、4、6...次技能时触发）
    if (this.totalSkillUseCount % 2 === 0) {
      const roarCfg = this.config.roars[skillName];
      this.roarText = roarCfg.text;
      this.roarTimer = roarCfg.duration || 4.0;
    }
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
      // Boss3体型变化
      if (pc.bodyRadius) {
        this.bodyRadius = pc.bodyRadius;
        this.collisionRadius = pc.bodyRadius;
      }
      // 重置技能冷却
      if (pc.skillCooldown) this.skillCooldownTimer = pc.skillCooldown;
      if (pc.dash) this.dashCooldownTimer = pc.dash.cooldown;
      if (pc.barrage) this.barrageCooldownTimer = pc.barrage.cooldown;
      if (pc.ray) this.rayCooldownTimer = pc.ray.cooldown;
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

  /**
   * 更新怒吼文字倒计时
   */
  updateRoar(dt) {
    if (this.roarTimer > 0) {
      this.roarTimer -= dt;
      if (this.roarTimer <= 0) {
        this.roarText = null;
        this.roarTimer = 0;
      }
    }
  }

  /**
   * 触发进场怒吼
   */
  triggerSpawnRoar() {
    if (this.config.roars && this.config.roars.spawn && !this.spawnRoarShown) {
      this.roarText = this.config.roars.spawn.text;
      this.roarTimer = this.config.roars.spawn.duration || 5.5;
      this.spawnRoarShown = true;
    }
  }

  /**
   * 渲染怒吼文字
   */
  renderRoar(ctx, canvasWidth, canvasHeight) {
    if (!this.roarText || this.roarTimer <= 0) return;

    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;

    const duration = this.config.roars?.spawn?.duration || 5.5;
    const elapsed = duration - this.roarTimer;
    let alpha;
    if (elapsed < 0.8) {
      alpha = elapsed / 0.8;
    } else if (this.roarTimer < 0.8) {
      alpha = this.roarTimer / 0.8;
    } else {
      alpha = 1;
    }

    ctx.save();

    // 半透明黑底遮罩
    ctx.fillStyle = `rgba(0,0,0,${0.45 * alpha})`;
    ctx.fillRect(0, cy - 60, canvasWidth, 120);

    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';

    // 文字阴影
    ctx.shadowColor = 'rgba(255,50,0,0.8)';
    ctx.shadowBlur = 20;

    ctx.fillStyle = '#ff3322';
    ctx.font = 'bold 36px "Microsoft YaHei", "Segoe UI", sans-serif';
    ctx.fillText(this.roarText, cx, cy + 5);

    // 署名行
    ctx.shadowBlur = 0;
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = '#ff8866';
    ctx.font = '16px "Microsoft YaHei", sans-serif';
    ctx.fillText(`— ${this.name}`, cx, cy + 38);

    ctx.restore();
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

    // ===== Boss3: 十字光波蓄力指示 =====
    if (this.state === BOSS_STATES.CROSSWAVE_WINDUP) {
      const cw = this._getPhaseConfig().crossWave;
      if (cw) {
        const progress = Math.min(1, this.stateTimer / cw.windup);
        ctx.save();
        ctx.translate(this.x, this.y);
        for (let i = 0; i < cw.beamCount; i++) {
          const angle = (i / cw.beamCount) * Math.PI * 2;
          ctx.save();
          ctx.rotate(angle);
          // 光柱蓄力线
          const indicatorWidth = cw.beamWidth * progress * 0.3;
          const indicatorLength = cw.beamRange * progress;
          ctx.fillStyle = `rgba(255,200,50,${0.15 + 0.4 * progress})`;
          ctx.fillRect(0, -indicatorWidth / 2, indicatorLength, indicatorWidth);
          // 边线
          ctx.strokeStyle = `rgba(255,200,50,${0.3 + 0.5 * progress})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(20, 0);
          ctx.lineTo(20 + progress * 150, 0);
          ctx.stroke();
          ctx.restore();
        }
        ctx.restore();
      }
    }

    // ===== Boss3: 十字光波光柱渲染 =====
    if (this.state === BOSS_STATES.CROSSWAVE && this.crossWaveBeamDirs.length > 0) {
      const cw = this._getPhaseConfig().crossWave;
      const beamProgress = 1 - (this.crossWaveBeamTimer / cw.beamDuration);
      ctx.save();
      for (const dir of this.crossWaveBeamDirs) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.atan2(dir.dirY, dir.dirX));

        // 主光柱
        const grad = ctx.createLinearGradient(0, 0, cw.beamRange, 0);
        grad.addColorStop(0, 'rgba(255,220,50,0.9)');
        grad.addColorStop(0.3, 'rgba(255,160,30,0.7)');
        grad.addColorStop(0.7, 'rgba(255,100,20,0.4)');
        grad.addColorStop(1, 'rgba(255,60,10,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, -cw.beamWidth / 2, cw.beamRange, cw.beamWidth);

        // 核心高光
        const coreGrad = ctx.createLinearGradient(0, 0, cw.beamRange * 0.6, 0);
        coreGrad.addColorStop(0, 'rgba(255,255,200,0.6)');
        coreGrad.addColorStop(1, 'rgba(255,255,200,0)');
        ctx.fillStyle = coreGrad;
        ctx.fillRect(0, -cw.beamWidth / 4, cw.beamRange * 0.6, cw.beamWidth / 2);

        ctx.restore();
      }
      ctx.restore();
    }

    // ===== Boss3: 陨石预警圈 =====
    for (const w of this.meteorWarnings) {
      if (!w.fallen) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,100,30,0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // 填充预警
        ctx.fillStyle = 'rgba(255,60,0,0.15)';
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // ===== Boss3: 陨石落地效果 =====
    const mrCfg = this._getPhaseConfig().meteorRain;
    const meteorSprite = mrCfg ? getSprite(mrCfg.sprite) : null;
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.timer -= 0.016;
      if (m.timer <= 0) { this.meteors.splice(i, 1); continue; }
      const alpha = Math.min(1, m.timer / 0.2);
      ctx.save();
      ctx.globalAlpha = alpha;

      if (meteorSprite) {
        // 陨石精灵图渲染
        const size = m.radius * 2.5;
        ctx.drawImage(meteorSprite, m.x - size / 2, m.y - size / 2, size, size);
        // 爆炸光圈叠加
        const grad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.radius * 1.5);
        grad.addColorStop(0, 'rgba(255,200,50,0.4)');
        grad.addColorStop(0.5, 'rgba(255,80,0,0.2)');
        grad.addColorStop(1, 'rgba(255,30,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius * 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 无精灵时用火焰圈占位
        const grad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.radius);
        grad.addColorStop(0, 'rgba(255,200,50,0.8)');
        grad.addColorStop(0.5, 'rgba(255,80,0,0.5)');
        grad.addColorStop(1, 'rgba(255,30,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ===== Boss3: 烈焰光环 =====
    if (this.state === BOSS_STATES.FLAME_AURA) {
      const fa = this._getPhaseConfig().flameAura;
      if (fa) {
        const pulse = 0.7 + Math.sin(performance.now() * 0.008) * 0.15;
        ctx.save();
        // 外圈
        const grad = ctx.createRadialGradient(this.x, this.y, this.bodyRadius, this.x, this.y, fa.radius);
        grad.addColorStop(0, `rgba(255,60,0,${0.4 * pulse})`);
        grad.addColorStop(0.6, `rgba(255,30,0,${0.25 * pulse})`);
        grad.addColorStop(1, 'rgba(255,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, fa.radius, 0, Math.PI * 2);
        ctx.fill();
        // 边缘线
        ctx.strokeStyle = `rgba(255,100,30,${0.5 * pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, fa.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}
