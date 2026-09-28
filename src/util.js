/* Ironwill - small shared helpers (math, rng, geometry). */
(function () {
    'use strict';
    window.IW = window.IW || {};
    var M = Math;

    var U = {
        TAU: M.PI * 2,

        clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
        lerp: function (a, b, t) { return a + (b - a) * t; },
        approach: function (cur, target, delta) {
            return cur < target ? M.min(cur + delta, target) : M.max(cur - delta, target);
        },
        sign: function (v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); },

        dist2: function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; },
        dist: function (ax, ay, bx, by) { return M.sqrt(U.dist2(ax, ay, bx, by)); },

        rand: function (rng, a, b) { return a + rng() * (b - a); },
        randInt: function (rng, a, b) { return M.floor(a + rng() * (b - a + 1)); },
        pick: function (rng, arr) { return arr[M.min(arr.length - 1, M.floor(rng() * arr.length))]; },

        shuffle: function (rng, arr) {
            for (var i = arr.length - 1; i > 0; i--) {
                var j = M.floor(rng() * (i + 1));
                var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
            }
            return arr;
        },

        /* entries: [{ w: weight, v: value }] */
        weightedPick: function (rng, entries) {
            var total = 0, i;
            for (i = 0; i < entries.length; i++) { if (entries[i].w > 0) { total += entries[i].w; } }
            if (total <= 0) { return entries.length ? entries[0].v : null; }
            var r = rng() * total;
            for (i = 0; i < entries.length; i++) {
                if (entries[i].w <= 0) { continue; }
                r -= entries[i].w;
                if (r <= 0) { return entries[i].v; }
            }
            return entries[entries.length - 1].v;
        },

        angleDiff: function (a, b) {
            var d = (a - b) % U.TAU;
            if (d > M.PI) { d -= U.TAU; }
            if (d < -M.PI) { d += U.TAU; }
            return d;
        },

        /* mulberry32 - deterministic rng so runs/tests are reproducible */
        makeRng: function (seed) {
            var s = seed >>> 0;
            return function () {
                s = (s + 0x6D2B79F5) | 0;
                var t = M.imul(s ^ (s >>> 15), 1 | s);
                t = (t + M.imul(t ^ (t >>> 7), 61 | t)) ^ t;
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
        },

        twoPi: M.PI * 2,

        /* short, stable string hash -> uint32 (used for tile variety) */
        hash2: function (x, y, salt) {
            var h = (x * 374761393 + y * 668265263 + (salt || 0) * 2246822519) | 0;
            h = (h ^ (h >>> 13)) | 0;
            h = M.imul(h, 1274126177) | 0;
            return (h ^ (h >>> 16)) >>> 0;
        },

        circleRectOverlap: function (cx, cy, r, rx, ry, rw, rh) {
            var nx = U.clamp(cx, rx, rx + rw), ny = U.clamp(cy, ry, ry + rh);
            return U.dist2(cx, cy, nx, ny) <= r * r;
        },

        /* point in rotated rectangle (used for spear thrusts) */
        pointInOrientedBox: function (px, py, cx, cy, angle, halfLen, halfWidth) {
            var dx = px - cx, dy = py - cy;
            var c = M.cos(-angle), s = M.sin(-angle);
            var lx = dx * c - dy * s, ly = dx * s + dy * c;
            return M.abs(lx) <= halfLen && M.abs(ly) <= halfWidth;
        },

        formatTime: function (sec) {
            var s = M.max(0, M.ceil(sec));
            var mm = M.floor(s / 60), ss = s % 60;
            return mm + ':' + (ss < 10 ? '0' : '') + ss;
        },

        fmt: function (v, digits) { return (v).toFixed(digits == null ? 1 : digits); },

        percent: function (v, digits) { return (v * 100).toFixed(digits == null ? 0 : digits) + '%'; },

        now: function () {
            return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        },

        clone: function (obj) {
            var out = {}, k;
            for (k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) { out[k] = obj[k]; } }
            return out;
        },

        hasOwn: function (obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); }
    };

    IW.util = U;
})();