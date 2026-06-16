/**
 * 空间哈希碰撞系统
 * 将画布划分为网格，仅检测相邻格子中的碰撞
 */

import { BALANCE } from '../config/balance.js';

const CELL_SIZE = 100;

export class CollisionSystem {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cols = Math.ceil(width / CELL_SIZE);
    this.rows = Math.ceil(height / CELL_SIZE);
    this.grid = new Map();
  }

  clear() {
    this.grid.clear();
  }

  _key(col, row) {
    return col * 10000 + row;
  }

  _getCell(x, y) {
    const col = Math.floor(x / CELL_SIZE);
    const row = Math.floor(y / CELL_SIZE);
    return { col: Math.max(0, Math.min(col, this.cols - 1)), row: Math.max(0, Math.min(row, this.rows - 1)) };
  }

  insert(entity) {
    const cell = this._getCell(entity.x, entity.y);
    const key = this._key(cell.col, cell.row);
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key).push(entity);
  }

  /**
   * 查询某位置附近的所有实体
   * @param {number} x - 中心x
   * @param {number} y - 中心y
   * @param {number} radius - 查询半径
   * @param {Function} filter - 过滤函数
   * @returns {Array} 匹配的实体列表
   */
  query(x, y, radius, filter = null) {
    const results = [];
    const minCol = Math.max(0, Math.floor((x - radius) / CELL_SIZE));
    const maxCol = Math.min(this.cols - 1, Math.floor((x + radius) / CELL_SIZE));
    const minRow = Math.max(0, Math.floor((y - radius) / CELL_SIZE));
    const maxRow = Math.min(this.rows - 1, Math.floor((y + radius) / CELL_SIZE));

    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        const cell = this.grid.get(this._key(col, row));
        if (!cell) continue;
        for (const entity of cell) {
          if (filter && !filter(entity)) continue;
          const dx = entity.x - x;
          const dy = entity.y - y;
          const distSq = dx * dx + dy * dy;
          const rSum = (radius + (entity.collisionRadius || 0));
          if (distSq <= rSum * rSum) {
            results.push({ entity, distSq, dx, dy });
          }
        }
      }
    }

    results.sort((a, b) => a.distSq - b.distSq);
    return results;
  }

  /**
   * 检测两个圆是否碰撞
   */
  static circleTest(x1, y1, r1, x2, y2, r2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distSq = dx * dx + dy * dy;
    const rSum = r1 + r2;
    return distSq <= rSum * rSum;
  }

  /**
   * 检测点与圆的碰撞
   */
  static pointInCircle(px, py, cx, cy, r) {
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy <= r * r;
  }

  /**
   * 检测点是否在画布内
   */
  isInBounds(x, y, margin = 0) {
    return x >= margin && x <= this.width - margin && y >= margin && y <= this.height - margin;
  }

  /**
   * 在画布边缘随机生成安全位置
   */
  getSafeSpawnPosition(playerX, playerY, safeDistance) {
    const margin = BALANCE.SPAWN_MARGIN;
    for (let attempt = 0; attempt < BALANCE.MAX_SPAWN_ATTEMPTS; attempt++) {
      const side = Math.floor(Math.random() * 4);
      let x, y;
      switch (side) {
        case 0: x = margin; y = margin + Math.random() * (this.height - margin * 2); break;
        case 1: x = this.width - margin; y = margin + Math.random() * (this.height - margin * 2); break;
        case 2: x = margin + Math.random() * (this.width - margin * 2); y = margin; break;
        case 3: x = margin + Math.random() * (this.width - margin * 2); y = this.height - margin; break;
      }
      const dx = x - playerX;
      const dy = y - playerY;
      if (dx * dx + dy * dy >= safeDistance * safeDistance) {
        return { x, y };
      }
    }
    // 后备：在对角位置生成
    const fx = playerX < this.width / 2 ? this.width - margin * 2 : margin * 2;
    const fy = playerY < this.height / 2 ? this.height - margin * 2 : margin * 2;
    return { x: fx, y: fy };
  }
}
