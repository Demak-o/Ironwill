/* Ironwill - headless smoke test.
 *
 * Loads the real game sources in the same order as index.html with a stubbed DOM /
 * canvas, then drives real waves, level-ups and shops. Any runtime error, NaN in the
 * simulation, or broken invariant fails the run. Run with:  node tools/headless_test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SOURCES = [
    'src/util.js', 'src/assets.js', 'src/audio.js', 'src/input.js',
    'src/data/stats.js', 'src/data/characters.js', 'src/data/enemies.js', 'src/data/items.js',
    'src/entities.js', 'src/arena.js', 'src/ui.js', 'src/game.js'
];

/* ------------------------------------------------------------------ stubs */

function makeCtx() {
    const noop = () => undefined;
    return {
        canvas: { width: 1280, height: 720 },
        globalAlpha: 1, globalCompositeOperation: 'source-over',
        fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '', textAlign: 'left',
        measureText: (s) => ({ width: String(s).length * 7 }),
        createLinearGradient: () => ({ addColorStop: noop }),
        createRadialGradient: () => ({ addColorStop: noop }),
        createPattern: () => ({}),
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
        putImageData: noop,
        save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
        beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
        ellipse: noop, rect: noop, roundRect: noop, fill: noop, stroke: noop,
        clip: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
        fillText: noop, strokeText: noop, drawImage: noop, setTransform: noop
    };
}

function makeCanvas() {
    return {
        width: 1280, height: 720, style: {},
        getContext: () => makeCtx(),
        addEventListener: () => undefined,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 })
    };
}

/* Fake images read their true pixel size from the real PNG header, so sheet frame
 * maths (frames = width / height) stays honest in the tests. */
function pngSize(file) {
    try {
        const fd = fs.openSync(file, 'r');
        const buf = Buffer.alloc(33);
        fs.readSync(fd, buf, 0, 33, 0);
        fs.closeSync(fd);
        if (buf.readUInt32BE(0) !== 0x89504e47) { return null; }
        return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    } catch (e) { return null; }
}

let pendingImages = 0;

function makeImage() {
    const img = { width: 0, height: 0, complete: false, onload: null, onerror: null, _src: '' };
    Object.defineProperty(img, 'src', {
        get() { return img._src; },
        set(v) {
            img._src = v;
            pendingImages++;
            const size = pngSize(path.join(ROOT, decodeURI(String(v))));
            setTimeout(() => {
                pendingImages--;
                if (size) {
                    img.width = size.width;
                    img.height = size.height;
                    img.complete = true;
                    if (img.onload) { img.onload(); }
                } else if (img.onerror) {
                    img.onerror();
                }
            }, 0);
        }
    });
    return img;
}

