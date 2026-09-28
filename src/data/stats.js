/* Ironwill - character stat definitions, aggregation and formatting. */
(function () {
    'use strict';
    window.IW = window.IW || {};
    var U = IW.util;
    var A = IW.Assets;

    /* Every stat an item can modify. `kind` drives display: 'flat' shows +N,
     * 'percent' shows +N% (stored as a fraction, e.g. 0.08 = +8%). */
    var META = [
        { id: 'maxHp', name: 'Max HP', kind: 'flat', digits: 0, icon: A.icon('icon04'), desc: 'How much punishment you can take before dying.' },
        { id: 'regen', name: 'Regen', kind: 'flat', digits: 1, suffix: '/s', icon: A.icon('icon11'), desc: 'Health restored every second.' },
        { id: 'armor', name: 'Armor', kind: 'flat', digits: 0, icon: A.icon('icon06'), desc: 'Reduces incoming damage: reduction = armor / (armor + 20).' },
        { id: 'dodge', name: 'Dodge', kind: 'percent', digits: 0, icon: A.icon('icon07'), cap: 0.6, desc: 'Chance to completely avoid a hit (max 60%).' },
        { id: 'damage', name: 'Damage', kind: 'percent', digits: 0, icon: A.icon('icon05'), desc: 'Applies to every attack you make.' },
        { id: 'melee', name: 'Melee Damage', kind: 'percent', digits: 0, icon: A.icon('tool1'), desc: 'Extra damage for melee weapons.' },
        { id: 'ranged', name: 'Ranged Damage', kind: 'percent', digits: 0, icon: A.icon('u:Blue:Archer:Arrow'), desc: 'Extra damage for ranged weapons.' },
        { id: 'attackSpeed', name: 'Attack Speed', kind: 'percent', digits: 0, icon: A.icon('icon10'), desc: 'How fast you swing / fire.' },
        { id: 'moveSpeed', name: 'Move Speed', kind: 'percent', digits: 0, icon: A.icon('icon08'), desc: 'Ground speed.' },
        { id: 'crit', name: 'Crit Chance', kind: 'percent', digits: 0, icon: A.icon('icon09'), cap: 1, desc: 'Chance for a critical hit.' },
        { id: 'critDamage', name: 'Crit Damage', kind: 'percent', digits: 0, icon: A.swordFor(5), desc: 'Added to the base 150% critical multiplier.' },
        { id: 'lifesteal', name: 'Lifesteal', kind: 'percent', digits: 1, icon: A.icon('meat'), desc: 'Heal for this share of damage dealt.' },
        { id: 'pickup', name: 'Pickup Range', kind: 'flat', digits: 0, icon: A.icon('icon02'), desc: 'Gold is magnetised to you from further away.' },
        { id: 'luck', name: 'Luck', kind: 'flat', digits: 0, icon: A.icon('icon03'), desc: 'Increases the odds of rarer items in the shop, and of bonus drops.' },
        { id: 'cooldown', name: 'Cooldown Reduction', kind: 'percent', digits: 0, icon: A.icon('icon12'), cap: 0.6, desc: 'Shortens your class ability cooldown.' }
    ];

    var byId = {};
    META.forEach(function (m) { byId[m.id] = m; });

    var Stats = {
        meta: META,
        metaById: function (id) { return byId[id]; },

        blank: function () {
            var s = {};
            META.forEach(function (m) { s[m.id] = 0; });
            return s;
        },

        base: function (overrides) {
            var s = Stats.blank();
            if (overrides) { Object.keys(overrides).forEach(function (k) { if (U.hasOwn(s, k) || k === 'x') { s[k] = overrides[k]; } }); }
            return s;
        },

        /* baseStats + every owned item's mods, then caps. Never mutates inputs. */
        compute: function (baseStats, items) {
            var s = Stats.base(baseStats);
            (items || []).forEach(function (it) {
                if (!it || !it.mods) { return; }
                Object.keys(it.mods).forEach(function (k) {
                    if (!U.hasOwn(s, k)) { s[k] = 0; }
                    s[k] += it.mods[k];
                });
            });
            META.forEach(function (m) {
                if (m.cap != null && s[m.id] > m.cap) { s[m.id] = m.cap; }
            });
            if (s.maxHp < 1) { s.maxHp = 1; }
            if (s.attackSpeed < -0.75) { s.attackSpeed = -0.75; }
            if (s.moveSpeed < -0.6) { s.moveSpeed = -0.6; }
            return s;
        },

        armorReduction: function (armor) {
            if (armor <= 0) { return 0; }
            return Math.min(0.8, armor / (armor + 20));
        },

        /* "+12 Max HP", "-6% Move Speed", ... */
        describe: function (mods, scale) {
            var out = [];
            if (!mods) { return out; }
            META.forEach(function (m) {
                if (!U.hasOwn(mods, m.id) || !mods[m.id]) { return; }
                var v = mods[m.id] * (scale == null ? 1 : scale);
                var amount;
                if (m.kind === 'percent') {
                    amount = (v > 0 ? '+' : '') + (v * 100).toFixed(m.digits) + '%';
                } else {
                    amount = (v > 0 ? '+' : '') + v.toFixed(m.digits);
                }
                if (m.suffix) { amount += m.suffix; }
                out.push({ text: amount + ' ' + m.name, good: v > 0 });
            });
            return out;
        },

        /* Compact readout used by the HUD stat panel and the shop side bar. */
        summary: function (s, baseSpeed) {
            return [
                { label: 'Max HP', value: '' + Math.round(s.maxHp) },
                { label: 'Regen', value: s.regen.toFixed(1) + '/s' },
                { label: 'Armor', value: Math.round(s.armor) + ' (-' + Math.round(Stats.armorReduction(s.armor) * 100) + '%)' },
                { label: 'Dodge', value: Math.round(s.dodge * 100) + '%' },
                { label: 'Damage', value: '+' + Math.round(s.damage * 100) + '%' },
                { label: 'Melee', value: '+' + Math.round(s.melee * 100) + '%' },
                { label: 'Ranged', value: '+' + Math.round(s.ranged * 100) + '%' },
                { label: 'Atk Speed', value: '+' + Math.round(s.attackSpeed * 100) + '%' },
                { label: 'Speed', value: Math.round((baseSpeed || 160) * (1 + s.moveSpeed)) + 'px/s' },
                { label: 'Crit', value: Math.round(s.crit * 100) + '% x' + (1.5 + s.critDamage).toFixed(2) },
                { label: 'Lifesteal', value: s.lifesteal.toFixed(1) + '%' },
                { label: 'Pickup', value: '' + Math.round(s.pickup) },
                { label: 'Luck', value: '' + Math.round(s.luck) },
                { label: 'Cooldown', value: '-' + Math.round(s.cooldown * 100) + '%' }
            ];
        }
    };

    IW.Stats = Stats;
})();