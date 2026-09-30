/* Ironwill - the arena: a pre-rendered biome floor with a water surround plus a
 * list of decorations that get y-sorted with the entities each frame. */
(function () {
    'use strict';
    window.IW = window.IW || {};
    var U = IW.util;
    var A = IW.Assets;

    var TILE = 48;
    var INSET = 96;           /* water band between the world edge and the arena */
    var WORLD_TILES_W = 40;
    var WORLD_TILES_H = 28;

    /* Interior (borderless) grass tiles - verified seamless by tiling them and looking
     * (tools/verify_tiles.ps1 + tools/score_tiles.ps1). Only cols 1-2 / rows 1-2 of a
     * tileset variant are pure interior grass; everything else carries a shore trim. */
    var INTERIOR = [
        { c: 1, r: 1 }, { c: 2, r: 1 },
        { c: 1, r: 2 }, { c: 2, r: 2 }
    ];

    /* Waves move through biomes - a new palette every few rounds. */
    IW.BIOMES = [
        { from: 1, variant: 2, name: 'Greenwood' },
        { from: 4, variant: 1, name: 'Sunbrindle' },
        { from: 7, variant: 4, name: 'Mirefen' },
        { from: 10, variant: 5, name: 'Gloamwater' },
        { from: 13, variant: 3, name: 'Frostfell' }
    ];

    IW.biomeForWave = function (wave) {
        var chosen = IW.BIOMES[0];
        for (var i = 0; i < IW.BIOMES.length; i++) {
            if (wave >= IW.BIOMES[i].from) { chosen = IW.BIOMES[i]; }
        }
        return chosen;
    };

    function Arena(rng, wave) {
        this.rng = rng;
        this.wave = wave;
        this.biome = IW.biomeForWave(wave);
        this.variant = this.biome.variant;
        this.tileSize = TILE;
        this.worldW = WORLD_TILES_W * TILE;
        this.worldH = WORLD_TILES_H * TILE;
        /* playable rect (entities are clamped to this) */
        this.x = INSET;
        this.y = INSET;
        this.w = this.worldW - INSET * 2;
        this.h = this.worldH - INSET * 2;
        this.decor = [];
        this.rocks = [];
        this.foam = [];
        this.ducks = [];
        this.canvas = null;
        this.build(rng);
    }

    Arena.prototype.tileVariant = function () { return this.variant; };

    Arena.prototype.build = function (rng) {
        this.decor.length = 0;
        this.rocks.length = 0;
        this.foam.length = 0;
        this.ducks.length = 0;

        if (typeof document !== 'undefined' && document.createElement) {
            this.canvas = document.createElement('canvas');
            this.canvas.width = this.worldW;
            this.canvas.height = this.worldH;
            var ctx = this.canvas.getContext('2d');
            if (ctx) { this.paintGround(ctx); } else { this.canvas = null; }
        } else {
            this.canvas = null;
        }

        this.placeDecor(rng);
    };

    /* ------------------------------------------------------ ground painting */

    Arena.prototype.paintGround = function (ctx) {
        var x, y;
        var wW = this.worldW, wH = this.worldH;

        /* water everywhere, then the arena floor on top */
        for (y = 0; y < wH; y += 64) {
            for (x = 0; x < wW; x += 64) {
                A.drawRegion(ctx, 'water', 0, 0, 64, 64, x, y, 64, 64);
            }
        }

        var cols = Math.round(this.w / TILE), rows = Math.round(this.h / TILE);
        for (var row = 0; row < rows; row++) {
            for (var col = 0; col < cols; col++) {
                var t = INTERIOR[U.hash2(col, row, this.variant) % INTERIOR.length];
                A.drawRegion(ctx, 'tile' + this.variant, t.c * TILE, t.r * TILE, TILE, TILE,
                    this.x + col * TILE, this.y + row * TILE, TILE, TILE);
            }
        }

        /* Break up the 48px repeat with soft grass patches (drawn once, so it is free
         * at runtime and can never introduce a visible tile seam). */
        var patches = Math.round((this.w * this.h) / 90000);
        for (var pIdx = 0; pIdx < patches; pIdx++) {
            var px = U.rand(this.rng, this.x + 30, this.x + this.w - 30);
            var py = U.rand(this.rng, this.y + 30, this.y + this.h - 30);
            var rad = U.rand(this.rng, 60, 190);
            var dark = this.rng() < 0.5;
            var grad = ctx.createRadialGradient ? ctx.createRadialGradient(px, py, 0, px, py, rad) : null;
            ctx.save();
            if (grad && grad.addColorStop) {
                grad.addColorStop(0, dark ? 'rgba(38,56,20,0.32)' : 'rgba(196,214,110,0.20)');
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = grad;
            } else {
                ctx.globalAlpha = 0.15;
                ctx.fillStyle = dark ? '#2a3a16' : '#c3d76e';
            }
            ctx.beginPath();
            ctx.arc(px, py, rad, 0, U.TAU);
            ctx.fill();
            ctx.restore();
        }

        /* water-edge rocks / splashes, tucked into the water band */
        for (var i = 0; i < 26; i++) {
            var side = Math.floor(this.rng() * 4);
            var rk = 'waterrock' + (1 + Math.floor(this.rng() * 2));
            var rx, ry;
            if (side === 0) { rx = U.rand(this.rng, 20, wW - 120); ry = U.rand(this.rng, 14, INSET - 46); }
            else if (side === 1) { rx = U.rand(this.rng, 20, wW - 120); ry = U.rand(this.rng, wH - INSET + 12, wH - 60); }
            else if (side === 2) { rx = U.rand(this.rng, 12, INSET - 54); ry = U.rand(this.rng, 20, wH - 80); }
            else { rx = U.rand(this.rng, wW - INSET + 12, wW - 64); ry = U.rand(this.rng, 20, wH - 80); }
            this.rocks.push({ key: rk, frame: Math.floor(this.rng() * A.frames(rk)), x: rx, y: ry, scale: U.rand(this.rng, 0.7, 1.1) });
        }

        /* swimming rubber ducks - these belong on the water, not the grass field */
        for (var dk = 0; dk < 2; dk++) {
            var dside = Math.floor(this.rng() * 4);
            var dx, dy;
            if (dside === 0) { dx = U.rand(this.rng, 60, wW - 80); dy = U.rand(this.rng, 16, INSET - 34); }
            else if (dside === 1) { dx = U.rand(this.rng, 60, wW - 80); dy = U.rand(this.rng, wH - INSET + 14, wH - 30); }
            else if (dside === 2) { dx = U.rand(this.rng, 16, INSET - 34); dy = U.rand(this.rng, 60, wH - 80); }
            else { dx = U.rand(this.rng, wW - INSET + 14, wW - 30); dy = U.rand(this.rng, 60, wH - 80); }
            this.ducks.push({ x: dx, y: dy, flip: this.rng() < 0.5, scale: U.rand(this.rng, 0.85, 1.1) });
        }

        /* shoreline: dark lip + light foam line around the playable rect */
        ctx.save();
        ctx.strokeStyle = 'rgba(12,32,30,0.55)';
        ctx.lineWidth = 10;
        ctx.strokeRect(this.x + 1, this.y + 1, this.w - 2, this.h - 2);
        ctx.strokeStyle = 'rgba(236,255,238,0.45)';
        ctx.lineWidth = 3;
        ctx.strokeRect(this.x + 4, this.y + 4, this.w - 8, this.h - 8);
        ctx.strokeStyle = 'rgba(24,52,36,0.35)';
        ctx.lineWidth = 26;
        ctx.strokeRect(this.x + 18, this.y + 18, this.w - 36, this.h - 36);
        ctx.restore();

        /* animated foam markers along the shoreline (drawn live, positions fixed here) */
        var step = 150;
        for (var px = this.x + 60; px < this.x + this.w - 60; px += step) {
            this.foam.push({ x: px, y: this.y + 2, flip: false });
            this.foam.push({ x: px, y: this.y + this.h - 2, flip: true });
        }
        for (var py = this.y + 60; py < this.y + this.h - 60; py += step) {
            this.foam.push({ x: this.x + 2, y: py, flip: false });
            this.foam.push({ x: this.x + this.w - 2, y: py, flip: true });
        }
    };

    /* --------------------------------------------------------- decorations */

    /* Where a decoration's visual base sits relative to its frame centre
     * (fraction of frame height) - measured with tools/measure_decor.ps1. */
    var DECOR_BASE = {
        tree1: 0.438, tree2: 0.438, tree3: 0.380, tree4: 0.380,
        bush1: 0.109, bush2: 0.109, bush3: 0.109, bush4: 0.109,
        rock1: 0.281, rock2: 0.281, rock3: 0.281, rock4: 0.281,
        stump1: 0.434, stump2: 0.434, stump3: 0.434, stump4: 0.434,
        sheep: 0.148, duck: 0.344
    };

    IW.decorBase = function (key) {
        var base = key.replace(/[0-9]+$/, '');
        var frac = DECOR_BASE[key] != null ? DECOR_BASE[key] : DECOR_BASE[base];
        return frac != null ? frac : 0.2;
    };

    /* Placeholder clearance radius for each decor kind (half a canopy/footprint),
     * so tall foliage no longer buries its neighbours' art the way a flat 92 px
     * gap did (which let a tree's canopy be half-covered by the asset in front). */
    var RAD = { tree: 135, bush: 60, rock: 55, stump: 100, sheep: 42 };

    Arena.prototype.placeDecor = function (rng) {
        var self = this;
        var cx = this.x + this.w / 2, cy = this.y + this.h / 2;

        function spot(minClear, rad) {
            var i, j;
            rad = rad || 60;
            for (i = 0; i < 60; i++) {
                var px = U.rand(rng, self.x + 72, self.x + self.w - 72);
                var py = U.rand(rng, self.y + 72, self.y + self.h - 72);
                if (U.dist(px, py, cx, cy) < minClear) { continue; }
                var ok = true;
                for (j = 0; j < self.decor.length; j++) {
                    var other = self.decor[j];
                    if (U.dist(px, py, other.x, other.y) < (other.rad || 60) + rad) { ok = false; break; }
                }
                if (ok) { return { x: px, y: py }; }
            }
            /* deterministic fallback so placement can never loop forever */
            var a = rng() * U.TAU, r = U.rand(rng, 180, Math.max(220, Math.min(self.w, self.h) / 2 - 130));
            return {
                x: U.clamp(cx + Math.cos(a) * r, self.x + 90, self.x + self.w - 90),
                y: U.clamp(cy + Math.sin(a) * r, self.y + 90, self.y + self.h - 90)
            };
        }

        var i, p;
        for (i = 0; i < 5; i++) {
            p = spot(330, RAD.tree);
            var tkey = 'tree' + U.randInt(rng, 1, 4);
            /* The tall 256 px trees (tree1/tree2) have 6-frame sway sheets whose 1,2,4,5
             * frames are motion-smear transitions that draw a stray second crown on the
             * left - frozen as a static decor frame they read as a broken "half tree".
             * Only frames 0 and 3 are clean single-crown poses; the small 192 px trees
             * (tree3/tree4) are a single clean crown on every frame so they can use all 8. */
            var tframe = (tkey === 'tree1' || tkey === 'tree2')
                ? [0, 3][U.randInt(rng, 0, 1)]
                : U.randInt(rng, 0, 7);
            /* The tall sway sheets bleed the start of the next pose into each frame's
             * right edge (~x 238-255) - that leftover crown renders as a stray
             * 'half tree' next to the real one. trim lets drawDecor crop it away
             * (the main crown never reaches beyond x ~152). */
            var ttrim = (tkey === 'tree1' || tkey === 'tree2') ? 224 : 0;
            this.decor.push({ kind: 'tree', key: tkey, frame: tframe, trim: ttrim, x: p.x, y: p.y, scale: U.rand(rng, 0.7, 0.95), rad: RAD.tree });
        }
        for (i = 0; i < 9; i++) {
            p = spot(250, RAD.bush);
            this.decor.push({ kind: 'bush', key: 'bush' + U.randInt(rng, 1, 4), frame: U.randInt(rng, 0, 7), x: p.x, y: p.y, scale: U.rand(rng, 0.7, 1.1), rad: RAD.bush });
        }
        for (i = 0; i < 8; i++) {
            p = spot(210, RAD.rock);
            this.decor.push({ kind: 'rock', key: 'rock' + U.randInt(rng, 1, 4), frame: 0, x: p.x, y: p.y, scale: U.rand(rng, 1.0, 1.7), rad: RAD.rock });
        }
        for (i = 0; i < 3; i++) {
            p = spot(250, RAD.stump);
            this.decor.push({ kind: 'stump', key: 'stump' + U.randInt(rng, 1, 4), frame: 0, x: p.x, y: p.y, scale: U.rand(rng, 0.85, 1.1), rad: RAD.stump });
        }
        for (i = 0; i < 2; i++) {
            p = spot(280, RAD.sheep);
            this.decor.push({ kind: 'sheep', key: 'sheep', frame: 0, x: p.x, y: p.y, scale: 1.0, fps: 5, rad: RAD.sheep });
        }
    };

    /* Draw the water/foam framing that sits behind everything. */
    Arena.prototype.drawFoam = function (ctx, camX, camY, time) {
        var i, f;
        for (i = 0; i < this.rocks.length; i++) {
            f = this.rocks[i];
            A.draw(ctx, f.key, f.frame, f.x - camX, f.y - camY, f.scale, false, 0.95);
        }
        var frames = A.frames('foam');
        for (i = 0; i < this.foam.length; i++) {
            f = this.foam[i];
            var frame = Math.floor(time * 7 + i * 2.3) % frames;
            A.draw(ctx, 'foam', frame, f.x - camX, f.y - camY, 0.55, f.flip, 0.32);
        }
        /* swimming ducks bob gently on the water */
        var dFrames = A.frames('duck');
        for (i = 0; i < this.ducks.length; i++) {
            f = this.ducks[i];
            var dFrame = Math.floor(time * 5 + i * 1.7) % dFrames;
            var bob = Math.sin(time * 3 + i * 2.0) * 1.6;
            A.draw(ctx, 'duck', dFrame, f.x - camX, f.y - camY + bob, f.scale, f.flip, 1);
        }
    };

    Arena.prototype.drawGround = function (ctx, camX, camY, vw, vh) {
        if (this.canvas) {
            ctx.drawImage(this.canvas, camX, camY, vw, vh, 0, 0, vw, vh);
        } else {
            /* headless / broken-image fallback: flat colours keep the game readable */
            ctx.fillStyle = '#3d7d8c';
            ctx.fillRect(0, 0, vw, vh);
            ctx.fillStyle = '#6f8f22';
            ctx.fillRect(this.x - camX, this.y - camY, this.w, this.h);
        }
    };

    Arena.prototype.clampPoint = function (x, y, pad) {
        pad = pad || 0;
        return {
            x: U.clamp(x, this.x + pad, this.x + this.w - pad),
            y: U.clamp(y, this.y + pad, this.y + this.h - pad)
        };
    };

    Arena.prototype.contains = function (x, y, pad) {
        pad = pad || 0;
        return x >= this.x + pad && x <= this.x + this.w - pad &&
            y >= this.y + pad && y <= this.y + this.h - pad;
    };

    Arena.prototype.randomPoint = function (rng, pad) {
        pad = pad || 60;
        return {
            x: U.rand(rng, this.x + pad, this.x + this.w - pad),
            y: U.rand(rng, this.y + pad, this.y + this.h - pad)
        };
    };

    IW.Arena = Arena;
})();