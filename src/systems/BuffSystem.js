/**
 * Buff 管理系统
 * 处理 Buff 的获取、升级、上限检查
 * 同类 buff 可重复获取进行升级，效果随等级递增
 * 独特 buff (unique) 只能获取一次
 */

import { BUFF_POOL, BUFF_QUALITY, QUALITY_RATES, SCHOOL_ASSOCIATIONS } from '../config/buffs.js';
import { PLAYER_CONFIG } from '../config/player.js';
import { getCapForStage } from '../config/stages.js';

const QUALITY_ORDER = ['white', 'blue', 'purple', 'gold'];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class BuffSystem {
  constructor() {
    // ownedBuffs: Map<buffId, { buff, stacks(=level), quality }>
    this.ownedBuffs = new Map();
    this.buffList = [];
  }

  /**
   * 等级倍率（总效果倍率）
   * L1: 1.0, L2: 1.2, L3: 1.5, L4: 1.9, L5: 2.4, L6: 3.0, L7: 3.7
   * 公式: 1 + 0.05 * (level-1) * (level+2)
   */
  _getLevelMultiplier(level) {
    return 1 + 0.05 * (level - 1) * (level + 2);
  }

  /**
   * 生成三选一选项
   * 非独特 buff 可重复出现（升级）
   * 独特/达到上限的 buff 不会出现
   */
  generateChoices(playerLevel) {
    const candidates = [];
    const available = this._getAvailableBuffs();
    if (available.length === 0) return [];

    const associatedBuff = this._pickAssociated(available);
    if (associatedBuff) candidates.push(associatedBuff);

    const shuffled = available.filter(b => !candidates.find(c => c.id === b.id));
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    while (candidates.length < 3 && shuffled.length > 0) {
      candidates.push(shuffled.pop());
    }

    for (const buff of candidates) {
      buff._assignedQuality = this._rollQuality(playerLevel, buff.quality);
      const owned = this.ownedBuffs.get(buff.id);
      buff._isUpgrade = !!owned;
      buff._currentLevel = owned ? owned.stacks : 0;
    }

    return candidates.slice(0, 3);
  }

  /**
   * 应用 buff — 升级或新增
   */
  applyBuff(buffId, player, assignedQuality) {
    const buffDef = BUFF_POOL.find(b => b.id === buffId);
    if (!buffDef) return;

    const existing = this.ownedBuffs.get(buffId);
    const q = assignedQuality || buffDef.quality;

    if (existing) {
      // 升级：层数+1（即等级+1）
      existing.stacks++;
      // 品质升级：低级不覆盖高级
      const existIdx = QUALITY_ORDER.indexOf(existing.quality);
      const newIdx = QUALITY_ORDER.indexOf(q);
      if (newIdx > existIdx) {
        existing.quality = q;
      }
    } else {
      this.ownedBuffs.set(buffId, { buff: buffDef, stacks: 1, quality: q });
      this.buffList.push(buffDef);
    }

    this._applyToPlayer(player);
  }

  /**
   * 重置属性到基础值，然后累加所有 buff 效果
   */
  _applyToPlayer(player) {
    // 使用角色专属配置作为基础值
    const baseConfig = player.heroConfig;

    // 重置到基础值
    player.critChance = 0;
    player.multiTarget = 1;
    player.armorPen = 0;
    player.damageBonus = 0;
    player.enchants.clear();
    player.elementMastery = 0;
    player.hpRegen = 0;
    player.lifesteal = 0;
    player.shieldGenAmount = 0;
    player.damageReduction = 0;
    player.knockback = 0;
    player.knockbackBonus = 0;
    player.hasGravity = false;
    player.hasSlowAura = false;
    player.hasExecute = false;

    player.swordCount = baseConfig.SWORD_COUNT;
    player.swordRadius = baseConfig.SWORD_RADIUS;
    player.swordRotationSpeed = baseConfig.SWORD_ROTATION_SPEED;
    player.swordDamage = baseConfig.SWORD_DAMAGE;
    player.swordLength = baseConfig.SWORD_LENGTH;
    player.swordHitRadius = baseConfig.SWORD_HIT_RADIUS;
    player.maxHp = baseConfig.HP;
    player.dodgeChance = baseConfig.DODGE_CHANCE;
    player.hasRevive = false;
    player.reviveUsed = false;

    // 应用跨关卡加成（在buff之前，乘算基础值）
    if (player.stageBonus) {
      const bonus = player.stageBonus;
      player.maxHp = Math.round(player.maxHp * bonus.hpMult);
      player.swordDamage = Math.round(player.swordDamage * bonus.atkMult);
      player.moveSpeed = Math.round(player.moveSpeed * bonus.spdMult);
      player.dodgeChance = player.dodgeChance * bonus.dodgeMult;
      player.swordRadius = Math.round(player.swordRadius * bonus.rangeMult);
    }

    // 累加所有 buff 效果
    for (const [id, { buff, stacks, quality }] of this.ownedBuffs) {
      this._applySingleBuff(player, buff, stacks, quality);
    }

    this._enforceCaps(player);
  }

  /**
   * 单个 buff 效果应用（升级模式）
   * stacks 即为 buff 等级，使用等级倍率计算总效果
   */
  _applySingleBuff(player, buff, level, quality) {
    const eff = buff.effect;

    // 品质加成系数
    const qIdx = QUALITY_ORDER.indexOf(quality);
    const qMultiplier = 1 + qIdx * 0.3; // white=1.0, blue=1.3, purple=1.6, gold=1.9

    // 等级倍率
    const lvlMul = this._getLevelMultiplier(level);

    // 元素附魔特殊处理
    if (eff.type === 'enchant') {
      player.enchants.add(eff.element);
      return;
    }

    switch (buff.id) {
      case 'sword_count':
        // 剑数：每级 +1，不用等级倍率（整数无法细分）
        player.swordCount += level;
        break;
      case 'sword_length':
        // 剑刃长度：使用等级倍率
        player.swordLength += Math.round(eff.value * lvlMul);
        player.swordHitRadius += Math.round(3 * lvlMul);
        break;
      case 'rotation_speed':
        player.swordRotationSpeed += Math.round(eff.value * qMultiplier * lvlMul);
        break;
      case 'attack_range':
        player.swordRadius += Math.round(eff.value * qMultiplier * lvlMul);
        break;
      case 'damage_up':
        player.swordDamage += Math.round(eff.value * qMultiplier * lvlMul);
        break;
      case 'crit_chance':
        player.critChance += eff.value * qMultiplier * lvlMul;
        break;
      case 'multi_target':
        // 每级 +1，不用等级倍率
        player.multiTarget += level;
        break;
      case 'sharp_blade':
        player.swordDamage += Math.round(10 * qMultiplier);
        player.armorPen = 0.2 * qMultiplier;
        break;
      case 'element_mastery':
        player.elementMastery += eff.value * qMultiplier * lvlMul;
        break;
      case 'hp_up':
        player.maxHp += Math.round(eff.value * qMultiplier * lvlMul);
        break;
      case 'dodge_up':
        player.dodgeChance += eff.value * qMultiplier * lvlMul;
        break;
      case 'hp_regen':
        player.hpRegen += Math.round(eff.value * qMultiplier * lvlMul);
        break;
      case 'lifesteal':
        player.lifesteal += eff.value * qMultiplier * lvlMul;
        break;
      case 'shield_gen':
        player.shieldGenAmount += Math.round(eff.value * qMultiplier * lvlMul);
        break;
      case 'steel_will':
        player.damageReduction = 0.2 * qMultiplier;
        break;
      case 'revive':
        player.hasRevive = true;
        break;
      case 'knockback':
        player.knockback = Math.round(50 * qMultiplier);
        break;
      case 'knockback_plus':
        player.knockbackBonus += Math.round(eff.value * qMultiplier * lvlMul);
        break;
      case 'gravity_field':
        player.hasGravity = true;
        break;
      case 'slow_aura':
        player.hasSlowAura = true;
        break;
      case 'execute':
        player.hasExecute = true;
        break;
    }
  }

  _enforceCaps(player) {
    const stage = player.currentStage || 1;
    player.maxHp = Math.min(player.maxHp, getCapForStage('MAX_HP', stage));
    player.dodgeChance = Math.min(player.dodgeChance, PLAYER_CONFIG.MAX_DODGE + (stage - 1) * 0.05);
    player.swordCount = Math.min(player.swordCount, getCapForStage('MAX_SWORD_COUNT', stage));
    player.swordRadius = Math.min(player.swordRadius, getCapForStage('MAX_SWORD_RADIUS', stage));
    player.swordRotationSpeed = Math.min(player.swordRotationSpeed, getCapForStage('MAX_ROTATION_SPEED', stage));
    player.swordLength = Math.min(player.swordLength, getCapForStage('MAX_SWORD_LENGTH', stage));
    player.swordHitRadius = Math.min(player.swordHitRadius, getCapForStage('MAX_SWORD_HIT_RADIUS', stage));
    player.critChance = Math.min(player.critChance, getCapForStage('MAX_CRIT_CHANCE', stage));
    if (player.hp > player.maxHp) player.hp = player.maxHp;
  }

  /**
   * 获取可选取的 buff
   * - 未拥有 → 可选
   * - 已拥有但非独特且未达上限 → 可选（升级）
   * - 已拥有且独特(unique) → 不可选
   * - 已拥有且达到上限 → 不可选
   * - 有前置需求(requires)未满足 → 不可选
   */
  _getAvailableBuffs() {
    return BUFF_POOL.filter(buff => {
      const owned = this.ownedBuffs.get(buff.id);
      if (!owned) {
        // 检查前置需求
        if (buff.requires && !this.ownedBuffs.has(buff.requires)) return false;
        return true;
      }
      if (buff.unique) return false;
      if (owned.stacks >= buff.maxStacks) return false;
      return true;
    });
  }

  _pickAssociated(available) {
    if (this.buffList.length === 0) return randomChoice(available);
    const ownedSchools = [...new Set(this.buffList.map(b => b.school))];
    const pairs = SCHOOL_ASSOCIATIONS.filter(pair => pair.some(s => ownedSchools.includes(s)));
    if (pairs.length === 0) return randomChoice(available);
    const pair = randomChoice(pairs);
    const school = randomChoice(pair);
    const schoolBuffs = available.filter(b => b.school === school);
    if (schoolBuffs.length === 0) return randomChoice(available);
    return randomChoice(schoolBuffs);
  }

  _rollQuality(playerLevel, baseQuality) {
    const rates = QUALITY_RATES.find(r => playerLevel <= r.maxLevel) || QUALITY_RATES[QUALITY_RATES.length - 1];
    const roll = Math.random();
    let cumulative = 0;
    for (const [quality, rate] of Object.entries(rates.rates)) {
      cumulative += rate;
      if (roll < cumulative) {
        const baseIdx = QUALITY_ORDER.indexOf(baseQuality);
        const rolledIdx = QUALITY_ORDER.indexOf(quality);
        return rolledIdx >= baseIdx ? quality : baseQuality;
      }
    }
    return baseQuality;
  }

  getOwnedBuffs() { return [...this.buffList]; }

  getBuffStacks(buffId) {
    const o = this.ownedBuffs.get(buffId);
    return o ? o.stacks : 0;
  }

  getBuffQuality(buffId) {
    const o = this.ownedBuffs.get(buffId);
    return o ? o.quality : 'white';
  }

  /**
   * 获取右上角 buff 显示数据
   * level 即为 buff 等级（被选择的次数）
   */
  getBuffDisplayList() {
    const result = [];
    for (const [id, { buff, stacks, quality }] of this.ownedBuffs) {
      result.push({ id, name: buff.name, school: buff.school, level: stacks, quality });
    }
    return result;
  }
}
