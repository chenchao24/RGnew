/**
 * 粒子特效系统
 */

export class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  /**
   * 生成命中粒子
   */
  spawnHitParticles(x, y, color = '#ffffff', count = 3) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 120,
        vy: (Math.random() - 0.5) * 120,
        life: 0.3 + Math.random() * 0.2,
        maxLife: 0.5,
        size: 2 + Math.random() * 2,
        color,
      });
    }
  }

  /**
   * 生成暴击粒子
   */
  spawnCritParticles(x, y) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * 150,
        vy: Math.sin(angle) * 150,
        life: 0.4 + Math.random() * 0.2,
        maxLife: 0.6,
        size: 3 + Math.random() * 2,
        color: '#FFD700',
      });
    }
  }

  /**
   * 生成爆炸粒子
   */
  spawnExplosionParticles(x, y, radius, color = '#ff8800') {
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 150;
      this.particles.push({
        x: x + (Math.random() - 0.5) * radius,
        y: y + (Math.random() - 0.5) * radius,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        size: 3 + Math.random() * 4,
        color,
      });
    }
  }

  /**
   * 生成拾取粒子
   */
  spawnPickupParticles(x, y, color) {
    for (let i = 0; i < 5; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 60,
        vy: -30 - Math.random() * 60,
        life: 0.3 + Math.random() * 0.2,
        maxLife: 0.5,
        size: 2 + Math.random() * 2,
        color,
      });
    }
  }

  /**
   * 玩家尾迹
   */
  spawnTrailParticle(x, y) {
    this.particles.push({
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      vx: 0,
      vy: 0,
      life: 0.3,
      maxLife: 0.3,
      size: 3,
      color: '#4488ff',
    });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.95;
      p.vy *= 0.95;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(ctx) {
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  clear() {
    this.particles = [];
  }
}
