/**
 * 弹道实体（远程怪 + Boss弹幕）
 */

export class Projectile {
  constructor(x, y, dirX, dirY, speed, damage, radius, isBoss = false) {
    this.x = x;
    this.y = y;
    this.dirX = dirX;
    this.dirY = dirY;
    this.speed = speed;
    this.damage = damage;
    this.radius = radius;
    this.isBoss = isBoss;
    this.alive = true;
    this.lifetime = 5;
  }

  update(dt) {
    this.x += this.dirX * this.speed * dt;
    this.y += this.dirY * this.speed * dt;
    this.lifetime -= dt;
    if (this.lifetime <= 0) this.alive = false;
    if (this.x < -50 || this.x > 1250 || this.y < -50 || this.y > 850) this.alive = false;
  }
}

export function createProjectile(x, y, dirX, dirY, speed, damage, radius, isBoss = false) {
  return new Projectile(x, y, dirX, dirY, speed, damage, radius, isBoss);
}
