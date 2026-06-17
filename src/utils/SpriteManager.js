/**
 * 占位精灵管理器
 * 优先从 assets/ 加载图片，找不到则用 Canvas 绘制占位图
 * 替换美术资源时只需将图片放入对应文件夹即可
 */

const spriteCache = new Map();
const loadingSet = new Set();

/**
 * 尝试加载图片，失败返回 null
 */
function tryLoadImage(src) {
  return new Promise((resolve) => {
    if (spriteCache.has(src)) {
      resolve(spriteCache.get(src));
      return;
    }
    const img = new Image();
    img.onload = () => {
      spriteCache.set(src, img);
      loadingSet.delete(src);
      resolve(img);
    };
    img.onerror = () => {
      loadingSet.delete(src);
      resolve(null);
    };
    loadingSet.add(src);
    img.src = src;
  });
}

/**
 * 预加载所有占位精灵
 */
export async function preloadSprites() {
  const paths = [
    'assets/sprites/player/player_front.png',
    'assets/sprites/player/player_back.png',
    'assets/sprites/player/player_side.png',
    'assets/sprites/monsters/normal_front.png',
    'assets/sprites/monsters/normal_back.png',
    'assets/sprites/monsters/fast_front.png',
    'assets/sprites/monsters/tank_front.png',
    'assets/sprites/monsters/bomber_front.png',
    'assets/sprites/monsters/ranged_front.png',
    'assets/sprites/boss/boss_idle.png',
    'assets/sprites/boss/boss_phase2.png',
    'assets/sprites/boss/boss_phase3.png',
    'assets/sprites/boss2/boss_idle.png',
    'assets/sprites/boss2/boss_phase2.png',
    'assets/sprites/boss3/boss_idle.png',
    'assets/sprites/boss3/boss_phase2.png',
    'assets/sprites/effects/meteor/meteor_fall.png',
    'assets/sprites/monsters3/normal_front.png',
    'assets/sprites/monsters3/fast_front.png',
    'assets/sprites/monsters3/tank_front.png',
    'assets/sprites/monsters3/bomber_front.png',
    'assets/sprites/monsters3/ranged_front.png',
    'assets/sprites/monsters3/shocker_front.png',
    'assets/sprites/monsters3/golem_front.png',
    'assets/bg/stage3/ground.png',
    'assets/sprites/swords/sword_blade.png',
    'assets/sprites/swords/mage/sword_blade.png',
    'assets/sprites/mage/mage_front.png',
    'assets/sprites/mage/mage_back.png',
    'assets/sprites/mage/mage_side.png',
    'assets/sprites/effects/hit.png',
    'assets/sprites/effects/crit.png',
    'assets/sprites/effects/explosion.png',
    'assets/sprites/effects/shield_break.png',
    'assets/items/exp_gem.png',
    'assets/items/hp_potion.png',
    'assets/items/atk_up.png',
    'assets/items/spd_up.png',
    'assets/items/sword_plus.png',
    'assets/items/shield.png',
    'assets/bg/ground.png',
    'assets/bg/stage2/ground.png',
    'assets/bg/title/bg.png',
    'assets/bg/select_hero/bg.png',
  ];

  await Promise.all(paths.map(p => tryLoadImage(p)));
}

/**
 * 获取精灵图片（可能为 null）
 */
export function getSprite(path) {
  return spriteCache.get(path) || null;
}

// ===== 占位绘制函数 =====
// 这些函数在无美术资源时使用，绘制清晰的占位图形

/**
 * 绘制玩家占位图（带朝向的圆形角色）
 */
