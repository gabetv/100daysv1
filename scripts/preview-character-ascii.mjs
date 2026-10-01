// Aperçu ASCII des poses (lecture humaine du tampon de pixels).
import fs from 'node:fs';

globalThis.document = {
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener: () => {}, documentElement: { dataset: {}, style: {} },
    body: { classList: { add() {}, remove() {}, toggle() {} } }, hidden: false,
};
globalThis.window = globalThis;
globalThis.location = { href: '', protocol: 'http:', host: 'localhost' };
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.sessionStorage = { getItem: () => 'testeur', setItem() {} };
globalThis.requestAnimationFrame = () => 0;
globalThis.performance = globalThis.performance || { now: () => Date.now() };

// Recharge le faux contexte depuis le test (dupliqué ici pour l'autonomie).
const testSrc = fs.readFileSync(new URL('./test-character-anim.mjs', import.meta.url), 'utf8');
const ctxStart = testSrc.indexOf('function parseCssColor');
const ctxEnd = testSrc.indexOf('// --- PNG minimal');
const module = testSrc.slice(ctxStart, ctxEnd);
const factory = new Function(`${module}\nreturn { FakeCtx, parseCssColor };`);
const { FakeCtx } = factory();

const { drawPixelCharacter } = await import('../public/js/ui/draw.js');
const { computeCharacterPose, previewRuntime, triggerCharacterAnim } = await import('../public/js/ui/character-anim.js');

const FRAME_W = 76, FRAME_H = 96, P = 2, GROUND = 84;

function renderPose(animType, u, overrides = {}) {
    const character = {
        id: `ascii-${animType}-${Math.random()}`, name: '',
        health: 20, maxHealth: 20,
        appearance: { skin: 'sand', hair: 'chestnut', hairStyle: 'short', outfit: 'lagoon', accessory: 'none' },
        ...overrides,
    };
    const buf = new Uint8ClampedArray(FRAME_W * FRAME_H * 4);
    const ctx = new FakeCtx(FRAME_W, FRAME_H, buf);
    const rt = previewRuntime(character, `ascii:${Math.random()}`);
    rt._waveAt = Date.now(); // pas de salut parasite : on veut la pose demandée
    if (animType !== 'idle') {
        triggerCharacterAnim(rt.key, animType, { force: true });
        // Anticipe le départ pour figer l'action à la phase u ∈ [0,1].
        rt.action.start = Date.now() - u * rt.action.dur;
    }
    const pose = computeCharacterPose(character, rt, { isPlayer: true });
    drawPixelCharacter(ctx, character, FRAME_W / 2, GROUND - P * 7.2, true, 0, P / 4, { showLabel: false, pose, runtime: rt });
    return buf;
}

// Caractères du plus sombre au plus clair.
const RAMP = ' .:-=+*#%@';
function ascii(buf, title) {
    const lines = [`${'='.repeat(FRAME_W / 2)} ${title} ${'='.repeat(FRAME_W / 2)}`.slice(0, FRAME_W)];
    for (let y = 0; y < FRAME_H; y += 2) {   // une ligne sur deux : ratio de caractère ~2:1
        let line = '';
        for (let x = 0; x < FRAME_W; x++) {
            const i = (y * FRAME_W + x) * 4;
            const a = buf[i + 3];
            if (a < 30) { line += ' '; continue; }
            const lum = (0.3 * buf[i] + 0.55 * buf[i + 1] + 0.15 * buf[i + 2]) / 255;
            line += RAMP[Math.min(RAMP.length - 1, Math.max(1, Math.round(lum * (RAMP.length - 1))))];
        }
        lines.push(line.replace(/\s+$/, ''));
    }
    return lines.join('\n');
}

const poses = [
    ['idle', 0, 'REPOS (respiration)'],
    ['walkin', 0.5, 'MARCHE (arrivee)'],
    ['chop', 0.5, 'COUPE (hache, impact)'],
    ['mine', 0.45, 'MINAGE (pioche)'],
    ['forage', 0.5, 'FOUILLE (accroupi)'],
    ['fish', 0.6, 'PECHE (canne)'],
    ['attack', 0.4, 'ATTAQUE (estoc)'],
    ['hurt', 0.2, 'ENCAISSE (rougi)'],
    ['cheer', 0.3, 'VICTOIRE (bras au ciel)'],
    ['sleep', 0.6, 'SOMMEIL (assis, Zzz)'],
    ['guitar', 0.5, 'GUITARE (notes)'],
    ['eat', 0.5, 'REPAS (main a la bouche)'],
];
const selected = process.argv.slice(2);
const wanted = new Map(selected.map(s => {
    const [name, u] = s.split('=');
    return [name, u !== undefined ? Number(u) : null];
}));
const show = selected.length ? poses.filter(p => wanted.has(p[0])) : poses;
for (const [anim, uDefault, label] of show) {
    const u = wanted.get(anim) ?? uDefault;
    console.log(ascii(renderPose(anim, u), `${label} [u=${u}]`));
    console.log();
}
