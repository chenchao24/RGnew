/**
 * 玩家实体
 * 支持双输入模式：R键前进+鼠标转向 / 纯鼠标跟随
 */

import { PLAYER_CONFIG } from '../config/player.js';
import { MAGE_CONFIG } from '../config/mage.js';
import { BALANCE } from '../config/balance.js';
import { distance, angleTo, lerp, lerpAngle, clamp } from '../utils/MathUtils.js';
import { drawPlayerPlaceholder, getSprite } from '../utils/SpriteManager.js';

export class Player {
  constructor(x, y, heroId = 'paladin') {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.heroId = heroId;

    // 根据角色选择配置
    const config = heroId === 'mage' ? MAGE_CONFIG : PLAYER_CONFIG;
    this.heroConfig = config;

    // 基础属性（从config复制，运行时可被buff修改）
    this.hp = config.HP;
    this.maxHp = config.HP;
    this.moveSpeed = config.MOVE_SPEED;
    this.dodgeChance = config.DODGE_CHANCE;
    this.collisionRadius = config.COLLISION_RADIUS;
    this.pickupRange = config.PICKUP_RANGE;

    // 旋转剑参数
    this.swordCount = config.SWORD_COUNT;
    this.swordRadius = config.SWORD_RADIUS;
    this.swordRotationSpeed = config.SWORD_ROTATION_SPEED;
    this.swordDamage = config.SWORD_DAMAGE;
    this.swordCooldown = config.SWORD_COOLDOWN;
    this.swordHitRadius = config.SWORD_HIT_RADIUS;
    this.swordLength = config.SWORD_LENGTH;

    // 战斗属性
    this.critChance = 0;
    this.multiTarget = 1;
    this.armorPen = 0;
    this.damageBonus = 0; // 百分比加成

    // 元素
    this.enchants = new Set();
    this.elementMastery = 0;

    // 生存
    this.hpRegen = 0;
    this.hpRegenTimer = 0;
    this.lifesteal = 0;
    this.shieldStacks = 0;
    this.shieldGenAmount = 0;
    this.shieldGenTimer = 0;
    this.damageReduction = 0;
    this.hasRevive = false;
    this.reviveUsed = false;

    // 控制
    this.knockback = 0;
    this.knockbackBonus = 0;
    this.hasGravity = false;
    this.hasSlowAura = false;
    this.hasExecute = false;

    // 朝向
    this.facingAngle = 0; // 弧度

    // 无敌帧
    this.invincibleTimer = 0;
    this._reviveInvincible = false;

    // 临时buff
    this.tempSwords = [];
    this.atkUpTimer = 0;
    this.atkUpMultiplier = 1;
    this.spdUpTimer = 0;
    this.spdUpMultiplier = 1;
    this.slowTimer = 0;
    this.slowMultiplier = 1;
    this.tempShieldTimer = 0;
    this.tempShieldActive = false;

    // 移动状态
    this._targetX = x;
    this._targetY = y;
    this._currentSpeed = 0;
    this._useKeyboardMode = false;

    // 法师瞬移技能
    this.blinkCooldown = 0;       // 剩余冷却（秒）
    this.blinkCasting = false;    // 是否正在读条
    this.blinkCastTimer = 0;      // 读条计时
    this.blinkTargetX = 0;        // 传送目标X
    this.blinkTargetY = 0;        // 传送目标Y
    this.blinkJustUsed = false;   // 本帧是否刚瞬移完（用于视觉特效）

    // 跨关卡加成
    this.currentStage = 1;        // 当前关卡索引
    this.stageBonus = null;       // { hpMult, atkMult, spdMult, dodgeMult, rangeMult }

    // 测试模式标记
    this.isTestMode = false;
  }