const sandbox = {
    console, Math, Date, JSON, Object, Array, String, Number, Boolean, Error,
    isFinite, parseInt, parseFloat, setTimeout, clearTimeout, setInterval, clearInterval,
    Uint8ClampedArray,
    performance: { now: () => Date.now() },
    requestAnimationFrame: () => 0,
    localStorage: (() => {
        const store = {};
        return {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: (k) => { delete store[k]; }
        };
    })(),
    Image: makeImage,
    document: {
        createElement: (tag) => (tag === 'canvas' ? makeCanvas() : { style: {}, appendChild: () => undefined }),
        getElementById: (id) => (id === 'game' ? makeCanvas() : null),
        addEventListener: () => undefined
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
/* ------------------------------------------------------------ load sources */

for (const rel of SOURCES) {
    const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    try {
        vm.runInContext(code, sandbox, { filename: rel });
    } catch (err) {
        console.error('FAILED to evaluate ' + rel);
        console.error(err);
        process.exit(1);
    }
}

const IW = sandbox.IW;
let failures = 0;
function check(cond, label, detail) {
    if (cond) { console.log('  ok   ' + label); }
    else {
        failures++;
        console.log('  FAIL ' + label + (detail === undefined ? '' : '  -> ' + detail));
    }
}

/* ----------------------------------------------------------- data checks */

console.log('\n== data tables ==');
check(IW.Characters.length === 4, 'four playable classes', IW.Characters.length);
check(IW.Characters.every((c) => c.weapon && c.ability && c.baseStats), 'each class has a weapon + ability');
check(IW.Characters.filter((c) => c.ability.key === 'Left Shift').length === 4, 'every ability is bound to Left Shift');
const weaponKinds = {};
IW.Characters.forEach((c) => { weaponKinds[c.weapon.kind] = 1; });
check(Object.keys(weaponKinds).length === 4, 'the four classes have four distinct weapon behaviours', Object.keys(weaponKinds).join(','));
check(IW.EnemyTiers.length === 4, 'four enemy colour tiers (blue belongs to the player)', IW.EnemyTiers.length);
check(IW.Items.length >= 30, 'a decent item pool', IW.Items.length);
const rarityCounts = {};
IW.Items.forEach((it) => { rarityCounts[it.rarity] = (rarityCounts[it.rarity] || 0) + 1; });
check(rarityCounts[1] > rarityCounts[3] && rarityCounts[3] > rarityCounts[5],
    'higher rarities have fewer items in the pool', JSON.stringify(rarityCounts));
check(IW.Items.every((it) => it.icon && it.mods && it.cost > 0), 'every item has an icon, mods and a price');

console.log('\n== luck scaling ==');
function meanRarity(luck, samples) {
    const rng = IW.util.makeRng(12345);
    let total = 0;
    for (let i = 0; i < samples; i++) { total += IW.rollRarity(rng, luck); }
    return total / samples;
}
const mean0 = meanRarity(0, 200000);
const mean10 = meanRarity(10, 200000);
const mean30 = meanRarity(30, 200000);
const mean80 = meanRarity(80, 200000);
console.log('  luck  0 -> average rarity ' + mean0.toFixed(3));
console.log('  luck 10 -> average rarity ' + mean10.toFixed(3));
console.log('  luck 30 -> average rarity ' + mean30.toFixed(3));
console.log('  luck 80 -> average rarity ' + mean80.toFixed(3));
check(mean0 < mean10 && mean10 < mean30 && mean30 < mean80, 'luck increases the average rarity of shop stock');
check(mean0 < 2.0, 'common stock dominates with no luck', mean0.toFixed(3));
check(mean80 > 2.3, 'high luck meaningfully shifts the table', mean80.toFixed(3));

function legendaryRate(luck) {
    const rng = IW.util.makeRng(99);
    let n = 0;
    for (let i = 0; i < 100000; i++) { if (IW.rollRarity(rng, luck) === 5) { n++; } }
    return n / 100000;
}
const legLow = legendaryRate(0);
const legHigh = legendaryRate(60);
check(legHigh > legLow * 3, 'legendaries are far more likely with luck',
    (legLow * 100).toFixed(3) + '% -> ' + (legHigh * 100).toFixed(3) + '%');
check(legLow < 0.015, 'legendaries are rare without luck', (legLow * 100).toFixed(3) + '%');

console.log('\n== wave scaling ==');
let prevHp = 0, prevInterval = 99, monotonicHp = true, monotonicSpawn = true;
for (let w = 1; w <= 20; w++) {
    const cfg = IW.waveConfig(w);
    if (cfg.hpMul < prevHp) { monotonicHp = false; }
    if (cfg.spawnInterval > prevInterval + 1e-9) { monotonicSpawn = false; }
    prevHp = cfg.hpMul;
    prevInterval = cfg.spawnInterval;
}
check(monotonicHp, 'enemy health multiplier never decreases');
check(monotonicSpawn, 'spawn interval never gets slower');
check([1, 2, 3, 4].map(IW.tierUnlockWave).join(',') === '1,3,6,9', 'tier unlock schedule is 1 / 3 / 6 / 9',
    [1, 2, 3, 4].map(IW.tierUnlockWave).join(','));
const t1 = IW.enemyStats(1, 'warrior', 1, false);
const t4 = IW.enemyStats(4, 'warrior', 20, false);
check(t4.hp > t1.hp * 8 && t4.damage > t1.damage * 2, 'purple wave-20 warriors dwarf wave-1 black ones',
    t1.hp + 'hp/' + t1.damage + 'dmg -> ' + t4.hp + 'hp/' + t4.damage + 'dmg');
const elite = IW.enemyStats(2, 'archer', 8, true);
const normal = IW.enemyStats(2, 'archer', 8, false);
check(elite.hp > normal.hp && elite.gold > normal.gold, 'elites are tougher and richer');

const goldEarly = IW.enemyStats(1, 'warrior', 1, false).gold;
const goldLate = IW.enemyStats(4, 'warrior', 20, false).gold;
check(goldLate > goldEarly * 5, 'late-wave enemies drop far more gold', goldEarly + ' -> ' + goldLate);

const stats0 = IW.Stats.summary(IW.Stats.compute(IW.Characters[0].baseStats, []), IW.Characters[0].baseSpeed);
/* -------------------------------------------------------- play a real run */

const canvas = makeCanvas();
const dt = 1 / 60;

function waitForImages() {
    return new Promise((resolve) => {
        const tick = () => { if (pendingImages === 0) { resolve(); } else { setTimeout(tick, 2); } };
        tick();
    });
}

function press(game, code) {
    IW.Input.keys[code] = true;
    IW.Input.justPressed[code] = true;
    game.tick(dt);
    IW.Input.keys[code] = false;
    IW.Input.endFrame();
}

async function main() {
    /* boot the real asset loader (the game reads every PNG from disk) */
    IW.Assets.load(null, () => {});
    await waitForImages();
    const total = Object.keys(IW.Assets.defs).length;
    const loaded = Object.keys(IW.Assets.defs).filter((k) => IW.Assets.ready(k)).length;
    console.log('\n== assets ==');
    console.log('  loaded ' + loaded + ' / ' + total + ' sprite sheets');
    check(loaded === total, 'every manifest entry loaded from disk');
    check(IW.Assets.frames('u:Blue:Warrior:Idle') === 8, 'Warrior_Idle -> 8 frames', IW.Assets.frames('u:Blue:Warrior:Idle'));
    check(IW.Assets.frames('u:Blue:Lancer:Idle') === 12, 'Lancer_Idle -> 12 frames of 320px', IW.Assets.frames('u:Blue:Lancer:Idle'));
    check(IW.Assets.frames('u:Blue:Archer:Shoot') === 8, 'Archer_Shoot -> 8 frames');
    check(IW.Assets.frames('u:Blue:Monk:Heal_Effect') === 11, 'Monk Heal_Effect -> 11 frames');
    check(IW.Assets.frames('tile2') === 12, 'tileset -> 12 columns of 48px tiles', IW.Assets.frames('tile2'));
    check(IW.Assets.frames('tree1') === 6 && IW.Assets.frames('bush1') === 8, 'decor sheets sliced correctly',
        IW.Assets.frames('tree1') + '/' + IW.Assets.frames('bush1'));

    console.log('\n== menu flow ==');
    const game = new IW.Game(canvas);
    check(!!game, 'the Game controller constructs');
    game.newArena(1);
    game.state = 'title';
    check(game.arena.w > 1280 && game.arena.h > 720, 'arena is larger than the viewport so the camera can pan',
        game.arena.w + 'x' + game.arena.h);
    check(game.arena.decor.length > 15, 'decorations were placed in the arena', game.arena.decor.length);

    press(game, 'Enter');
    check(game.state === 'select', 'ENTER on the title opens character select', game.state);
    press(game, 'Digit3');
    check(game.selectedIndex === 2, 'number keys select a class', game.selectedIndex);
    press(game, 'Enter');
    check(game.state === 'wave' && game.wave === 1, 'the run starts on wave 1', game.state + ' w' + game.wave);
    check(game.player && game.player.char.id === 'lancer', 'the chosen class is used', game.player && game.player.char.id);
    check(game.introLines.length > 0, 'a wave intro banner is prepared');
console.log('\n== four simulated runs (one per class) ==');
    const seenStates = {};
    let maxEnemies = 0, purchases = 0, rerolls = 0, heals = 0, levelUps = 0, deaths = 0, shops = 0;

    for (let character = 0; character < IW.Characters.length; character++) {
        game.startRun(character);
        shops = 0; purchases = 0; rerolls = 0; heals = 0; levelUps = 0;

        let guard = 0;
        while (game.wave <= 12 && guard++ < 8000) {
            seenStates[game.state] = (seenStates[game.state] || 0) + 1;
            maxEnemies = Math.max(maxEnemies, game.livingEnemies());

            /* simulate a wandering player that dodges, attacks and uses abilities */
            const a = guard * 0.11;
            IW.Input.keys.KeyW = Math.sin(a) > 0.2;
            IW.Input.keys.KeyS = Math.sin(a) < -0.2;
            IW.Input.keys.KeyA = Math.cos(a) < -0.2;
            IW.Input.keys.KeyD = Math.cos(a) > 0.2;
            if (guard % 100 === 0) { IW.Input.keys.ShiftLeft = true; IW.Input.justPressed.ShiftLeft = true; }

            /* mouse-aim at the nearest enemy and hold left click to attack */
            const p0 = game.player;
            let nte = null, nd = Infinity;
            for (const e of game.enemies) {
                if (e.dead) { continue; }
                const dd = (e.x - p0.x) * (e.x - p0.x) + (e.y - p0.y) * (e.y - p0.y);
                if (dd < nd) { nd = dd; nte = e; }
            }
            if (nte) {
                IW.Input.mouse.x = nte.x - game.camera.x;
                IW.Input.mouse.y = nte.y - game.camera.y;
                IW.Input.mouse.down = true;
            } else {
                IW.Input.mouse.down = false;
            }

            game.tick(dt);
            IW.Input.keys.ShiftLeft = false;
            IW.Input.endFrame();

            if (game.state === 'levelUp') {
                levelUps++;
                game.chooseUpgrade(guard % 3);
            } else if (game.state === 'waveClear') {
                game.leaveWaveClear();
            } else if (game.state === 'shop') {
                shops++;
                for (let i = 0; i < 4; i++) { if (game.purchase(i)) { purchases++; } }
                if (game.player.gold > 30) { rerolls++; game.rerollShop(); }
                if (game.player.hp < game.player.maxHp * 0.6) { heals++; game.shopHeal(); }
                game.nextWave();
            } else if (game.state === 'gameover') {
                deaths++;
                break;
            }
        }

        console.log('  ' + IW.Characters[character].name.padEnd(7) + ' wave ' + String(game.wave).padStart(2) +
            ' | lvl ' + String(game.player.level).padStart(2) +
            ' | kills ' + String(game.player.kills).padStart(3) +
            ' | items ' + game.player.items.length +
            ' | perks ' + game.player.perks.length +
            ' | gold ' + Math.round(game.player.gold));

        const nm = IW.Characters[character].name;
        check(isFinite(game.player.x + game.player.y), nm + ': position stays finite');
        check(isFinite(game.player.hp) && game.player.hp >= 0, nm + ': health stays sane');
        check(isFinite(game.player.gold) && game.player.gold >= 0, nm + ': gold never goes negative');
        check(game.player.items.length < 200, nm + ': item count stays bounded');
        check(game.player.level > 1, nm + ': levelled up during the run');
    }

    console.log('\n== observations ==');
    console.log('  states seen: ' + JSON.stringify(seenStates));
    console.log('  peak live enemies: ' + maxEnemies);
    console.log('  purchases ' + purchases + ' | rerolls ' + rerolls + ' | heals ' + heals +
        ' | level-ups ' + levelUps + ' | deaths ' + deaths);

    check(!!seenStates.wave && !!seenStates.shop, 'both the wave and the shop states were reached');
    check(purchases > 0, 'items were bought from the shop', purchases);
    check(levelUps > 0, 'level-up boons were offered and taken', levelUps);
    check(shops > 0, 'the shop opened after cleared waves', shops);
    check(maxEnemies > 3, 'enemies spawn and pile up', maxEnemies);
    check(maxEnemies <= 90, 'enemy count stays bounded', maxEnemies);
/* ---------------------------------------- deep run + late-game behaviour */

    console.log('\n== deep run (a funded build pushing into the late waves) ==');
    /* The Game seeds its RNG from wall-clock time, which makes a funded deep run
     * flaky, and reusing the already-run `game` above drags its leftover state into
     * the sim. Run the deep check on a fresh, deterministically-seeded Game. */
    const dgame = new IW.Game(canvas);
    dgame.rng = IW.util.makeRng(5);
    /* Wipe leftover keyboard/mouse state from the runs above so none of it bleeds
     * into the first ticks of the isolated deep-run game. */
    IW.Input.keys = {};
    IW.Input.justPressed = {};
    IW.Input.released = {};
    IW.Input.mouse.x = 640; IW.Input.mouse.y = 360;
    IW.Input.mouse.down = false; IW.Input.mouse.justDown = false; IW.Input.mouse.justUp = false;
    dgame.startRun(0);
    dgame.player.gold = 5000;
    let deepGuard = 0, deepDeaths = 0;
    while (dgame.wave <= 20 && deepGuard++ < 50000) {
        /* a bot that actually plays: run away from the nearest enemy, attack it with
         * the mouse, and use the class ability */
        const p = dgame.player;
        let nearest = null, best = Infinity;
        for (const e of dgame.enemies) {
            const d2 = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y);
            if (d2 < best) { best = d2; nearest = e; }
        }
        if (nearest) {
            const dx = p.x - nearest.x, dy = p.y - nearest.y;
            IW.Input.keys.KeyD = dx > 30;
            IW.Input.keys.KeyA = dx < -30;
            IW.Input.keys.KeyS = dy > 30;
            IW.Input.keys.KeyW = dy < -30;
            if (Math.sqrt(best) < 200 && deepGuard % 40 === 0) {
                IW.Input.keys.ShiftLeft = true;
                IW.Input.justPressed.ShiftLeft = true;
            }
            IW.Input.mouse.x = nearest.x - dgame.camera.x;
            IW.Input.mouse.y = nearest.y - dgame.camera.y;
            IW.Input.mouse.down = true;
        } else {
            IW.Input.mouse.down = false;
        }
        dgame.tick(dt);
        IW.Input.keys.ShiftLeft = false;
        IW.Input.endFrame();

        if (dgame.state === 'levelUp') { dgame.chooseUpgrade(0); }
        else if (dgame.state === 'waveClear') { dgame.leaveWaveClear(); }
        else if (dgame.state === 'shop') {
            for (let i = 0; i < 4; i++) { dgame.purchase(i); }
            if (dgame.player.hp < dgame.player.maxHp) { dgame.shopHeal(); }
            dgame.nextWave();
            if (dgame.state === 'victory') { dgame.keepGoing(); }
        } else if (dgame.state === 'gameover') {
            deepDeaths++;
            const reached = dgame.wave;
            dgame.retry();
            dgame.player.gold = 5000;
            dgame.wave = reached;
            dgame.startWave(reached);
            if (deepDeaths > 8) { break; }
        }
    }
    console.log('  reached wave ' + dgame.wave + ' (level ' + dgame.player.level +
        ', items ' + dgame.player.items.length + ', perks ' + dgame.player.perks.length +
        ', hp ' + Math.round(dgame.player.hp) + '/' + Math.round(dgame.player.maxHp) + ')');
    check(dgame.wave >= 12, 'a funded run gets deep into the campaign', dgame.wave);
    check(isFinite(dgame.player.x + dgame.player.y + dgame.player.hp + dgame.player.gold), 'no NaN after a long run');
    check(dgame.enemies.every((e) => isFinite(e.x + e.y + e.hp)), 'no NaN enemy state');
    check(dgame.projectiles.every((q) => isFinite(q.x + q.y)), 'no NaN projectile state');
    check(dgame.pickups.every((q) => isFinite(q.x + q.y)), 'no NaN pickup state');
    check(dgame.player.items.length > 2, 'the funded run accumulated items', dgame.player.items.length);

    /* victory path */
    console.log('\n== campaign victory path ==');
    game.startRun(1);
    game.wave = 20;
    game.startWave(20);
    game.state = 'shop';
    game.nextWave();
    check(game.state === 'victory', 'clearing wave 20 opens the victory screen', game.state);
    const waveBeforeEndless = game.wave;
    game.keepGoing();
    check(game.state === 'wave' && game.wave === waveBeforeEndless + 1, 'endless mode continues past wave 20',
        game.state + ' w' + game.wave);

    /* deterministic check that an endless level-up interrupts for the upgrade + shop
     * flow, then resumes the SAME endless wave (never re-starts it). */
    game.player.gainXp(game.player.xpNext * 2);   /* force pending levels */
    let ig = 0;
    while (ig++ < 30 && game.state === 'wave') { game.tick(dt); IW.Input.endFrame(); }
    check(game.state === 'levelUp', 'an endless level-up interrupts the wave', game.state);
    game.chooseUpgrade(ig % 3);                       /* pick the first upgrade */
    if (game.state === 'levelUp') { game.chooseUpgrade(ig % 3); }
    check(game.state === 'shop', 'endless upgrades open the shop', game.state);
    game.nextWave();
    check(game.state === 'wave', 'the endless wave resumes after the shop', game.state);
    check(game.endless === true, 'still in endless after the resume', game.endless);

    /* endless (bounded smoke): one infinite wave, non-stop enemies, escalating diff. */
    console.log('\n== endless mode (bounded smoke test) ==');
    /* gear the smoke player like a real wave-20 survivor so it can actually fight */
    const buildPool = IW.Items.filter((it) => it.rarity >= 3);
    for (let bi = 0; bi < 8 && bi < buildPool.length; bi++) {
        game.player.addItem(IW.instantiate(buildPool[bi], 21));
    }
    game.player.recompute(true);
    game.player.gold = 5000;
    let eg = 0, endlessLv = 0, endlessShops = 0, endlessResumes = 0;
    let emptyRun = 0, maxEmptyRun = 0, maxLiving = 0;
    let esc0 = game.endlessEsc();
    while (eg < 2400 && game.state !== 'gameover') {
        const p2 = game.player;
        let n2 = null, b2 = Infinity;
        for (const e2 of game.enemies) {
            const d3 = (e2.x - p2.x) * (e2.x - p2.x) + (e2.y - p2.y) * (e2.y - p2.y);
            if (d3 < b2) { b2 = d3; n2 = e2; }
        }
        if (n2) {
            const dx2 = p2.x - n2.x, dy2 = p2.y - n2.y;
            IW.Input.keys.KeyD = dx2 > 30; IW.Input.keys.KeyA = dx2 < -30;
            IW.Input.keys.KeyS = dy2 > 30; IW.Input.keys.KeyW = dy2 < -30;
            IW.Input.mouse.x = n2.x - game.camera.x;
            IW.Input.mouse.y = n2.y - game.camera.y;
            IW.Input.mouse.down = true;
        } else { IW.Input.mouse.down = false; }
        game.tick(dt);
        IW.Input.endFrame();
        if (game.state === 'levelUp') { endlessLv++; game.chooseUpgrade(eg % 3); }
        else if (game.state === 'shop') { endlessShops++; game.nextWave(); if (game.state === 'wave') endlessResumes++; }
        if (game.state === 'wave') {
            const ln = game.livingEnemies();
            if (ln <= 0) { emptyRun++; maxEmptyRun = Math.max(maxEmptyRun, emptyRun); }
            else { emptyRun = 0; }
            maxLiving = Math.max(maxLiving, ln);
        }
        eg++;
    }
    const esc1 = game.endlessEsc();
    console.log('  endless: ' + eg + ' ticks | survived ' + (game.state !== 'gameover') +
        ' | level-ups ' + endlessLv + ' | shops ' + endlessShops + ' | resumes ' + endlessResumes +
        ' | longest empty ' + maxEmptyRun + ' frames | peak living ' + maxLiving +
        ' | diff ' + esc0.toFixed(2) + ' -> ' + esc1.toFixed(2));
    check(game.endless && game.wave === 21, 'endless stays a single wave 21', game.wave);
    check(game.endlessTime > 0 && esc1 > esc0, 'endless difficulty escalates with survival time',
        esc0.toFixed(2) + ' -> ' + esc1.toFixed(2));
    check(maxEmptyRun <= 20, 'the endless arena never stays empty - spawns keep it stocked', maxEmptyRun);
    check(esc1 < 1 + 0.09 * (2400 / 60 / 60) + 0.01, 'difficulty ramps slowly (not exponential blow-up)', esc1.toFixed(3));
    check(isFinite(game.player.x + game.player.y + game.player.hp + game.endlessTime), 'no NaN after endless play');
    check(game.enemies.every((e2) => isFinite(e2.x + e2.y + e2.hp)), 'no NaN endless enemy');

    /* pause + stats panel + mute must not explode */
    console.log('\n== ui edge cases ==');
    game.state = 'wave';
    game.showStats = true;
    game.draw();
    game.state = 'paused';
    game.draw();
    game.state = 'title';
    game.draw();
    game.state = 'select';
    game.draw();
    game.state = 'gameover';
    game.draw();
    game.state = 'victory';
    game.draw();
    check(true, 'every screen draws without throwing');

    game.hoverId = game.hitTest(640, 520);
    check(typeof game.hoverId === 'string' || game.hoverId === null, 'hit testing returns an id or null', String(game.hoverId));

    /* the tile/sprite picking helpers used by the renderer */
    const tile = IW.Assets.tile(2, 1, 1);
    check(tile.sx === 48 && tile.sy === 48 && tile.sw === 48, 'interior tile lookup is correct', JSON.stringify(tile));
    check(IW.decorBase('tree1') > 0.3 && IW.decorBase('rock3') > 0.2, 'decor base offsets are defined');

    console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
    process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
    console.error('\nUNCAUGHT ERROR DURING THE TEST RUN');
    console.error(err);
    process.exit(1);
});
check(stats0.length >= 14 && stats0.some((s) => s.label === 'Luck'), 'the stat sheet reports luck like any other stat');