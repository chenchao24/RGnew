/**
 * 掉落系统
 */

import { ITEM_TYPES } from '../config/items.js';
import { Item } from '../entities/Item.js';

export class DropSystem {
  constructor() {
    this.items = [];
  }

  /**
   * 怪物死亡时生成掉落
   */
  onMonsterKilled(monster, waveConfig) {
    const x = monster.x;
    const y = monster.y;

    // 必掉经验宝石
    const expValue = monster.exp;
    this.items.push(new Item('EXP_GEM', x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10, expValue));

    // 特殊怪概率掉落
    if (monster.isSpecial) {
      this._rollSpecialDrops(monster, x, y);
    }
  }

  /**
   * Boss掉落
   */
  onBossKilled(boss) {
    // 大量经验宝石
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const dist = 20 + Math.random() * 30;
      this.items.push(new Item(
        'EXP_GEM',
        boss.x + Math.cos(angle) * dist,
        boss.y + Math.sin(angle) * dist,
        Math.round(boss.exp / 10)
      ));
    }

    // 必掉生命恢复
    this.items.push(new Item('HP_POTION', boss.x + (Math.random() - 0.5) * 20, boss.y + (Math.random() - 0.5) * 20));
  }

  _rollSpecialDrops(monster, x, y) {
    const offsetX = (Math.random() - 0.5) * 16;
    const offsetY = (Math.random() - 0.5) * 16;

    // 生命恢复（所有特殊怪30%）
    if (Math.random() < ITEM_TYPES.HP_POTION.dropRate) {
      this.items.push(new Item('HP_POTION', x + offsetX, y + offsetY));
    }

    // 攻击力UP（所有特殊怪15%）
    if (Math.random() < ITEM_TYPES.ATK_UP.dropRate) {
      this.items.push(new Item('ATK_UP', x + offsetX * 2, y + offsetY * 2));
    }

    // 移速UP（所有特殊怪15%）
    if (Math.random() < ITEM_TYPES.SPD_UP.dropRate) {
      this.items.push(new Item('SPD_UP', x - offsetX, y - offsetY));
    }

    // 剑数+1（仅坦克怪10%）
    if (monster.type === 'TANK' && Math.random() < ITEM_TYPES.SWORD_PLUS.dropRate) {
      this.items.push(new Item('SWORD_PLUS', x + offsetX, y - offsetY));
    }

    // 护盾（仅自爆怪20%）
    if (monster.type === 'BOMBER' && Math.random() < ITEM_TYPES.SHIELD.dropRate) {
      this.items.push(new Item('SHIELD', x - offsetX, y + offsetY));
    }
  }

  /**
   * 处理自动拾取
   */
  processPickup(player) {
    const pickupResults = [];

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (!item.alive) {
        this.items.splice(i, 1);
        continue;
      }

      const dx = player.x - item.x;
      const dy = player.y - item.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= player.pickupRange) {
        const result = item.pickup();
        this.items.splice(i, 1);
        pickupResults.push(result);
      }
    }

    return pickupResults;
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      this.items[i].update(dt);
      if (!this.items[i].alive) {
        this.items.splice(i, 1);
      }
    }
  }

  render(ctx) {
    for (const item of this.items) {
      item.render(ctx);
    }
  }

  clear() {
    this.items = [];
  }
}
