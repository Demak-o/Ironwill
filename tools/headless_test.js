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
    /* The Game seeds its RNG from wall-clock time, which makes this funded deep run
     * flaky. Pin a fixed seed here so the regression check is reproducible. */
    game.rng = IW.util.makeRng(1337);
    game.startRun(0);
    game.player.gold = 5000;
    let deepGuard = 0, deepDeaths = 0;
    while (game.wave <= 22 && deepGuard++ < 50000) {
        /* a bot that actually plays: run away from the nearest enemy and use its ability */
        const p = game.player;
        let nearest = null, best = Infinity;
        for (const e of game.enemies) {
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
        }
        game.tick(dt);
        IW.Input.keys.ShiftLeft = false;
        IW.Input.endFrame();

        if (game.state === 'levelUp') { game.chooseUpgrade(0); }
        else if (game.state === 'waveClear') { game.leaveWaveClear(); }
        else if (game.state === 'shop') {
            for (let i = 0; i < 4; i++) { game.purchase(i); }
            if (game.player.hp < game.player.maxHp) { game.shopHeal(); }
            game.nextWave();
            if (game.state === 'victory') { game.keepGoing(); }
        } else if (game.state === 'gameover') {
            deepDeaths++;
            const reached = game.wave;
            game.retry();
            game.player.gold = 5000;
            game.wave = reached;
            game.startWave(reached);
            if (deepDeaths > 8) { break; }
        }
    }
    console.log('  reached wave ' + game.wave + ' (level ' + game.player.level +
        ', items ' + game.player.items.length + ', perks ' + game.player.perks.length +
        ', hp ' + Math.round(game.player.hp) + '/' + Math.round(game.player.maxHp) + ')');
    check(game.wave >= 12, 'a funded run gets deep into the campaign', game.wave);
    check(isFinite(game.player.x + game.player.y + game.player.hp + game.player.gold), 'no NaN after a long run');
    check(game.enemies.every((e) => isFinite(e.x + e.y + e.hp)), 'no NaN enemy state');
    check(game.projectiles.every((p) => isFinite(p.x + p.y)), 'no NaN projectile state');
    check(game.pickups.every((p) => isFinite(p.x + p.y)), 'no NaN pickup state');
    check(game.player.items.length > 2, 'the funded run accumulated items', game.player.items.length);

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