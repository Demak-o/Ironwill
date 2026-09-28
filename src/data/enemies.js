/* Ironwill - enemy tiers (the non-blue unit colours), enemy archetypes and the
 * round/wave difficulty curve.
 *
 * Colour = strength tier:  Black(1) -> Red(2) -> Yellow(3) -> Purple(4).
 * Blue is reserved for the player's four classes.
 */
(function () {
    'use strict';
    window.IW = window.IW || {};
    var U = IW.util;

    IW.enemySheet = function (colour, type, anim) { return 'u:' + colour + ':' + type + ':' + anim; };

    IW.EnemyTiers = [
        { id: 1, colour: 'Black', name: 'Shade', hpMul: 1.0, dmgMul: 1.0, speedMul: 1.0, goldMul: 1.0, xpMul: 1.0, ring: '#565f6b' },
        { id: 2, colour: 'Red', name: 'Crimson', hpMul: 1.35, dmgMul: 1.25, speedMul: 1.06, goldMul: 1.8, xpMul: 1.5, ring: '#e05252' },
        { id: 3, colour: 'Yellow', name: 'Gilded', hpMul: 1.8, dmgMul: 1.5, speedMul: 1.12, goldMul: 2.8, xpMul: 2.2, ring: '#e8c04a' },
        { id: 4, colour: 'Purple', name: 'Void', hpMul: 2.6, dmgMul: 1.85, speedMul: 1.18, goldMul: 4.2, xpMul: 3.2, ring: '#a05ce0' }
    ];

    IW.tierById = function (id) { return IW.EnemyTiers[Math.max(0, Math.min(3, id - 1))]; };

    /* Enemy archetypes. Every tier has all five, so colour is purely strength. */
    IW.EnemyTypes = {
        pawn: {
            id: 'pawn', type: 'Pawn', name: 'Peasant', ai: 'chase',
            hp: 14, speed: 84, damage: 6, radius: 15, gold: 1, xp: 1,
            contactCd: 0.7, knockbackResist: 0,
            anims: { idle: 'Idle', run: 'Run' },
            weight: function (wave) { return Math.max(10, 62 - wave * 2.2); }
        },
        warrior: {
            id: 'warrior', type: 'Warrior', name: 'Man-at-Arms', ai: 'chase',
            hp: 46, speed: 60, damage: 13, radius: 19, gold: 2, xp: 2,
            contactCd: 0.8, knockbackResist: 0.35,
            windup: 0.38, attackRange: 56, attackCd: 1.7,
            anims: { idle: 'Idle', run: 'Run', attack: 'Attack1' },
            weight: function (wave, tier) { return 22 + tier * 5 + wave * 0.4; }
        },
        archer: {
            id: 'archer', type: 'Archer', name: 'Bowman', ai: 'ranged',
            hp: 24, speed: 74, damage: 9, radius: 16, gold: 2, xp: 2,
            contactCd: 1.0, knockbackResist: 0,
            keepDist: 238, shootCd: 2.4, projSpeed: 330, aimTime: 0.45,
            anims: { idle: 'Idle', run: 'Run', shoot: 'Shoot' },
            weight: function (wave, tier) { return wave >= 2 ? 18 + tier * 4 : 0; }
        },
        lancer: {
            id: 'lancer', type: 'Lancer', name: 'Pikeman', ai: 'charger',
            hp: 34, speed: 68, damage: 15, radius: 18, gold: 3, xp: 3,
            contactCd: 0.9, knockbackResist: 0.2,
            telegraph: 0.6, chargeSpeed: 3.1, chargeTime: 0.35, chargeCd: 3.2, chargeRange: 340,
            anims: { idle: 'Idle', run: 'Run', attack: 'Right_Attack' },
            weight: function (wave, tier) { return wave >= 4 ? 12 + tier * 4 : 0; }
        },
        monk: {
            id: 'monk', type: 'Monk', name: 'Zealot', ai: 'healer',
            hp: 30, speed: 78, damage: 4, radius: 16, gold: 3, xp: 3,
            contactCd: 1.0, knockbackResist: 0,
            healAmount: 10, healCd: 1.6, healRange: 180, keepDist: 155,
            anims: { idle: 'Idle', run: 'Run', effect: 'Heal_Effect' },
            weight: function (wave, tier) { return wave >= 5 ? 8 + tier * 2 : 0; }
        }
    };

    IW.EnemyTypeList = ['pawn', 'warrior', 'archer', 'lancer', 'monk'];

    /* Elites start appearing once the horde has teeth. */
    IW.ELITE = { scale: 1.28, hpMul: 3.0, dmgMul: 1.25, goldMul: 4, xpMul: 3, ring: '#ffd45e' };
/* ------------------------------------------------------------ wave curve */

    IW.waveConfig = function (wave) {
        var w = Math.max(1, wave);
        var duration = Math.min(60, 30 + (w - 1) * 1.5);
        var spawnInterval = Math.max(0.42, 2.1 - w * 0.09);
        var groupSize = 1 + Math.floor(w / 3);
        var cap = Math.min(72, 14 + w * 2);
        /* Health grows on a gentle quadratic so late waves stay punchy. */
        var hpMul = 1 + 0.13 * (w - 1) + 0.012 * Math.pow(w - 1, 2);
        var dmgMul = Math.min(3.2, 1 + 0.085 * (w - 1));
        var goldMul = 1 + 0.05 * (w - 1);
        var xpMul = 1 + 0.05 * (w - 1);
        var eliteChance = w >= 4 ? Math.min(0.18, 0.02 + (w - 4) * 0.012) : 0;
        return {
            wave: w,
            duration: duration,
            spawnInterval: spawnInterval,
            groupSize: groupSize,
            cap: cap,
            hpMul: hpMul,
            dmgMul: dmgMul,
            goldMul: goldMul,
            xpMul: xpMul,
            eliteChance: eliteChance
        };
    };

    /* Tier unlock schedule keeps the "colour = threat" promise honest. */
    IW.tierUnlockWave = function (tier) {
        return { 1: 1, 2: 3, 3: 6, 4: 9 }[tier] || 1;
    };

    IW.tierWeights = function (wave) {
        var out = [];
        IW.EnemyTiers.forEach(function (t) {
            var unlock = IW.tierUnlockWave(t.id);
            if (wave < unlock) { return; }
            var growth = 8 + (wave - unlock) * 6.5 + t.id * 2;
            var weight = t.id === 1 ? Math.max(8, 62 - wave * 2.4) : Math.min(58, growth);
            if (weight > 0) { out.push({ v: t.id, w: weight }); }
        });
        return out.length ? out : [{ v: 1, w: 1 }];
    };

    IW.typeWeights = function (wave, tier) {
        var out = [];
        IW.EnemyTypeList.forEach(function (id) {
            var t = IW.EnemyTypes[id];
            var weight = t.weight(wave, tier);
            if (weight > 0) { out.push({ v: id, w: weight }); }
        });
        return out.length ? out : [{ v: 'pawn', w: 1 }];
    };

    IW.rollTier = function (rng, wave) {
        return U.weightedPick(rng, IW.tierWeights(wave));
    };

    IW.rollEnemyType = function (rng, wave, tier) {
        return U.weightedPick(rng, IW.typeWeights(wave, tier));
    };

    /* Final numbers for one spawned enemy. */
    IW.enemyStats = function (tierId, typeId, wave, elite) {
        var tier = IW.tierById(tierId);
        var type = IW.EnemyTypes[typeId];
        var cfg = IW.waveConfig(wave);
        var eliteMul = elite ? IW.ELITE : null;
        var hp = type.hp * tier.hpMul * cfg.hpMul * (eliteMul ? eliteMul.hpMul : 1);
        var dmg = type.damage * tier.dmgMul * cfg.dmgMul * (eliteMul ? eliteMul.dmgMul : 1);
        var gold = type.gold * tier.goldMul * cfg.goldMul * 0.9 * (eliteMul ? eliteMul.goldMul : 1);
        var xp = type.xp * tier.xpMul * cfg.xpMul * (eliteMul ? eliteMul.xpMul : 1);
        return {
            hp: Math.max(1, Math.round(hp)),
            damage: Math.max(1, Math.round(dmg)),
            speed: type.speed * tier.speedMul * (elite ? 1.05 : 1),
            gold: Math.max(1, Math.round(gold)),
            xp: Math.max(1, Math.round(xp)),
            radius: type.radius * (elite ? IW.ELITE.scale : 1),
            contactCd: type.contactCd,
            knockbackResist: Math.min(0.9, type.knockbackResist + (elite ? 0.2 : 0))
        };
    };

    /* Bonus loot chance for a kill, boosted by the Luck stat. */
    IW.dropRoll = function (rng, luck) {
        var luckBonus = 1 + Math.min(1, luck / 60);
        var out = { meat: 0, bonus: 0 };
        if (rng() < 0.045 * luckBonus) { out.meat = 1; }
        if (rng() < 0.06 * luckBonus) { out.bonus = Math.max(1, Math.round(2 * luckBonus)); }
        return out;
    };
})();