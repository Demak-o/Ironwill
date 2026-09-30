/* Ironwill - all UI: drawing helpers, HUD, and the menu / shop / level-up screens.
 * Each screen exposes a layout() used by both drawing and mouse hit-testing so the
 * two can never disagree. */
(function () {
    'use strict';
    window.IW = window.IW || {};
    var U = IW.util;
    var A = IW.Assets;

    var VIEW_W = 1280, VIEW_H = 720;
    var FONT = 'Consolas, "Lucida Console", monospace';

    var COL = {
        ink: '#f4ecd4',
        dim: '#b9b6a2',
        faint: '#8d8b7c',
        gold: '#ffd45e',
        good: '#8ee86a',
        bad: '#ff7b6b',
        panel: 'rgba(20,22,26,0.92)',
        panelEdge: '#6f6a56',
        slot: 'rgba(12,14,17,0.75)'
    };

    var UI = {
        VW: VIEW_W,
        VH: VIEW_H,
        COL: COL,
        FONT: FONT,

        /* ------------------------------------------------------------ basics */

        font: function (ctx, size, weight, align) {
            ctx.font = (weight ? weight + ' ' : '') + size + 'px ' + FONT;
            if (align) { ctx.textAlign = align; }
        },

        text: function (ctx, str, x, y, opts) {
            opts = opts || {};
            ctx.save();
            this.font(ctx, opts.size || 16, opts.bold ? 'bold' : '', opts.align || 'left');
            if (opts.outline) {
                ctx.lineWidth = opts.outline;
                ctx.strokeStyle = opts.outlineColour || 'rgba(0,0,0,0.85)';
                ctx.strokeText(str, x, y);
            }
            ctx.fillStyle = opts.colour || COL.ink;
            ctx.fillText(str, x, y);
            ctx.restore();
        },

        /* Nine-slice a UI plate into any rect. The plate art ships as a 3x3 atlas
         * whose cells are separated by transparent gutters (bands live in
         * A.defs[key].slice), so we draw corner / stretched middle / corner: the
         * frame comes out whole and filled instead of broken across the gutters.
         * A single row band (the bars) is stretched across the full height, and a
         * texture with no slice table is stretched whole.
         * Returns the drawn geometry - ix / iy are the frame thickness - or null
         * when the texture is unavailable, so callers can fall back. */
        plate: function (ctx, key, x, y, w, h, alpha) {
            var d = A.defs[key];
            if (!d || !d.img || d.failed) { return null; }
            var s = d.slice;
            var prevAlpha = ctx.globalAlpha, prevSmooth = ctx.imageSmoothingEnabled;
            if (alpha != null) { ctx.globalAlpha = prevAlpha * alpha; }
            ctx.imageSmoothingEnabled = false;

            if (!s) {
                ctx.drawImage(d.img, 0, 0, d.img.width, d.img.height, x, y, w, h);
                ctx.globalAlpha = prevAlpha;
                ctx.imageSmoothingEnabled = prevSmooth;
                return { x: x, y: y, w: w, h: h, ix: 0, iy: 0 };
            }

            var total = function (bands) {
                var t = 0;
                for (var n = 0; n < bands.length; n++) { t += bands[n][1]; }
                return t;
            };
            /* Corners keep their native pixel size, shrunk only when the rect is
             * too small to fit them, so the frame never overruns the box. */
            var k = Math.min(1, w / total(s.c), h / total(s.r));
            var spans = function (bands, from, span) {
                if (bands.length === 1) { return [{ p: from, l: span }]; }
                var a = Math.round(bands[0][1] * k);
                var b = Math.min(Math.round(bands[2][1] * k), Math.max(0, span - a));
                return [{ p: from, l: a }, { p: from + a, l: span - a - b }, { p: from + span - b, l: b }];
            };
            var cx = spans(s.c, x, w), cy = spans(s.r, y, h);
            for (var ri = 0; ri < cy.length; ri++) {
                for (var ci = 0; ci < cx.length; ci++) {
                    ctx.drawImage(d.img, s.c[ci][0], s.r[ri][0], s.c[ci][1], s.r[ri][1],
                        cx[ci].p, cy[ri].p, Math.max(0, cx[ci].l), Math.max(0, cy[ri].l));
                }
            }
            ctx.globalAlpha = prevAlpha;
            ctx.imageSmoothingEnabled = prevSmooth;
            return {
                x: x, y: y, w: w, h: h,
                ix: cx.length === 1 ? 0 : cx[0].l,
                iy: cy.length === 1 ? 0 : cy[0].l
            };
        },

        panel: function (ctx, x, y, w, h, opts) {
            opts = opts || {};
            ctx.save();
            ctx.fillStyle = opts.fill || COL.panel;
            if (opts.radius && ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(x, y, w, h, opts.radius);
                ctx.fill();
            } else {
                ctx.fillRect(x, y, w, h);
            }
            ctx.strokeStyle = opts.edge || COL.panelEdge;
            ctx.lineWidth = opts.lineWidth || 2;
            ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
            if (opts.accent) {
                ctx.fillStyle = opts.accent;
                ctx.fillRect(x + 2, y + 2, w - 4, 3);
            }
            ctx.restore();
        },

        bar: function (ctx, x, y, w, h, pct, colour, opts) {
            opts = opts || {};
            pct = U.clamp(pct, 0, 1);
            ctx.save();
            ctx.fillStyle = opts.track || 'rgba(0,0,0,0.6)';
            ctx.fillRect(x, y, w, h);
            ctx.fillStyle = colour;
            ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * pct), h - 2);
            if (opts.gloss) {
                ctx.globalAlpha = 0.18;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * pct), Math.max(1, (h - 2) * 0.4));
                ctx.globalAlpha = 1;
            }
            ctx.strokeStyle = opts.edge || 'rgba(0,0,0,0.8)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
            ctx.restore();
        },

        button: function (ctx, rect, label, state, opts) {
            opts = opts || {};
            state = state || {};
            var key = opts.tone === 'red'
                ? (state.pressed ? 'btnRedDown' : 'btnRed')
                : (state.pressed ? 'btnBlueDown' : 'btnBlue');
            var ok = UI.plate(ctx, key, rect.x, rect.y, rect.w, rect.h, state.disabled ? 0.45 : 1);
            if (!ok) {
                UI.panel(ctx, rect.x, rect.y, rect.w, rect.h, { fill: 'rgba(30,34,40,0.92)', radius: 6 });
            }
            if (state.hover && !state.disabled) {
                ctx.save();
                ctx.globalAlpha = 0.16;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 8);
                ctx.restore();
            }
            UI.text(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2 + (opts.fontSize || 18) * 0.36, {
                size: opts.fontSize || 18,
                bold: true,
                align: 'center',
                colour: state.disabled ? COL.faint : (opts.colour || COL.ink),
                outline: 3
            });
        },

        cursor: function (ctx, mouse) {
            if (!A.ready('cursor')) { return; }
            A.draw(ctx, 'cursor', 0, mouse.x, mouse.y, 0.45, false, 0.95);
        },

        /* ------------------------------------------------------- shared widgets */

        statPanel: function (ctx, game, x, y, w) {
            var p = game.player;
            var rows = IW.Stats.summary(p.stats, p.baseSpeed);
            var h = 30 + rows.length * 17;
            UI.panel(ctx, x, y, w, h, { fill: 'rgba(16,18,22,0.92)', accent: 'rgba(255,212,94,0.5)' });
            UI.text(ctx, 'STATS', x + 10, y + 21, { size: 13, bold: true, colour: COL.gold });
            for (var i = 0; i < rows.length; i++) {
                var ry = y + 40 + i * 17;
                UI.text(ctx, rows[i].label, x + 10, ry, { size: 12, colour: COL.dim });
                UI.text(ctx, rows[i].value, x + w - 10, ry, { size: 12, bold: true, align: 'right', colour: COL.ink });
            }
            return h;
        },

        itemSlot: function (ctx, item, x, y, size, count) {
            var rarity = IW.Rarities[item.rarity] || IW.Rarities[1];
            UI.panel(ctx, x, y, size, size, { fill: 'rgba(14,16,20,0.85)', edge: rarity.colour, lineWidth: 2 });
            A.drawIcon(ctx, item.icon, x + size / 2, y + size / 2, size * 0.72, 1);
            if (count && count > 1) {
                var badge = 'x' + count;
                this.font(ctx, 10, 'bold', 'right');
                ctx.fillStyle = '#ffffff';
                ctx.fillText(badge, x + size - 4, y + size - 5);
            }
        },

        minimap: function (ctx, game) {
            var a = game.arena;
            var w = 168, h = Math.round(w * (a.h / a.w));
            var x = 16, y = VIEW_H - h - 16;
            UI.panel(ctx, x - 3, y - 3, w + 6, h + 6, { fill: 'rgba(10,12,15,0.72)' });
            ctx.save();
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = '#3a5a22';
            ctx.fillRect(x, y, w, h);
            ctx.restore();
            var sx = w / a.w, sy = h / a.h, i, e, px, py;
            for (i = 0; i < game.enemies.length; i++) {
                e = game.enemies[i];
                if (e.dead) { continue; }
                px = x + e.x * sx;
                py = y + e.y * sy;
                ctx.fillStyle = e.elite ? IW.ELITE.ring : e.tier.ring;
                ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
            }
            for (i = 0; i < game.pickups.length; i++) {
                var pk = game.pickups[i];
                if (pk.dead || pk.kind !== 'gold') { continue; }
                ctx.fillStyle = 'rgba(255,212,94,0.9)';
                ctx.fillRect(x + pk.x * sx - 1, y + pk.y * sy - 1, 2, 2);
            }
            var p = game.player;
            if (p && !p.dead) {
                ctx.fillStyle = '#7fd0ff';
                ctx.fillRect(x + p.x * sx - 2, y + p.y * sy - 2, 4, 4);
            }
            UI.text(ctx, 'ARENA', x, y - 6, { size: 10, colour: COL.faint });
        },

        /* ------------------------------------------------------------- HUD */

        hud: function (ctx, game) {
            var p = game.player;
            if (!p) { return; }
            var i, barW = 300, barH = 34;
            var hpPct = p.maxHp > 0 ? p.hp / p.maxHp : 0;

            UI.panel(ctx, 12, 12, barW + 16, 92, { fill: 'rgba(14,16,20,0.85)', accent: 'rgba(255,255,255,0.12)' });
            var hpPlate = UI.plate(ctx, 'barBigBase', 20, 20, barW, barH, 1);
            var hpIn = hpPlate ? hpPlate.ix + 2 : 14;
            UI.bar(ctx, 20 + hpIn, 25, barW - 2 * hpIn, barH - 10, hpPct,
                hpPct > 0.5 ? '#48d06a' : (hpPct > 0.25 ? '#e8c04a' : '#e05a4a'), { gloss: true });
            UI.text(ctx, Math.ceil(p.hp) + ' / ' + Math.round(p.maxHp), 20 + barW / 2, 20 + barH * 0.72,
                { size: 15, bold: true, align: 'center', outline: 3 });

            var xpPlate = UI.plate(ctx, 'barSmallBase', 20, 62, barW * 0.78, 20, 1);
            var xpIn = xpPlate ? xpPlate.ix + 2 : 10;
            UI.bar(ctx, 20 + xpIn, 66, barW * 0.78 - 2 * xpIn, 12, p.xpNext > 0 ? p.xp / p.xpNext : 0, '#7fb2ff', {});
            UI.text(ctx, 'LVL ' + p.level, 20 + barW * 0.78 + 8, 78, { size: 14, bold: true, colour: COL.gold, outline: 3 });
            UI.text(ctx, 'XP ' + Math.floor(p.xp) + '/' + p.xpNext, barW * 0.78 - 30, 78, { size: 11, align: 'right', colour: COL.dim, outline: 2 });

            /* wave + timer (or endless run clock) */
            var centreX = VIEW_W / 2;
            UI.panel(ctx, centreX - 176, 12, 352, 62, { fill: 'rgba(14,16,20,0.85)', accent: 'rgba(255,212,94,0.5)' });
            if (game.endless) {
                UI.text(ctx, 'ENDLESS', centreX - 168, 36, { size: 19, bold: true, colour: COL.gold, outline: 3 });
                UI.text(ctx, game.biome.name.toUpperCase(), centreX + 168, 36, { size: 12, align: 'right', colour: COL.dim, outline: 2 });
                UI.text(ctx, 'DIFF x' + game.endlessEsc().toFixed(2) + '   ' + U.formatTime(game.endlessTime),
                    centreX - 164, 57, { size: 11, colour: '#4a3a12' });
                UI.text(ctx, 'ENEMIES ' + game.livingEnemies(), centreX + 164, 57, { size: 11, align: 'right', colour: '#4a3a12' });
            } else {
                var timeLeft = Math.max(0, game.waveTime);
                UI.text(ctx, 'WAVE ' + game.wave, centreX - 168, 36, { size: 19, bold: true, colour: COL.gold, outline: 3 });
                UI.text(ctx, game.biome.name.toUpperCase(), centreX + 168, 36, { size: 12, align: 'right', colour: COL.dim, outline: 2 });
                UI.bar(ctx, centreX - 168, 44, 336, 16, game.waveDuration > 0 ? timeLeft / game.waveDuration : 0, '#e8c04a', { gloss: true });
                UI.text(ctx, U.formatTime(timeLeft), centreX - 164, 57, { size: 11, colour: '#4a3a12' });
                UI.text(ctx, 'ENEMIES ' + game.livingEnemies(), centreX + 164, 57, { size: 11, align: 'right', colour: '#4a3a12' });
            }

            /* gold + kills + score */
            UI.panel(ctx, VIEW_W - 200, 12, 188, 92, { fill: 'rgba(14,16,20,0.85)', accent: 'rgba(255,212,94,0.4)' });
            A.draw(ctx, 'gold', 0, VIEW_W - 178, 38, 0.42, false, 1);
            UI.text(ctx, '' + Math.floor(p.gold), VIEW_W - 152, 48, { size: 22, bold: true, colour: COL.gold, outline: 3 });
            UI.text(ctx, 'GOLD', VIEW_W - 152, 64, { size: 10, colour: COL.faint });
            UI.text(ctx, 'KILLS ' + p.kills, VIEW_W - 188, 82, { size: 12, colour: COL.dim, outline: 2 });
            UI.text(ctx, 'SCORE ' + game.calcScore(), VIEW_W - 188, 97, { size: 12, bold: true, colour: '#7fd0ff', outline: 2 });

            /* ability button + cooldown */
            var ab = p.char.ability;
            var abCd = ab.cooldown * (1 - p.stats.cooldown);
            var cold = p.abilityTimer > 0 && abCd > 0 ? U.clamp(p.abilityTimer / abCd, 0, 1) : 0;
            var bx = centreX - 130, by = VIEW_H - 54;
            UI.panel(ctx, bx, by, 260, 42, { fill: 'rgba(14,16,20,0.85)', edge: cold > 0 ? '#4a4a45' : COL.gold });
            if (cold > 0) {
                ctx.save();
                ctx.globalAlpha = 0.55;
                ctx.fillStyle = '#000000';
                ctx.fillRect(bx + 2, by + 2, (260 - 4) * cold, 38);
                ctx.restore();
            }
            UI.text(ctx, ab.name.toUpperCase(), bx + 12, by + 26, { size: 14, bold: true, colour: cold > 0 ? COL.faint : COL.ink });
            UI.text(ctx, cold > 0 ? cold.toFixed(1) + 's' : 'SHIFT', bx + 248, by + 26,
                { size: 14, bold: true, align: 'right', colour: cold > 0 ? COL.bad : COL.good });

            /* inventory strip — stack duplicates */
            var slot = 30, perRow = 13, items = p.items;
            var stacks = {}, ordered = [];
            for (i = 0; i < items.length; i++) {
                var id = items[i].id || items[i].name;
                if (stacks[id]) { stacks[id].count++; } else {
                    stacks[id] = { item: items[i], count: 1 };
                    ordered.push(id);
                }
            }
            for (i = 0; i < ordered.length; i++) {
                var s = stacks[ordered[i]];
                var idx = i;
                var row = Math.floor(idx / perRow), colm = idx % perRow;
                UI.itemSlot(ctx, s.item, VIEW_W - 16 - slot - colm * (slot + 3), VIEW_H - 44 - (row + 1) * (slot + 3), slot, s.count);
            }

            UI.minimap(ctx, game);
        },

        /* ---------------------------------------------------- title + selection */

        fitSize: function (ctx, str, size, maxWidth, minSize) {
            var s = size;
            while (s > (minSize || 9)) {
                this.font(ctx, s, 'bold', 'left');
                if (ctx.measureText(str).width <= maxWidth) { return s; }
                s -= 1;
            }
            return s;
        },

        /* two-column label/value rows, returns the next y */
        statLines: function (ctx, x, y, w, rows) {
            for (var i = 0; i < rows.length; i++) {
                UI.text(ctx, rows[i][0], x, y + i * 15, { size: 12, colour: COL.dim });
                UI.text(ctx, rows[i][1], x + w, y + i * 15, { size: 12, bold: true, align: 'right', colour: COL.ink });
            }
            return y + rows.length * 15;
        },

        /* naive word wrap, returns the y after the last line */
        wrap: function (ctx, str, x, y, maxW, lineH, size, colour) {
            if (!str) { return y; }
            var words = ('' + str).split(' ');
            var line = '';
            var lines = 0;
            for (var i = 0; i < words.length; i++) {
                var test = line ? line + ' ' + words[i] : words[i];
                this.font(ctx, size, '', 'left');
                if (ctx.measureText(test).width > maxW && line) {
                    UI.text(ctx, line, x, y + lines * lineH, { size: size, colour: colour });
                    lines++;
                    line = words[i];
                } else {
                    line = test;
                }
            }
            if (line) {
                UI.text(ctx, line, x, y + lines * lineH, { size: size, colour: colour });
                lines++;
            }
            return y + lines * lineH;
        },

        titleLayout: function () {
            return {
                start: { x: VIEW_W / 2 - 140, y: 486, w: 280, h: 64 },
                mute: { x: VIEW_W - 158, y: VIEW_H - 52, w: 142, h: 36 }
            };
        },

        title: function (ctx, game) {
            var lay = UI.titleLayout();
            var grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
            grad.addColorStop(0, 'rgba(8,10,14,0.6)');
            grad.addColorStop(0.5, 'rgba(8,10,14,0.32)');
            grad.addColorStop(1, 'rgba(8,10,14,0.85)');
            ctx.save();
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, VIEW_W, VIEW_H);
            ctx.restore();

            UI.text(ctx, 'IRONWILL', VIEW_W / 2, 168, { size: 78, bold: true, align: 'center', colour: COL.gold, outline: 9 });
            UI.text(ctx, 'A ROUND-BASED ROGUELIKE OF SHIELDS AND SWARMS', VIEW_W / 2, 206,
                { size: 15, align: 'center', colour: COL.dim, outline: 4 });

            /* hero shot: the four classes with a few of the horde behind them */
            var hero = [
                { key: 'u:Red:Warrior:Idle', x: 292, scale: 0.70, flip: true, alpha: 0.8 },
                { key: 'u:Purple:Monk:Idle', x: 988, scale: 0.75, flip: true, alpha: 0.8 },
                { key: 'u:Yellow:Archer:Idle', x: 872, scale: 0.70, flip: true, alpha: 0.85 },
                { key: 'u:Black:Pawn:Idle', x: 408, scale: 0.70, flip: true, alpha: 0.85 },
                { key: 'u:Blue:Lancer:Idle', x: 830, scale: 0.72, flip: false, alpha: 1 },
                { key: 'u:Blue:Monk:Idle', x: 722, scale: 0.75, flip: false, alpha: 1 },
                { key: 'u:Blue:Archer:Idle', x: 558, scale: 0.70, flip: false, alpha: 1 },
                { key: 'u:Blue:Warrior:Idle', x: 450, scale: 0.70, flip: false, alpha: 1 }
            ];
            for (var i = 0; i < hero.length; i++) {
                var hh = hero[i];
                var frame = Math.floor(game.time * 6 + i * 2) % A.frames(hh.key);
                A.draw(ctx, hh.key, frame, hh.x, 425, hh.scale, hh.flip, hh.alpha);
            }

            UI.button(ctx, lay.start, 'BEGIN', { hover: game.hoverId === 'start' });
            UI.text(ctx, 'WASD / ARROWS move    LEFT SHIFT ability    ESC pause    TAB stats    M mute', VIEW_W / 2, 606,
                { size: 13, align: 'center', colour: COL.dim, outline: 3 });
            UI.text(ctx, 'Clear the wave, spend the gold, survive the next one. Blue is you - black, red, yellow and purple enemies grow nastier with every tier.',
                VIEW_W / 2, 634, { size: 12, align: 'center', colour: COL.faint, outline: 3 });
            UI.text(ctx, 'BEST WAVE ' + game.bestWave, VIEW_W / 2, 668, { size: 16, bold: true, align: 'center', colour: COL.gold, outline: 3 });

            /* leaderboard */
            var board = game.loadLeaderboard();
            if (board.length > 0) {
                UI.text(ctx, 'LEADERBOARD', VIEW_W - 160, 484, { size: 11, bold: true, align: 'center', colour: COL.gold, outline: 3 });
                for (var bi = 0; bi < Math.min(5, board.length); bi++) {
                    var be = board[bi];
                    UI.text(ctx, (bi + 1) + '. ' + be.char + ' (' + be.diff + ')', VIEW_W - 280, 500 + bi * 18,
                        { size: 11, colour: COL.dim });
                    UI.text(ctx, '' + be.score, VIEW_W - 40, 500 + bi * 18,
                        { size: 11, bold: true, align: 'right', colour: COL.ink });
                }
            }

            UI.button(ctx, lay.mute, IW.Audio.muted ? 'SOUND OFF' : 'SOUND ON', { hover: game.hoverId === 'mute' }, { fontSize: 14 });
        },

        selectLayout: function () {
            var cards = [], w = 276, h = 392, gap = 16;
            var total = 4 * w + 3 * gap;
            var x0 = (VIEW_W - total) / 2;
            for (var i = 0; i < 4; i++) {
                cards.push({ x: x0 + i * (w + gap), y: 122, w: w, h: h, index: i });
            }
            return {
                cards: cards,
                start: { x: VIEW_W / 2 - 145, y: 616, w: 290, h: 62 },
                back: { x: 24, y: 20, w: 130, h: 42 },
                diff: [
                    { x: VIEW_W / 2 - 290, y: 556, w: 170, h: 44, index: 0 },
                    { x: VIEW_W / 2 - 90, y: 556, w: 170, h: 44, index: 1 },
                    { x: VIEW_W / 2 + 110, y: 556, w: 170, h: 44, index: 2 }
                ]
            };
        },

        select: function (ctx, game) {
            var lay = UI.selectLayout();
            UI.text(ctx, 'CHOOSE YOUR CHAMPION', VIEW_W / 2, 58, { size: 34, bold: true, align: 'center', colour: COL.gold, outline: 6 });
            UI.text(ctx, '1 - 4 to pick, ENTER to ride out', VIEW_W / 2, 86, { size: 13, align: 'center', colour: COL.dim, outline: 3 });

            for (var i = 0; i < lay.cards.length; i++) {
                var ch = IW.Characters[i];
                var r = lay.cards[i];
                var selected = game.selectedIndex === i;
                var card = UI.plate(ctx, 'paper', r.x, r.y, r.w, r.h, selected ? 1 : 0.9);
                if (!card) { UI.panel(ctx, r.x, r.y, r.w, r.h, { fill: 'rgba(28,24,20,0.94)' }); }
                UI.panel(ctx, r.x + 14, r.y + 14, r.w - 28, r.h - 28, {
                    fill: selected ? 'rgba(48,38,18,0.95)' : 'rgba(26,22,18,0.95)',
                    edge: selected ? COL.gold : 'rgba(0,0,0,0.55)',
                    lineWidth: selected ? 3 : 1
                });

                var key = 'u:Blue:' + ch.unitType + ':Idle';
                var frame = Math.floor(game.time * 6 + i) % A.frames(key);
                var scale = IW.SPRITE_SCALE[ch.unitType] * 0.85;   // compact card: slightly smaller
                A.draw(ctx, key, frame, r.x + r.w / 2, r.y + 100, scale, false, 1);

                UI.text(ctx, ch.name.toUpperCase(), r.x + r.w / 2, r.y + 130, { size: 20, bold: true, align: 'center', colour: COL.ink, outline: 4 });
                UI.text(ctx, ch.title, r.x + r.w / 2, r.y + 147, { size: 11, align: 'center', colour: COL.dim, outline: 3 });

                var y = UI.statLines(ctx, r.x + 20, r.y + 166, r.w - 40, [
                    ['HP', '' + Math.round(ch.baseStats.maxHp)],
                    ['Speed', ch.baseSpeed + ' px/s'],
                    ['Armor', '' + ch.baseStats.armor],
                    ['Weapon', ch.weapon.name],
                    ['Ability', ch.ability.name]
                ]);

                // Use compact text below the stats to fit blurb + ability inside the card
                UI.text(ctx, 'THE FANTASY', r.x + 20, y + 14, { size: 10, bold: true, colour: COL.gold });
                y = UI.wrap(ctx, ch.blurb, r.x + 20, y + 28, r.w - 40, 11, 11, COL.dim);
                UI.text(ctx, 'ABILITY - LEFT SHIFT', r.x + 20, y + 14, { size: 10, bold: true, colour: COL.gold });
                UI.wrap(ctx, ch.ability.desc, r.x + 20, y + 28, r.w - 40, 11, 11, COL.dim);
            }

            /* difficulty picker */
            var diffs = IW.DIFFICULTIES;
            UI.text(ctx, 'DIFFICULTY   (Q / W / E to change)', VIEW_W / 2, 548, { size: 11, align: 'center', colour: COL.dim, outline: 3 });
            for (var di = 0; di < diffs.length && di < lay.diff.length; di++) {
                var dr = lay.diff[di];
                var selDiff = game.difficulty === di + 1;
                var key = selDiff ? 'btnBlueDown' : 'btnBlue';
                UI.plate(ctx, key, dr.x, dr.y, dr.w, dr.h, 1);
                UI.text(ctx, (selDiff ? '> ' : '') + diffs[di].name + '  ' + diffs[di].scoreMul.toFixed(1) + 'x',
                    dr.x + dr.w / 2, dr.y + dr.h / 2 + 7, { size: 13, bold: true, align: 'center', colour: selDiff ? COL.gold : COL.ink, outline: 3 });
            }

            UI.button(ctx, lay.start, 'BEGIN RUN', { hover: game.hoverId === 'start' });
            UI.button(ctx, lay.back, 'BACK', { hover: game.hoverId === 'back' }, { fontSize: 14 });
        },

        /* --------------------------------------------------- level-up + clear */

        backdrop: function (ctx, alpha) {
            ctx.save();
            ctx.fillStyle = 'rgba(6,8,12,' + (alpha == null ? 0.7 : alpha) + ')';
            ctx.fillRect(0, 0, VIEW_W, VIEW_H);
            ctx.restore();
        },

        levelUpLayout: function () {
            var count = 3, w = 300, h = 296, gap = 26;
            var total = count * w + (count - 1) * gap;
            var x0 = (VIEW_W - total) / 2;
            var cards = [];
            for (var i = 0; i < count; i++) {
                cards.push({ x: x0 + i * (w + gap), y: 232, w: w, h: h, index: i });
            }
            return { cards: cards };
        },

        levelUp: function (ctx, game) {
            var lay = UI.levelUpLayout();
            UI.backdrop(ctx, 0.72);
            UI.text(ctx, 'LEVEL UP', VIEW_W / 2, 116, { size: 44, bold: true, align: 'center', colour: COL.gold, outline: 8 });
            UI.text(ctx, 'Level ' + game.player.level + ' reached - choose a boon' +
                (game.player.pendingLevels > 1 ? '   (' + game.player.pendingLevels + ' more waiting)' : ''),
                VIEW_W / 2, 152, { size: 15, align: 'center', colour: COL.dim, outline: 4 });
            UI.text(ctx, 'click a card or press 1 / 2 / 3', VIEW_W / 2, 178, { size: 12, align: 'center', colour: COL.faint, outline: 3 });

            var choices = game.upgradeChoices || [];
            for (var i = 0; i < lay.cards.length && i < choices.length; i++) {
                var up = choices[i];
                var r = lay.cards[i];
                var hover = game.hoverId === 'up' + i;
                var ok = UI.plate(ctx, 'paper', r.x, r.y, r.w, r.h, 1);
                if (!ok) { UI.panel(ctx, r.x, r.y, r.w, r.h, { fill: 'rgba(30,26,22,0.96)' }); }
                UI.panel(ctx, r.x + 14, r.y + 14, r.w - 28, r.h - 28, {
                    fill: hover ? 'rgba(54,44,20,0.95)' : 'rgba(26,22,18,0.95)',
                    edge: hover ? COL.gold : 'rgba(0,0,0,0.55)',
                    lineWidth: hover ? 3 : 1
                });
                A.drawIcon(ctx, up.icon, r.x + r.w / 2, r.y + 96, 84, 1);
                UI.text(ctx, up.name, r.x + r.w / 2, r.y + 178, { size: 19, bold: true, align: 'center', colour: COL.ink, outline: 4 });
                var lines = IW.Stats.describe(up.mods);
                UI.text(ctx, lines.length ? lines[0].text : '', r.x + r.w / 2, r.y + 204, { size: 13, align: 'center', colour: COL.good, outline: 3 });
                UI.text(ctx, 'PRESS ' + (i + 1), r.x + r.w / 2, r.y + 250, { size: 13, bold: true, align: 'center', colour: COL.faint, outline: 3 });
            }
        },

        waveClearLayout: function () {
            return { next: { x: VIEW_W / 2 - 150, y: 480, w: 300, h: 62 } };
        },

        waveClear: function (ctx, game) {
            var lay = UI.waveClearLayout();
            UI.backdrop(ctx, 0.62);
            UI.panel(ctx, VIEW_W / 2 - 300, 128, 600, 330, { fill: 'rgba(18,20,24,0.95)', accent: 'rgba(255,212,94,0.6)' });
            UI.text(ctx, 'WAVE ' + game.wave + ' CLEARED', VIEW_W / 2, 182, { size: 38, bold: true, align: 'center', colour: COL.gold, outline: 6 });
            UI.text(ctx, game.biome.name + ' survived', VIEW_W / 2, 210, { size: 14, align: 'center', colour: COL.dim, outline: 3 });

            var rows = [
                ['Gold earned this wave', '' + game.waveGold],
                ['Enemies slain', '' + game.waveKills],
                ['Wave length', U.formatTime(game.waveDuration)],
                ['Player level', '' + game.player.level],
                ['Items owned', '' + game.player.items.length],
                ['Health', Math.ceil(game.player.hp) + ' / ' + Math.round(game.player.maxHp)]
            ];
            for (var i = 0; i < rows.length; i++) {
                var ry = 248 + i * 26;
                UI.text(ctx, rows[i][0], VIEW_W / 2 - 250, ry, { size: 15, colour: COL.dim });
                UI.text(ctx, rows[i][1], VIEW_W / 2 + 250, ry, { size: 15, bold: true, align: 'right', colour: COL.ink });
            }
            UI.text(ctx, 'The shop is opening - spend it well.', VIEW_W / 2, 428, { size: 13, align: 'center', colour: COL.faint, outline: 3 });
            UI.button(ctx, lay.next, game.player.pendingLevels > 0 ? 'LEVEL UP' : 'ENTER SHOP', { hover: game.hoverId === 'next' });
        },
