/* Ironwill - the Game controller: run setup, waves, spawning, collisions, camera,
 * the state machine and all input routing. */
(function () {
    'use strict';
    window.IW = window.IW || {};
    var U = IW.util;
    var A = IW.Assets;
    var UI = IW.UI;
    var Input = IW.Input;

    var VW = 1280, VH = 720;
    var FINAL_WAVE = 20;

    function Game(canvas) {
        this.canvas = canvas;
        this.ctx = (canvas && canvas.getContext) ? canvas.getContext('2d') : null;
        this.state = 'title';
        this.time = 0;
        this.seed = ((Date.now ? Date.now() : 1) ^ 0x9e3779b9) >>> 0;
        this.rng = U.makeRng(this.seed);
        this.uidCounter = 0;

        this.enemies = [];
        this.projectiles = [];
        this.pickups = [];
        this.effects = [];
        this.texts = [];

        this.player = null;
        this.wave = 0;
        this.waveCfg = IW.waveConfig(1);
        this.waveTime = 0;
        this.waveDuration = 0;
        this.waveGold = 0;
        this.waveKills = 0;
        this.goldEarned = 0;
        this.spawnTimer = 0;
        this.spawned = 0;
        this.bestWave = loadBest();
        this.endless = false;

        this.camera = { x: 0, y: 0, shake: 0 };
        this.introTimer = 0;
        this.introLines = [];
        this.toast = '';
        this.toastTimer = 0;
        this.hoverId = null;
        this.selectedIndex = 0;
        this.showStats = false;

        this.shop = [];
        this.rerollCost = 8;
        this.rerolls = 0;
        this.upgradeChoices = [];
        this.healBase = 14;

        this.arena = null;
        this.biome = IW.biomeForWave(1);
        this.difficulty = 1;     /* 1=Normal, 2=Medium, 3=Hard */
        this.score = 0;
    }

    /* ------------------------------------------------------- persistence */

    function loadBest() {
        try {
            if (window.localStorage) {
                var v = parseInt(window.localStorage.getItem('ironwill.bestWave'), 10);
                if (isFinite(v) && v > 0) { return v; }
            }
        } catch (e) { /* ignore */ }
        return 0;
    }

    Game.prototype.saveBest = function () {
        if (this.wave <= this.bestWave) { return; }
        this.bestWave = this.wave;
        try {
            if (window.localStorage) { window.localStorage.setItem('ironwill.bestWave', '' + this.bestWave); }
        } catch (e) { /* ignore */ }
    };

    /* Difficulty presets: score multiplier, enemy stat multiplier. */
    IW.DIFFICULTIES = [
        { name: 'Normal',  scoreMul: 1.00, enemyMul: 1.00 },
        { name: 'Medium',  scoreMul: 1.20, enemyMul: 1.08 },
        { name: 'Hard',    scoreMul: 1.50, enemyMul: 1.18 }
    ];

    Game.prototype.diffMul = function () {
        return (IW.DIFFICULTIES[this.difficulty - 1] || IW.DIFFICULTIES[0]);
    };

    Game.prototype.calcScore = function () {
        var diff = this.diffMul();
        return Math.round(this.wave * 25 + this.goldEarned * 0.5 + this.player.kills * 3) * diff.scoreMul;
    };

    /* ------------------------------------------------------------- leaderboard */

    IW.MAX_LEADERBOARD = 10;

    function loadLeaderboard() {
        try {
            if (window.localStorage) {
                var v = JSON.parse(window.localStorage.getItem('ironwill.leaderboard'));
                if (Array.isArray(v) && v.length > 0) { return v; }
            }
        } catch (e) { /* ignore */ }
        return [];
    }

    Game.prototype.saveLeaderboard = function () {
        var board = loadLeaderboard();
        var entry = {
            score: Math.round(this.calcScore()),
            wave: this.wave,
            char: this.char ? this.char.name : 'Unknown',
            diff: this.diffMul().name,
            date: Date.now ? Date.now() : 0
        };
        board.push(entry);
        board.sort(function (a, b) { return b.score - a.score; });
        if (board.length > IW.MAX_LEADERBOARD) { board.length = IW.MAX_LEADERBOARD; }
        try {
            if (window.localStorage) { window.localStorage.setItem('ironwill.leaderboard', JSON.stringify(board)); }
        } catch (e) { /* ignore */ }
        return board;
    };

    Game.prototype.loadLeaderboard = loadLeaderboard;

    /* ---------------------------------------------------------- run setup */

    Game.prototype.newArena = function (wave) {
        this.biome = IW.biomeForWave(wave);
        this.arena = new IW.Arena(this.rng, wave);
        this.camera.x = U.clamp(this.arena.worldW / 2 - VW / 2, 0, Math.max(0, this.arena.worldW - VW));
        this.camera.y = U.clamp(this.arena.worldH / 2 - VH / 2, 0, Math.max(0, this.arena.worldH - VH));
    };

    Game.prototype.startRun = function (charIndex) {
        var char = IW.Characters[charIndex] || IW.Characters[0];
        this.char = char;
        this.enemies.length = 0;
        this.projectiles.length = 0;
        this.pickups.length = 0;
        this.effects.length = 0;
        this.texts.length = 0;
        this.goldEarned = 0;
        this.endless = false;
        this.wave = 0;
        this.spawned = 0;
        this.upgradeChoices = [];
        this.newArena(1);
        this.player = new IW.Player(this, char);
        this.player.gold = 0;
        this.startWave(1);
    };

    Game.prototype.startWave = function (wave) {
        var cfg = IW.waveConfig(wave);
        var biomeChanged = !this.arena || this.arena.biome.variant !== IW.biomeForWave(wave).variant;
        this.wave = wave;
        this.waveCfg = cfg;
        this.waveTime = cfg.duration;
        this.waveDuration = cfg.duration;
        this.waveGold = 0;
        this.waveKills = 0;
        this.spawned = 0;
        this.spawnTimer = 0.35;
        this.enemies.length = 0;
        this.projectiles.length = 0;
        this.pickups.length = 0;
        if (biomeChanged) { this.newArena(wave); }
        /* slight heal between waves keeps long runs honest without free full heals */
        if (this.player) { this.player.heal(this.player.maxHp * 0.05); }
        this.state = 'wave';
        this.introTimer = 3.2;
        this.introLines = this.introText(wave);
        IW.Audio.play('wave');
    };

    Game.prototype.introText = function (wave) {
        var lines = [];
        var names = [];
        for (var t = 1; t <= 4; t++) {
            if (IW.tierUnlockWave(t) === wave) { names.push(IW.tierById(t).name); }
        }
        if (names.length) {
            lines.push(names.join(' and ') + ' enemies have entered the arena - tougher, better armoured, richer.');
        }
        if (wave === 1) {
            lines.push('Aim with your mouse and hold Left Click to attack. Left Shift uses your class ability.');
        } else if (wave === 2) {
            lines.push('Hold the arena for ' + Math.round(IW.waveConfig(wave).duration) + ' seconds; gold flies to you when you are close.');
        } else if (wave === FINAL_WAVE && !this.endless) {
            lines.push('Final wave of the campaign. Survive it and the horde breaks.');
        } else if (wave % 3 === 0) {
            lines.push('Elite champions are more common from here on.');
        }
        if (!lines.length) { lines.push('The horde returns, ' + Math.round(this.waveCfg.cap) + ' at a time.'); }
        return lines;
    };

    /* ----------------------------------------------------------- spawning */

    Game.prototype.spawnPoint = function () {
        var pad = 90;
        var vx = this.camera.x, vy = this.camera.y;
        for (var i = 0; i < 40; i++) {
            var side = Math.floor(this.rng() * 4);
            var x, y;
            if (side === 0) { x = U.rand(this.rng, vx - pad, vx + VW + pad); y = vy - pad; }
            else if (side === 1) { x = U.rand(this.rng, vx - pad, vx + VW + pad); y = vy + VH + pad; }
            else if (side === 2) { x = vx - pad; y = U.rand(this.rng, vy - pad, vy + VH + pad); }
            else { x = vx + VW + pad; y = U.rand(this.rng, vy - pad, vy + VH + pad); }
            var p = this.arena.clampPoint(x, y, 28);
            if (!this.player || U.dist(p.x, p.y, this.player.x, this.player.y) > 260) { return p; }
        }
        return this.arena.randomPoint(this.rng, 90);
    };

    Game.prototype.spawnEnemy = function () {
        var cfg = this.waveCfg;
        var tier = IW.rollTier(this.rng, this.wave);
        var type = IW.rollEnemyType(this.rng, this.wave, tier);
        var elite = this.rng() < cfg.eliteChance;
        var p = this.spawnPoint();
        var e = new IW.Enemy(this, {
            tierId: tier, typeId: type, wave: this.wave, elite: elite, x: p.x, y: p.y
        });
        this.enemies.push(e);
        /* difficulty stat scaling */
        var diffMul = this.diffMul().enemyMul;
        if (diffMul > 1) {
            e.stats.hp = Math.round(e.stats.hp * diffMul);
            e.stats.damage = Math.round(e.stats.damage * diffMul);
            e.maxHp = e.stats.hp;
        }
        this.spawnEffect({
            kind: 'ring', x: p.x, y: p.y, radius0: 4, radius1: 48, life: 0.5,
            colour: e.elite ? IW.ELITE.ring : e.tier.ring
        });
        return e;
    };

    Game.prototype.livingEnemies = function () {
        var n = 0;
        for (var i = 0; i < this.enemies.length; i++) {
            if (!this.enemies[i].dead) { n++; }
        }
        return n;
    };

    /* ---------------------------------------------------------- utilities */

    Game.prototype.addFloatText = function (x, y, text, colour, size) {
        if (this.texts.length > 60) { this.texts.shift(); }
        this.texts.push(new IW.FloatText(x, y, text, colour, size));
    };

    Game.prototype.spawnEffect = function (opts) {
        if (this.effects.length > 90) { this.effects.shift(); }
        this.effects.push(new IW.Effect(this, opts));
    };

    Game.prototype.shake = function (amount) {
        this.camera.shake = Math.min(16, this.camera.shake + amount);
    };

    Game.prototype.damageEnemy = function (e, dmg, opts) {
        if (!e || e.dead) { return 0; }
        opts = opts || {};
        var dealt = e.hurt(dmg, opts);
        var p = this.player;
        if (p) { p.damageDealt += dealt; }
        if (opts.crit) {
            this.addFloatText(e.x + (this.rng() - 0.5) * 12, e.y - 30, dealt + '!', '#ffd45e', 19);
        } else {
            this.addFloatText(e.x + (this.rng() - 0.5) * 12, e.y - 26, '' + dealt, '#ffffff', 14);
        }
        this.spawnEffect({
            kind: 'anim', key: 'dust2', fps: 18, life: 0.3, scale: 0.32,
            x: e.x + (this.rng() - 0.5) * 18, y: e.y + (this.rng() - 0.5) * 18
        });
        if (p && p.stats.lifesteal > 0) { p.heal(dealt * p.stats.lifesteal); }
        IW.Audio.play('hit');
        if (e.dead) { this.killEnemy(e); }
        return dealt;
    };

    Game.prototype.killEnemy = function (e) {
        var p = this.player;
        this.waveKills++;
        if (p) {
            p.kills++;
            p.gainXp(e.stats.xp);
        }
        var drop = IW.dropRoll(this.rng, p ? p.stats.luck : 0);
        this.pickups.push(new IW.Pickup(this, e.x, e.y, 'gold', e.stats.gold + drop.bonus));
        if (drop.meat) { this.pickups.push(new IW.Pickup(this, e.x + 14, e.y - 6, 'meat', 1)); }
        this.spawnEffect({ kind: 'anim', key: 'explosion1', x: e.x, y: e.y, scale: 0.9, fps: 20, life: 0.45 });
        IW.Audio.play('enemyDie');
        if (e.elite) {
            this.spawnEffect({ kind: 'burst', x: e.x, y: e.y, radius0: 10, radius1: 60, colour: IW.ELITE.ring, life: 0.5 });
            this.shake(4);
        }
    };

    Game.prototype.onPlayerDeath = function () {
        if (this.state === 'gameover') { return; }
        this.state = 'gameover';
        var p = this.player;
        this.spawnEffect({ kind: 'anim', key: 'explosion2', x: p.x, y: p.y, scale: 1.3, fps: 16, life: 0.9 });
        this.spawnEffect({ kind: 'ring', x: p.x, y: p.y, radius0: 10, radius1: 120, colour: '#e05a4a', life: 0.8, lineWidth: 8 });
        this.shake(12);
        IW.Audio.play('gameover');
    };
/* ------------------------------------------------------------ update */

    Game.prototype.tick = function (dt) {
        this.updateInput(dt);
        this.update(dt);
    };

    Game.prototype.update = function (dt) {
        this.time += dt;
        if (this.introTimer > 0) { this.introTimer -= dt; }
        if (this.toastTimer > 0) { this.toastTimer -= dt; }
        if (this.camera.shake > 0) {
            this.camera.shake -= dt * 26;
            if (this.camera.shake < 0) { this.camera.shake = 0; }
        }

        switch (this.state) {
            case 'wave':
                this.updateWorld(dt);
                break;
            case 'waveClear':
            case 'shop':
            case 'levelUp':
            case 'gameover':
            case 'victory':
            case 'title':
            case 'select':
                /* menus keep the world breathing so effects finish gracefully */
                this.updateEffects(dt);
                this.updateCamera(dt);
                break;
            default:
                break;
        }
    };

    Game.prototype.updateEffects = function (dt) {
        var i;
        for (i = this.effects.length - 1; i >= 0; i--) {
            this.effects[i].update(dt);
            if (this.effects[i].dead) { this.effects.splice(i, 1); }
        }
        for (i = this.texts.length - 1; i >= 0; i--) {
            this.texts[i].update(dt);
            if (this.texts[i].dead) { this.texts.splice(i, 1); }
        }
    };

    Game.prototype.updateWorld = function (dt) {
        var i, e;

        /* countdown */
        this.waveTime -= dt;

        /* spawning — only while the timer is running */
        if (this.spawned < this.waveCfg.cap && this.waveTime > 0) {
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0 && this.livingEnemies() < this.waveCfg.cap) {
                var group = this.waveCfg.groupSize;
                if (this.spawned + group > this.waveCfg.cap) { group = this.waveCfg.cap - this.spawned; }
                for (i = 0; i < group; i++) {
                    if (this.spawned >= this.waveCfg.cap) { break; }
                    this.spawnEnemy();
                    this.spawned++;
                }
                this.spawnTimer = this.waveCfg.spawnInterval;
            }
        }

        if (this.player) { this.player.update(dt); }

        for (i = 0; i < this.enemies.length; i++) {
            e = this.enemies[i];
            if (!e.dead) { e.update(dt); }
        }
        for (i = this.projectiles.length - 1; i >= 0; i--) {
            this.projectiles[i].update(dt);
            if (this.projectiles[i].dead) { this.projectiles.splice(i, 1); }
        }
        for (i = this.pickups.length - 1; i >= 0; i--) {
            this.pickups[i].update(dt);
            if (this.pickups[i].dead) { this.pickups.splice(i, 1); }
        }

        /* contact damage */
        var p = this.player;
        if (p && !p.dead) {
            for (i = 0; i < this.enemies.length; i++) {
                e = this.enemies[i];
                if (e.dead || e.spawnTime > 0 || e.contactTimer > 0) { continue; }
                if (U.dist2(p.x, p.y, e.x, e.y) > Math.pow(p.radius + e.radius, 2)) { continue; }
                e.contactTimer = e.stats.contactCd;
                p.takeDamage(e.stats.damage, e);
            }
        }

        /* clear out the dead */
        for (i = this.enemies.length - 1; i >= 0; i--) {
            if (this.enemies[i].dead) { this.enemies.splice(i, 1); }
        }

        this.updateEffects(dt);
        this.updateCamera(dt);

        /* wave over? — timer expires, round ends (enemies flee / despawn) */
        if (this.waveTime <= 0) {
            this.endWave();
        }
    };

    Game.prototype.updateCamera = function (dt) {
        if (!this.arena) { return; }
        var targetX, targetY;
        var p = this.player;
        if (p && !p.dead) {
            targetX = p.x - VW / 2;
            targetY = p.y - VH / 2;
        } else {
            targetX = this.arena.worldW / 2 - VW / 2;
            targetY = this.arena.worldH / 2 - VH / 2;
        }
        targetX = U.clamp(targetX, 0, Math.max(0, this.arena.worldW - VW));
        targetY = U.clamp(targetY, 0, Math.max(0, this.arena.worldH - VH));
        var t = Math.min(1, dt * 9);
        this.camera.x = U.lerp(this.camera.x, targetX, t);
        this.camera.y = U.lerp(this.camera.y, targetY, t);
    };

    Game.prototype.endWave = function () {
        var i, collected = 0;
        /* remaining gold is swept up automatically, like most wave games do */
        for (i = 0; i < this.pickups.length; i++) {
            if (this.pickups[i].kind === 'gold' && !this.pickups[i].dead) {
                collected += this.pickups[i].value;
                this.pickups[i].dead = true;
            }
        }
        if (collected > 0 && this.player) {
            this.player.gainGold(collected);
            this.goldEarned += collected;
            this.waveGold += collected;
            this.addFloatText(this.player.x, this.player.y - 40, '+' + collected + 'g', '#ffd45e', 18);
        }
        /* the horde withdraws */
        for (i = 0; i < this.enemies.length; i++) {
            if (!this.enemies[i].dead) {
                this.spawnEffect({ kind: 'anim', key: 'dust1', x: this.enemies[i].x, y: this.enemies[i].y, scale: 0.6, fps: 18, life: 0.4 });
                this.enemies[i].dead = true;
            }
        }
        this.enemies.length = 0;
        this.projectiles.length = 0;
        this.pickups.length = 0;
        this.saveBest();
        this.state = 'waveClear';
        this.introTimer = 0;
    };
/* ------------------------------------------------- level-ups and shop */

    Game.prototype.showToast = function (msg) {
        this.toast = msg;
        this.toastTimer = 1.8;
    };

    Game.prototype.leaveWaveClear = function () {
        if (this.player.pendingLevels > 0) {
            this.beginLevelUp();
        } else {
            this.openShop();
        }
    };

    Game.prototype.beginLevelUp = function () {
        this.upgradeChoices = IW.rollUpgrades(this.rng, 3);
        this.state = 'levelUp';
        IW.Audio.play('levelup');
    };

    Game.prototype.chooseUpgrade = function (i) {
        var up = this.upgradeChoices[i];
        if (!up || this.state !== 'levelUp') { return false; }
        this.player.perks.push({ id: up.id, name: up.name, mods: up.mods, icon: up.icon });
        this.player.pendingLevels = Math.max(0, this.player.pendingLevels - 1);
        this.player.recompute();
        this.showToast(up.name + ' gained');
        IW.Audio.play('levelup');
        if (this.player.pendingLevels > 0) {
            this.upgradeChoices = IW.rollUpgrades(this.rng, 3);
        } else {
            this.openShop();
        }
        return true;
    };

    Game.prototype.openShop = function () {
        this.rerolls = 0;
        this.rerollCost = 8;
        this.healBase = 12 + this.wave;
        this.healPrice = this.healBase;
        this.shop = IW.rollShop(this.rng, this.player.stats.luck, 4, this.wave, []);
        this.state = 'shop';
    };

    Game.prototype.purchase = function (i) {
        var item = this.shop[i];
        if (!item || item.sold || this.state !== 'shop') { return false; }
        if (this.player.gold < item.cost) {
            this.showToast('Not enough gold for ' + item.name);
            IW.Audio.play('error');
            return false;
        }
        this.player.gold -= item.cost;
        this.player.addItem(item);
        item.sold = true;
        IW.Audio.play('buy');
        this.showToast(item.name + ' equipped');
        return true;
    };

    Game.prototype.rerollShop = function () {
        if (this.state !== 'shop') { return false; }
        if (this.player.gold < this.rerollCost) {
            this.showToast('Not enough gold to reroll');
            IW.Audio.play('error');
            return false;
        }
        this.player.gold -= this.rerollCost;
        this.rerolls++;
        this.rerollCost = Math.round(this.rerollCost * 1.6) + 2;
        var keep = [];
        for (var i = 0; i < this.shop.length; i++) {
            if (this.shop[i]) { keep.push(this.shop[i].id); }
        }
        this.shop = IW.rollShop(this.rng, this.player.stats.luck, 4, this.wave, keep);
        IW.Audio.play('click');
        return true;
    };

    Game.prototype.healCost = function () { return this.healPrice || this.healBase || 14; };

    Game.prototype.shopHeal = function () {
        var cost = this.healCost();
        if (this.state !== 'shop') { return false; }
        if (this.player.hp >= this.player.maxHp) {
            this.showToast('Already at full health');
            IW.Audio.play('error');
            return false;
        }
        if (this.player.gold < cost) {
            this.showToast('Not enough gold to heal');
            IW.Audio.play('error');
            return false;
        }
        this.player.gold -= cost;
        var amount = Math.round(this.player.maxHp * 0.4);
        this.player.heal(amount);
        this.healPrice = Math.round(cost * 1.6) + 2;
        this.showToast('Healed ' + amount + ' HP');
        IW.Audio.play('heal');
        return true;
    };

    Game.prototype.nextWave = function () {
        if (this.state !== 'shop') { return; }
        if (!this.endless && this.wave >= FINAL_WAVE) {
            this.state = 'victory';
            IW.Audio.play('win');
            return;
        }
        this.startWave(this.wave + 1);
    };

    Game.prototype.keepGoing = function () {
        this.endless = true;
        this.startWave(this.wave + 1);
    };

    Game.prototype.retry = function () {
        this.startRun(this.char ? IW.Characters.indexOf(this.char) : 0);
    };

    Game.prototype.toMenu = function () {
        this.state = 'title';
        this.hoverId = null;
    };
/* ------------------------------------------------------ input routing */

    Game.prototype.inRect = function (r, x, y) {
        return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    };

    Game.prototype.hitTest = function (x, y) {
        var i, lay;
        switch (this.state) {
            case 'title':
                lay = UI.titleLayout();
                if (this.inRect(lay.start, x, y)) { return 'start'; }
                if (this.inRect(lay.mute, x, y)) { return 'mute'; }
                return null;
            case 'select':
                lay = UI.selectLayout();
                for (i = 0; i < lay.cards.length; i++) { if (this.inRect(lay.cards[i], x, y)) { return 'card' + i; } }
                for (i = 0; i < lay.diff.length; i++) { if (this.inRect(lay.diff[i], x, y)) { return 'diff' + i; } }
                if (this.inRect(lay.start, x, y)) { return 'start'; }
                if (this.inRect(lay.back, x, y)) { return 'back'; }
                return null;
            case 'levelUp':
                lay = UI.levelUpLayout();
                for (i = 0; i < lay.cards.length; i++) { if (this.inRect(lay.cards[i], x, y)) { return 'up' + i; } }
                return null;
            case 'waveClear':
                lay = UI.waveClearLayout();
                return this.inRect(lay.next, x, y) ? 'next' : null;
            case 'shop':
                lay = UI.shopLayout();
                for (i = 0; i < lay.cards.length; i++) { if (this.inRect(lay.cards[i], x, y)) { return 'slot' + i; } }
                if (this.inRect(lay.reroll, x, y)) { return 'reroll'; }
                if (this.inRect(lay.heal, x, y)) { return 'heal'; }
                if (this.inRect(lay.next, x, y)) { return 'next'; }
                if (this.inRect(lay.mute, x, y)) { return 'mute'; }
                return null;
            case 'paused':
                lay = UI.pauseLayout();
                if (this.inRect(lay.resume, x, y)) { return 'resume'; }
                if (this.inRect(lay.menu, x, y)) { return 'menu'; }
                if (this.inRect(lay.mute, x, y)) { return 'mute'; }
                return null;
            case 'gameover':
                lay = UI.gameOverLayout();
                if (this.inRect(lay.again, x, y)) { return 'again'; }
                if (this.inRect(lay.menu, x, y)) { return 'menu'; }
                return null;
            case 'victory':
                lay = UI.victoryLayout();
                if (this.inRect(lay.endless, x, y)) { return 'endless'; }
                if (this.inRect(lay.menu, x, y)) { return 'menu'; }
                return null;
            default:
                return null;
        }
    };

    Game.prototype.activate = function (id) {
        if (!id) { return; }
        var index = parseInt(String(id).replace(/[^0-9]/g, ''), 10);
        IW.Audio.play('click');
        switch (id) {
            case 'mute':
                IW.Audio.toggleMute();
                break;
            case 'start':
                if (this.state === 'title') { this.state = 'select'; }
                else if (this.state === 'select') { this.startRun(this.selectedIndex); }
                break;
            case 'back':
                this.toMenu();
                break;
            case 'next':
                if (this.state === 'waveClear') { this.leaveWaveClear(); }
                else if (this.state === 'shop') { this.nextWave(); }
                break;
            case 'reroll':
                this.rerollShop();
                break;
            case 'heal':
                this.shopHeal();
                break;
            case 'resume':
                this.state = 'wave';
                break;
            case 'menu':
                this.toMenu();
                break;
            case 'again':
                this.retry();
                break;
            case 'endless':
                this.keepGoing();
                break;
            default:
                if (id.indexOf('card') === 0) { this.selectedIndex = U.clamp(index, 0, 3); }
                else if (id.indexOf('up') === 0) { this.chooseUpgrade(index); }
                else if (id.indexOf('slot') === 0) { this.purchase(index); }
                else if (id.indexOf('diff') === 0) { this.difficulty = U.clamp(index, 0, 2) + 1; }
                break;
        }
    };

    Game.prototype.onPointerMove = function (x, y) {
        this.hoverId = this.hitTest(x, y);
        Input.mouse.x = x;
        Input.mouse.y = y;
    };

    Game.prototype.onPointerDown = function (x, y) {
        this.onPointerMove(x, y);
        this.activate(this.hoverId);
    };
Game.prototype.updateInput = function () {
        var i;
        if (Input.pressed('KeyM')) {
            IW.Audio.toggleMute();
            this.showToast(IW.Audio.muted ? 'Sound off' : 'Sound on');
        }

        switch (this.state) {
            case 'title':
                if (Input.anyPressed(['Enter', 'NumpadEnter', 'Space'])) { this.activate('start'); }
                break;

            case 'select':
                for (i = 0; i < 4; i++) {
                    if (Input.pressed('Digit' + (i + 1)) || Input.pressed('Numpad' + (i + 1))) { this.selectedIndex = i; }
                }
                if (Input.anyPressed(['ArrowRight', 'KeyD'])) { this.selectedIndex = Math.min(3, this.selectedIndex + 1); }
                if (Input.anyPressed(['ArrowLeft', 'KeyA'])) { this.selectedIndex = Math.max(0, this.selectedIndex - 1); }
                if (Input.pressed('KeyQ')) { this.difficulty = 1; }
                if (Input.pressed('KeyW')) { this.difficulty = 2; }
                if (Input.pressed('KeyE')) { this.difficulty = 3; }
                if (Input.anyPressed(['Enter', 'NumpadEnter', 'Space'])) { this.startRun(this.selectedIndex); }
                if (Input.pressed('Escape')) { this.toMenu(); }
                break;

            case 'wave':
                if (Input.anyPressed(['Escape', 'KeyP'])) { this.state = 'paused'; IW.Audio.play('click'); }
                if (Input.pressed('Tab')) { this.showStats = !this.showStats; }
                break;

            case 'paused':
                if (Input.anyPressed(['Escape', 'KeyP', 'Enter', 'NumpadEnter'])) { this.state = 'wave'; }
                break;

            case 'waveClear':
                if (Input.anyPressed(['Enter', 'NumpadEnter', 'Space'])) { this.leaveWaveClear(); }
                break;

            case 'levelUp':
                for (i = 0; i < 3; i++) {
                    if (Input.pressed('Digit' + (i + 1)) || Input.pressed('Numpad' + (i + 1))) { this.chooseUpgrade(i); }
                }
                break;

            case 'shop':
                for (i = 0; i < 4; i++) {
                    if (Input.pressed('Digit' + (i + 1)) || Input.pressed('Numpad' + (i + 1))) { this.purchase(i); }
                }
                if (Input.pressed('KeyR')) { this.rerollShop(); }
                if (Input.pressed('KeyH')) { this.shopHeal(); }
                if (Input.anyPressed(['Enter', 'NumpadEnter', 'Space'])) { this.nextWave(); }
                break;

            case 'gameover':
                if (Input.pressed('KeyR') || Input.anyPressed(['Enter', 'NumpadEnter', 'Space'])) { this.retry(); }
                if (Input.pressed('Escape')) { this.toMenu(); }
                break;

            case 'victory':
                if (Input.anyPressed(['Enter', 'NumpadEnter', 'Space'])) { this.keepGoing(); }
                if (Input.pressed('Escape')) { this.toMenu(); }
                break;

            default:
                break;
        }
    };

    /* ------------------------------------------------------------- draw */

    Game.prototype.draw = function () {
        var ctx = this.ctx;
        if (!ctx) { return; }
        var i, shake = this.camera.shake;
        var camX = this.camera.x + (this.rng() - 0.5) * shake;
        var camY = this.camera.y + (this.rng() - 0.5) * shake;
        var worldW = this.arena ? this.arena.worldW : VW;
        var worldH = this.arena ? this.arena.worldH : VH;
        camX = Math.round(U.clamp(camX, 0, Math.max(0, worldW - VW)));
        camY = Math.round(U.clamp(camY, 0, Math.max(0, worldH - VH)));

        ctx.save();
        ctx.clearRect(0, 0, VW, VH);
        if (this.arena) {
            this.arena.drawGround(ctx, camX, camY, VW, VH);
            this.arena.drawFoam(ctx, camX, camY, this.time);
        } else {
            ctx.fillStyle = '#20301c';
            ctx.fillRect(0, 0, VW, VH);
        }

        this.drawScene(ctx, camX, camY);

        for (i = 0; i < this.projectiles.length; i++) { this.projectiles[i].draw(ctx, camX, camY); }
        for (i = 0; i < this.effects.length; i++) { this.effects[i].draw(ctx, camX, camY); }
        for (i = 0; i < this.texts.length; i++) { this.texts[i].draw(ctx, camX, camY); }

        this.drawOverlays(ctx);
        ctx.restore();
    };

    Game.prototype.drawOverlays = function (ctx) {
        switch (this.state) {
            case 'title':
                UI.title(ctx, this);
                break;
            case 'select':
                UI.select(ctx, this);
                break;
            case 'wave':
                UI.hud(ctx, this);
                if (this.showStats) {
                    UI.statPanel(ctx, this, 16, VH - 320, 300);
                }
                UI.waveIntro(ctx, this);
                UI.toast(ctx, this);
                break;
            case 'paused':
                UI.hud(ctx, this);
                UI.pause(ctx, this);
                break;
            case 'waveClear':
                UI.hud(ctx, this);
                UI.waveClear(ctx, this);
                break;
            case 'levelUp':
                UI.hud(ctx, this);
                UI.levelUp(ctx, this);
                break;
            case 'shop':
                UI.hud(ctx, this);
                UI.shop(ctx, this);
                UI.toast(ctx, this);
                break;
            case 'gameover':
                UI.gameOver(ctx, this);
                break;
            case 'victory':
                UI.victory(ctx, this);
                break;
            default:
                break;
        }
        UI.cursor(ctx, Input.mouse);
    };

    /* ------------------------------------------- y-sorted scene + boot */

    Game.prototype.drawScene = function (ctx, camX, camY) {
        var list = [], i, o;
        var decor = this.arena ? this.arena.decor : [];
        for (i = 0; i < decor.length; i++) {
            o = decor[i];
            if (o.x < camX - 220 || o.x > camX + VW + 220 || o.y < camY - 340 || o.y > camY + VH + 260) { continue; }
            list.push({ y: o.y, kind: 'decor', o: o });
        }
        for (i = 0; i < this.pickups.length; i++) { o = this.pickups[i]; list.push({ y: o.y, kind: 'simple', o: o }); }
        for (i = 0; i < this.enemies.length; i++) {
            o = this.enemies[i];
            if (!o.dead) { list.push({ y: o.y, kind: 'simple', o: o }); }
        }
        if (this.player && !this.player.dead) { list.push({ y: this.player.y, kind: 'simple', o: this.player }); }

        list.sort(function (a, b) { return a.y - b.y; });

        for (i = 0; i < list.length; i++) {
            var it = list[i];
            if (it.kind === 'decor') { this.drawDecor(ctx, it.o, camX, camY); }
            else { it.o.draw(ctx, camX, camY); }
        }
    };

    Game.prototype.drawDecor = function (ctx, dec, camX, camY) {
        var frames = Math.max(1, A.frames(dec.key));
        var frame = dec.frame || 0;
        if (dec.fps) { frame = Math.floor(this.time * dec.fps + dec.x * 0.013) % frames; }
        var fs = A.frameSize(dec.key);
        var base = IW.decorBase(dec.key);
        var drawY = (dec.y - camY) - fs.fh * dec.scale * base;
        if (dec.trim) {
            /* Crop the stray sway bleed (see placeDecor): render only the left trim
             * width of the frame, centred on the placement point like a full frame. */
            var tw = dec.trim, dw = tw * dec.scale, dh = fs.fh * dec.scale;
            A.drawRegion(ctx, dec.key, (frame % frames) * fs.fw, 0, tw, fs.fh,
                (dec.x - camX) - dw / 2, drawY - dh / 2, dw, dh, 1);
        } else {
            A.draw(ctx, dec.key, frame, dec.x - camX, drawY, dec.scale, false, 1);
        }
    };

    Game.prototype.loop = function () {
        var self = this;
        var last = U.now();
        function frame(now) {
            var dt = (now - last) / 1000;
            last = now;
            if (!isFinite(dt) || dt < 0) { dt = 0; }
            if (dt > 0.05) { dt = 0.05; }
            self.tick(dt);
            self.draw();
            IW.Input.endFrame();
            if (typeof requestAnimationFrame === 'function') { requestAnimationFrame(frame); }
        }
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(frame);
        } else {
            this.tick(1 / 60);
            this.draw();
        }
    };

    /* ------------------------------------------------------------ bootstrap */

    IW.Game = Game;

    IW.boot = function (canvas) {
        var game = new Game(canvas);
        IW.game = game;

        var loading = null, fill = null, text = null;
        if (typeof document !== 'undefined' && document.getElementById) {
            loading = document.getElementById('loading');
            fill = document.getElementById('loading-fill');
            text = document.getElementById('loading-text');
        }

        if (Input.init) { Input.init(canvas); }

        var started = false;
        function start() {
            if (started) { return; }
            started = true;
            if (loading) { loading.className = 'hidden'; }
            IW.Audio.init();
            game.newArena(1);
            game.state = 'title';
            game.loop();
        }

        A.load(function (p) {
            if (fill) { fill.style.width = Math.round(p * 100) + '%'; }
            if (text) { text.textContent = 'Loading ' + Math.round(p * 100) + '%'; }
        }, start);

        /* belt and braces: never leave the player staring at a loading bar */
        if (typeof setTimeout === 'function') { setTimeout(start, 12000); }

        if (canvas && canvas.addEventListener) {
            canvas.addEventListener('mousemove', function (e) {
                var p = Input.toCanvas(e);
                game.onPointerMove(p.x, p.y);
            }, false);
            canvas.addEventListener('mousedown', function (e) {
                var p = Input.toCanvas(e);
                if (e.button === 0) { game.onPointerDown(p.x, p.y); }
            }, false);
        }
        return game;
    };
})();