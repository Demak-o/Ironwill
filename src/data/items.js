/* Ironwill - the shop's item pool, rarity roll (driven by Luck) and the
 * level-up stat cards. */
(function () {
    'use strict';
    window.IW = window.IW || {};
    var U = IW.util;
    var A = IW.Assets;

    /* Higher rarity = rarer. `base` is the weight before Luck is applied. */
    IW.RarityList = [
        { id: 1, key: 'common', name: 'Common', colour: '#d9d3bd', base: 100, cost: 14 },
        { id: 2, key: 'uncommon', name: 'Uncommon', colour: '#7ec850', base: 52, cost: 27 },
        { id: 3, key: 'rare', name: 'Rare', colour: '#4aa3e0', base: 20, cost: 46 },
        { id: 4, key: 'epic', name: 'Epic', colour: '#b464e0', base: 6.0, cost: 78 },
        { id: 5, key: 'legendary', name: 'Legendary', colour: '#f0a72a', base: 1.25, cost: 125 }
    ];

    IW.Rarities = [null];
    IW.RarityList.forEach(function (r) { IW.Rarities.push(r); });

    /* Luck shifts weight from common toward the top tiers.
     * factor is per point of Luck. */
    var LUCK_FACTOR = { 1: -0.0055, 2: 0, 3: 0.035, 4: 0.06, 5: 0.09 };

    IW.rarityWeights = function (luck) {
        var l = Math.max(-20, Math.min(150, luck || 0));
        return IW.RarityList.map(function (r) {
            var factor = 1 + (LUCK_FACTOR[r.id] || 0) * l;
            if (factor < 0.2) { factor = 0.2; }
            return { v: r.id, w: r.base * factor };
        });
    };

    IW.rollRarity = function (rng, luck) {
        return U.weightedPick(rng, IW.rarityWeights(luck));
    };

    /* Average rarity for a given Luck - used by the UI and the tests. */
    IW.expectedRarity = function (luck) {
        var entries = IW.rarityWeights(luck), total = 0, sum = 0;
        entries.forEach(function (e) { total += e.w; sum += e.w * e.v; });
        return total > 0 ? sum / total : 0;
    };

    IW.priceItem = function (item, wave) {
        return Math.max(1, Math.round(item.cost * (1 + 0.04 * Math.max(0, wave - 1))));
    };

    IW.instantiate = function (item, wave) {
        return {
            id: item.id,
            name: item.name,
            rarity: item.rarity,
            rarityName: IW.Rarities[item.rarity].name,
            rarityColour: IW.Rarities[item.rarity].colour,
            cost: IW.priceItem(item, wave),
            mods: item.mods,
            icon: item.icon,
            flavour: item.flavour
        };
    };

    /* Roll `count` shop slots: pick a rarity (Luck!), then an item of that rarity.
     * `exclude` keeps a shop free of duplicates, `owned` is only informational. */
    IW.rollShop = function (rng, luck, count, wave, exclude) {
        var used = {};
        (exclude || []).forEach(function (id) { used[id] = 1; });
        var out = [];
        for (var i = 0; i < count; i++) {
            var rarity = IW.rollRarity(rng, luck);
            var pool = IW.Items.filter(function (it) { return it.rarity === rarity && !used[it.id]; });
            if (!pool.length) { pool = IW.Items.filter(function (it) { return !used[it.id]; }); }
            if (!pool.length) { out.push(null); continue; }
            var item = U.pick(rng, pool);
            used[item.id] = 1;
            out.push(IW.instantiate(item, wave));
        }
        return out;
    };

    /* ------------------------------------------------------- level-up cards */

    IW.StatUpgrades = [
        { id: 'up_hp', name: '+18 Max HP', mods: { maxHp: 18 }, icon: A.icon('icon04') },
        { id: 'up_regen', name: '+1.0 Regen', mods: { regen: 1.0 }, icon: A.icon('icon11') },
        { id: 'up_armor', name: '+2 Armor', mods: { armor: 2 }, icon: A.icon('icon06') },
        { id: 'up_dodge', name: '+5% Dodge', mods: { dodge: 0.05 }, icon: A.icon('icon07') },
        { id: 'up_damage', name: '+10% Damage', mods: { damage: 0.10 }, icon: A.icon('icon05') },
        { id: 'up_melee', name: '+12% Melee Damage', mods: { melee: 0.12 }, icon: A.icon('tool1') },
        { id: 'up_ranged', name: '+12% Ranged Damage', mods: { ranged: 0.12 }, icon: A.icon('u:Blue:Archer:Arrow') },
        { id: 'up_atkspeed', name: '+10% Attack Speed', mods: { attackSpeed: 0.10 }, icon: A.icon('icon10') },
        { id: 'up_move', name: '+8% Move Speed', mods: { moveSpeed: 0.08 }, icon: A.icon('icon08') },
        { id: 'up_crit', name: '+6% Crit Chance', mods: { crit: 0.06 }, icon: A.icon('icon09') },
        { id: 'up_critdmg', name: '+20% Crit Damage', mods: { critDamage: 0.20 }, icon: A.swordFor(3) },
        { id: 'up_lifesteal', name: '+3% Lifesteal', mods: { lifesteal: 0.03 }, icon: A.icon('meat') },
        { id: 'up_pickup', name: '+40 Pickup Range', mods: { pickup: 40 }, icon: A.icon('icon02') },
        { id: 'up_luck', name: '+5 Luck', mods: { luck: 5 }, icon: A.icon('icon03') },
        { id: 'up_cooldown', name: '+8% Cooldown Reduction', mods: { cooldown: 0.08 }, icon: A.icon('icon12') }
    ];

    IW.rollUpgrades = function (rng, count) {
        return U.shuffle(rng, IW.StatUpgrades.slice()).slice(0, count || 3);
    };
/* ----------------------------------------------------------- item pool */

    var I = A.icon;
    var SW = A.swordFor;

    IW.Items = [
        /* --- Common ------------------------------------------------------- */
        { id: 'leather_cap', name: 'Leather Cap', rarity: 1, cost: 13, mods: { maxHp: 14, armor: 1 }, icon: I('icon04'), flavour: 'Better than a bare head.' },
        { id: 'plank_shield', name: 'Plank Shield', rarity: 1, cost: 15, mods: { armor: 2 }, icon: I('icon06'), flavour: 'Two boards and a prayer.' },
        { id: 'sharp_stone', name: 'Sharp Stone', rarity: 1, cost: 14, mods: { damage: 0.06 }, icon: I('icon05'), flavour: 'Grind an edge onto anything.' },
        { id: 'trail_boots', name: 'Trail Boots', rarity: 1, cost: 13, mods: { moveSpeed: 0.06 }, icon: I('icon08'), flavour: 'Worn thin, still fast.' },
        { id: 'whetstone', name: 'Whetstone', rarity: 1, cost: 15, mods: { attackSpeed: 0.06 }, icon: I('icon10'), flavour: 'A sharper rhythm.' },
        { id: 'short_bow', name: 'Short Bow', rarity: 1, cost: 15, mods: { ranged: 0.08 }, icon: I('u:Blue:Archer:Arrow'), flavour: 'Quick draw, light pull.' },
        { id: 'herb_pouch', name: 'Herb Pouch', rarity: 1, cost: 14, mods: { regen: 0.5 }, icon: I('icon11'), flavour: 'Smells foul, works wonders.' },
        { id: 'lucky_coin', name: 'Lucky Coin', rarity: 1, cost: 15, mods: { luck: 3 }, icon: I('icon03'), flavour: 'Heads you win.' },
        { id: 'iron_dagger', name: 'Iron Dagger', rarity: 1, cost: 16, mods: { damage: 0.05, crit: 0.03 }, icon: I('tool1'), flavour: 'Small, mean, quick.' },
        { id: 'hunter_hood', name: 'Hunter Hood', rarity: 1, cost: 14, mods: { dodge: 0.04, moveSpeed: 0.03 }, icon: I('icon07'), flavour: 'Hide in plain sight.' },
        { id: 'woodcutter_axe', name: 'Woodcutter Axe', rarity: 1, cost: 16, mods: { melee: 0.07, damage: 0.03 }, icon: I('tool2'), flavour: 'Fells oaks and ogres alike.' },

        /* --- Uncommon ----------------------------------------------------- */
        { id: 'iron_sword', name: 'Iron Sword', rarity: 2, cost: 26, mods: { damage: 0.12 }, icon: SW(2), flavour: 'Honest steel.' },
        { id: 'tower_shield', name: 'Tower Shield', rarity: 2, cost: 27, mods: { armor: 4, moveSpeed: -0.04 }, icon: I('icon06'), flavour: 'A wall you can carry.' },
        { id: 'hunter_cloak', name: 'Hunter Cloak', rarity: 2, cost: 25, mods: { dodge: 0.06 }, icon: I('icon07'), flavour: 'Cut for the thicket.' },
        { id: 'meat_hook', name: 'Meat Hook', rarity: 2, cost: 28, mods: { maxHp: 22, lifesteal: 0.02 }, icon: I('meat'), flavour: 'Dinner, then dinner again.' },
        { id: 'full_quiver', name: 'Full Quiver', rarity: 2, cost: 28, mods: { ranged: 0.12, attackSpeed: 0.04 }, icon: I('u:Blue:Archer:Arrow'), flavour: 'Forty shafts, all fletched.' },
        { id: 'fortuna_charm', name: 'Fortuna Charm', rarity: 2, cost: 27, mods: { luck: 5, pickup: 40 }, icon: I('icon12'), flavour: 'It hums when coins are near.' },
        { id: 'steel_helm', name: 'Steel Helm', rarity: 2, cost: 28, mods: { maxHp: 16, armor: 2 }, icon: I('icon06'), flavour: 'Rings like a bell, saves your skull.' },
        { id: 'berserker_ring', name: 'Berserker Ring', rarity: 2, cost: 26, mods: { melee: 0.14, maxHp: -10 }, icon: I('icon09'), flavour: 'It wants your blood as payment.' },
        { id: 'swift_gloves', name: 'Swift Gloves', rarity: 2, cost: 27, mods: { attackSpeed: 0.10, crit: 0.03 }, icon: I('icon10'), flavour: 'Wrapped tight for fast work.' },
        { id: 'farmers_pick', name: "Farmer's Pick", rarity: 2, cost: 26, mods: { damage: 0.10, pickup: 60 }, icon: I('tool4'), flavour: 'Hauls up anything glittering.' },

        /* --- Rare --------------------------------------------------------- */
        { id: 'knight_blade', name: 'Knight Blade', rarity: 3, cost: 46, mods: { damage: 0.16, melee: 0.10 }, icon: SW(3), flavour: 'Forged for the last stand.' },
        { id: 'emerald_amulet', name: 'Emerald Amulet', rarity: 3, cost: 48, mods: { crit: 0.09, critDamage: 0.18 }, icon: I('icon07'), flavour: 'Finds the seam in every plate.' },
        { id: 'tower_aegis', name: 'Tower Aegis', rarity: 3, cost: 47, mods: { armor: 5, dodge: 0.05 }, icon: I('icon06'), flavour: 'Winter-blue and unbothered.' },
        { id: 'vampiric_fang', name: 'Vampiric Fang', rarity: 3, cost: 49, mods: { lifesteal: 0.06, damage: 0.08 }, icon: I('icon01'), flavour: 'It drinks, you heal.' },
        { id: 'glittering_hoard', name: 'Glittering Hoard', rarity: 3, cost: 45, mods: { luck: 9, pickup: 50 }, icon: I('icon03'), flavour: 'Greed, organised.' },
        { id: 'windstep_boots', name: 'Windstep Boots', rarity: 3, cost: 46, mods: { moveSpeed: 0.12, dodge: 0.05 }, icon: I('icon08'), flavour: 'You barely touch the ground.' },
        { id: 'yew_longbow', name: 'Yew Longbow', rarity: 3, cost: 47, mods: { ranged: 0.18, crit: 0.06 }, icon: I('u:Blue:Archer:Arrow'), flavour: 'Draws heavy, flies true.' },
        { id: 'war_drum', name: 'War Drum', rarity: 3, cost: 45, mods: { attackSpeed: 0.14, cooldown: 0.06 }, icon: I('icon12'), flavour: 'The beat sets the tempo of the fight.' },

        /* --- Epic --------------------------------------------------------- */
        { id: 'champion_plate', name: 'Champion Plate', rarity: 4, cost: 78, mods: { maxHp: 34, armor: 5, moveSpeed: -0.06 }, icon: I('icon06'), flavour: 'Worn by champions, weighs like one.' },
        { id: 'executioner_axe', name: "Executioner's Axe", rarity: 4, cost: 76, mods: { damage: 0.26, attackSpeed: -0.08 }, icon: I('tool2'), flavour: 'Slow, terrifying, final.' },
        { id: 'assassin_fang', name: "Assassin's Fang", rarity: 4, cost: 80, mods: { crit: 0.16, critDamage: 0.35 }, icon: I('tool1'), flavour: 'One chance is all it needs.' },
        { id: 'titan_heart', name: 'Titan Heart', rarity: 4, cost: 74, mods: { maxHp: 30, regen: 1.6 }, icon: I('meat'), flavour: 'Still beating, somehow.' },
        { id: 'storm_quiver', name: 'Storm Quiver', rarity: 4, cost: 79, mods: { ranged: 0.26, attackSpeed: 0.10 }, icon: I('u:Blue:Archer:Arrow'), flavour: 'Arrows like hail.' },
        { id: 'zealots_bell', name: "Zealot's Bell", rarity: 4, cost: 76, mods: { damage: 0.16, cooldown: 0.12, regen: 1.0 }, icon: I('icon11'), flavour: 'Tolls for the faithful and the foul.' },

        /* --- Legendary ---------------------------------------------------- */
        { id: 'crown_of_avarice', name: 'Crown of Avarice', rarity: 5, cost: 125, mods: { luck: 18, damage: 0.10, pickup: 80 }, icon: I('icon03'), flavour: 'Rare things find their way to it.' },
        { id: 'dragonfang', name: 'Dragonfang', rarity: 5, cost: 130, mods: { damage: 0.40, crit: 0.08 }, icon: SW(5), flavour: 'Cut from something that used to fly.' },
        { id: 'aegis_of_eternity', name: 'Aegis of Eternity', rarity: 5, cost: 128, mods: { armor: 9, dodge: 0.10, maxHp: 26 }, icon: I('icon06'), flavour: 'Nothing gets through. Nothing.' },
        { id: 'philosopher_stone', name: 'Philosopher Stone', rarity: 5, cost: 135, mods: { damage: 0.12, attackSpeed: 0.15, regen: 2.5, cooldown: 0.15 }, icon: I('icon07'), flavour: 'Turns effort into gold.' },
        { id: 'ironwill_relic', name: 'The Ironwill', rarity: 5, cost: 140, mods: { damage: 0.18, maxHp: 25, lifesteal: 0.06, melee: 0.12, ranged: 0.12 }, icon: I('icon09'), flavour: 'Refuse to fall, and you will not.' },
        { id: 'duck_of_destiny', name: 'Duck of Destiny', rarity: 5, cost: 118, mods: { luck: 10, moveSpeed: 0.10, damage: 0.08 }, icon: I('duck'), flavour: 'Squeaks once per wave. Do not ask why.' }
    ];

    IW.itemById = function (id) {
        for (var i = 0; i < IW.Items.length; i++) { if (IW.Items[i].id === id) { return IW.Items[i]; } }
        return null;
    };
})();