/* ------------------------------------------------------------- shop */

        shopLayout: function () {
            var cards = [], w = 222, h = 330, gap = 14, x0 = 22;
            for (var i = 0; i < 4; i++) {
                cards.push({ x: x0 + i * (w + gap), y: 168, w: w, h: h, index: i });
            }
            var bx = 972, by = 168;
            return {
                cards: cards,
                panel: { x: bx, y: by, w: 286, h: 470 },
                reroll: { x: bx + 16, y: by + 226, w: 254, h: 52 },
                heal: { x: bx + 16, y: by + 288, w: 254, h: 52 },
                next: { x: bx + 16, y: by + 388, w: 254, h: 62 },
                mute: { x: VIEW_W - 158, y: VIEW_H - 46, w: 142, h: 34 }
            };
        },

        shop: function (ctx, game) {
            var lay = UI.shopLayout();
            var p = game.player;
            UI.backdrop(ctx, 0.78);

            /* wooden board behind the shelves */
            UI.plate(ctx, 'woodTable', 8, 104, 936, 580, 0.5);
            UI.text(ctx, 'SHOP', 40, 62, { size: 40, bold: true, colour: COL.gold, outline: 7 });
            UI.text(ctx, 'Wave ' + game.wave + ' cleared - stock refreshes every round. Luck improves the odds of rare stock.',
                40, 92, { size: 14, colour: COL.dim, outline: 3 });

            A.draw(ctx, 'gold', 0, 1096, 40, 0.46, false, 1);
            UI.text(ctx, '' + Math.floor(p.gold), 1122, 50, { size: 24, bold: true, colour: COL.gold, outline: 4 });

            for (var i = 0; i < lay.cards.length; i++) {
                UI.shopCard(ctx, lay.cards[i], game, i);
            }

            var pan = lay.panel;
            UI.panel(ctx, pan.x, pan.y, pan.w, pan.h, { fill: 'rgba(16,18,22,0.96)', accent: 'rgba(255,212,94,0.55)' });
            UI.text(ctx, 'YOUR RUN', pan.x + 16, pan.y + 30, { size: 15, bold: true, colour: COL.gold });
            UI.text(ctx, 'Level ' + p.level + '   Items ' + p.items.length, pan.x + 16, pan.y + 52, { size: 13, colour: COL.dim });

            var rows = IW.Stats.summary(p.stats, p.baseSpeed);
            for (var r = 0; r < rows.length; r++) {
                var ry = pan.y + 80 + r * 17;
                UI.text(ctx, rows[r].label, pan.x + 16, ry, { size: 12, colour: COL.dim });
                UI.text(ctx, rows[r].value, pan.x + pan.w - 16, ry, { size: 12, bold: true, align: 'right', colour: COL.ink });
            }

            var canRoll = p.gold >= game.rerollCost;
            UI.button(ctx, lay.reroll, 'REROLL STOCK  ' + game.rerollCost + 'g',
                { hover: game.hoverId === 'reroll', disabled: !canRoll }, { fontSize: 15 });
            var healCost = game.healCost();
            var canHeal = p.gold >= healCost && p.hp < p.maxHp;
            UI.button(ctx, lay.heal, 'HEAL 40%  ' + healCost + 'g',
                { hover: game.hoverId === 'heal', disabled: !canHeal }, { fontSize: 15, tone: 'red' });
            UI.button(ctx, lay.next, 'NEXT WAVE  >', { hover: game.hoverId === 'next' }, { fontSize: 19 });

            UI.text(ctx, '1-4 buy   R reroll   H heal   ENTER next wave', pan.x + pan.w / 2, pan.y + pan.h - 12,
                { size: 11, align: 'center', colour: COL.faint, outline: 3 });
            UI.button(ctx, lay.mute, IW.Audio.muted ? 'SOUND OFF' : 'SOUND ON',
                { hover: game.hoverId === 'mute' }, { fontSize: 13 });
        },

        shopCard: function (ctx, rect, game, index) {
            var item = game.shop[index];
            var hover = game.hoverId === 'slot' + index;
            var rarity = item ? (IW.Rarities[item.rarity] || IW.Rarities[1]) : IW.Rarities[1];
            var affordable = !!(item && !item.sold && game.player.gold >= item.cost);

            var ok = UI.plate(ctx, 'paper', rect.x, rect.y, rect.w, rect.h, item ? 1 : 0.65);
            if (!ok) { UI.panel(ctx, rect.x, rect.y, rect.w, rect.h, { fill: 'rgba(30,26,22,0.95)' }); }
            UI.panel(ctx, rect.x + 14, rect.y + 14, rect.w - 28, rect.h - 28, {
                fill: hover && affordable ? 'rgba(54,44,20,0.95)' : 'rgba(26,22,18,0.95)',
                edge: hover ? COL.gold : 'rgba(0,0,0,0.55)',
                lineWidth: hover ? 3 : 1
            });

            if (!item) {
                UI.text(ctx, 'SOLD', rect.x + rect.w / 2, rect.y + rect.h / 2,
                    { size: 22, bold: true, align: 'center', colour: COL.faint, outline: 4 });
                return;
            }

            ctx.save();
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = rarity.colour;
            ctx.fillRect(rect.x + 18, rect.y + 18, rect.w - 36, 22);
            ctx.restore();
            UI.text(ctx, rarity.name.toUpperCase(), rect.x + rect.w / 2, rect.y + 34,
                { size: 12, bold: true, align: 'center', colour: '#1d1b16' });
            UI.text(ctx, '[' + (index + 1) + ']', rect.x + 26, rect.y + 33,
                { size: 11, bold: true, colour: '#1d1b16' });

            A.drawIcon(ctx, item.icon, rect.x + rect.w / 2, rect.y + 84, 76, item.sold ? 0.5 : 1);
            UI.text(ctx, item.name, rect.x + rect.w / 2, rect.y + 136,
                { size: UI.fitSize(ctx, item.name, 16, rect.w - 24, 11), bold: true, align: 'center', colour: COL.ink, outline: 4 });

            var lines = IW.Stats.describe(item.mods);
            for (var i = 0; i < lines.length && i < 3; i++) {
                UI.text(ctx, lines[i].text, rect.x + rect.w / 2, rect.y + 160 + i * 18,
                    { size: 13, align: 'center', colour: lines[i].good ? COL.good : COL.bad, outline: 3 });
            }
            UI.wrap(ctx, item.flavour, rect.x + 20, rect.y + 230, rect.w - 40, 13, 11, 'rgba(92,84,68,0.95)');

            var plateY = rect.y + rect.h - 52;
            UI.panel(ctx, rect.x + 18, plateY, rect.w - 36, 36, {
                fill: affordable ? 'rgba(20,26,20,0.85)' : 'rgba(40,18,18,0.85)',
                edge: affordable ? COL.gold : COL.bad
            });
            A.draw(ctx, 'gold', 0, rect.x + 34, plateY + 19, 0.3, false, 1);
            UI.text(ctx, item.cost + 'g', rect.x + 54, plateY + 24,
                { size: 17, bold: true, colour: affordable ? COL.gold : COL.bad, outline: 3 });
            UI.text(ctx, item.sold ? 'SOLD' : (affordable ? 'BUY' : 'NO GOLD'), rect.x + rect.w - 26, plateY + 24,
                { size: 12, bold: true, align: 'right', colour: affordable ? COL.good : COL.faint, outline: 3 });
        },

        /* --------------------------------------------- pause / death / victory */

        pauseLayout: function () {
            return {
                resume: { x: VIEW_W / 2 - 140, y: 400, w: 280, h: 56 },
                menu: { x: VIEW_W / 2 - 140, y: 468, w: 280, h: 56 },
                mute: { x: VIEW_W / 2 - 140, y: 536, w: 280, h: 50 }
            };
        },

        pause: function (ctx, game) {
            var lay = UI.pauseLayout();
            UI.backdrop(ctx, 0.72);
            UI.panel(ctx, VIEW_W / 2 - 320, 150, 640, 470, { fill: 'rgba(18,20,24,0.96)', accent: 'rgba(255,212,94,0.6)' });
            UI.text(ctx, 'PAUSED', VIEW_W / 2, 220, { size: 42, bold: true, align: 'center', colour: COL.gold, outline: 7 });
            UI.text(ctx, game.endless
                    ? ('Endless wave ' + U.formatTime(game.endlessTime) + ' survived - difficulty x' + game.endlessEsc().toFixed(1))
                    : ('Wave ' + game.wave + ' - ' + U.formatTime(Math.max(0, game.waveTime)) + ' left on the clock'),
                VIEW_W / 2, 252, { size: 14, align: 'center', colour: COL.dim, outline: 3 });

            var lines = [
                'WASD / ARROWS    move',
                'MOUSE    aim         LEFT CLICK (hold)    attack',
                'LEFT SHIFT / SPACE    class ability',
                'ESC / P    pause        TAB    stats        M    mute'
            ];
            for (var i = 0; i < lines.length; i++) {
                UI.text(ctx, lines[i], VIEW_W / 2, 302 + i * 24, { size: 13, align: 'center', colour: COL.dim });
            }

            UI.button(ctx, lay.resume, 'RESUME', { hover: game.hoverId === 'resume' });
            UI.button(ctx, lay.menu, 'ABANDON RUN', { hover: game.hoverId === 'menu' }, { fontSize: 16, tone: 'red' });
            UI.button(ctx, lay.mute, IW.Audio.muted ? 'SOUND OFF' : 'SOUND ON', { hover: game.hoverId === 'mute' }, { fontSize: 15 });
        },

        gameOverLayout: function () {
            return {
                again: { x: VIEW_W / 2 - 300, y: 552, w: 280, h: 58 },
                menu: { x: VIEW_W / 2 + 20, y: 552, w: 280, h: 58 }
            };
        },

        gameOver: function (ctx, game) {
            var lay = UI.gameOverLayout();
            var p = game.player;
            UI.backdrop(ctx, 0.8);
            UI.panel(ctx, VIEW_W / 2 - 380, 90, 760, 600, { fill: 'rgba(14,12,14,0.96)', accent: 'rgba(224,90,74,0.7)' });
            UI.text(ctx, 'YOU DIED', VIEW_W / 2, 178, { size: 60, bold: true, align: 'center', colour: '#e05a4a', outline: 9 });
            UI.text(ctx, 'Wave ' + game.wave + ' claimed ' + p.char.name + ', ' + p.char.title, VIEW_W / 2, 212,
                { size: 14, align: 'center', colour: COL.dim, outline: 3 });

            var rows = [
                ['Waves survived', '' + Math.max(0, game.effWave() - 1)],
                ['Reached wave', '' + game.effWave()],
                ['Level', '' + p.level],
                ['Enemies slain', '' + p.kills],
                ['Gold earned', '' + game.goldEarned],
                ['Items bought', '' + p.items.length],
                ['Damage dealt', '' + Math.round(p.damageDealt)],
                ['Damage taken', '' + Math.round(p.damageTaken)],
                ['Difficulty', game.diffMul().name],
                ['SCORE', '' + game.calcScore()],
                ['Best wave ever', '' + game.bestWave]
            ];
            for (var i = 0; i < rows.length; i++) {
                var col = i % 2, row = Math.floor(i / 2);
                var x = VIEW_W / 2 - 320 + col * 350;
                var y = 272 + row * 34;
                UI.text(ctx, rows[i][0], x, y, { size: 15, colour: COL.dim });
                UI.text(ctx, rows[i][1], x + 300, y, { size: 15, bold: true, align: 'right', colour: COL.ink });
            }

            UI.text(ctx, 'R to try the ' + p.char.name + ' again    ENTER for the menu', VIEW_W / 2, 524,
                { size: 13, align: 'center', colour: COL.faint, outline: 3 });
            UI.button(ctx, lay.again, 'RETRY', { hover: game.hoverId === 'again' });
            UI.button(ctx, lay.menu, 'MAIN MENU', { hover: game.hoverId === 'menu' }, { fontSize: 16, tone: 'red' });
        },
