/**
 * 掉落道具实体
 */

import { ITEM_TYPES } from '../config/items.js';
import { drawItemPlaceholder } from '../utils/SpriteManager.js';

export class Item {
  constructor(type, x, y, expValue = 0) {
    this.config = ITEM_TYPES[type];
    this.x = x;
    this.y = y;
    this.type = type;
    this.expValue = expValue;
    this.alive = true;
    this.remainingTime = this.config.lifetime;
    this.totalLifetime = this.config.lifetime;
    this.picked = false;
  }

  update(dt) {
    this.remainingTime -= dt;
    if (this.remainingTime <= 0) {
      this.alive = false;
    }
  }

  /**
   * 被拾取时调用
   * @returns {object} 道具效果
   */
  pickup() {
    this.picked = true;
    this.alive = false;

    switch (this.type) {
      case 'EXP_GEM':
        return { type: 'exp', value: this.expValue };
      case 'HP_POTION':
        return { type: 'heal', value: this.config.healAmount };
      case 'ATK_UP':
        return { type: 'atk_up', duration: this.config.duration, multiplier: this.config.multiplier };
      case 'SPD_UP':
        return { type: 'spd_up', duration: this.config.duration, multiplier: this.config.multiplier };
      case 'SWORD_PLUS':
        return { type: 'sword_plus', duration: this.config.duration };
      case 'SHIELD':
        return { type: 'shield', duration: this.config.duration };
      default:
        return { type: 'unknown' };
    }
  }

  render(ctx) {
    if (!this.alive) return;
    drawItemPlaceholder(ctx, this);
  }
}
