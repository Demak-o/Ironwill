/* Ironwill - asset manifest, loader and sprite-sheet drawing helpers.
 *
 * Verified layout notes (see tools/inspect_assets.ps1):
 *   - Every unit sheet is a single row of square frames: frameSize = image.height
 *     (192px for most units, 320px for the Lancer).
 *   - Tilesets are 576x384 => 12x8 tiles of 48px; interior grass = cols 1-2, rows 0-2.
 */
(function () {
    'use strict';
    window.IW = window.IW || {};

    var BASE = 'Assets/';
    var defs = {};

    function addDef(key, path, fw, fh, frames) {
        defs[key] = {
            key: key, path: BASE + path, img: null,
            fw: fw || 0, fh: fh || 0, frames: frames || 0, failed: false
        };
        return key;
    }

    /* ---------------------------------------------------------------- units */

    var COLOURS = ['Blue', 'Black', 'Red', 'Yellow', 'Purple'];
    var UNITS = {
        Warrior: ['Idle', 'Run', 'Attack1', 'Attack2', 'Guard'],
        Archer: ['Idle', 'Run', 'Shoot'],
        Lancer: ['Idle', 'Run', 'Right_Attack', 'Right_Defence', 'Up_Attack', 'Down_Attack', 'UpRight_Attack', 'DownRight_Attack'],
        Monk: ['Idle', 'Run', 'Heal', 'Heal_Effect'],
        Pawn: ['Idle', 'Run']
    };
    var UNIT_FILE = {
        Warrior: function (a) { return 'Warrior_' + a + '.png'; },
        Archer: function (a) { return 'Archer_' + a + '.png'; },
        Lancer: function (a) { return 'Lancer_' + a + '.png'; },
        Monk: function (a) { return a + '.png'; },
        Pawn: function (a) { return 'Pawn_' + a + '.png'; }
    };

    function unitKey(colour, type, anim) { return 'u:' + colour + ':' + type + ':' + anim; }

    COLOURS.forEach(function (colour) {
        Object.keys(UNITS).forEach(function (type) {
            UNITS[type].forEach(function (anim) {
                addDef(unitKey(colour, type, anim),
                    'Units/' + colour + ' Units/' + type + '/' + UNIT_FILE[type](anim));
            });
        });
        addDef(unitKey(colour, 'Archer', 'Arrow'), 'Units/' + colour + ' Units/Archer/Arrow.png');
    });

    /* ------------------------------------------------------- terrain + decor */

    var i;
    /* Tilesets are 576x384: 12 columns x 8 rows of 48px tiles. */
    for (i = 1; i <= 5; i++) { addDef('tile' + i, 'Terrain/Tileset/Tilemap_color' + i + '.png', 48, 48, 12); }
    addDef('water', 'Terrain/Tileset/Water Background color.png');
    addDef('foam', 'Terrain/Tileset/Water Foam.png');
    addDef('shadow', 'Terrain/Tileset/Shadow.png');

    for (i = 1; i <= 4; i++) {
        addDef('tree' + i, 'Terrain/Resources/Wood/Trees/Tree' + i + '.png');
        addDef('bush' + i, 'Terrain/Decorations/Bushes/Bushe' + i + '.png');
        addDef('rock' + i, 'Terrain/Decorations/Rocks/Rock' + i + '.png');
        addDef('stump' + i, 'Terrain/Resources/Wood/Trees/Stump ' + i + '.png', 192, 256, 1);
        addDef('goldstone' + i, 'Terrain/Resources/Gold/Gold Stones/Gold Stone ' + i + '.png');
    }
    addDef('waterrock1', 'Terrain/Decorations/Rocks in the Water/Water Rocks_01.png');
    addDef('waterrock2', 'Terrain/Decorations/Rocks in the Water/Water Rocks_02.png');
    addDef('duck', 'Terrain/Decorations/Rubber Duck/Rubber duck.png');
    addDef('sheep', 'Terrain/Resources/Meat/Sheep/Sheep_Idle.png');
    addDef('meat', 'Terrain/Resources/Meat/Meat Resource/Meat Resource.png');
    addDef('wood', 'Terrain/Resources/Wood/Wood Resource/Wood Resource.png');
    addDef('gold', 'Terrain/Resources/Gold/Gold Resource/Gold_Resource.png');
    addDef('goldGlow', 'Terrain/Resources/Gold/Gold Resource/Gold_Resource_Highlight.png');
    for (i = 1; i <= 4; i++) { addDef('tool' + i, 'Terrain/Resources/Tools/Tool_0' + i + '.png'); }
/* -------------------------------------------------------------- particles */

    addDef('explosion1', 'Particle FX/Explosion_01.png');
    addDef('explosion2', 'Particle FX/Explosion_02.png');
    addDef('dust1', 'Particle FX/Dust_01.png');
    addDef('dust2', 'Particle FX/Dust_02.png');
    addDef('fire1', 'Particle FX/Fire_01.png');
    addDef('splash', 'Particle FX/Water Splash.png');

    /* -------------------------------------------------------------------- ui */

    addDef('banner', 'UI Elements/UI Elements/Banners/Banner.png', 448, 448, 1);
    addDef('bannerSlots', 'UI Elements/UI Elements/Banners/Banner_Slots.png', 192, 192, 1);
    addDef('barBigBase', 'UI Elements/UI Elements/Bars/BigBar_Base.png', 320, 64, 1);
    addDef('barBigFill', 'UI Elements/UI Elements/Bars/BigBar_Fill.png', 64, 64, 1);
    addDef('barSmallBase', 'UI Elements/UI Elements/Bars/SmallBar_Base.png', 320, 64, 1);
    addDef('barSmallFill', 'UI Elements/UI Elements/Bars/SmallBar_Fill.png', 64, 64, 1);
    addDef('btnBlue', 'UI Elements/UI Elements/Buttons/BigBlueButton_Regular.png', 320, 320, 1);
    addDef('btnBlueDown', 'UI Elements/UI Elements/Buttons/BigBlueButton_Pressed.png', 320, 320, 1);
    addDef('btnRed', 'UI Elements/UI Elements/Buttons/BigRedButton_Regular.png', 320, 320, 1);
    addDef('btnRedDown', 'UI Elements/UI Elements/Buttons/BigRedButton_Pressed.png', 320, 320, 1);
    addDef('btnSquareBlue', 'UI Elements/UI Elements/Buttons/SmallBlueSquareButton_Regular.png', 128, 128, 1);
    addDef('btnSquareBlueDown', 'UI Elements/UI Elements/Buttons/SmallBlueSquareButton_Pressed.png', 128, 128, 1);
    addDef('btnSquareRed', 'UI Elements/UI Elements/Buttons/SmallRedSquareButton_Regular.png', 128, 128, 1);
    addDef('btnSquareRedDown', 'UI Elements/UI Elements/Buttons/SmallRedSquareButton_Pressed.png', 128, 128, 1);
    addDef('btnRoundBlue', 'UI Elements/UI Elements/Buttons/SmallBlueRoundButton_Regular.png', 128, 128, 1);
    addDef('btnRoundRed', 'UI Elements/UI Elements/Buttons/SmallRedRoundButton_Regular.png', 128, 128, 1);
    addDef('paper', 'UI Elements/UI Elements/Papers/RegularPaper.png', 320, 320, 1);
    addDef('paperSpecial', 'UI Elements/UI Elements/Papers/SpecialPaper.png', 320, 320, 1);
    addDef('woodTable', 'UI Elements/UI Elements/Wood Table/WoodTable.png', 448, 448, 1);
    addDef('woodTableSlots', 'UI Elements/UI Elements/Wood Table/WoodTable_Slots.png', 192, 192, 1);

    /* The plate art ships as *pre-sliced* 3x3 atlases: nine cells separated by
     * fully transparent 64px gutters (verified with tools/inspect_ui_cells.ps1).
     * Each band below is [source offset, source length]; UI.plate() draws
     * corner / stretched middle / corner, so the frame comes out whole instead of
     * landing on the gutters. A single row band (the bars) is stretched whole. */
    var BTN_C = [[19, 45], [128, 64], [256, 45]];
    var BTN_R = [[17, 47], [128, 64], [256, 47]];
    function sliceBands(key, cols, rows) { defs[key].slice = { c: cols, r: rows }; }
    sliceBands('banner', [[28, 100], [192, 64], [320, 84]], [[60, 68], [192, 64], [320, 111]]);
    sliceBands('paper', [[12, 52], [128, 64], [256, 52]], [[20, 44], [128, 64], [256, 45]]);
    sliceBands('paperSpecial', [[10, 54], [128, 64], [256, 54]], [[20, 44], [128, 64], [256, 43]]);
    sliceBands('btnBlue', BTN_C, BTN_R);
    sliceBands('btnBlueDown', BTN_C, BTN_R);
    sliceBands('btnRed', BTN_C, BTN_R);
    sliceBands('btnRedDown', BTN_C, BTN_R);
    sliceBands('woodTable', [[45, 83], [192, 64], [320, 84]], [[43, 85], [192, 64], [320, 103]]);
    sliceBands('barBigBase', [[40, 24], [128, 64], [256, 24]], [[9, 51]]);
    sliceBands('barSmallBase', [[49, 15], [128, 64], [256, 15]], [[22, 19]]);
    addDef('swords', 'UI Elements/UI Elements/Swords/Swords.png', 64, 64, 0);
    addDef('ribbonSmall', 'UI Elements/UI Elements/Ribbons/SmallRibbons.png', 320, 640, 1);
    addDef('cursor', 'UI Elements/UI Elements/Cursors/Cursor_01.png', 64, 64, 1);
    for (i = 1; i <= 12; i++) {
        var n = (i < 10 ? '0' : '') + i;
        addDef('icon' + n, 'UI Elements/UI Elements/Icons/Icon_' + n + '.png', 64, 64, 1);
    }
    addDef('avatar', 'UI Elements/UI Elements/Human Avatars/Avatars_01.png', 256, 256, 1);

    /* Rarity-coloured weapon crops out of Swords.png: rows 0,2,4,6,8 hold
     * blue / red / yellow / purple / steel weapons. */
    var SWORD_ROWS = { 1: 8 * 64, 2: 0, 3: 2 * 64, 4: 4 * 64, 5: 6 * 64 };

    /* ---------------------------------------------------------------- loader */

    var Assets = {
        defs: defs,

        /* icon specs used by items.js: { key, sx, sy, sw, sh } */
        icon: function (key, sx, sy, sw, sh) {
            return { key: key, sx: sx || 0, sy: sy || 0, sw: sw || 0, sh: sh || 0 };
        },

        swordFor: function (rarity, part) {
            return {
                key: 'swords', sx: (part == null ? 1 : part) * 64, sy: SWORD_ROWS[rarity] || 0,
                sw: 64, sh: 64, aspect: 1
            };
        },

        load: function (onProgress, onDone) {
            var keys = Object.keys(defs);
            var total = keys.length, done = 0, finished = false;

            function tick() {
                done++;
                if (onProgress) { onProgress(done / total); }
                if (done >= total && !finished) {
                    finished = true;
                    if (onDone) { onDone(); }
                }
            }

            if (!total) { if (onDone) { onDone(); } return; }

            keys.forEach(function (k) {
                var d = defs[k];
                var img;
                try { img = new Image(); } catch (e) { img = null; }
                if (!img) { d.failed = true; tick(); return; }
                d.img = img;
                img.onload = function () {
                    if (!d.fw) { d.fw = img.height || 0; }
                    if (!d.fh) { d.fh = img.height || 0; }
                    if (!d.frames) {
                        d.frames = (d.fw > 0 && img.width >= d.fw) ? Math.max(1, Math.round(img.width / d.fw)) : 1;
                    }
                    tick();
                };
                img.onerror = function () { d.failed = true; tick(); };
                try { img.src = encodeURI(d.path); } catch (e2) { d.failed = true; tick(); }
            });
        },

        /* ---------------------------------------------------- query / drawing */

        ready: function (key) {
            var d = defs[key];
            return !!(d && d.img && !d.failed && d.frames > 0);
        },

        frameSize: function (key) {
            var d = defs[key];
            return d ? { fw: d.fw, fh: d.fh, frames: d.frames } : { fw: 0, fh: 0, frames: 0 };
        },

        frames: function (key) {
            var d = defs[key];
            return d ? Math.max(1, d.frames) : 1;
        },
/* Draw one animation frame centred on (cx, cy). scale 1 = native px. */
        draw: function (ctx, key, frame, cx, cy, scale, flip, alpha) {
            var d = defs[key];
            if (!d || !d.img || d.failed || !d.frames) { return false; }
            if (scale == null) { scale = 1; }
            var w = d.fw * scale, h = d.fh * scale;
            var f = ((frame % d.frames) + d.frames) % d.frames;
            var prevAlpha = ctx.globalAlpha;
            if (alpha != null) { ctx.globalAlpha = alpha; }
            if (flip) {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.scale(-1, 1);
                ctx.drawImage(d.img, f * d.fw, 0, d.fw, d.fh, -w / 2, -h / 2, w, h);
                ctx.restore();
            } else {
                ctx.drawImage(d.img, f * d.fw, 0, d.fw, d.fh, cx - w / 2, cy - h / 2, w, h);
            }
            ctx.globalAlpha = prevAlpha;
            return true;
        },

        drawRotated: function (ctx, key, frame, cx, cy, scale, angle, alpha) {
            var d = defs[key];
            if (!d || !d.img || d.failed || !d.frames) { return false; }
            var w = d.fw * scale, h = d.fh * scale;
            var f = ((frame % d.frames) + d.frames) % d.frames;
            var prevAlpha = ctx.globalAlpha;
            if (alpha != null) { ctx.globalAlpha = alpha; }
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            ctx.drawImage(d.img, f * d.fw, 0, d.fw, d.fh, -w / 2, -h / 2, w, h);
            ctx.restore();
            ctx.globalAlpha = prevAlpha;
            return true;
        },

        /* Draw an arbitrary source region (tiles, UI pieces, icon crops). */
        drawRegion: function (ctx, key, sx, sy, sw, sh, dx, dy, dw, dh, alpha) {
            var d = defs[key];
            if (!d || !d.img || d.failed) { return false; }
            var prevAlpha = ctx.globalAlpha;
            if (alpha != null) { ctx.globalAlpha = alpha; }
            ctx.drawImage(d.img, sx, sy, sw, sh, dx, dy, dw, dh);
            ctx.globalAlpha = prevAlpha;
            return true;
        },

        /* Draw an item icon spec into a square box centred on (cx, cy). */
        drawIcon: function (ctx, icon, cx, cy, size, alpha) {
            if (!icon) { return false; }
            var key = icon.key || icon;
            var d = defs[key];
            if (!d || !d.img || d.failed) { return false; }
            var sw = icon.sw || d.fw || 64, sh = icon.sh || d.fh || 64;
            var w = size * (icon.aspect || 1);
            return this.drawRegion(ctx, key, icon.sx || 0, icon.sy || 0, sw, sh, cx - w / 2, cy - size / 2, w, size, alpha);
        },

        /* Tinted frame draw (hit flashes, tier tints). */
        tinted: function (ctx, key, frame, cx, cy, scale, flip, colour, alpha) {
            var d = defs[key];
            if (!d || !d.img || d.failed || !d.frames) { return false; }
            var w = Math.round(d.fw * scale), h = Math.round(d.fh * scale);
            if (w <= 0 || h <= 0) { return false; }
            var buf = this._tintBuffer;
            if (!buf) { buf = this._tintBuffer = { c: null, ctx: null }; }
            if (!buf.c) {
                if (typeof document === 'undefined' || !document.createElement) { return false; }
                buf.c = document.createElement('canvas');
                buf.ctx = buf.c.getContext('2d');
            }
            if (!buf.ctx) { return false; }
            if (buf.c.width < w || buf.c.height < h) { buf.c.width = Math.max(w, 96); buf.c.height = Math.max(h, 96); }
            var b = buf.ctx;
            b.clearRect(0, 0, buf.c.width, buf.c.height);
            var f = ((frame % d.frames) + d.frames) % d.frames;
            if (flip) {
                /* Mirror the frame into the buffer so a tinted sprite keeps the caller's
                 * facing; otherwise a left-facing character got a right-facing ghost on top. */
                b.save();
                b.translate(w, 0);
                b.scale(-1, 1);
                b.drawImage(d.img, f * d.fw, 0, d.fw, d.fh, 0, 0, w, h);
                b.restore();
            } else {
                b.drawImage(d.img, f * d.fw, 0, d.fw, d.fh, 0, 0, w, h);
            }
            b.globalCompositeOperation = 'source-atop';
            b.globalAlpha = alpha == null ? 0.5 : alpha;
            b.fillStyle = colour || '#ffffff';
            b.fillRect(0, 0, w, h);
            b.globalAlpha = 1;
            b.globalCompositeOperation = 'source-over';
            ctx.drawImage(buf.c, 0, 0, w, h, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
            return true;
        },

        tile: function (variant, col, row) {
            return { key: 'tile' + variant, sx: col * 48, sy: row * 48, sw: 48, sh: 48 };
        }
    };

    IW.Assets = Assets;
})();