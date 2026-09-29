/* Ironwill - entities: animation helper, projectiles, pickups, visual effects
 * and floating combat text. */
(function () {
    'use strict';
    window.IW = window.IW || {};
    var U = IW.util;
    var A = IW.Assets;

    /* --------------------------------------------------------------- anim */

    function Anim(key, fps, loop) {
        this.key = key;
        this.fps = fps || 8;
        this.loop = loop !== false;
        this.t = 0;
        this.frame = 0;
        this.done = false;
    }

    Anim.prototype.set = function (key, fps, loop) {
        if (this.key === key && this.fps === fps) { return; }
        this.key = key;
        this.fps = fps || this.fps;
        this.loop = loop !== false;
        this.t = 0;
        this.frame = 0;
        this.done = false;
    };

    Anim.prototype.update = function (dt) {
        var frames = A.frames(this.key);
        this.t += dt;
        var f = Math.floor(this.t * this.fps);
        if (this.loop) {
            this.frame = ((f % frames) + frames) % frames;
        } else if (f >= frames) {
            this.frame = frames - 1;
            this.done = true;
        } else {
            this.frame = f;
        }
    };

    /* --------------------------------------------------------- projectiles */

    function Projectile(game, opts) {
        this.game = game;
        this.x = opts.x;
        this.y = opts.y;
        this.vx = opts.vx;
        this.vy = opts.vy;
        this.angle = Math.atan2(opts.vy, opts.vx);
        this.damage = opts.damage;
        this.owner = opts.owner || 'player';
        this.pierce = opts.pierce || 0;
        this.knockback = opts.knockback || 0;
        this.life = opts.life == null ? 1.6 : opts.life;
        this.radius = opts.radius || 7;
        this.key = opts.key;
        this.scale = opts.scale || 0.42;
        this.crit = !!opts.crit;
        this.anim = new Anim(this.key, 12, true);
        this.hit = {};
        this.dead = false;
        this.spin = opts.spin || 0;
        this.rot = 0;
    }

    Projectile.prototype.update = function (dt) {
        this.life -= dt;
        if (this.life <= 0) { this.dead = true; return; }
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.rot += this.spin * dt;
        this.anim.update(dt);

        var g = this.game, i, e;
        if (this.owner === 'player') {
            for (i = 0; i < g.enemies.length; i++) {
                e = g.enemies[i];
                if (e.dead || this.hit[e.uid]) { continue; }
                if (U.dist2(this.x, this.y, e.x, e.y) <= Math.pow(e.radius + this.radius, 2)) {
                    this.hit[e.uid] = 1;
                    g.damageEnemy(e, this.damage, {
                        crit: this.crit,
                        knockback: this.knockback,
                        dirX: this.vx, dirY: this.vy,
                        source: 'player'
                    });
                    if (this.pierce > 0) { this.pierce--; } else { this.dead = true; return; }
                }
            }
        } else {
            var p = g.player;
            if (p && !p.dead && U.dist2(this.x, this.y, p.x, p.y) <= Math.pow(p.radius + this.radius, 2)) {
                p.takeDamage(this.damage, this);
                this.dead = true;
                return;
            }
        }

        if (this.x < g.arena.x - 60 || this.x > g.arena.x + g.arena.w + 60 ||
            this.y < g.arena.y - 60 || this.y > g.arena.y + g.arena.h + 60) {
            this.dead = true;
        }
    };

    Projectile.prototype.draw = function (ctx, camX, camY) {
        var sx = this.x - camX, sy = this.y - camY;
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 4, 7, 3, 0, 0, U.TAU);
        ctx.fill();
        ctx.restore();
        A.drawRotated(ctx, this.key, this.anim.frame, sx, sy, this.scale, this.angle + this.rot, 1);
    };

    /* ------------------------------------------------------------- pickups */

    function Pickup(game, x, y, kind, value) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.kind = kind || 'gold';
        this.value = value || 1;
        this.vx = (game.rng() - 0.5) * 90;
        this.vy = (game.rng() - 0.5) * 90 - 40;
        this.z = 6 + game.rng() * 10;
        this.vz = 90 + game.rng() * 60;
        this.t = 0;
        this.magnet = false;
        this.dead = false;
        this.forceCollect = false;
        this.anim = new Anim('goldGlow', 12, true);
    }

    Pickup.prototype.update = function (dt) {
        this.t += dt;
        var p = this.game.player;
        this.anim.update(dt);

        /* little hop when it first drops */
        if (this.z > 0 || this.vz > 0) {
            this.vz -= 420 * dt;
            this.z += this.vz * dt;
            if (this.z < 0) { this.z = 0; this.vz = 0; }
        }
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= (1 - 6 * dt);
        this.vy *= (1 - 6 * dt);

        if (!p || p.dead) { return; }
        var d = U.dist(this.x, this.y, p.x, p.y);
        if (!this.magnet && d < p.stats.pickup) { this.magnet = true; }
        if (this.magnet) {
            var speed = this.forceCollect ? 620 : 340 + (p.stats.pickup - d) * 1.6;
            if (speed < 260) { speed = 260; }
            var ang = Math.atan2(p.y - this.y, p.x - this.x);
            this.x += Math.cos(ang) * speed * dt;
            this.y += Math.sin(ang) * speed * dt;
            this.z = Math.max(0, this.z - 40 * dt);
        }
        if (U.dist(this.x, this.y, p.x, p.y) < 20) { this.collect(); }
    };

    Pickup.prototype.collect = function () {
        if (this.dead) { return; }
        this.dead = true;
        var p = this.game.player;
        if (this.kind === 'gold') {
            p.gainGold(this.value);
            this.game.goldEarned += this.value;
            this.game.waveGold += this.value;
        } else {
            var amount = Math.max(4, Math.round(p.stats.maxHp * 0.12));
            p.heal(amount);
            this.game.addFloatText(this.x, this.y - 12, '+' + amount, '#8ee86a', 16);
            this.game.spawnEffect({ kind: 'anim', key: 'u:Blue:Monk:Heal_Effect', x: this.x, y: this.y, scale: 0.4, fps: 16 });
            IW.Audio.play('heal');
        }
    };

    Pickup.prototype.draw = function (ctx, camX, camY) {
        var sx = this.x - camX, sy = this.y - camY - this.z;
        if (this.kind === 'gold') {
            A.draw(ctx, 'goldGlow', this.anim.frame, sx, sy, 0.8, false, 0.5);
            A.draw(ctx, 'gold', 0, sx, sy, 0.85, false, 1);
        } else {
            A.draw(ctx, 'meat', 0, sx, sy - 2, 0.6, false, 1);
        }
    };

    /* ------------------------------------------------------------ fx + text */

    function Effect(game, opts) {
        this.game = game;
        this.kind = opts.kind || 'anim';
        this.x = opts.x;
        this.y = opts.y;
        this.key = opts.key;
        this.scale = opts.scale || 1;
        this.fps = opts.fps || 14;
        this.life = opts.life == null ? 0.55 : opts.life;
        this.maxLife = this.life;
        this.angle = opts.angle || 0;
        this.flip = !!opts.flip;
        this.follow = opts.follow || null;
        this.colour = opts.colour || '#ffe9a8';
        this.radius0 = opts.radius0 || 0;
        this.radius1 = opts.radius1 || 60;
        this.halfAngle = opts.halfAngle || 1.0;
        this.lineWidth = opts.lineWidth || 6;
        this.rotSpeed = opts.rotSpeed || 0;
        this.anim = new Anim(this.key, this.fps, false);
        this.dead = false;
    }

    Effect.prototype.update = function (dt) {
        this.life -= dt;
        if (this.life <= 0) { this.dead = true; return; }
        this.angle += this.rotSpeed * dt;
        if (this.key) { this.anim.update(dt); }
        if (this.follow === 'player' && this.game.player) {
            this.x = this.game.player.x;
            this.y = this.game.player.y;
            this.flip = this.game.player.facing.x < 0;
        }
    };

    Effect.prototype.draw = function (ctx, camX, camY) {
        var sx = this.x - camX, sy = this.y - camY;
        var p = 1 - (this.life / this.maxLife);
        ctx.save();
        if (this.kind === 'anim') {
            var alpha = Math.max(0, Math.min(1, this.life / this.maxLife * 1.7));
            A.draw(ctx, this.key, this.anim.frame, sx, sy, this.scale, this.flip, alpha);
        } else if (this.kind === 'ring') {
            var r = U.lerp(this.radius0, this.radius1, p);
            ctx.globalAlpha = (1 - p) * 0.85;
            ctx.strokeStyle = this.colour;
            ctx.lineWidth = this.lineWidth * (1 - p * 0.6);
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, U.TAU);
            ctx.stroke();
        } else if (this.kind === 'arc') {
            ctx.globalAlpha = (1 - p) * 0.8;
            ctx.strokeStyle = this.colour;
            ctx.lineWidth = 14 * (1 - p * 0.5);
            ctx.beginPath();
            ctx.arc(sx, sy, this.radius1 * (0.7 + p * 0.35), this.angle - this.halfAngle, this.angle + this.halfAngle);
            ctx.stroke();
        } else if (this.kind === 'line') {
            ctx.globalAlpha = (1 - p) * 0.75;
            ctx.translate(sx, sy);
            ctx.rotate(this.angle);
            ctx.fillStyle = this.colour;
            ctx.fillRect(0, -this.lineWidth / 2, this.radius1 * (0.8 + p * 0.4), this.lineWidth);
            ctx.globalAlpha = (1 - p) * 0.35;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, -this.lineWidth / 6, this.radius1 * (0.8 + p * 0.4), this.lineWidth / 3);
            ctx.restore();
            return;
        } else if (this.kind === 'burst') {
            ctx.globalAlpha = (1 - p) * 0.9;
            ctx.strokeStyle = this.colour;
            ctx.lineWidth = 4;
            for (var i = 0; i < 8; i++) {
                var a = this.angle + i * (U.TAU / 8);
                var r0 = this.radius0 + p * 30;
                var r1 = this.radius0 + 30 + p * this.radius1;
                ctx.beginPath();
                ctx.moveTo(sx + Math.cos(a) * r0, sy + Math.sin(a) * r0);
                ctx.lineTo(sx + Math.cos(a) * r1, sy + Math.sin(a) * r1);
                ctx.stroke();
            }
        }
        ctx.restore();
    };

    function FloatText(x, y, text, colour, size) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.colour = colour || '#ffffff';
        this.size = size || 15;
        this.life = 0.85;
        this.maxLife = 0.85;
        this.vy = -46;
        this.vx = 0;
        this.dead = false;
    }

    FloatText.prototype.update = function (dt) {
        this.life -= dt;
        if (this.life <= 0) { this.dead = true; return; }
        this.y += this.vy * dt;
        this.x += this.vx * dt;
        this.vy *= (1 - 1.6 * dt);
    };

    FloatText.prototype.draw = function (ctx, camX, camY) {
        var p = this.life / this.maxLife;
        ctx.save();
        ctx.globalAlpha = Math.min(1, p * 2.2);
        ctx.font = 'bold ' + this.size + 'px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.strokeText(this.text, this.x - camX, this.y - camY);
        ctx.fillStyle = this.colour;
        ctx.fillText(this.text, this.x - camX, this.y - camY);
        ctx.restore();
    };

    IW.Anim = Anim;
    IW.Projectile = Projectile;
    IW.Pickup = Pickup;
    IW.Effect = Effect;
    IW.FloatText = FloatText;

    /* --------------------------------------------------------------- player */

    /* Per-type feet offset: the fraction of the frame height between the frame's
     * centre and the sprite's feet (measured in tools/measure_units.ps1). */
    var FEET = { Warrior: 0.208, Archer: 0.203, Monk: 0.193, Pawn: 0.198, Lancer: 0.116 };

    function feetOf(type) { return FEET[type] != null ? FEET[type] : 0.2; }

    function Player(game, char) {
        this.game = game;
        this.char = char;
        this.unitType = char.unitType;
        this.scale = IW.SPRITE_SCALE[char.unitType] || 0.62;
        this.x = game.arena.x + game.arena.w / 2;
        this.y = game.arena.y + game.arena.h / 2;
        this.vx = 0;
        this.vy = 0;
        this.radius = char.radius;
        this.baseSpeed = char.baseSpeed;
        this.items = [];
        this.perks = [];
        this.stats = IW.Stats.compute(char.baseStats, this.items);
        this.maxHp = this.stats.maxHp;
        this.hp = this.maxHp;
        this.level = 1;
        this.xp = 0;
        this.xpNext = 12;
        this.pendingLevels = 0;
        this.gold = 0;
        this.attackTimer = char.weapon.cooldown * 0.4;
        this.attackHold = 0;
        this.attackSheet = null;
        this.swing = 0;
        this.abilityTimer = 0;
        this.abilityTime = 0;
        this.healTime = 0;
        this.braceTime = 0;
        this.riposte = 0;
        this.dashTime = 0;
        this.dashDirX = 1;
        this.dashDirY = 0;
        this.invuln = 0.5;
        this.facing = { x: 1, y: 0 };
        this.aim = 0;
        this.moving = false;
        this.hurtFlash = 0;
        this.dead = false;
        this.anim = new Anim(IW.charSheet(char, 'Idle'), 8, true);
        this.kills = 0;
        this.damageDealt = 0;
        this.damageTaken = 0;
        this.healed = 0;
    }

    /* Re-derives stats from base + items. Keeps the current health ratio. */
    Player.prototype.recompute = function (full) {
        var ratio = this.maxHp > 0 ? this.hp / this.maxHp : 1;
        this.stats = IW.Stats.compute(this.char.baseStats, this.items.concat(this.perks));
        this.maxHp = this.stats.maxHp;
        this.hp = full ? this.maxHp : Math.min(this.maxHp, Math.max(1, this.maxHp * ratio));
        if (this.hp > this.maxHp) { this.hp = this.maxHp; }
    };

    Player.prototype.addItem = function (item) {
        this.items.push({ id: item.id, name: item.name, rarity: item.rarity, mods: item.mods, icon: item.icon });
        this.recompute();
    };

    Player.prototype.heal = function (amount) {
        var before = this.hp;
        this.hp = Math.min(this.maxHp, this.hp + amount);
        this.healed += this.hp - before;
    };

    Player.prototype.gainGold = function (n) { this.gold += Math.max(0, Math.round(n)); };

    Player.prototype.gainXp = function (n) {
        this.xp += n;
        while (this.xp >= this.xpNext) {
            this.xp -= this.xpNext;
            this.level++;
            this.pendingLevels++;
            this.xpNext = Math.round(this.xpNext * 1.3 + 6);
        }
    };

    Player.prototype.takeDamage = function (amount, source) {
        if (this.dead) { return 0; }
        if (this.invuln > 0 || this.dashTime > 0) { return 0; }
        var s = this.stats;
        if (s.dodge > 0 && this.game.rng() < s.dodge) {
            this.invuln = 0.3;
            this.game.addFloatText(this.x, this.y - 34, 'dodge', '#cfe3ff', 15);
            return 0;
        }
        var dmg = amount * (1 - IW.Stats.armorReduction(s.armor));
        if (this.braceTime > 0) { dmg *= (1 - this.char.ability.damageReduction); }
        dmg = Math.max(1, Math.round(dmg));
        this.hp -= dmg;
        this.damageTaken += dmg;
        this.invuln = 0.7;
        this.hurtFlash = 0.22;
        this.game.addFloatText(this.x, this.y - 34, '-' + dmg, '#ff7b6b', 17);
        this.game.spawnEffect({ kind: 'anim', key: 'dust2', x: this.x, y: this.y, scale: 0.45, fps: 18 });
        this.game.shake(5);
        IW.Audio.play('hurt');
        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
            this.game.onPlayerDeath();
        }
        return dmg;
    };

    /* Nearest living enemy within `range` (0 = ignore distance). */
    Player.prototype.findTarget = function (range) {
        var best = null, bestD = range > 0 ? range * range : Infinity;
        var list = this.game.enemies;
        for (var i = 0; i < list.length; i++) {
            var e = list[i];
            if (e.dead || e.spawnTime > 0) { continue; }
            var d = U.dist2(this.x, this.y, e.x, e.y);
            if (d < bestD) { bestD = d; best = e; }
        }
        return best;
    };

    Player.prototype.moveBy = function (dx, dy) {
        var a = this.game.arena;
        this.x = U.clamp(this.x + dx, a.x + this.radius, a.x + a.w - this.radius);
        this.y = U.clamp(this.y + dy, a.y + this.radius, a.y + a.h - this.radius);
    };

    Player.prototype.weaponRange = function () {
        var w = this.char.weapon;
        if (w.kind === 'arc') { return w.range; }
        if (w.kind === 'thrust') { return w.reach; }
        if (w.kind === 'pulse') { return w.radius; }
        return 620;
    };

    /* Lancer attack/defence sheets are split per direction - pick and mirror. */
    Player.prototype.lancerSheet = function (prefix, angle) {
        var dx = Math.cos(angle), dy = Math.sin(angle);
        var ax = Math.abs(dx);
        var variant;
        if (ax >= 0.4) { variant = dy < -0.4 ? 'UpRight' : (dy > 0.4 ? 'DownRight' : 'Right'); }
        else { variant = dy < 0 ? 'Up' : 'Down'; }
        return { key: 'u:Blue:Lancer:' + variant + '_' + prefix, flip: dx < 0 };
    };

    Player.prototype.update = function (dt) {
        var g = this.game, input = IW.Input, w = this.char.weapon, ab = this.char.ability, s = this.stats;

        if (this.dead) { this.anim.update(dt); return; }

        this.attackTimer -= dt;
        this.abilityTimer -= dt;
        this.invuln -= dt;
        this.hurtFlash -= dt;
        if (this.attackHold > 0) { this.attackHold -= dt; }
        if (this.abilityTime > 0) { this.abilityTime -= dt; }
        if (this.braceTime > 0) { this.braceTime -= dt; }
        if (this.riposte > 0) { this.riposte -= dt; }
        if (s.regen > 0) { this.heal(s.regen * dt); }

        /* ---- ability (Left Shift / Space) ---- */
        if (input.abilityKey() && this.abilityTimer <= 0 && this.dashTime <= 0) { this.useAbility(); }

        /* ---- healing channel ---- */
        if (this.healTime > 0) {
            var rate = (ab.healPct * this.maxHp) / ab.duration;
            this.healTime -= dt;
            this.heal(rate * dt);
            if (g.rng() < 0.5) {
                g.spawnEffect({
                    kind: 'anim', key: 'u:Blue:Monk:Heal_Effect', fps: 16, scale: 0.18, life: 0.4,
                    x: this.x + (g.rng() - 0.5) * 46, y: this.y + (g.rng() - 0.5) * 46
                });
            }
        }

        /* ---- movement ---- */
        if (this.dashTime > 0) {
            this.dashTime -= dt;
            var dashSpeed = this.baseSpeed * (1 + s.moveSpeed) * ab.speedMul;
            this.moveBy(this.dashDirX * dashSpeed * dt, this.dashDirY * dashSpeed * dt);
            this.moving = true;
            this.invuln = Math.max(this.invuln, 0.05);
            if (g.rng() < 0.8) {
                g.spawnEffect({ kind: 'anim', key: 'dust1', x: this.x, y: this.y, scale: 0.32, fps: 18, life: 0.35 });
            }
        } else {
            var ax = input.axis();
            var speed = this.baseSpeed * (1 + s.moveSpeed);
            if (this.braceTime > 0) { speed *= 0.3; }
            if (ax.x !== 0 || ax.y !== 0) {
                this.moveBy(ax.x * speed * dt, ax.y * speed * dt);
                this.facing.x = ax.x < -0.1 ? -1 : (ax.x > 0.1 ? 1 : this.facing.x);
                this.facing.y = ax.y;
                this.moving = true;
            } else {
                this.moving = false;
            }
        }

        /* ---- aiming (mouse cursor) + attacking (hold left click to swing) ---- */
        var mx = input.mouse.x + g.camera.x;
        var my = input.mouse.y + g.camera.y;
        this.aim = Math.atan2(my - this.y, mx - this.x);
        if (input.mouse.down && this.attackTimer <= 0) {
            this.attackTimer = Math.max(0.1, w.cooldown / (1 + s.attackSpeed));
            this.fireWeapon();
        }

        this.updateAnim(dt);
    };

    Player.prototype.fireWeapon = function (target) {
        var g = this.game, w = this.char.weapon, s = this.stats;
        var buffed = this.riposte > 0;
        var mult = buffed ? (1 + this.char.ability.buffDamage) : 1;
        var aim = this.aim;
        var isMelee = w.kind !== 'shot';
        var crit = s.crit > 0 && g.rng() < s.crit;
        var base = w.damage * (1 + s.damage) * (1 + (isMelee ? s.melee : s.ranged)) * mult;
        var dmg = Math.max(1, Math.round(base * (crit ? (1.5 + s.critDamage) : 1)));
        var i, e;

        if (w.kind === 'arc') {
            this.attackSheet = w.anims[this.swing % w.anims.length];
            this.swing++;
            this.attackHold = A.frames(this.attackSheet) / w.fps;
            this.flip = Math.cos(aim) < 0;
            for (i = 0; i < g.enemies.length; i++) {
                e = g.enemies[i];
                if (e.dead || e.spawnTime > 0) { continue; }
                if (U.dist(this.x, this.y, e.x, e.y) > w.range + e.radius) { continue; }
                var ang = Math.atan2(e.y - this.y, e.x - this.x);
                if (Math.abs(U.angleDiff(ang, aim)) > w.halfAngle) { continue; }
                g.damageEnemy(e, dmg, {
                    crit: crit, knockback: w.knockback,
                    dirX: Math.cos(aim), dirY: Math.sin(aim), source: 'player'
                });
            }
            g.spawnEffect({
                kind: 'arc', x: this.x, y: this.y, angle: aim, halfAngle: w.halfAngle,
                radius1: w.range * 0.95, colour: buffed ? '#ffd45e' : '#ffeaa0', life: 0.22
            });
            IW.Audio.play(w.sfx);

        } else if (w.kind === 'thrust') {
            var reach = w.reach * (buffed ? 1.35 : 1);
            var halfW = w.halfWidth * (buffed ? 1.7 : 1);
            var cx = this.x + Math.cos(aim) * reach * 0.5;
            var cy = this.y + Math.sin(aim) * reach * 0.5;
            var lancer = this.lancerSheet('Attack', aim);
            this.attackSheet = lancer.key;
            this.attackFlip = lancer.flip;
            this.attackHold = A.frames(this.attackSheet) / w.animFps;
            this.flip = lancer.flip;
            for (i = 0; i < g.enemies.length; i++) {
                e = g.enemies[i];
                if (e.dead || e.spawnTime > 0) { continue; }
                if (!U.pointInOrientedBox(e.x, e.y, cx, cy, aim, reach * 0.5 + e.radius, halfW + e.radius)) { continue; }
                g.damageEnemy(e, dmg, {
                    crit: crit, knockback: w.knockback,
                    dirX: Math.cos(aim), dirY: Math.sin(aim), source: 'player'
                });
            }
            g.spawnEffect({
                kind: 'line', x: this.x, y: this.y, angle: aim, radius1: reach,
                lineWidth: halfW * 1.6, colour: buffed ? '#ffd45e' : '#ffffff', life: 0.2
            });
            IW.Audio.play(w.sfx);

        } else if (w.kind === 'pulse') {
            for (i = 0; i < g.enemies.length; i++) {
                e = g.enemies[i];
                if (e.dead || e.spawnTime > 0) { continue; }
                var d = U.dist(this.x, this.y, e.x, e.y);
                if (d > w.radius + e.radius) { continue; }
                var pa = Math.atan2(e.y - this.y, e.x - this.x);
                g.damageEnemy(e, dmg, {
                    crit: crit, knockback: w.knockback,
                    dirX: Math.cos(pa), dirY: Math.sin(pa), source: 'player'
                });
            }
            g.spawnEffect({
                kind: 'anim', key: w.effect, x: this.x, y: this.y,
                scale: (w.radius * 2) / 192, fps: w.fps, life: 0.5
            });
            g.spawnEffect({ kind: 'ring', x: this.x, y: this.y, radius0: 12, radius1: w.radius, colour: '#ffe9a8', life: 0.3 });
            this.attackSheet = w.anim;
            this.attackHold = A.frames(w.anim) / 9;
            IW.Audio.play(w.sfx);

        } else if (w.kind === 'shot') {
            var ang2 = aim + (g.rng() - 0.5) * 0.08;
            g.projectiles.push(new IW.Projectile(g, {
                x: this.x + Math.cos(ang2) * 16,
                y: this.y + Math.sin(ang2) * 16,
                vx: Math.cos(ang2) * w.speed,
                vy: Math.sin(ang2) * w.speed,
                damage: dmg,
                owner: 'player',
                pierce: w.pierce,
                knockback: w.knockback,
                life: w.lifetime,
                key: w.projKey,
                scale: 0.45,
                crit: crit,
                radius: 8
            }));
            this.attackSheet = w.anim;
            this.attackHold = A.frames(w.anim) / w.fps;
            this.flip = Math.cos(aim) < 0;
            IW.Audio.play(w.sfx);
        }

        if (crit) { this.critHits = (this.critHits || 0) + 1; }
        if (buffed) {
            this.riposte = 0;
            g.addFloatText(this.x, this.y - 48, 'RIPOSTE!', '#ffd45e', 16);
        }
    };

    Player.prototype.useAbility = function () {
        var g = this.game, ab = this.char.ability, s = this.stats;
        this.abilityTimer = ab.cooldown * (1 - s.cooldown);

        if (ab.kind === 'aegis') {
            this.abilityTime = ab.duration;
            this.invuln = Math.max(this.invuln, ab.duration);
            var dmg = Math.max(1, Math.round(ab.damage * (1 + s.damage) * (1 + s.melee)));
            for (var i = 0; i < g.enemies.length; i++) {
                var e = g.enemies[i];
                if (e.dead || e.spawnTime > 0) { continue; }
                if (U.dist(this.x, this.y, e.x, e.y) > ab.radius + e.radius) { continue; }
                var a = Math.atan2(e.y - this.y, e.x - this.x);
                g.damageEnemy(e, dmg, {
                    crit: false, knockback: ab.knockback,
                    dirX: Math.cos(a), dirY: Math.sin(a), source: 'player'
                });
            }
            g.spawnEffect({ kind: 'ring', x: this.x, y: this.y, radius0: 18, radius1: ab.radius, colour: '#9fd6ff', life: 0.45, lineWidth: 9 });
            g.spawnEffect({ kind: 'burst', x: this.x, y: this.y, angle: this.aim, radius0: 20, radius1: 70, colour: '#cfe3ff', life: 0.35 });
            g.shake(4);
            IW.Audio.play('ability');

        } else if (ab.kind === 'dash') {
            var ax = IW.Input.axis();
            var vx = ax.x, vy = ax.y;
            if (vx === 0 && vy === 0) { vx = Math.cos(this.aim); vy = Math.sin(this.aim); }
            var len = Math.sqrt(vx * vx + vy * vy) || 1;
            this.dashDirX = vx / len;
            this.dashDirY = vy / len;
            this.dashTime = ab.duration;
            this.invuln = Math.max(this.invuln, ab.invuln);
            g.spawnEffect({ kind: 'anim', key: 'dust1', x: this.x, y: this.y, scale: 0.5, fps: 18, life: 0.4 });
            IW.Audio.play('dash');

        } else if (ab.kind === 'brace') {
            this.braceTime = ab.duration;
            this.riposte = ab.buffTime;
            g.spawnEffect({ kind: 'ring', x: this.x, y: this.y, radius0: 8, radius1: 56, colour: '#ffe6b0', life: 0.35 });
            IW.Audio.play('ability');

        } else if (ab.kind === 'heal') {
            this.healTime = ab.duration;
            g.spawnEffect({ kind: 'ring', x: this.x, y: this.y, radius0: 10, radius1: 70, colour: '#8ee86a', life: 0.5 });
            IW.Audio.play('heal');
        }

        g.addFloatText(this.x, this.y - 58, ab.name.toUpperCase(), '#cfe3ff', 14);
    };

    Player.prototype.updateAnim = function (dt) {
        var w = this.char.weapon, ab = this.char.ability;
        var key = null, fps = 8;

        if (this.abilityTime > 0 && ab.anim) { key = ab.anim; fps = ab.fps || 12; }
        else if (this.healTime > 0 && ab.anim) { key = ab.anim; fps = ab.fps || 12; }
        else if (this.braceTime > 0 && this.unitType === 'Lancer') {
            var def = this.lancerSheet('Defence', this.aim);
            key = def.key;
            fps = 9;
            this.flip = def.flip;
        } else if (this.attackHold > 0 && this.attackSheet) {
            key = this.attackSheet;
            fps = w.kind === 'thrust' ? w.animFps : (w.fps || 12);
            if (w.kind === 'thrust' && this.attackFlip != null) { this.flip = this.attackFlip; }
        } else if (this.dashTime > 0) {
            key = IW.charSheet(this.char, 'Run');
            fps = 15;
            this.flip = this.dashDirX < 0;
        } else if (this.moving) {
            key = IW.charSheet(this.char, 'Run');
            fps = 10;
            this.flip = this.facing.x < 0;
        } else {
            key = IW.charSheet(this.char, 'Idle');
            fps = 7;
        }

        this.anim.set(key, fps, true);
        this.anim.update(dt);
    };

    Player.prototype.draw = function (ctx, camX, camY) {
        var sx = this.x - camX, sy = this.y - camY;
        var fs = A.frameSize(this.anim.key);
        var drawY = sy - fs.fh * this.scale * feetOf(this.unitType);

        A.draw(ctx, 'shadow', 0, sx, sy + 2, Math.max(0.22, this.radius / 46), false, 0.35);

        var alpha = 1;
        if (this.dashTime > 0) { alpha = 0.75; }
        else if (this.invuln > 0) { alpha = 0.55 + 0.45 * Math.abs(Math.sin(this.game.time * 18)); }

        var ok = A.draw(ctx, this.anim.key, this.anim.frame, sx, drawY, this.scale, !!this.flip, alpha);
        if (!ok) {
            ctx.fillStyle = this.char.colour;
            ctx.fillRect(sx - 14, sy - 34, 28, 34);
        }

        if (this.braceTime > 0) {
            ctx.save();
            ctx.globalAlpha = 0.35 + 0.2 * Math.abs(Math.sin(this.game.time * 12));
            ctx.strokeStyle = '#ffe6b0';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(sx, sy - 8, this.radius + 14, 0, U.TAU);
            ctx.stroke();
            ctx.restore();
        }
        if (this.abilityTime > 0) {
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#9fd6ff';
            ctx.beginPath();
            ctx.arc(sx, sy - 8, this.radius + 18, 0, U.TAU);
            ctx.fill();
            ctx.restore();
        }
        if (this.hurtFlash > 0) {
            A.tinted(ctx, this.anim.key, this.anim.frame, sx, drawY, this.scale, !!this.flip, '#ff5555', 0.55);
        }
    };

    IW.Player = Player;

    /* ---------------------------------------------------------------- enemy */

    function Enemy(game, opts) {
        this.game = game;
        this.uid = ++game.uidCounter;
        this.tierId = opts.tierId;
        this.typeId = opts.typeId;
        this.tier = IW.tierById(opts.tierId);
        this.type = IW.EnemyTypes[opts.typeId];
        this.elite = !!opts.elite;
        this.stats = IW.enemyStats(this.tierId, this.typeId, opts.wave, this.elite);
        this.maxHp = this.stats.hp;
        this.hp = this.stats.hp;
        this.radius = this.stats.radius;
        this.speed = this.stats.speed;
        this.x = opts.x;
        this.y = opts.y;
        this.vx = 0;
        this.vy = 0;
        this.scale = (IW.SPRITE_SCALE[this.type.type] || 0.62) * (this.elite ? IW.ELITE.scale : 1);
        this.anim = new Anim(IW.enemySheet(this.tier.colour, this.type.type, this.type.anims.idle), 7, true);
        this.state = 'chase';
        this.stateTime = 0;
        this.contactTimer = 0;
        this.attackCd = this.type.attackCd ? this.type.attackCd * (0.5 + game.rng() * 0.7) : 0;
        this.shootCd = this.type.shootCd ? this.type.shootCd * (0.4 + game.rng() * 0.8) : 0;
        this.chargeCd = this.type.chargeCd ? this.type.chargeCd * (0.5 + game.rng()) : 0;
        this.healCd = this.type.healCd ? this.type.healCd * game.rng() : 0;
        this.chargeX = 0;
        this.chargeY = 0;
        this.flash = 0;
        this.facing = { x: 1, y: 0 };
        this.dead = false;
        this.hpBarTimer = 0;
        this.spawnTime = 0.32;
        this.tint = this.type.type === 'Pawn' ? this.tier.ring : null;
    }

    Enemy.prototype.update = function (dt) {
        var g = this.game, p = g.player, t = this.type, s = this.stats, i;
        if (this.dead) { return; }
        if (this.spawnTime > 0) { this.spawnTime -= dt; this.anim.update(dt); return; }

        this.contactTimer -= dt;
        this.attackCd -= dt;
        this.shootCd -= dt;
        this.chargeCd -= dt;
        this.healCd -= dt;
        this.flash -= dt;
        this.hpBarTimer -= dt;

        var dx = 0, dy = 0, d = 1;
        var alive = !!(p && !p.dead);
        if (alive) {
            dx = p.x - this.x;
            dy = p.y - this.y;
            d = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
        }
        var nx = dx / d, ny = dy / d;
        var mvx = 0, mvy = 0;
        if (nx > 0.05) { this.facing.x = 1; } else if (nx < -0.05) { this.facing.x = -1; }

        if (t.ai === 'chase') {
            if (this.state === 'windup') {
                this.stateTime -= dt;
                mvx = nx * 0.3;
                mvy = ny * 0.3;
                if (this.stateTime <= 0) {
                    this.state = 'chase';
                    if (alive && d < t.attackRange + p.radius + 16) {
                        var ang = Math.atan2(dy, dx);
                        g.spawnEffect({ kind: 'arc', x: this.x, y: this.y, angle: ang, halfAngle: 0.9, radius1: t.attackRange, colour: '#ff9b6b', life: 0.2 });
                        p.takeDamage(s.damage, this);
                    }
                }
            } else if (alive && t.attackRange && this.attackCd <= 0 && d < t.attackRange + p.radius) {
                this.state = 'windup';
                this.stateTime = t.windup;
                this.attackCd = t.attackCd;
                this.anim.set(IW.enemySheet(this.tier.colour, t.type, t.anims.attack || t.anims.idle), 9, false);
            } else {
                mvx = nx;
                mvy = ny;
            }
        }

        else if (t.ai === 'ranged') {
            if (this.state === 'aim') {
                this.stateTime -= dt;
                if (this.stateTime <= 0) {
                    this.state = 'chase';
                    this.shootCd = t.shootCd;
                    var a2 = Math.atan2(dy, dx);
                    g.projectiles.push(new IW.Projectile(g, {
                        x: this.x + Math.cos(a2) * 16,
                        y: this.y + Math.sin(a2) * 16,
                        vx: Math.cos(a2) * t.projSpeed,
                        vy: Math.sin(a2) * t.projSpeed,
                        damage: s.damage,
                        owner: 'enemy',
                        life: 2.4,
                        key: IW.enemySheet(this.tier.colour, 'Archer', 'Arrow'),
                        scale: 0.4,
                        radius: 7
                    }));
                    IW.Audio.play('shoot');
                }
            } else if (alive && this.shootCd <= 0 && d < 520) {
                this.state = 'aim';
                this.stateTime = t.aimTime;
                this.anim.set(IW.enemySheet(this.tier.colour, t.type, t.anims.shoot), 9, false);
            }
            if (d > t.keepDist + 30) { mvx = nx; mvy = ny; }
            else if (d < t.keepDist - 40) { mvx = -nx; mvy = -ny; }
            else { mvx = -ny * 0.55; mvy = nx * 0.55; }

        } else if (t.ai === 'charger') {
            if (this.state === 'telegraph') {
                this.stateTime -= dt;
                this.flash = 0.12;
                if (this.stateTime <= 0) {
                    this.state = 'charge';
                    this.stateTime = t.chargeTime;
                    this.chargeX = nx;
                    this.chargeY = ny;
                    IW.Audio.play('thrust');
                }
            } else if (this.state === 'charge') {
                mvx = this.chargeX * t.chargeSpeed;
                mvy = this.chargeY * t.chargeSpeed;
                this.stateTime -= dt;
                if (this.stateTime <= 0) { this.state = 'chase'; this.chargeCd = t.chargeCd; }
            } else if (alive && this.chargeCd <= 0 && d < t.chargeRange) {
                this.state = 'telegraph';
                this.stateTime = t.telegraph;
                this.anim.set(IW.enemySheet(this.tier.colour, t.type, t.anims.attack || t.anims.run), 6, false);
            } else {
                mvx = nx * 0.75;
                mvy = ny * 0.75;
            }

        } else if (t.ai === 'healer') {
            if (d < t.keepDist) { mvx = -nx * 0.8; mvy = -ny * 0.8; }
            else if (d > t.keepDist + 90) { mvx = nx * 0.85; mvy = ny * 0.85; }
            if (this.healCd <= 0) {
                this.healCd = t.healCd;
                var amount = Math.max(4, Math.round(this.maxHp * 0.07));
                var healed = 0;
                for (i = 0; i < g.enemies.length; i++) {
                    var o = g.enemies[i];
                    if (o.dead || o === this || o.spawnTime > 0 || o.hp >= o.maxHp) { continue; }
                    if (U.dist(this.x, this.y, o.x, o.y) > t.healRange) { continue; }
                    o.hp = Math.min(o.maxHp, o.hp + amount);
                    o.hpBarTimer = 2.2;
                    g.spawnEffect({ kind: 'anim', key: 'u:Blue:Monk:Heal_Effect', x: o.x, y: o.y, scale: 0.3, fps: 16, life: 0.4 });
                    healed++;
                }
                if (healed > 0) {
                    this.anim.set(IW.enemySheet(this.tier.colour, t.type, t.anims.effect), 12, false);
                }
            }
        }

        /* ---- movement ---- */
        var sp = this.speed;
        this.x += (mvx * sp + this.vx) * dt;
        this.y += (mvy * sp + this.vy) * dt;
        var damp = Math.min(0.95, 9 * dt);
        this.vx -= this.vx * damp;
        this.vy -= this.vy * damp;

        var a = g.arena;
        this.x = U.clamp(this.x, a.x + this.radius, a.x + a.w - this.radius);
        this.y = U.clamp(this.y, a.y + this.radius, a.y + a.h - this.radius);

        /* light separation so the horde does not stack into one pixel */
        for (i = 0; i < g.enemies.length; i++) {
            var o2 = g.enemies[i];
            if (o2 === this || o2.dead || o2.spawnTime > 0) { continue; }
            var ox = this.x - o2.x, oy = this.y - o2.y;
            var minD = this.radius + o2.radius;
            var dd2 = ox * ox + oy * oy;
            if (dd2 > 0.01 && dd2 < minD * minD) {
                var dd = Math.sqrt(dd2);
                var push = (minD - dd) * 0.5;
                this.x += (ox / dd) * push;
                this.y += (oy / dd) * push;
            }
        }

        /* ---- animation ---- */
        var isMoving = mvx !== 0 || mvy !== 0;
        if (this.anim.loop || this.anim.done) {
            this.anim.set(IW.enemySheet(this.tier.colour, t.type, isMoving ? t.anims.run : t.anims.idle), isMoving ? 10 : 7, true);
        }
        this.anim.update(dt);
    };

    Enemy.prototype.hurt = function (damage, opts) {
        if (this.dead) { return 0; }
        var dmg = Math.max(1, Math.round(damage));
        this.hp -= dmg;
        this.hpBarTimer = 2.5;
        this.flash = 0.14;
        var kb = ((opts && opts.knockback) || 0) * (1 - this.stats.knockbackResist);
        if (kb > 0) {
            var lx = (opts && opts.dirX) || 0, ly = (opts && opts.dirY) || 0;
            var len = Math.sqrt(lx * lx + ly * ly) || 1;
            this.vx += (lx / len) * kb;
            this.vy += (ly / len) * kb;
        }
        if (this.hp <= 0) { this.hp = 0; this.dead = true; }
        return dmg;
    };

    Enemy.prototype.draw = function (ctx, camX, camY) {
        var sx = this.x - camX, sy = this.y - camY;
        var fs = A.frameSize(this.anim.key);
        var drawY = sy - fs.fh * this.scale * feetOf(this.type.type);
        var flip = this.facing.x < 0;

        /* tier ring - the quickest read on how dangerous this one is */
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = this.elite ? IW.ELITE.ring : this.tier.ring;
        ctx.lineWidth = this.elite ? 4 : 2.5;
        ctx.beginPath();
        ctx.ellipse(sx, sy + 4, this.radius * 1.5, this.radius * 0.72, 0, 0, U.TAU);
        ctx.stroke();
        ctx.restore();

        A.draw(ctx, 'shadow', 0, sx, sy + 2, Math.max(0.2, this.radius / 46), false, 0.3);

        var alpha = this.spawnTime > 0 ? (0.3 + (1 - this.spawnTime / 0.32) * 0.7) : 1;
        var ok = A.draw(ctx, this.anim.key, this.anim.frame, sx, drawY, this.scale, flip, alpha);
        if (!ok) {
            ctx.fillStyle = this.tier.ring;
            ctx.fillRect(sx - 12, sy - 28, 24, 28);
        }
        if (this.tint) { A.tinted(ctx, this.anim.key, this.anim.frame, sx, drawY, this.scale, flip, this.tint, 0.38); }
        if (this.flash > 0) { A.tinted(ctx, this.anim.key, this.anim.frame, sx, drawY, this.scale, flip, '#ffffff', 0.7); }

        if (this.hpBarTimer > 0 && this.hp < this.maxHp) {
            var w = Math.max(26, this.radius * 2.3), h = 4;
            var bx = sx - w / 2, by = sy - this.radius * 2.6 - 10;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);
            ctx.fillStyle = this.elite ? '#ffd45e' : '#ff5f5f';
            ctx.fillRect(bx, by, w * (this.hp / this.maxHp), h);
        }
    };

    IW.Enemy = Enemy;
})();