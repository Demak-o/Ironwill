/* Ironwill - the four playable classes (all taken from the blue unit set).
 *
 * Every class shares the same controls: WASD to move, aim with the mouse and hold
 * Left Click to attack, and Left Shift / Space for its unique ability.
 */
(function () {
    'use strict';
    window.IW = window.IW || {};
    var S = IW.Stats;
    var uk = function (type, anim) { return 'u:Blue:' + type + ':' + anim; };

    /* On-screen size per unit type, measured from the sheets (tools/measure_units.ps1).
     * The Lancer's frames are 320px tall with a small body plus a long spear. */
    IW.SPRITE_SCALE = { Warrior: 0.70, Archer: 0.70, Monk: 0.75, Pawn: 0.70, Lancer: 0.72 };

    /* Fraction of the frame height from its centre down to the sprite's feet. */
    IW.FEET = { Warrior: 0.208, Archer: 0.203, Monk: 0.193, Pawn: 0.198, Lancer: 0.116 };

    IW.Characters = [
        {
            id: 'knight',
            name: 'Knight',
            title: 'Bulwark of the Keep',
            unitType: 'Warrior',
            colour: '#cfe3ff',
            blurb: 'Slow, heavy and impossible to shove aside. Sweeps his blade through everything in front of him.',
            baseSpeed: 158,
            radius: 19,
            baseStats: S.base({ maxHp: 130, regen: 0.4, armor: 1, dodge: 0, damage: 0, melee: 0.10, attackSpeed: 0, crit: 0.05, pickup: 130, luck: 0 }),
            weapon: {
                kind: 'arc',
                name: 'Longsword',
                damage: 30,
                cooldown: 0.62,
                range: 104,
                halfAngle: 1.05,
                knockback: 150,
                anims: [uk('Warrior', 'Attack1'), uk('Warrior', 'Attack2')],
                fps: 15,
                sfx: 'slash',
                effect: 'slash'
            },
            ability: {
                kind: 'aegis',
                name: 'Aegis Stance',
                key: 'Left Shift',
                cooldown: 9,
                duration: 1.1,
                radius: 134,
                damage: 26,
                knockback: 320,
                anim: uk('Warrior', 'Guard'),
                fps: 12,
                desc: 'Plant the shield: brief invulnerability and a shockwave that hurls attackers away.'
            }
        },
        {
            id: 'archer',
            name: 'Archer',
            title: 'Greenwood Huntress',
            unitType: 'Archer',
            colour: '#b9f2c4',
            blurb: 'Fragile but quick. Picks enemies apart from range and slips out of trouble with a dash.',
            baseSpeed: 176,
            radius: 17,
            baseStats: S.base({ maxHp: 88, regen: 0.2, armor: 0, dodge: 0.05, damage: 0, ranged: 0.05, attackSpeed: 0, crit: 0.08, pickup: 140, luck: 0 }),
            weapon: {
                kind: 'shot',
                name: 'Hunting Bow',
                damage: 21,
                cooldown: 0.44,
                speed: 720,
                pierce: 0,
                lifetime: 0.9,
                knockback: 40,
                projKey: uk('Archer', 'Arrow'),
                anim: uk('Archer', 'Shoot'),
                fps: 17,
                sfx: 'bow',
                effect: 'arrow'
            },
            ability: {
                kind: 'dash',
                name: 'Windstep Dash',
                key: 'Left Shift',
                cooldown: 3.2,
                duration: 0.2,
                speedMul: 3.4,
                invuln: 0.34,
                sfx: 'dash',
                desc: 'A short dash that ignores all damage while you travel. Bound to Left Shift.'
            }
        },
        {
            id: 'lancer',
            name: 'Lancer',
            title: 'Pikewall Veteran',
            unitType: 'Lancer',
            colour: '#ffe6b0',
            blurb: 'Long reach and a wall of discipline. Skewers whole lines and turns a brace into a counter-attack.',
            baseSpeed: 166,
            radius: 18,
            baseStats: S.base({ maxHp: 104, regen: 0.3, armor: 2, dodge: 0, damage: 0, melee: 0.05, attackSpeed: 0, crit: 0.06, pickup: 130, luck: 0 }),
            weapon: {
                kind: 'thrust',
                name: 'Boar Spear',
                damage: 30,
                cooldown: 0.56,
                reach: 142,
                halfWidth: 24,
                knockback: 120,
                animFps: 15,
                sfx: 'thrust',
                effect: 'spear'
            },
            ability: {
                kind: 'brace',
                name: 'Brace & Riposte',
                key: 'Left Shift',
                cooldown: 7.5,
                duration: 1.3,
                damageReduction: 0.65,
                buffTime: 2.5,
                buffDamage: 1.2,
                sfx: 'ability',
                desc: 'Take 65% less damage while braced; your next thrust is empowered and strikes wider.'
            }
        },
        {
            id: 'monk',
            name: 'Monk',
            title: 'Bell of the Monastery',
            unitType: 'Monk',
            colour: '#ffe08a',
            blurb: 'Calls down a burst of holy light at your aim point, and can channel healing to survive.',
            baseSpeed: 168,
            radius: 17,
            baseStats: S.base({ maxHp: 96, regen: 0.8, armor: 1, dodge: 0, damage: 0.05, attackSpeed: 0, crit: 0.05, pickup: 145, luck: 0 }),
            weapon: {
                kind: 'pulse',
                name: 'Sanctified Wave',
                damage: 17,
                cooldown: 0.7,
                radius: 124,
                castRange: 300,
                knockback: 110,
                effect: uk('Monk', 'Heal_Effect'),
                fps: 18,
                anim: uk('Monk', 'Idle'),
                sfx: 'pulse'
            },
            ability: {
                kind: 'heal',
                name: 'Mend Wounds',
                key: 'Left Shift',
                cooldown: 12,
                duration: 0.9,
                healPct: 0.35,
                anim: uk('Monk', 'Heal'),
                fps: 12,
                sfx: 'heal',
                desc: 'Channel for a moment to restore 35% of your maximum health.'
            }
        }
    ];

    IW.findCharacter = function (id) {
        for (var i = 0; i < IW.Characters.length; i++) {
            if (IW.Characters[i].id === id) { return IW.Characters[i]; }
        }
        return IW.Characters[0];
    };

    /* Sprite key for one of a character's animations. */
    IW.charSheet = function (char, anim) {
        return 'u:Blue:' + char.unitType + ':' + anim;
    };
})();