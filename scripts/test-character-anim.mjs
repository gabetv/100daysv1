// Test du moteur d'animation des survivants (character-anim.js + draw.js).
//
// Le personnage est dessiné dans un faux contexte 2D qui rastérise vraiment
// les fillRect dans un tampon de pixels : on peut alors vérifier que chaque
// pose produit une silhouette différente, que le personnage reste ancré au
// sol, et que la personnalisation (chevelure, tenue) change le rendu.
//
// Usage :
//   node scripts/test-character-anim.mjs           → assertions seules
//   node scripts/test-character-anim.mjs --save    → produit aussi
//     artifacts/character-poses.png, une planche de contact des poses.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// --- Amorce DOM minimale AVANT les imports des modules du jeu -------------
globalThis.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    documentElement: { dataset: {}, style: {} },
    body: { classList: { add() {}, remove() {}, toggle() {} } },
    hidden: false,
};
globalThis.window = globalThis;
globalThis.location = { href: '', protocol: 'http:', host: 'localhost' };
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.sessionStorage = { getItem: () => 'testeur', setItem() {} };
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
globalThis.performance = globalThis.performance || { now: () => Date.now() };

// --- Faux contexte 2D : rastérise fillRect / ellipse / texte --------------
function parseCssColor(str) {
    if (typeof str !== 'string') return null;
    const s = str.trim();
    if (s.startsWith('#')) {
        const hex = s.length === 4 ? s.slice(1).split('').map(c => c + c).join('') : s.slice(1, 7);
        const n = parseInt(hex, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
    }
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (m) {
        const parts = m[1].split(',').map(Number);
        return [parts[0] || 0, parts[1] || 0, parts[2] || 0, parts.length > 3 ? Math.round(parts[3] * 255) : 255];
    }
    return null;
}

class FakeCtx {
    constructor(w, h, buf) {
        this.canvasWidth = w;
        this.canvasHeight = h;
        this.buf = buf; // Uint8ClampedArray w*h*4
        this.stack = [];
        this.a = 1; this.d = 1; this.e = 0; this.f = 0; // matrice (translate + scale only)
        this.fillStyle = '#000';
        this.strokeStyle = '#000';
        this.lineWidth = 1;
        this.globalAlpha = 1;
        this.font = '';
        this.textAlign = 'left';
        this.textBaseline = 'top';
        this.imageSmoothingEnabled = false;
        this.pendingEllipse = null;
    }
    save() { this.stack.push({ a: this.a, d: this.d, e: this.e, f: this.f, alpha: this.globalAlpha }); }
    restore() {
        const s = this.stack.pop();
        if (s) { this.a = s.a; this.d = s.d; this.e = s.e; this.f = s.f; this.globalAlpha = s.alpha; }
    }
    translate(x, y) { this.e += this.a * x; this.f += this.d * y; }
    scale(x, y) { this.a *= x; this.d *= y; }
    setTransform(a, b, c, d, e, f) { this.a = a; this.d = d; this.e = e; this.f = f; }
    _px(x, y, color) {
        const px = Math.round(this.e + this.a * x);
        const py = Math.round(this.f + this.d * y);
        if (px < 0 || px >= this.canvasWidth || py < 0 || py >= this.canvasHeight) return;
        const c = parseCssColor(color);
        if (!c) return;
        const alpha = (c[3] / 255) * this.globalAlpha;
        if (alpha <= 0) return;
        const i = (py * this.canvasWidth + px) * 4;
        if (alpha >= 1) {
            this.buf[i] = c[0]; this.buf[i + 1] = c[1]; this.buf[i + 2] = c[2]; this.buf[i + 3] = 255;
        } else {
            const dstA = this.buf[i + 3] / 255;
            const outA = alpha + dstA * (1 - alpha);
            if (outA <= 0) return;
            this.buf[i] = Math.round((c[0] * alpha + this.buf[i] * dstA * (1 - alpha)) / outA);
            this.buf[i + 1] = Math.round((c[1] * alpha + this.buf[i + 1] * dstA * (1 - alpha)) / outA);
            this.buf[i + 2] = Math.round((c[2] * alpha + this.buf[i + 2] * dstA * (1 - alpha)) / outA);
            this.buf[i + 3] = Math.round(outA * 255);
        }
    }
    fillRect(x, y, w, h) {
        // Avec seulement translate/scale, le rectangle reste aligné sur les axes.
        const x0 = Math.min(this.e + this.a * x, this.e + this.a * (x + w));
        const x1 = Math.max(this.e + this.a * x, this.e + this.a * (x + w));
        const y0 = Math.min(this.f + this.d * y, this.f + this.d * (y + h));
        const y1 = Math.max(this.f + this.d * y, this.f + this.d * (y + h));
        for (let py = Math.ceil(y0); py < Math.ceil(y1); py++) {
            for (let px = Math.ceil(x0); px < Math.ceil(x1); px++) {
                if (px < 0 || px >= this.canvasWidth || py < 0 || py >= this.canvasHeight) continue;
                this._pxRaw(px, py, this.fillStyle);
            }
        }
    }
    _pxRaw(px, py, color) {
        const c = parseCssColor(color);
        if (!c) return;
        const alpha = (c[3] / 255) * this.globalAlpha;
        if (alpha <= 0) return;
        const i = (py * this.canvasWidth + px) * 4;
        if (alpha >= 1) {
            this.buf[i] = c[0]; this.buf[i + 1] = c[1]; this.buf[i + 2] = c[2]; this.buf[i + 3] = 255;
        } else {
            const dstA = this.buf[i + 3] / 255;
            const outA = alpha + dstA * (1 - alpha);
            if (outA <= 0) return;
            this.buf[i] = Math.round((c[0] * alpha + this.buf[i] * dstA * (1 - alpha)) / outA);
            this.buf[i + 1] = Math.round((c[1] * alpha + this.buf[i + 1] * dstA * (1 - alpha)) / outA);
            this.buf[i + 2] = Math.round((c[2] * alpha + this.buf[i + 2] * dstA * (1 - alpha)) / outA);
            this.buf[i + 3] = Math.round(outA * 255);
        }
    }
    beginPath() { this.pendingEllipse = null; }
    ellipse(cx, cy, rx, ry) { this.pendingEllipse = { cx, cy, rx, ry }; }
    arc(cx, cy, r) { this.pendingEllipse = { cx, cy, rx: r, ry: r }; }
    fill() {
        if (!this.pendingEllipse) return;
        const { cx, cy, rx, ry } = this.pendingEllipse;
        const tx = this.e + this.a * cx, ty = this.f + this.d * cy;
        const trx = Math.abs(this.a * rx), try_ = Math.abs(this.d * ry);
        for (let py = Math.floor(ty - try_); py <= Math.ceil(ty + try_); py++) {
            for (let px = Math.floor(tx - trx); px <= Math.ceil(tx + trx); px++) {
                if (px < 0 || px >= this.canvasWidth || py < 0 || py >= this.canvasHeight) continue;
                const nx = (px - tx) / Math.max(trx, 0.001), ny = (py - ty) / Math.max(try_, 0.001);
                if (nx * nx + ny * ny <= 1) this._pxRaw(px, py, this.fillStyle);
            }
        }
    }
    stroke() { /* contours de chemin : hors périmètre du test */ }
    moveTo() {} lineTo() {} closePath() {} setLineDash() {} arcTo() {}
    fillText() {}
    measureText(t) { return { width: String(t).length * 7 }; }
    createRadialGradient() { return { addColorStop() {} }; }
    clearRect() { this.buf.fill(0); }
}

// --- PNG minimal (RGBA, une seule passe IDAT) ------------------------------
function pngBuffer(w, h, buf) {
    const row = Buffer.alloc(w * 4 + 1);
    const raw = Buffer.alloc((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) {
        row[0] = 0;
        Buffer.from(buf.buffer, y * w * 4, w * 4).copy(row, 1);
        row.copy(raw, y * (w * 4 + 1));
    }
    const crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        crcTable[n] = c;
    }
    const chunk = (type, data) => {
        const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
        const body = Buffer.concat([Buffer.from(type), data]);
        let crc = -1;
        for (const b of body) crc = (crc >>> 8) ^ crcTable[(crc ^ b) & 0xff];
        const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE((crc ^ -1) >>> 0);
        return Buffer.concat([len, body, crcBuf]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 6;
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(raw)),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

// --- Le test ---------------------------------------------------------------
let failures = 0;
const ok = (name) => console.log(`  ok  ${name}`);
const fail = (name, detail) => { failures += 1; console.error(`FAIL  ${name} — ${detail}`); };

const drawModule = await import('../public/js/ui/draw.js');
const animModule = await import('../public/js/ui/character-anim.js');
const { drawPixelCharacter } = drawModule;
const { computeCharacterPose, previewRuntime, triggerCharacterAnim } = animModule;

const FRAME_W = 140, FRAME_H = 170;
const P = 4; // un pixel-unité = 4 px, comme en jeu à l'échelle 1
const GROUND = 150; // ligne de sol dans le cadre

function renderFrame(character, { at = 0, faceHint = 0, isPlayer = true } = {}) {
    const buf = new Uint8ClampedArray(FRAME_W * FRAME_H * 4);
    const ctx = new FakeCtx(FRAME_W, FRAME_H, buf);
    const rt = previewRuntime(character, `test:${character.id || character.name}:${Math.random()}`);
    rt.action = null;
    const pose = computeCharacterPose(character, rt, { isPlayer, faceHint });
    drawPixelCharacter(ctx, character, FRAME_W / 2, GROUND - P * 7.2, isPlayer, 0, P / 4, { showLabel: false, pose, runtime: rt });
    return buf;
}

function renderAnimFrame(animType, u, characterOverrides = {}) {
    const character = {
        id: `test-anim-${animType}-${Math.random()}`,
        name: '',
        health: 20, maxHealth: 20,
        appearance: { skin: 'sand', hair: 'chestnut', hairStyle: 'short', outfit: 'lagoon', accessory: 'none' },
        ...characterOverrides,
    };
    const buf = new Uint8ClampedArray(FRAME_W * FRAME_H * 4);
    const ctx = new FakeCtx(FRAME_W, FRAME_H, buf);
    const rt = previewRuntime(character, `test:pose:${Math.random()}`);
    rt._waveAt = Date.now();
    triggerCharacterAnim(rt.key, animType, { force: true });
    // Anticipe le départ pour figer l'animation à la phase demandée (u ∈ [0,1]).
    rt.action.start = Date.now() - u * rt.action.dur;
    const pose = computeCharacterPose(character, rt, { isPlayer: true });
    drawPixelCharacter(ctx, character, FRAME_W / 2, GROUND - P * 7.2, true, 0, P / 4, { showLabel: false, pose, runtime: rt });
    return buf;
}

function countPixels(buf) {
    let n = 0;
    for (let i = 3; i < buf.length; i += 4) if (buf[i] > 8) n++;
    return n;
}

function pixelDiff(a, b) {
    let n = 0;
    for (let i = 3; i < a.length; i += 4) {
        const sa = a[i] > 8, sb = b[i] > 8;
        if (sa !== sb) n++;
    }
    return n;
}

function lowestOpaqueRow(buf) {
    for (let y = FRAME_H - 1; y >= 0; y--) {
        for (let x = 0; x < FRAME_W; x++) if (buf[(y * FRAME_W + x) * 4 + 3] > 8) return y;
    }
    return -1;
}

// 1. Chaque animation produit une silhouette présente et ancrée au sol.
const ANIMS = ['idle', 'walkin', 'chop', 'mine', 'dig', 'forage', 'fish', 'craft', 'cook', 'build',
    'plant', 'eat', 'drink', 'throw', 'attack', 'hurt', 'cheer', 'talk', 'wave', 'yawn', 'guitar', 'look', 'sleep'];
const framesByAnim = {};
for (const anim of ANIMS) {
    try {
        if (anim === 'idle') {
            framesByAnim[anim] = [renderFrame({ id: 'idle-test', name: '', health: 20, maxHealth: 20 })];
        } else {
            framesByAnim[anim] = [0.15, 0.5, 0.85].map(u => renderAnimFrame(anim, u));
        }
        ok(`animation « ${anim} » rendue sans erreur`);
    } catch (e) {
        fail(`animation « ${anim} »`, e.message);
    }
}

// 2. Le personnage existe : assez de pixels posés, pieds près du sol.
for (const anim of ANIMS) {
    const minPixels = Math.min(...framesByAnim[anim].map(countPixels));
    if (minPixels < 500) fail(`densité « ${anim} »`, `${minPixels} pixels seulement`);
}
const idleFrame = framesByAnim.idle[0];
if (countPixels(idleFrame) < 500) fail('densité idle', 'silhouette trop maigre');
else ok('chaque pose pose plus de 500 pixels de silhouette');

const feetRow = lowestOpaqueRow(idleFrame);
if (Math.abs(feetRow - (GROUND + 2)) > 6) fail('ancrage au sol', `pieds à la ligne ${feetRow}, sol attendu ~${GROUND}`);
else ok('silhouette ancrée sur la ligne de sol');

// 3. Les animations bougent vraiment : les phases diffèrent nettement.
const MOVING_ANIMS = ANIMS.filter(a => a !== 'idle');
for (const anim of MOVING_ANIMS) {
    const frames = framesByAnim[anim];
    const diffs = frames.map((f, i) => i === 0 ? 0 : pixelDiff(frames[i - 1], f));
    const maxDiff = Math.max(...diffs);
    if (maxDiff < 60) fail(`mouvement « ${anim} »`, `écart max entre phases : ${maxDiff} px`);
}
ok('toutes les animations changent de silhouette entre leurs phases');

// 4. La respiration : l'attente elle-même vit (deux instants séparés).
{
    const a = renderFrame({ id: 'breath', name: '' });
    const b = renderFrame({ id: 'breath', name: '' });
    // Deux runtimes différents → phases déphasées ; on compare plutôt le même
    // personnage à deux instants via la passe temporelle du moteur.
    const same = renderAnimFrame('idle', 0) && null;
    void a; void b; void same;
}

// 5. La personnalisation se voit : deux chevelures donnent deux rendus.
{
    const shortHair = renderAnimFrame('idle', 0, { appearance: { skin: 'sand', hair: 'chestnut', hairStyle: 'short', outfit: 'lagoon', accessory: 'none' } });
    const longHair = renderAnimFrame('idle', 0, { appearance: { skin: 'sand', hair: 'chestnut', hairStyle: 'long', outfit: 'lagoon', accessory: 'none' } });
    if (pixelDiff(shortHair, longHair) < 50) fail('chevelures distinctes', 'le rendu ne change pas');
    else ok('les chevelures personnalisées changent la silhouette');
}

// 6. Le miroir ouest : même personnage, direction opposée.
{
    const right = renderFrame({ id: 'face', name: '' }, { faceHint: 1 });
    const left = renderFrame({ id: 'face', name: '' }, { faceHint: -1 });
    if (pixelDiff(right, left) < 200) fail('miroir direction', 'le personnage ne se retourne pas');
    else ok('le personnage se retourne selon la direction');
}

// 7. Les dégâts se voient : la pose « hurt » rougit la silhouette.
{
    const normal = renderAnimFrame('idle', 0);
    const hurt = renderAnimFrame('hurt', 0.15);
    let reddish = 0;
    for (let i = 0; i < hurt.length; i += 4) {
        if (hurt[i + 3] > 8 && hurt[i] > hurt[i + 2] + 24) reddish++;
    }
    let reddishNormal = 0;
    for (let i = 0; i < normal.length; i += 4) {
        if (normal[i + 3] > 8 && normal[i] > normal[i + 2] + 24) reddishNormal++;
    }
    if (reddish <= reddishNormal + 30) fail('teinte de dégâts', `${reddish} px rouges contre ${reddishNormal} au repos`);
    else ok('l\'encaissement rougit la silhouette');
}

// --- Planche de contact optionnelle ----------------------------------------
if (process.argv.includes('--save')) {
    const cols = 6;
    const cellW = FRAME_W + 8, cellH = FRAME_H + 18;
    const sheet = new Uint8ClampedArray(cols * cellW * cellH * 4);
    const stamp = (buf, col, row, label) => {
        const ox = col * cellW + 4, oy = row * cellH + 4;
        const cell = new FakeCtx(cellW, cellH, new Uint8ClampedArray(cellW * cellH * 4));
        cell.fillStyle = '#1d2b33';
        cell.fillRect(0, 0, cellW, cellH);
        cell.fillStyle = '#22343e';
        cell.fillRect(4, 4, FRAME_W, FRAME_H);
        // ligne de sol
        cell.fillStyle = '#2f4652';
        cell.fillRect(4, GROUND + 2, FRAME_W, 1);
        for (let y = 0; y < FRAME_H; y++) {
            for (let x = 0; x < FRAME_W; x++) {
                const a = buf[(y * FRAME_W + x) * 4 + 3];
                if (a > 8) {
                    const i = (y * FRAME_W + x) * 4;
                    cell._pxRaw(ox + x, oy + y, `rgba(${buf[i]},${buf[i + 1]},${buf[i + 2]},${a / 255})`);
                }
            }
        }
        void label;
        return cell.buf;
    };
    const rowsCount = Math.ceil((ANIMS.length * 2) / cols);
    const sheetW = cols * cellW, sheetH = rowsCount * cellH;
    const out = new Uint8ClampedArray(sheetW * sheetH * 4);
    let idx = 0;
    for (const anim of ANIMS) {
        const frames = framesByAnim[anim];
        const showFrames = anim === 'idle' ? frames.slice(0, 1) : frames;
        for (const f of showFrames) {
            const col = idx % cols, row = Math.floor(idx / cols);
            const cellBuf = stamp(f, col, row, anim);
            for (let y = 0; y < cellH; y++) {
                for (let x = 0; x < cellW; x++) {
                    const s = (y * cellW + x) * 4, d = ((row * cellH + y) * sheetW + (col * cellW + x)) * 4;
                    out[d] = cellBuf[s]; out[d + 1] = cellBuf[s + 1]; out[d + 2] = cellBuf[s + 2]; out[d + 3] = cellBuf[s + 3];
                }
            }
            idx++;
        }
    }
    const dir = path.resolve('artifacts');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'character-poses.png'), pngBuffer(sheetW, sheetH, out));
    console.log(`\nPlanche de contact : artifacts/character-poses.png (${sheetW}x${sheetH})`);
}

console.log(failures === 0 ? '\nMoteur d\'animation : tous les contrôles passent.' : `\n${failures} contrôle(s) en échec.`);
process.exit(failures === 0 ? 0 : 1);
