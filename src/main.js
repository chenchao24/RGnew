/**
 * 游戏入口
 */

import { Game } from './core/Game.js';
import { preloadSprites } from './utils/SpriteManager.js';

const canvas = document.getElementById('gameCanvas');
const game = new Game(canvas);

// 游戏循环
let lastTime = 0;
const targetDt = 1 / 60;
const maxDt = 1 / 30; // 防止大跳帧

function gameLoop(timestamp) {
  if (lastTime === 0) lastTime = timestamp;
  let dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  // 限制dt防止物理引擎爆炸
  dt = Math.min(dt, maxDt);

  // 处理标题/结算画面的点击
  game.update(dt);
  game.render();

  requestAnimationFrame(gameLoop);
}

// 鼠标点击
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  game.handleClick(x, y);
});

// 数字键选择Buff
window.addEventListener('keydown', (e) => {
  const key = e.key;
  if (key === '1' || key === '2' || key === '3') {
    const idx = parseInt(key) - 1;
    if (game.state === 'level_up' && game.buffChoices && game.buffChoices[idx]) {
      game.selectBuff(game.buffChoices[idx].id);
    }
  }
  // Enter/Space 在标题页进入角色选择
  if ((key === 'Enter' || key === ' ') && game.state === 'title') {
    game.state = 'select_hero';
    e.preventDefault();
  }
});

// 预加载精灵图片后启动游戏
preloadSprites().then(() => {
  // 背景图依赖精灵加载完成，重新初始化
  game._initBackground();
  requestAnimationFrame(gameLoop);
});