  update(dt, inputManager, canvasWidth, canvasHeight) {
    const mouse = inputManager.getMousePosition();
    const rHeld = inputManager.isRKeyHeld();

    // 朝向始终跟随鼠标
    const targetAngle = angleTo(this.x, this.y, mouse.x, mouse.y);
    this.facingAngle = lerpAngle(this.facingAngle, targetAngle, PLAYER_CONFIG.TURN_SPEED * dt);

    // 双模式移动
    if (rHeld) {
      // R键模式：按住R向面朝方向移动
      this._useKeyboardMode = true;
      const currentMaxSpeed = this.moveSpeed * this.spdUpMultiplier * this.slowMultiplier;
      const dirX = Math.cos(this.facingAngle);
      const dirY = Math.sin(this.facingAngle);



      this.vx = lerp(this.vx, dirX * currentMaxSpeed, PLAYER_CONFIG.MOVE_ACCEL * dt / Math.max(currentMaxSpeed, 1));
      this.vy = lerp(this.vy, dirY * currentMaxSpeed, PLAYER_CONFIG.MOVE_ACCEL * dt / Math.max(currentMaxSpeed, 1));

      this._currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      this._targetX = mouse.x;
      this._targetY = mouse.y;
    } else if (inputManager.mouseOnCanvas) {
      // 纯鼠标模式：平滑跟随鼠标位置
      this._useKeyboardMode = false;
      this._targetX = mouse.x;
      this._targetY = mouse.y;

      const dx = this._targetX - this.x;
      const dy = this._targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 3) {
        const currentMaxSpeed = this.moveSpeed * this.spdUpMultiplier * this.slowMultiplier;
        const speed = Math.min(dist * PLAYER_CONFIG.MOUSE_FOLLOW_SMOOTH, currentMaxSpeed);
        this.vx = (dx / dist) * speed;
        this.vy = (dy / dist) * speed;
        this._currentSpeed = speed;
      } else {
        this.vx = 0;
        this.vy = 0;
        this._currentSpeed = 0;
      }
    } else {
      // 鼠标不在画布上，减速停下
      this.vx = lerp(this.vx, 0, PLAYER_CONFIG.MOVE_DECEL * dt / 200);
      this.vy = lerp(this.vy, 0, PLAYER_CONFIG.MOVE_DECEL * dt / 200);
      this._currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    }

    // 应用速度
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 边界限制
    const margin = this.collisionRadius;
    this.x = clamp(this.x, margin, canvasWidth - margin);
    this.y = clamp(this.y, margin, canvasHeight - margin);

