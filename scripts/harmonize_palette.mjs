// scripts/harmonize_palette.mjs
// ---------------------------------------------------------------------------
// HARMONISATION DE LA PALETTE
//
// Le jeu a été repeint en « carnet de survie » (bois, cuir, parchemin) dans
// reference-ui.css, mais style.css et game-shell.css gardaient des centaines de
// teintes froides (sarcelle, bleu nuit, menthe) héritées de la version
// précédente. Résultat : deux palettes qui cohabitent à l'écran.
//
// Ce script convertit **uniquement les couleurs** (hex, rgb, rgba) :
//
//   1. froid de décor (sarcelle / bleu nuit / menthe pâle) -> bois & parchemin ;
//   2. vert menthe sémantique (réussite, gain) -> vert feuille chaud ;
//   3. bleus sémantiques (eau, soif, défense) -> conservés, mais resserrés
//      autour d'une seule teinte 190-210 au lieu de vingt bleus différents ;
//   4. les bruns, ors, rouges existants ne bougent pas.
//
// Les couleurs converties sont en plus quantifiées sur une échelle de clarté
// commune : l'interface utilise une rampe de bois cohérente plutôt que 250
// bruns tirés au hasard. La clarté d'origine est préservée, donc les contrastes
// (donc la lisibilité) le sont aussi.
//
// Usage : node scripts/harmonize_palette.mjs [--check]
// ---------------------------------------------------------------------------

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const FILES = [
    'public/style.css',
    'public/game-shell.css',
    'public/responsive.css',
];

// --- Couleurs sémantiques à ne jamais toucher ------------------------------
// Eau, soif, ciel, boutons « défendre » : le bleu reste la couleur de l'eau.
const KEEP = new Set([
    '#145b95', // océan de la scène mobile
    '#48cae4', '#a8dadc', '#9fe3ff', '#2b8fc7', '#4dd0e1', '#9fd6ff',
    '#55b8db', '#55bde2', '#6ccfe1', '#62c9e2', '#69bad0', '#7dd3fc',
    '#214b70', '#1e40af', // moitiés sombres du bouton « défendre »
    '#000', '#fff', '#ffffff', '#000000',
]);

// --- Couleurs froides « décor » que les règles génériques rateraient -------
const FORCE_WARM = new Set([
    '#b7e4d0',              // --shell-foam : menthe utilisée comme parchemin
    '#eff8ec',              // texte principal, blanc verdâtre
    '#e9f7f3', '#eaf6f4',   // fonds très clairs verdâtres
    '#9fd5c8', '#cce6e2', '#9ac2bf',
    'rgba(183,228,208',     // préfixe : toutes les variantes alpha de --shell-foam
    'rgba(196,230,221',
    'rgba(167,212,211',
    'rgba(220,241,239',
    'rgba(174,220,221',
    'rgba(185,222,223',
    'rgba(183,217,220',
    'rgba(120,214,202',
]);

