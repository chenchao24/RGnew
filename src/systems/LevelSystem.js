/**
 * 经验与升级系统
 */

import { BALANCE } from '../config/balance.js';

export class LevelSystem {
  constructor() {
    this.level = 1;
    this.exp = 0;
    this.expToNext = this._calcExpToNext(2);
    this.totalExp = 0;

    // 升级队列（一次可能升多级）
    this.pendingLevelUps = 0;
  }

  /**
   * 添加经验
   * @returns {number} 升级次数（0表示未升级）
   */
  addExp(amount) {
    this.exp += amount;
    this.totalExp += amount;

    let levelUps = 0;
    while (this.exp >= this.expToNext) {
      this.exp -= this.expToNext;
      this.level++;
      levelUps++;
      this.expToNext = this._calcExpToNext(this.level + 1);
    }

    this.pendingLevelUps += levelUps;
    return levelUps;
  }

  /**
   * 消耗一个待处理升级
   * @returns {boolean} 是否有待处理升级
   */
  consumeLevelUp() {
    if (this.pendingLevelUps > 0) {
      this.pendingLevelUps--;
      return true;
    }
    return false;
  }

  hasPendingLevelUp() {
    return this.pendingLevelUps > 0;
  }

  /**
   * 计算升到下一级所需的经验
   * 使用二次曲线，等级越高升级越慢
   * ExpToNext(n) = 8 + 3*n + 0.5*n^2
   * n=2: 8+6+2 = 16
   * n=10: 8+30+50 = 88
   * n=20: 8+60+200 = 268
   * n=35: 8+105+612 = 725
   */
  _calcExpToNext(n) {
    if (n <= 1) return 0;
    return Math.round(8 + 3 * n + 0.5 * n * n);
  }

  /**
   * 获取经验进度（0-1）
   */
  getExpProgress() {
    if (this.expToNext <= 0) return 1;
    return this.exp / this.expToNext;
  }

  getLevel() { return this.level; }
  getExp() { return this.exp; }
  getExpToNext() { return this.expToNext; }
  getTotalExp() { return this.totalExp; }
}