    // 无敌帧倒计时
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= dt;
      // 复活无敌结束后清除标记
      if (this.invincibleTimer <= 0) {
        this._reviveInvincible = false;
      }
    }

    // 生命恢复
    if (this.hpRegen > 0) {
      this.hpRegenTimer += dt;
      if (this.hpRegenTimer >= 5) {
        this.hpRegenTimer -= 5;
        this.hp = Math.min(this.maxHp, this.hp + this.hpRegen);
      }
    }

    // 护盾生成
    if (this.shieldGenAmount > 0) {
      this.shieldGenTimer += dt;
      if (this.shieldGenTimer >= 15 && this.shieldStacks < 3) {
        this.shieldGenTimer = 0;
        this.shieldStacks++;
      }
    }

    // 临时buff倒计时
    if (this.atkUpTimer > 0) {
      this.atkUpTimer -= dt;
      if (this.atkUpTimer <= 0) this.atkUpMultiplier = 1;
    }
    if (this.spdUpTimer > 0) {
      this.spdUpTimer -= dt;
      if (this.spdUpTimer <= 0) this.spdUpMultiplier = 1;
    }
    // 减速效果
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) this.slowMultiplier = 1;
    }
    if (this.tempShieldTimer > 0) {
      this.tempShieldTimer -= dt;
      if (this.tempShieldTimer <= 0) this.tempShieldActive = false;
    }

    // 临时剑倒计时
    for (let i = this.tempSwords.length - 1; i >= 0; i--) {
      this.tempSwords[i].timer -= dt;
      if (this.tempSwords[i].timer <= 0) {
        this.tempSwords.splice(i, 1);
      }
    }

    // 瞬移技能冷却
    if (this.blinkCooldown > 0) {
      this.blinkCooldown -= dt;
      if (this.blinkCooldown < 0) this.blinkCooldown = 0;
    }

    // 瞬移读条
    this.blinkJustUsed = false;
    if (this.blinkCasting) {
      this.blinkCastTimer -= dt;
      if (this.blinkCastTimer <= 0) {
        // 瞬移完成
        this.x = this.blinkTargetX;
        this.y = this.blinkTargetY;
        this.vx = 0;
        this.vy = 0;
        this.blinkCasting = false;
        this.blinkCooldown = this.heroConfig.SKILL_BLINK_COOLDOWN;
        this.invincibleTimer = 0.5; // 瞬移后短暂无敌
        this.blinkJustUsed = true;
      }
    }
  }

  /**
   * 尝试释放瞬移技能（右键触发）
   * @returns {boolean} 是否成功开始读条
   */
  tryBlink(canvasWidth, canvasHeight) {
    if (this.heroId !== 'mage') return false;
    if (this.blinkCooldown > 0 || this.blinkCasting) return false;

    const cfg = this.heroConfig;
    // 随机方向和距离
    const angle = Math.random() * Math.PI * 2;
    const dist = cfg.SKILL_BLINK_MIN_DISTANCE + Math.random() * (cfg.SKILL_BLINK_MAX_DISTANCE - cfg.SKILL_BLINK_MIN_DISTANCE);
    let tx = this.x + Math.cos(angle) * dist;
    let ty = this.y + Math.sin(angle) * dist;
    // 限制在地图内
    const margin = this.collisionRadius + 10;
    tx = clamp(tx, margin, canvasWidth - margin);
    ty = clamp(ty, margin, canvasHeight - margin);

    this.blinkTargetX = tx;
    this.blinkTargetY = ty;
    this.blinkCasting = true;
    this.blinkCastTimer = cfg.SKILL_BLINK_CAST_TIME;
    return true;
  }

  /**
   * 取消瞬移读条（受到伤害时）
   */
  cancelBlink() {
    if (this.blinkCasting) {
      this.blinkCasting = false;
      this.blinkCastTimer = 0;
    }
  }

  /**
   * 受到伤害
   * @returns {object} { dodged, damage, died }
   */
  takeDamage(rawDamage) {
    // 测试模式：大幅减伤，不会死亡
    if (this.isTestMode) {
      this.invincibleTimer = 0.1;
      return { dodged: false, damage: 0, died: false };
    }

    // 普通无敌帧：跳过伤害（保持原有机制）
    if (this.invincibleTimer > 0 && !this._reviveInvincible) return { dodged: false, damage: 0, died: false };

    // 复活无敌期间：受伤但不致死，HP最低保留1
    const isReviveInvincible = this._reviveInvincible === true;

    // 受击取消瞬移读条
    this.cancelBlink();

    // 闪避判定
    if (Math.random() < this.dodgeChance) {
      this.invincibleTimer = BALANCE.DODGE_INVINCIBLE_TIME;
      return { dodged: true, damage: 0, died: false };
    }

    // 护盾吸收
    if (this.tempShieldActive) {
      this.tempShieldActive = false;
      this.tempShieldTimer = 0;
      return { dodged: false, damage: 0, died: false, shieldBroken: true };
    }
    if (this.shieldStacks > 0) {
      this.shieldStacks--;
      return { dodged: false, damage: 0, died: false, shieldBroken: true };
    }

    // 减伤计算
    let reduction = this.damageReduction;
    if (this.hp / this.maxHp < BALANCE.STEEL_WIL_LOW_HP_THRESHOLD && this.damageReduction > 0) {
      reduction = BALANCE.STEEL_WIL_LOW_HP_REDUCTION;
    }
    const finalDamage = Math.max(1, Math.round(rawDamage * (1 - reduction)));

    this.hp -= finalDamage;
    this.invincibleTimer = BALANCE.DODGE_INVINCIBLE_TIME;

    // NaN保护
    if (isNaN(this.hp)) this.hp = 0;

    // 复活无敌期间：HP最低保留1，不会再次死亡
    if (isReviveInvincible && this.hp <= 0) {
      this.hp = 1;
      this.invincibleTimer = 0.15; // 短暂无敌防止连续帧被打
      return { dodged: false, damage: finalDamage, died: false };
    }

    if (this.hp <= 0) {
      // 复活检查
      if (this.hasRevive && !this.reviveUsed) {
        this.reviveUsed = true;
        this.hp = Math.round(this.maxHp * 0.5);
        this.invincibleTimer = 2; // 复活无敌2秒，但期间记录伤害延迟结算
        this._reviveInvincible = true; // 标记复活无敌状态
        return { dodged: false, damage: finalDamage, died: false, revived: true };
      }
      this.hp = 0;
      return { dodged: false, damage: finalDamage, died: true };
    }

    return { dodged: false, damage: finalDamage, died: false };
  }

  /**
   * 获取总剑数（永久+临时）
   */
  getTotalSwordCount() {
    return this.swordCount + this.tempSwords.length;
  }

  /**
   * 应用减速效果
   * @param {number} slowPercent - 减速百分比(0-1)
   * @param {number} duration - 持续时间(秒)
   */
  applySlow(slowPercent, duration) {
    this.slowMultiplier = 1 - slowPercent;
    this.slowTimer = duration;
  }

  /**
   * 获取总伤害
   */
  getTotalDamage() {
    const base = this.swordDamage * this.atkUpMultiplier;
    return Math.round(base * (1 + this.damageBonus));
  }

  render(ctx) {
    // 根据角色选择图片
    let frontImg, backImg, sideImg;
    if (this.heroId === 'mage' && this.heroConfig.PLAYER_SPRITES) {
      const sp = this.heroConfig.PLAYER_SPRITES;
      frontImg = getSprite(sp.front);
      backImg = getSprite(sp.back);
      sideImg = getSprite(sp.side);
    } else {
      frontImg = getSprite('assets/sprites/player/player_front.png');
      backImg = getSprite('assets/sprites/player/player_back.png');
      sideImg = getSprite('assets/sprites/player/player_side.png');
    }

    if (frontImg && backImg && sideImg) {
      // 根据朝向选择图片
      let angle = this.facingAngle;
      // 归一化到 [-π, π]
      while (angle > Math.PI) angle -= Math.PI * 2;
      while (angle < -Math.PI) angle += Math.PI * 2;

      let img, flipX = false;
      const absAngle = Math.abs(angle);

      if (absAngle < Math.PI / 4 || absAngle > Math.PI * 3 / 4) {
        // 面朝左/右 → 侧面
        img = sideImg;
        flipX = angle < 0 ? false : (angle > 0 && absAngle > Math.PI / 2 ? true : false);
        // 更精确：朝右(angle~0)不翻转，朝左(angle~±π)翻转
        flipX = angle > Math.PI / 2 || angle < -Math.PI / 2;
      } else if (angle > 0) {
        // 面朝下 → 正面
        img = frontImg;
      } else {
        // 面朝上 → 背面
        img = backImg;
      }

      // 绘制尺寸 56x88
      const drawW = 48;
      const drawH = 70;
      ctx.save();
      ctx.translate(this.x, this.y);

      // 无敌闪烁
      if (this.invincibleTimer > 0) {
        ctx.globalAlpha = 0.5 + Math.sin(performance.now() * 0.02) * 0.3;
      }

      if (flipX) {
        ctx.scale(-1, 1);
      }
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    } else {
      // 无图片资源，使用占位绘制
      drawPlayerPlaceholder(ctx, this.x, this.y, this.facingAngle, this.collisionRadius, this.invincibleTimer > 0);
    }

    // 护盾视觉
    if (this.tempShieldActive || this.shieldStacks > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(68,204,204,0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.collisionRadius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 攻击力UP视觉
    if (this.atkUpTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,68,68,0.15)';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.collisionRadius + 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 定身光环视觉
    if (this.hasSlowAura) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,204,0,0.2)';
      ctx.fillStyle = 'rgba(255,204,0,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y, BALANCE.SLOW_AURA_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 瞬移读条效果
    if (this.blinkCasting) {
      const cfg = this.heroConfig;
      const progress = 1 - (this.blinkCastTimer / cfg.SKILL_BLINK_CAST_TIME);
      ctx.save();
      ctx.strokeStyle = 'rgba(100,180,255,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.collisionRadius + 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
      // 闪光填充
      ctx.fillStyle = `rgba(100,180,255,${0.1 + progress * 0.15})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.collisionRadius + 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