victoryLayout: function () {
            return {
                endless: { x: VIEW_W / 2 - 300, y: 552, w: 280, h: 58 },
                menu: { x: VIEW_W / 2 + 20, y: 552, w: 280, h: 58 }
            };
        },

        victory: function (ctx, game) {
            var lay = UI.victoryLayout();
            var p = game.player;
            UI.backdrop(ctx, 0.78);
            UI.panel(ctx, VIEW_W / 2 - 380, 90, 760, 600, { fill: 'rgba(12,16,14,0.96)', accent: 'rgba(255,212,94,0.8)' });
            UI.text(ctx, 'THE HORDE BREAKS', VIEW_W / 2, 180, { size: 52, bold: true, align: 'center', colour: COL.gold, outline: 9 });
            UI.text(ctx, 'Twenty waves. The water runs red, but the keep still stands.', VIEW_W / 2, 214,
                { size: 15, align: 'center', colour: COL.dim, outline: 3 });

            var rows = [
                ['Character', p.char.name],
                ['Level', '' + p.level],
                ['Enemies slain', '' + p.kills],
                ['Gold earned', '' + game.goldEarned],
                ['Items owned', '' + p.items.length],
                ['Damage dealt', '' + Math.round(p.damageDealt)],
                ['Difficulty', game.diffMul().name],
                ['SCORE', '' + game.calcScore()]
            ];
            for (var i = 0; i < rows.length; i++) {
                var y = 278 + i * 32;
                UI.text(ctx, rows[i][0], VIEW_W / 2 - 300, y, { size: 15, colour: COL.dim });
                UI.text(ctx, rows[i][1], VIEW_W / 2 + 300, y, { size: 15, bold: true, align: 'right', colour: COL.ink });
            }
            UI.text(ctx, 'Endless mode available: the waves keep coming, harder every time.', VIEW_W / 2, 486,
                { size: 13, align: 'center', colour: COL.faint, outline: 3 });
            UI.button(ctx, lay.endless, 'KEEP GOING', { hover: game.hoverId === 'endless' });
            UI.button(ctx, lay.menu, 'MAIN MENU', { hover: game.hoverId === 'menu' }, { fontSize: 16, tone: 'red' });
        },

        /* ------------------------------------------------- banners + toasts */

        waveIntro: function (ctx, game) {
            if (game.introTimer <= 0) { return; }
            var texts = game.introLines || [];
            ctx.save();
            ctx.globalAlpha = U.clamp(game.introTimer, 0, 1);
            var w = 640, h = 52 + texts.length * 20;
            UI.panel(ctx, VIEW_W / 2 - w / 2, 96, w, h, { fill: 'rgba(12,14,18,0.85)', edge: COL.gold, accent: 'rgba(255,212,94,0.6)' });
            UI.text(ctx, (game.endless ? 'ENDLESS' : 'WAVE ' + game.wave) + ' - ' + game.biome.name.toUpperCase(), VIEW_W / 2, 124,
                { size: 20, bold: true, align: 'center', colour: COL.gold, outline: 4 });
            for (var i = 0; i < texts.length; i++) {
                UI.text(ctx, texts[i], VIEW_W / 2, 148 + i * 20, { size: 13, align: 'center', colour: COL.dim, outline: 3 });
            }
            ctx.restore();
        },

        toast: function (ctx, game) {
            if (!game.toast || game.toastTimer <= 0) { return; }
            ctx.save();
            ctx.globalAlpha = U.clamp(game.toastTimer, 0, 1);
            UI.text(ctx, game.toast, VIEW_W / 2, 214, { size: 18, bold: true, align: 'center', colour: COL.good, outline: 5 });
            ctx.restore();
        }
    };

    IW.UI = UI;
})();