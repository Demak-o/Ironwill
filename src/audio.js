/* Ironwill - tiny WebAudio synth for SFX (no audio files needed). */
(function () {
    'use strict';
    window.IW = window.IW || {};

    var Audio = {
        ctx: null,
        master: null,
        muted: false,
        ready: false,

        init: function () {
            if (this.ready) { return; }
            var Ctor = window.AudioContext || window.webkitAudioContext;
            if (!Ctor) { return; }
            try {
                this.ctx = new Ctor();
                this.master = this.ctx.createGain();
                this.master.gain.value = this.muted ? 0 : 0.35;
                this.master.connect(this.ctx.destination);
                this.ready = true;
            } catch (e) {
                this.ctx = null;
            }
            try {
                var stored = window.localStorage ? window.localStorage.getItem('ironwill.muted') : null;
                if (stored === '1') { this.setMuted(true); }
            } catch (e2) { /* ignore */ }
        },

        resume: function () {
            if (this.ctx && this.ctx.state === 'suspended' && this.ctx.resume) { this.ctx.resume(); }
        },

        setMuted: function (m) {
            this.muted = !!m;
            if (this.master) { this.master.gain.value = this.muted ? 0 : 0.35; }
            try {
                if (window.localStorage) { window.localStorage.setItem('ironwill.muted', this.muted ? '1' : '0'); }
            } catch (e) { /* ignore */ }
        },

        toggleMute: function () { this.setMuted(!this.muted); return this.muted; },

        _tone: function (opts) {
            if (!this.ready || this.muted) { return; }
            var ctx = this.ctx, t0 = ctx.currentTime;
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.type = opts.type || 'square';
            osc.frequency.setValueAtTime(opts.f0, t0);
            if (opts.f1 != null) { osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.f1), t0 + opts.dur); }
            var vol = (opts.vol == null ? 0.3 : opts.vol);
            gain.gain.setValueAtTime(0.0001, t0);
            gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
            osc.connect(gain); gain.connect(this.master);
            osc.start(t0); osc.stop(t0 + opts.dur + 0.02);
        },

        _noise: function (opts) {
            if (!this.ready || this.muted) { return; }
            var ctx = this.ctx, t0 = ctx.currentTime;
            var len = Math.max(1, Math.floor(ctx.sampleRate * opts.dur));
            var buf = ctx.createBuffer(1, len, ctx.sampleRate);
            var data = buf.getChannelData(0);
            for (var i = 0; i < len; i++) { data[i] = (Math.random() * 2 - 1) * (1 - i / len); }
            var src = ctx.createBufferSource();
            src.buffer = buf;
            var filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = opts.cut || 1400;
            var gain = ctx.createGain();
            gain.gain.value = opts.vol == null ? 0.3 : opts.vol;
            src.connect(filter); filter.connect(gain); gain.connect(this.master);
            src.start(t0);
        },

        play: function (name) {
            if (!this.ready || this.muted) { return; }
            this.resume();
            switch (name) {
                case 'shoot': this._tone({ type: 'square', f0: 820, f1: 260, dur: 0.09, vol: 0.16 }); break;
                case 'bow': this._tone({ type: 'triangle', f0: 620, f1: 180, dur: 0.14, vol: 0.2 }); break;
                case 'slash': this._noise({ dur: 0.13, cut: 2600, vol: 0.18 }); break;
                case 'thrust': this._tone({ type: 'sawtooth', f0: 320, f1: 900, dur: 0.1, vol: 0.14 }); break;
                case 'pulse': this._tone({ type: 'sine', f0: 240, f1: 700, dur: 0.22, vol: 0.18 }); break;
                case 'hit': this._noise({ dur: 0.09, cut: 1800, vol: 0.22 }); break;
                case 'hurt': this._tone({ type: 'square', f0: 300, f1: 90, dur: 0.22, vol: 0.28 }); break;
                case 'enemyDie': this._tone({ type: 'triangle', f0: 420, f1: 80, dur: 0.24, vol: 0.2 }); break;
                case 'coin': this._tone({ type: 'square', f0: 1250, f1: 1750, dur: 0.07, vol: 0.13 }); break;
                case 'buy': this._tone({ type: 'square', f0: 600, f1: 1200, dur: 0.16, vol: 0.2 }); break;
                case 'click': this._tone({ type: 'square', f0: 900, f1: 900, dur: 0.04, vol: 0.12 }); break;
                case 'error': this._tone({ type: 'sawtooth', f0: 200, f1: 140, dur: 0.14, vol: 0.2 }); break;
                case 'levelup': this._tone({ type: 'triangle', f0: 520, f1: 1400, dur: 0.35, vol: 0.24 }); break;
                case 'wave': this._tone({ type: 'square', f0: 300, f1: 640, dur: 0.4, vol: 0.2 }); break;
                case 'ability': this._tone({ type: 'sawtooth', f0: 180, f1: 620, dur: 0.26, vol: 0.2 }); break;
                case 'heal': this._tone({ type: 'sine', f0: 440, f1: 900, dur: 0.4, vol: 0.2 }); this._tone({ type: 'sine', f0: 660, f1: 1200, dur: 0.4, vol: 0.1 }); break;
                case 'dash': this._noise({ dur: 0.18, cut: 900, vol: 0.18 }); break;
                case 'gameover': this._tone({ type: 'sawtooth', f0: 300, f1: 60, dur: 1.2, vol: 0.25 }); break;
                case 'win': this._tone({ type: 'triangle', f0: 520, f1: 1500, dur: 0.6, vol: 0.24 }); break;
                default: break;
            }
        }
    };

    IW.Audio = Audio;
})();