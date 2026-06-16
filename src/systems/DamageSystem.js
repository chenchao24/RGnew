/**
 * 伤害计算系统
 * 处理物理/元素伤害、暴击、闪避、击退等
 */

import { BALANCE } from '../config/balance.js';
import { distance, angleTo } from '../utils/MathUtils.js';

export class DamageSystem {
  constructor() {
    this.damageNumbers = []; // 浮动伤害数字
    this.rangedShootingCount = 0; // 当前正在射击的远程怪数量
  }

  /**
   * 计算旋转剑对怪物的伤害
   */
  processSwordHits(player, monsters, swords) {
    const results = [];

    for (const sword of swords) {
      if (!sword) continue;
      const tip = sword.getTipPosition();
      let targetsHit = 0;

      for (const monster of monsters) {
        if (!monster.alive) continue;
        if (targetsHit >= player.multiTarget) break;

        const dist = distance(tip.x, tip.y, monster.x, monster.y);
        if (dist > player.swordHitRadius + monster.collisionRadius) continue;

        // 冷却检查
        if (!sword.canHit(monster.id, player.swordCooldown)) continue;

        // 命中！
        sword.registerHit(monster.id, player.swordCooldown);
        targetsHit++;

        // 计算伤害
        let damage = player.getTotalDamage();

        // 暴击判定
        let isCrit = false;
        if (Math.random() < player.critChance) {
          isCrit = true;
          damage = Math.round(damage * BALANCE.CRIT_MULTIPLIER);
        }

        // 造成伤害
        monster.takeDamage(damage);

        // 吸血
        if (player.lifesteal > 0) {
          const heal = Math.round(damage * player.lifesteal);
          player.hp = Math.min(player.maxHp, player.hp + heal);
        }

        // 击退
        if (player.knockback > 0) {
          const totalKnockback = player.knockback + player.knockbackBonus;
          monster.applyKnockback(totalKnockback, player.knockbackBonus > 0 ? BALANCE.KNOCKBACK_STUN : 0.15);
        }

        // 斩杀
        if (player.hasExecute && monster.hp > 0 && monster.hp / monster.maxHp <= BALANCE.EXECUTE_THRESHOLD) {
          monster.hp = 0;
          monster.alive = false;
        }

        // 元素附魔
        const elementResults = this._applyEnchants(player, monster);

        // 引力场效果
        if (player.hasGravity) {
          this._applyGravity(player, monster);
        }

        // 伤害数字
        this._addDamageNumber(monster.x, monster.y - 15, damage, isCrit ? 'crit' : 'normal');
        for (const elem of elementResults) {
          this._addDamageNumber(monster.x + (Math.random() - 0.5) * 10, monster.y - 25, elem.damage, elem.type);
        }

        results.push({ monster, damage, isCrit, killed: !monster.alive });
      }
    }

    return results;
  }

  /**
   * 应用元素附魔效果
   */
  _applyEnchants(player, monster) {
    const results = [];
    const masteryMult = 1 + player.elementMastery;

    if (player.enchants.has('fire')) {
      monster.fireTimer = BALANCE.FIRE_DOT_DURATION * masteryMult;
      const dotDmg = Math.round(BALANCE.FIRE_DOT_DPS);
      results.push({ type: 'fire', damage: dotDmg });
    }

    if (player.enchants.has('frost')) {
      monster.frostTimer = BALANCE.FROST_DURATION * masteryMult;
      results.push({ type: 'frost', damage: 0 });
    }

    if (player.enchants.has('lightning')) {
      // 连锁闪电由外部处理
      results.push({ type: 'lightning', damage: 0, chainCount: BALANCE.LIGHTNING_CHAIN_COUNT });
    }

    if (player.enchants.has('poison')) {
      monster.poisonStacks = Math.min(monster.poisonStacks + 1, BALANCE.POISON_MAX_STACKS);
      monster.poisonTimer = BALANCE.POISON_DOT_DURATION * masteryMult;
      results.push({ type: 'poison', damage: Math.round(BALANCE.POISON_DOT_DPS) });
    }

    return results;
  }

  /**
   * 处理元素DOT
   */
  processElementalDOTs(monsters, dt) {
    for (const monster of monsters) {
      if (!monster.alive) continue;

      // 灼烧
      if (monster.fireTimer > 0) {
        const dmg = Math.round(BALANCE.FIRE_DOT_DPS * dt);
        if (dmg > 0) {
          monster.takeDamage(dmg);
        }
      }

      // 中毒
      if (monster.poisonStacks > 0 && monster.poisonTimer > 0) {
        const dmg = Math.round(BALANCE.POISON_DOT_DPS * monster.poisonStacks * dt);
        if (dmg > 0) {
          monster.takeDamage(dmg);
        }
      }
    }
  }