// --- Conversions couleur ----------------------------------------------------
function hexToRgb(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex([r, g, b]) {
    return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const l = (mx + mn) / 2;
    let h = 0, s = 0;
    const d = mx - mn;
    if (d) {
        s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
        if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (mx === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
    }
    return [h, s * 100, l * 100];
}
function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let rgb;
    if (h < 60) rgb = [c, x, 0];
    else if (h < 120) rgb = [x, c, 0];
    else if (h < 180) rgb = [0, c, x];
    else if (h < 240) rgb = [0, x, c];
    else if (h < 300) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    return rgb.map((v) => Math.round((v + m) * 255));
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Échelle de clarté commune : une rampe de bois, pas 250 bruns au hasard.
const L_LADDER = [3, 6, 9, 12, 16, 20, 25, 30, 36, 43, 50, 57, 65, 73, 81, 88, 94, 97];
const snapL = (l) => L_LADDER.reduce((best, v) => (Math.abs(v - l) < Math.abs(best - l) ? v : best), L_LADDER[0]);

/** Bois / cuir / parchemin : la teinte se réchauffe avec la clarté. */
function toWarm(h, s, l) {
    const L = snapL(l);
    const hue = 9 + (L / 100) * 30;              // 9° (encre) -> 39° (parchemin)
    let sat;
    if (L < 25) sat = clamp(s * 0.45 + 6, 10, 38);
    else if (L < 70) sat = clamp(s * 0.5 + 10, 14, 46);
    else sat = clamp(s * 0.5 + 14, 18, 60);
    return hslToRgb(hue, sat, L);
}

/** Menthe / émeraude -> vert feuille, assorti au --shell-green du carnet. */
function toLeaf(h, s, l) {
    const L = snapL(l);
    const hue = 95 + ((h - 148) / 30) * 14;      // 95° -> 109°
    const sat = clamp(s * 0.8, 20, 58);
    return hslToRgb(hue, sat, L);
}

/** Les bleus restent bleus, mais tous dans la même famille 190-210°. */
function tightenBlue(h, s, l) {
    const hue = 198 + clamp(h - 198, -8, 12);
    return hslToRgb(hue, s, l);
}

function classify(h, s, l) {
    if (s <= 4) return l >= 88 || l <= 6 ? 'keep' : 'warm'; // gris neutres -> gris chauds
    if (h >= 148 && h <= 175 && ((s >= 35 && l <= 72) || s >= 50)) return 'leaf';
    if (h >= 148 && h <= 265) {
        const vividBlue = h >= 176 && s >= 50 && l >= 40 && l <= 88;
        return vividBlue ? 'blue' : 'warm';
    }
    return 'keep';
}

function convert(rgb, forced) {
    const [h, s, l] = rgbToHsl(...rgb);
    const kind = forced ? 'warm' : classify(h, s, l);
    switch (kind) {
        case 'warm': return { rgb: toWarm(h, s, l), kind };
        case 'leaf': return { rgb: toLeaf(h, s, l), kind };
        case 'blue': return { rgb: tightenBlue(h, s, l), kind };
        default: return { rgb, kind: 'keep' };
    }
}

// --- Réécriture des fichiers ------------------------------------------------
const COLOR_RE = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*[\d.]+\s*)?\)/g;

const check = process.argv.includes('--check');
const stats = { warm: 0, leaf: 0, blue: 0, keep: 0 };
let touchedFiles = 0;

for (const rel of FILES) {
    const abs = path.join(ROOT, rel);
    const src = fs.readFileSync(abs, 'utf8');
    const out = src.replace(COLOR_RE, (raw) => {
        const norm = raw.toLowerCase().replace(/\s+/g, '');
        if (KEEP.has(norm)) { stats.keep++; return raw; }

        const forced = [...FORCE_WARM].some((f) => norm === f || norm.startsWith(f + ','));

        let rgb, alpha = null;
        if (raw.startsWith('#')) {
            rgb = hexToRgb(norm);
        } else {
            const nums = norm.match(/[\d.]+/g).map(Number);
            rgb = [nums[0], nums[1], nums[2]];
            alpha = nums.length > 3 ? nums[3] : null;
        }

        const res = convert(rgb, forced);
        stats[res.kind]++;
        if (res.kind === 'keep') return raw;

        if (raw.startsWith('#')) return rgbToHex(res.rgb);
        const [r, g, b] = res.rgb;
        return alpha === null ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
    });

    if (out !== src) {
        touchedFiles++;
        if (!check) fs.writeFileSync(abs, out);
    }
}

console.log(`Harmonisation ${check ? '(simulation)' : 'appliquée'} sur ${touchedFiles} fichier(s).`);
console.log(`  bois/parchemin : ${stats.warm}`);
console.log(`  vert feuille   : ${stats.leaf}`);
console.log(`  bleus resserrés: ${stats.blue}`);
console.log(`  inchangées     : ${stats.keep}`);
