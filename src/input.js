/* Ironwill - keyboard + mouse input. Mouse coords are converted to canvas space. */
(function () {
    'use strict';
    window.IW = window.IW || {};

    var Input = {
        keys: {},
        justPressed: {},
        released: {},
        mouse: { x: 640, y: 360, down: false, justDown: false, justUp: false, rightDown: false, inside: false },
        canvas: null,

        init: function (canvas) {
            this.canvas = canvas;
            var self = this;

            window.addEventListener('keydown', function (e) {
                if (!self.keys[e.code]) { self.justPressed[e.code] = true; }
                self.keys[e.code] = true;
                self._prevent(e);
            }, false);

            window.addEventListener('keyup', function (e) {
                self.keys[e.code] = false;
                self.released[e.code] = true;
                self._prevent(e);
            }, false);

            window.addEventListener('blur', function () {
                self.keys = {};
                self.mouse.down = false;
                self.mouse.rightDown = false;
            }, false);

            canvas.addEventListener('mousemove', function (e) {
                var p = self.toCanvas(e);
                self.mouse.x = p.x; self.mouse.y = p.y;
                self.mouse.inside = true;
            }, false);

            canvas.addEventListener('mousedown', function (e) {
                var p = self.toCanvas(e);
                self.mouse.x = p.x; self.mouse.y = p.y;
                if (e.button === 2) { self.mouse.rightDown = true; } else {
                    if (!self.mouse.down) { self.mouse.justDown = true; }
                    self.mouse.down = true;
                }
                e.preventDefault();
            }, false);

            window.addEventListener('mouseup', function (e) {
                if (e.button === 2) { self.mouse.rightDown = false; } else {
                    self.mouse.down = false; self.mouse.justUp = true;
                }
            }, false);

            canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); }, false);
            window.addEventListener('mouseout', function () { self.mouse.inside = false; }, false);
        },

        _prevent: function (e) {
            // stop the page from scrolling with arrows / space
            if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown' ||
                e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Tab') {
                e.preventDefault();
            }
        },

        toCanvas: function (e) {
            var c = this.canvas;
            if (!c || !c.getBoundingClientRect) { return { x: e.clientX || 0, y: e.clientY || 0 }; }
            var r = c.getBoundingClientRect();
            var w = c.width || 1280, h = c.height || 720;
            if (!r || !r.width || !r.height) { return { x: e.clientX || 0, y: e.clientY || 0 }; }
            return {
                x: (e.clientX - r.left) * (w / r.width),
                y: (e.clientY - r.top) * (h / r.height)
            };
        },

        down: function (code) { return !!this.keys[code]; },
        anyDown: function (codes) {
            for (var i = 0; i < codes.length; i++) { if (this.keys[codes[i]]) { return true; } }
            return false;
        },
        pressed: function (code) { return !!this.justPressed[code]; },
        anyPressed: function (codes) {
            for (var i = 0; i < codes.length; i++) { if (this.justPressed[codes[i]]) { return true; } }
            return false;
        },

        /* WASD / arrows movement axis, already normalised */
        axis: function () {
            var x = 0, y = 0;
            if (this.anyDown(['KeyA', 'ArrowLeft'])) { x -= 1; }
            if (this.anyDown(['KeyD', 'ArrowRight'])) { x += 1; }
            if (this.anyDown(['KeyW', 'ArrowUp'])) { y -= 1; }
            if (this.anyDown(['KeyS', 'ArrowDown'])) { y += 1; }
            var len = Math.sqrt(x * x + y * y);
            if (len > 0) { x /= len; y /= len; }
            return { x: x, y: y };
        },

        abilityKey: function () {
            return this.anyPressed(['ShiftLeft', 'Space']);
        },
        abilityHeld: function () {
            return this.anyDown(['ShiftLeft', 'Space']);
        },
        confirmKey: function () {
            return this.anyPressed(['Enter', 'NumpadEnter', 'Space', 'KeyE']);
        },

        endFrame: function () {
            this.justPressed = {};
            this.released = {};
            this.mouse.justDown = false;
            this.mouse.justUp = false;
        }
    };

    IW.Input = Input;
})();