  /**
   * 引力场效果
   */
  _applyGravity(player, monster) {
    const dx = player.x - monster.x;
    const dy = player.y - monster.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0 && dist <= player.swordRadius) {
      const pull = BALANCE.GRAVITY_PULL_SPEED * (1 / 60);
      monster.x += (dx / dist) * pull;
      monster.y += (dy / dist) * pull;
    }
  }

  /**
   * 处理怪物攻击玩家
   */
  processMonsterAttacks(monsters, player, dt) {
    const results = [];

    for (const monster of monsters) {
      if (!monster.alive) continue;
      if (monster.state !== 'attack' && monster.type !== 'FAST') continue;

      const dist = distance(monster.x, monster.y, player.x, player.y);
      if (dist > monster.attackRange + player.collisionRadius) continue;

      // 快速怪只在CHASE状态接触时造成伤害
      if (monster.type === 'FAST' && monster.state !== 'CHASE') continue;

      const damage = monster.getAttackDamage();
      const result = player.takeDamage(damage);

      if (result.dodged) {
        this._addDamageNumber(player.x, player.y - 20, 0, 'dodge');
      } else if (result.damage > 0) {
        this._addDamageNumber(player.x, player.y - 20, result.damage, 'player_hit');
      }

      if (result.shieldBroken) {
        this._addDamageNumber(player.x, player.y - 20, 0, 'shield');
      }

      results.push(result);

      // 快速怪攻击后不需要冷却
      if (monster.type === 'FAST') continue;

      // 其他怪物攻击后进入冷却
      if (monster.state === 'attack') {
        monster.state = 'cooldown';
        monster.stateTimer = 0;
      }
    }

    return results;
  }

  /**
   * 添加伤害数字
   */
  _addDamageNumber(x, y, value, type) {
    this.damageNumbers.push({
      x, y,
      value,
      type,
      lifetime: BALANCE.DAMAGE_NUMBER_LIFETIME,
      maxLifetime: BALANCE.DAMAGE_NUMBER_LIFETIME,
      vy: -BALANCE.DAMAGE_NUMBER_RISE_SPEED,
    });
  }

  /**
   * 更新伤害数字
   */
  updateDamageNumbers(dt) {
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const num = this.damageNumbers[i];
      num.lifetime -= dt;
      num.y += num.vy * dt;
      if (num.lifetime <= 0) {
        this.damageNumbers.splice(i, 1);
      }
    }
  }

  /**
   * 渲染伤害数字
   */
  renderDamageNumbers(ctx) {
    for (const num of this.damageNumbers) {
      const alpha = Math.min(1, num.lifetime / (num.maxLifetime * 0.5));
      ctx.save();
      ctx.globalAlpha = alpha;

      let color, size, text;
      switch (num.type) {
        case 'crit':
          color = '#FFD700';
          size = 22;
          text = num.value.toString();
          // 暴击放大效果
          const scale = 1 + (num.lifetime > num.maxLifetime * 0.8 ? 0.3 : 0);
          ctx.font = `bold ${size}px 'Segoe UI', sans-serif`;
          ctx.translate(num.x, num.y);
          ctx.scale(scale, scale);
          ctx.fillText(text, -ctx.measureText(text).width / 2, 0);
          ctx.restore();
          continue;
        case 'normal':
          color = '#FFFFFF';
          size = 16;
          text = num.value.toString();
          break;
        case 'fire':
          color = '#FF6600';
          size = 14;
          text = num.value > 0 ? num.value.toString() : '🔥';
          break;
        case 'frost':
          color = '#66CCFF';
          size = 14;
          text = '❄';
          break;
        case 'lightning':
          color = '#FFFF00';
          size = 14;
          text = '⚡';
          break;
        case 'poison':
          color = '#66FF66';
          size = 14;
          text = num.value > 0 ? num.value.toString() : '☠';
          break;
        case 'dodge':
          color = '#999999';
          size = 14;
          text = 'MISS';
          break;
        case 'player_hit':
          color = '#FF4444';
          size = 18;
          text = `-${num.value}`;
          break;
        case 'shield':
          color = '#44CCCC';
          size = 14;
          text = '🛡';
          break;
        case 'heal':
          color = '#00FF00';
          size = 16;
          text = `+${num.value}`;
          break;
        default:
          color = '#FFFFFF';
          size = 14;
          text = num.value.toString();
      }

      ctx.font = `bold ${size}px 'Segoe UI', sans-serif`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(text, num.x, num.y);
      ctx.restore();
    }
  }
}
