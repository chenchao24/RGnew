/**
 * 旋转剑实体
 * 围绕玩家旋转的攻击手段
 */

import { degToRad } from '../utils/MathUtils.js';
import { drawSwordPlaceholder, getSprite } from '../utils/SpriteManager.js';

export class RotatingSword {
  constructor(index, total, isTemp = false) {
    this.index = index;
    this.isTemp = isTemp;
    this.angleOffset = (index / total) * Math.PI * 2;
    this.currentAngle = 0;
    this.x = 0;
    this.y = 0;

    // 碰撞冷却记录：monsterId → 剩余冷却时间
    this.hitCooldowns = new Map();
  }

  update(dt, playerX, playerY, radius, rotationSpeedDeg) {
    // 更新旋转角度
    this.currentAngle += degToRad(rotationSpeedDeg) * dt;

    // 计算剑尖位置
    const totalAngle = this.currentAngle + this.angleOffset;
    this.x = playerX + Math.cos(totalAngle) * radius;
    this.y = playerY + Math.sin(totalAngle) * radius;

    // 冷却倒计时
    for (const [id, timer] of this.hitCooldowns) {
      const newTimer = timer - dt;
      if (newTimer <= 0) {
        this.hitCooldowns.delete(id);
      } else {
        this.hitCooldowns.set(id, newTimer);
      }
    }
  }

  /**
   * 检查是否可以命中某怪物
   */
  canHit(monsterId, cooldown) {
    return !this.hitCooldowns.has(monsterId);
  }

  /**
   * 记录命中冷却
   */
  registerHit(monsterId, cooldown) {
    this.hitCooldowns.set(monsterId, cooldown);
  }

  /**
   * 获取剑尖位置
   */
  getTipPosition() {
    return { x: this.x, y: this.y };
  }

  /**
   * 获取剑刃的朝向角度
   */
  getBladeAngle() {
    return this.currentAngle + this.angleOffset;
  }

  render(ctx, length, width, swordSpritePath = 'assets/sprites/swords/sword_blade.png') {
    const swordImg = getSprite(swordSpritePath);
    if (swordImg) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.getBladeAngle());
      if (this.isTemp) ctx.globalAlpha = 0.6;
      // 按长度参数缩放（基准 36px）
      const scale = length / 36;
      ctx.scale(scale, scale);
      ctx.drawImage(swordImg, -swordImg.width / 2, -swordImg.height / 2);
      ctx.restore();
    } else {
      drawSwordPlaceholder(ctx, this.x, this.y, this.getBladeAngle(), length, width, this.isTemp);
    }
  }
}