export function drawPlayerPlaceholder(ctx, x, y, angle, radius, invincible = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // 身体
  ctx.globalAlpha = invincible ? 0.5 + Math.sin(performance.now() * 0.02) * 0.3 : 1;
  ctx.fillStyle = '#44aaff';
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  // 发光效果
  ctx.strokeStyle = '#88ccff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 面朝方向指示（箭头）
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(radius + 6, 0);
  ctx.lineTo(radius - 2, -5);
  ctx.lineTo(radius - 2, 5);
  ctx.closePath();
  ctx.fill();

  // 眼睛（正面标记）
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(radius * 0.35, -radius * 0.3, 3, 0, Math.PI * 2);
  ctx.arc(radius * 0.35, radius * 0.3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#112244';
  ctx.beginPath();
  ctx.arc(radius * 0.4, -radius * 0.3, 1.5, 0, Math.PI * 2);
  ctx.arc(radius * 0.4, radius * 0.3, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * 绘制怪物占位图（带朝向）
 */
export function drawMonsterPlaceholder(ctx, monster) {
  const { x, y, facingAngle, template, hp, maxHp } = monster;
  const r = template.bodyRadius;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(facingAngle);

  // 自爆怪脉冲效果
  let alpha = 1;
  if (template.id === 'bomber' && monster.state === 'exploding') {
    const pulse = Math.sin(performance.now() * 0.01 * (3 + monster.explosionTimer * 2));
    alpha = 0.5 + pulse * 0.5;
    ctx.fillStyle = `rgba(255,136,0,${alpha})`;
  } else {
    ctx.fillStyle = template.color;
  }

  switch (template.id) {
    case 'normal':
      // 圆形
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      // 眼睛
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(r * 0.3, -r * 0.3, 3, 0, Math.PI * 2);
      ctx.arc(r * 0.3, r * 0.3, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(r * 0.35, -r * 0.3, 1.5, 0, Math.PI * 2);
      ctx.arc(r * 0.35, r * 0.3, 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'fast':
      // 三角形（顶点指向面朝方向）
      ctx.beginPath();
      ctx.moveTo(r + 4, 0);
      ctx.lineTo(-r, -r * 0.8);
      ctx.lineTo(-r, r * 0.8);
      ctx.closePath();
      ctx.fill();
      // 眼睛
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(r * 0.2, -r * 0.2, 2, 0, Math.PI * 2);
      ctx.arc(r * 0.2, r * 0.2, 2, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'tank':
      // 正方形
      ctx.fillRect(-r, -r, r * 2, r * 2);
      // 眼睛
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(r * 0.3, -r * 0.35, 3.5, 0, Math.PI * 2);
      ctx.arc(r * 0.3, r * 0.35, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(r * 0.4, -r * 0.35, 2, 0, Math.PI * 2);
      ctx.arc(r * 0.4, r * 0.35, 2, 0, Math.PI * 2);
      ctx.fill();
      // 冲刺指示
      if (monster.state === 'dashing') {
        ctx.strokeStyle = '#ff6666';
        ctx.lineWidth = 3;
        ctx.strokeRect(-r - 2, -r - 2, r * 2 + 4, r * 2 + 4);
      }
      break;

    case 'bomber':
      // 圆形 + 脉冲
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      // 倒计时视觉
      if (monster.state === 'exploding') {
        ctx.strokeStyle = `rgba(255,200,0,${alpha})`;
        ctx.lineWidth = 3;
        const progress = 1 - (monster.explosionTimer / template.explosionDelay);
        ctx.beginPath();
        ctx.arc(0, 0, r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.stroke();
      }
      // 眼睛
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(r * 0.25, -r * 0.3, 2.5, 0, Math.PI * 2);
      ctx.arc(r * 0.25, r * 0.3, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'ranged':
      // 菱形
      ctx.beginPath();
      ctx.moveTo(r + 2, 0);
      ctx.lineTo(0, -r);
      ctx.lineTo(-r - 2, 0);
      ctx.lineTo(0, r);
      ctx.closePath();
      ctx.fill();
      // 眼睛
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(r * 0.2, -r * 0.3, 2, 0, Math.PI * 2);
      ctx.arc(r * 0.2, r * 0.3, 2, 0, Math.PI * 2);
      ctx.fill();
      // 射击闪光
      if (monster.shootFlashTimer > 0) {
        ctx.fillStyle = `rgba(255,200,255,${monster.shootFlashTimer * 3})`;
        ctx.beginPath();
        ctx.arc(r + 6, 0, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      break;

    case 'shocker':
      // 六边形（震荡怪）
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      // 震荡波指示
      if (monster.shockWaveActive) {
        ctx.strokeStyle = 'rgba(68,102,221,0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      // 眼睛
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(r * 0.3, -r * 0.3, 3, 0, Math.PI * 2);
      ctx.arc(r * 0.3, r * 0.3, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(r * 0.35, -r * 0.3, 1.5, 0, Math.PI * 2);
      ctx.arc(r * 0.35, r * 0.3, 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'golem':
      // 大圆形（巨石怪）
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      // 石纹条纹
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 0.2);
      ctx.lineTo(r * 0.4, r * 0.1);
      ctx.moveTo(-r * 0.3, r * 0.4);
      ctx.lineTo(r * 0.5, -r * 0.3);
      ctx.stroke();
      // 眼睛
      ctx.fillStyle = '#ff4400';
      ctx.beginPath();
      ctx.arc(r * 0.25, -r * 0.25, 4, 0, Math.PI * 2);
      ctx.arc(r * 0.25, r * 0.25, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
  }

  ctx.rotate(-facingAngle); // 恢复旋转以绘制血条

  // 血条（受伤后显示）
  if (hp < maxHp) {
    const barWidth = r * 2;
    const barHeight = 3;
    const barY = -r - 8;
    ctx.fillStyle = '#333';
    ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);
    ctx.fillStyle = hp > maxHp * 0.3 ? '#44cc44' : '#cc4444';
    ctx.fillRect(-barWidth / 2, barY, barWidth * (hp / maxHp), barHeight);
  }

  ctx.restore();
}

/**
 * 绘制Boss占位图
 */
export function drawBossPlaceholder(ctx, boss) {
  const { x, y, facingAngle, hp, maxHp, phase } = boss;
  const config = boss.config || {};
  const r = boss.bodyRadius || config.bodyRadius || 36;

  ctx.save();
  ctx.translate(x, y);

  // 获取阶段颜色
  const phaseConfig = config[`phase${phase}`] || {};
  const phaseColor = phaseConfig.color || (phase === 3 ? '#992222' : phase === 2 ? '#7722bb' : (config.color || '#6622aa'));
  const coreColor = config.coreColor || '#9944dd';
  ctx.fillStyle = phaseColor;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const wobble = r + Math.sin(performance.now() * 0.003 + i * 1.5) * 4;
    const px = Math.cos(angle) * wobble;
    const py = Math.sin(angle) * wobble;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // 旋转核心
  ctx.save();
  ctx.rotate(performance.now() * 0.002);
  ctx.fillStyle = coreColor;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const px = Math.cos(angle) * 14;
    const py = Math.sin(angle) * 14;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 眼睛（朝向方向）
  ctx.save();
  ctx.rotate(facingAngle);
  ctx.fillStyle = '#ff4444';
  ctx.beginPath();
  ctx.arc(16, -10, 5, 0, Math.PI * 2);
  ctx.arc(16, 10, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(18, -10, 2.5, 0, Math.PI * 2);
  ctx.arc(18, 10, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 狂暴黑烟粒子（最后阶段）
  if (phaseConfig.smokeColor || phase >= 3) {
    ctx.fillStyle = phaseConfig.smokeColor || 'rgba(50,0,0,0.3)';
    for (let i = 0; i < 5; i++) {
      const ox = Math.sin(performance.now() * 0.005 + i * 2) * (r + 10);
      const oy = Math.cos(performance.now() * 0.004 + i * 3) * (r + 10);
      ctx.beginPath();
      ctx.arc(ox, oy, 8 + Math.sin(performance.now() * 0.006 + i) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 血条
  const barWidth = 80;
  const barHeight = 6;
  const barY = -r - 14;
  ctx.fillStyle = '#333';
  ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);
  const hpRatio = hp / maxHp;
  ctx.fillStyle = hpRatio > 0.6 ? (config.color || '#aa44ff') : hpRatio > 0.25 ? '#ff8844' : '#ff2222';
  ctx.fillRect(-barWidth / 2, barY, barWidth * hpRatio, barHeight);
  ctx.strokeStyle = config.color || '#6622aa';
  ctx.lineWidth = 1;
  ctx.strokeRect(-barWidth / 2, barY, barWidth, barHeight);

  ctx.restore();
}

/**
 * 绘制旋转剑占位图
 */
export function drawSwordPlaceholder(ctx, x, y, angle, length = 20, width = 6, isTemp = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = isTemp ? 0.6 : 1;

  // 剑刃
  ctx.fillStyle = isTemp ? '#aaddff' : '#ddeeff';
  ctx.beginPath();
  ctx.moveTo(length, 0);
  ctx.lineTo(-4, -width / 2);
  ctx.lineTo(-4, width / 2);
  ctx.closePath();
  ctx.fill();

  // 剑柄
  ctx.fillStyle = '#8899aa';
  ctx.fillRect(-8, -width / 2 - 1, 8, width + 2);

  // 发光
  ctx.shadowColor = isTemp ? '#88ccff' : '#aaddff';
  ctx.shadowBlur = 6;
  ctx.fillStyle = isTemp ? '#cceeFF' : '#ffffff';
  ctx.beginPath();
  ctx.arc(length * 0.5, 0, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * 绘制道具占位图
 */
export function drawItemPlaceholder(ctx, item) {
  const { x, y, config } = item;
  const r = config.radius;
  const time = performance.now() * 0.003;
  const blink = item.remainingTime < 5 ? (Math.sin(time * 8) > 0 ? 1 : 0.3) : 1;

  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = blink;

  // 发光底圈
  ctx.fillStyle = config.glowColor;
  ctx.beginPath();
  ctx.arc(0, 0, r + 4 + Math.sin(time) * 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = config.color;
  switch (config.shape) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'cross':
      ctx.fillRect(-r, -2, r * 2, 4);
      ctx.fillRect(-2, -r, 4, r * 2);
      break;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.fill();
      break;
    case 'triangle':
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, r * 0.7);
      ctx.lineTo(-r, r * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    case 'sword':
      ctx.fillRect(-2, -r, 4, r * 2);
      ctx.fillRect(-5, r * 0.3, 10, 3);
      break;
    case 'hexagon':
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * 绘制弹道占位图
 */
export function drawProjectilePlaceholder(ctx, proj) {
  ctx.save();
  ctx.translate(proj.x, proj.y);
  ctx.fillStyle = proj.isBoss ? '#8844cc' : '#9944cc';
  ctx.shadowColor = proj.isBoss ? '#aa66ff' : '#bb66ff';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(0, 0, proj.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}
