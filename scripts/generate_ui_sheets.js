// scripts/generate_ui_sheets.js
// Suite de la production d'assets : des PLANCHES (sprite sheets) pixel art
// destinées au HUD. Tout est généré en pixels RGBA, sans moteur graphique ni
// fichier source externe, exactement comme `generate_ui_assets.js`.
//
// Planches produites dans assets/ui/ :
//   sheet-timer.png        — décompte de la journée (sablier, phases, cadran, alerte)
//   sheet-interactions.png — marqueurs d'interaction affichés sur la scène
//   sheet-hud-icons.png    — petites icônes du HUD
//   sheets.json            — manifeste (taille des frames, nom des lignes)
//
// Lancement : npm run generate:sheets

import fs from 'fs';
import path from 'path';
import { PixelCanvas, PALETTE as C } from './lib/pixel-canvas.js';

const OUT = path.resolve('assets/ui');
fs.mkdirSync(OUT, { recursive: true });

const SAND = [238, 190, 104, 255];
const SAND_DARK = [199, 146, 66, 255];
const GLASS = [238, 224, 196, 110];
const WOOD = [142, 88, 44, 255];

/** Compose une planche à partir d'une grille de frames. */
function buildSheet({ frameW, frameH, rows, columns, draw }) {
    const sheet = new PixelCanvas(frameW * columns, frameH * rows.length);
    rows.forEach((rowName, row) => {
        for (let col = 0; col < columns; col++) {
            const cell = new PixelCanvas(frameW, frameH);
            draw(cell, rowName, col, columns);
            sheet.blit(cell, col * frameW, row * frameH);
        }
    });
    return sheet;
}

/* =====================================================================
   1. PLANCHE DU DÉCOMPTE DE LA JOURNÉE
   ===================================================================== */

// --- Ligne « hourglass » : 8 étapes d'écoulement du sable. ---
function drawHourglass(p, col, columns) {
    const t = col / (columns - 1);
    const bob = col % 2 === 0 ? 0 : 1;

    // Montants en bois + plateaux haut/bas.
    p.rect(5, 2 + bob, 22, 3, WOOD);
    p.rect(5, 27 + bob, 22, 3, WOOD);
    p.rect(5, 1 + bob, 22, 1, C.gold);
    p.rect(5, 30 + bob, 22, 1, C.goldDark);
    p.rect(5, 5 + bob, 2, 22, WOOD);
    p.rect(25, 5 + bob, 2, 22, WOOD);

    const top = 6 + bob, mid = 16 + bob, bottom = 26 + bob;
    const halfTop = 7.5, halfBottom = 7.5;
    const upper = [[16 - halfTop, top], [16 + halfTop, top], [16, mid]];
    const lower = [[16, mid], [16 + halfBottom, bottom], [16 - halfBottom, bottom]];

    // Verre.
    p.polygon(upper, GLASS);
    p.polygon(lower, GLASS);

    // Sable restant en haut : le niveau monte vers l'étranglement.
    const cut = top + (mid - top) * t;
    if (t < 0.995) {
        const k = (cut - top) / (mid - top);
        const half = halfTop * (1 - k);
        p.polygon([[16 - half, cut], [16 + half, cut], [16, mid]], SAND);
        p.line(16 - half, cut, 16 + half, cut, SAND_DARK, 1);
    }

    // Tas de sable en bas : un monticule qui grossit.
    if (t > 0.02) {
        const pileH = (bottom - mid) * t;
        const yTop = bottom - pileH;
        const half = halfBottom * (pileH / (bottom - mid));
        p.polygon([
            [16 - half, yTop], [16 + half, yTop],
            [16 + halfBottom, bottom], [16 - halfBottom, bottom],
        ], SAND);
        p.line(16 - half, yTop, 16 + half, yTop, [252, 216, 142, 255], 1);
    }

    // Filet de sable qui tombe.
    if (t > 0.03 && t < 0.97) {
        const grainY = mid + 1 + ((col * 3) % Math.max(1, bottom - mid - 2));
        p.rect(16, mid, 1, Math.max(1, bottom - 2 - mid), SAND_DARK);
        p.rect(15, grainY, 2, 2, [255, 229, 160, 255]);
    }

    // Contours pour garder des bords francs.
    p.line(16 - halfTop, top, 16, mid, C.foam, 1);
    p.line(16 + halfTop, top, 16, mid, C.foam, 1);
    p.line(16, mid, 16 - halfBottom, bottom, C.foam, 1);
    p.line(16, mid, 16 + halfBottom, bottom, C.foam, 1);
}

// --- Ligne « phase » : aube, jour, crépuscule, nuit (2 frames chacune). ---
function drawPhase(p, col) {
    const phase = Math.floor(col / 2);   // 0 aube · 1 jour · 2 crépuscule · 3 nuit
    const wobble = col % 2;
    const skies = [
        [[62, 42, 72, 255], [214, 118, 86, 255]],   // aube
        [[52, 124, 166, 255], [138, 205, 228, 255]], // jour
        [[86, 40, 58, 255], [226, 118, 62, 255]],   // crépuscule
        [[26, 24, 48, 255], [62, 68, 120, 255]],    // nuit
    ];
    const [skyTop, skyBottom] = skies[phase];

    p.rect(2, 2, 28, 20, skyTop);
    p.rect(2, 12, 28, 10, skyBottom);
    p.dither(2, 8, 28, 8, skyBottom, 0.5);

    if (phase === 3) {
        // Lune + étoiles scintillantes.
        p.circle(19, 11, 6, [236, 240, 210, 255]);
        p.circle(16, 9, 6, skyTop);
        [[6, 6], [11, 14], [26, 7], [23, 17], [8, 18]].forEach(([sx, sy], i) => {
            if ((i + wobble) % 2 === 0) p.rect(sx, sy, 1, 1, C.white);
            else p.rect(sx, sy, 2, 1, [226, 219, 206, 255]);
        });
    } else {
        const positions = [[9, 16], [16, 8], [23, 16]];
        const colors = [[255, 186, 104, 255], [255, 226, 130, 255], [243, 126, 70, 255]];
        const [sx, sy] = positions[phase];
        const sun = colors[phase];
        p.circle(sx, sy - wobble, 5, sun);
        p.circle(sx, sy - wobble, 3, [255, 246, 198, 255]);
        // Rayons en gros pixels.
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + wobble * 0.2;
            p.rect(Math.round(sx + Math.cos(a) * 7), Math.round(sy - wobble + Math.sin(a) * 7), 2, 2, sun);
        }
    }

    // Horizon + mer pixelisée.
    p.rect(2, 22, 28, 2, [32, 86, 114, 255]);
    p.rect(2, 24, 28, 6, [46, 120, 156, 255]);
    for (let x = 3; x < 29; x += 4) {
        p.rect(x + (wobble ? 1 : 0), 26, 2, 1, [126, 198, 224, 255]);
    }
    p.frame(1, 1, 30, 30, C.ink, 1);
}

// --- Ligne « dial » : cadran circulaire rempli de 1/8 à 8/8. ---
function drawDial(p, col, columns) {
    const filled = (col + 1) / columns;
    p.circle(16, 16, 14, C.ink);
    p.ring(16, 16, 14, 11, C.deep);
    p.arc(16, 16, 14, 11, 0, filled, filled > 0.75 ? C.coral : C.gold);
    p.ring(16, 16, 11, 10, C.teal);
    p.circle(16, 16, 9, [46, 30, 26, 255]);
    // Aiguille.
    const a = filled * Math.PI * 2;
    p.line(16, 16, 16 + Math.sin(a) * 7, 16 - Math.cos(a) * 7, C.white, 2);
    p.rect(15, 15, 2, 2, C.gold);
    // Graduations aux quarts.
    [0, 0.25, 0.5, 0.75].forEach(q => {
        const ang = q * Math.PI * 2;
        p.rect(Math.round(16 + Math.sin(ang) * 12.5) - 1, Math.round(16 - Math.cos(ang) * 12.5) - 1, 2, 2, C.foam);
    });
}

// --- Ligne « urgent » : réveil qui sonne (dernières secondes du jour). ---
function drawUrgent(p, col) {
    const shake = [0, 1, 0, -1, 0, 1, 0, -1][col % 8];
    const bright = col % 2 === 0;
    const body = bright ? C.coral : [190, 68, 52, 255];
    const x = 16 + shake;

    // Cloches.
    p.circle(x - 8, 7, 4, C.goldDark);
    p.circle(x + 8, 7, 4, C.goldDark);
    p.rect(x - 1, 4, 2, 4, C.goldDark);

    p.circle(x, 18, 12, C.ink);
    p.circle(x, 18, 11, body);
    p.circle(x, 18, 8, [255, 240, 196, 255]);
    // Aiguilles d'un temps presque écoulé.
    p.line(x, 18, x, 12, C.ink, 2);
    p.line(x, 18, x + (bright ? 5 : 4), 20, C.ink, 2);
    p.rect(x - 1, 17, 2, 2, C.coral);
    // Pieds.
    p.rect(x - 9, 28, 4, 3, C.goldDark);
    p.rect(x + 5, 28, 4, 3, C.goldDark);
    // Ondes sonores quand ça sonne.
    if (bright) {
        p.line(x - 14, 3, x - 11, 6, C.gold, 2);
        p.line(x + 14, 3, x + 11, 6, C.gold, 2);
    }
}

function timerSheet() {
    return buildSheet({
        frameW: 32,
        frameH: 32,
        columns: 8,
        rows: ['hourglass', 'phase', 'dial', 'urgent'],
        draw: (cell, rowName, col, columns) => {
            if (rowName === 'hourglass') drawHourglass(cell, col, columns);
            else if (rowName === 'phase') drawPhase(cell, col);
            else if (rowName === 'dial') drawDial(cell, col, columns);
            else drawUrgent(cell, col);
        },
    });
}

/* =====================================================================
   2. PLANCHE DES MARQUEURS D'INTERACTION
   ===================================================================== */

function drawFocus(p, col, columns) {
    // Réticule de sélection : les quatre équerres respirent vers l'extérieur.
    const t = col / (columns - 1);
    const spread = Math.round(Math.sin(t * Math.PI) * 3);
    const m = 3 + spread;
    const len = 8;
    const color = C.gold;
    const corners = [
        [m, m, 1, 1], [32 - m, m, -1, 1],
        [m, 32 - m, 1, -1], [32 - m, 32 - m, -1, -1],
    ];
    corners.forEach(([cx, cy, sx, sy]) => {
        for (let i = 0; i < len; i++) {
            p.rect(cx + sx * i - (sx < 0 ? 1 : 0), cy - (sy < 0 ? 1 : 0), 1, 2, color);
            p.rect(cx - (sx < 0 ? 1 : 0), cy + sy * i - (sy < 0 ? 1 : 0), 2, 1, color);
        }
    });
    p.rect(15, 15, 2, 2, C.white);
}

function drawAlert(p, col, columns) {
    // Le rebond reste dans la cellule : le triangle ne doit jamais être rogné.
    const bob = Math.round(Math.sin((col / columns) * Math.PI * 2) * 2);
    const y = Math.max(3, Math.min(9, 6 + bob));
    p.polygon([[16, y - 2], [29, y + 20], [3, y + 20]], C.ink);
    p.polygon([[16, y], [27, y + 19], [5, y + 19]], col % 2 ? [255, 214, 120, 255] : C.gold);
    p.rect(15, y + 6, 3, 8, [60, 32, 12, 255]);
    p.rect(15, y + 15, 3, 3, [60, 32, 12, 255]);
}

function drawLoot(p, col, columns) {
    const t = col / columns;
    const grow = 6 + Math.round(Math.sin(t * Math.PI * 2) * 3);
    p.polygon([
        [16, 16 - grow - 3], [16 + 3, 16 - 3], [16 + grow + 3, 16],
        [16 + 3, 16 + 3], [16, 16 + grow + 3], [16 - 3, 16 + 3],
        [16 - grow - 3, 16], [16 - 3, 16 - 3],
    ], C.gold);
    p.polygon([
        [16, 16 - grow + 2], [16 + 2, 16 - 2], [16 + grow - 2, 16],
        [16 + 2, 16 + 2], [16, 16 + grow - 2], [16 - 2, 16 + 2],
        [16 - grow + 2, 16], [16 - 2, 16 - 2],
    ], C.white);
    const minis = [[5, 7], [26, 9], [7, 25], [24, 24]];
    minis.forEach(([mx, my], i) => {
        if ((i + col) % 3 === 0) return;
        p.rect(mx - 1, my, 3, 1, C.gold);
        p.rect(mx, my - 1, 1, 3, C.gold);
    });
}

function drawDanger(p, col, columns) {
    const pulse = col / columns;
    const halo = Math.round(11 + Math.sin(pulse * Math.PI * 2) * 2);
    p.circle(16, 16, halo, [226, 94, 73, 60]);
    // Crâne stylisé.
    p.circle(16, 14, 8, [238, 232, 212, 255]);
    p.rect(9, 14, 14, 6, [238, 232, 212, 255]);
    p.rect(11, 20, 10, 4, [238, 232, 212, 255]);
    p.rect(11, 12, 4, 4, C.ink);
    p.rect(17, 12, 4, 4, C.ink);
    if (col % 2 === 0) { p.rect(12, 13, 2, 2, C.coral); p.rect(18, 13, 2, 2, C.coral); }
    p.rect(15, 18, 2, 2, C.ink);
    p.rect(12, 21, 2, 3, C.ink);
    p.rect(15, 21, 2, 3, C.ink);
    p.rect(18, 21, 2, 3, C.ink);
}

function drawTalk(p, col, columns) {
    const bob = Math.round(Math.sin((col / columns) * Math.PI * 2) * 1.5);
    p.rect(3, 5 + bob, 26, 16, C.ink);
    p.rect(4, 6 + bob, 24, 14, C.teal);
    p.rect(5, 7 + bob, 22, 3, C.sea);
    p.polygon([[10, 21 + bob], [18, 21 + bob], [11, 27 + bob]], C.teal);
    // Trois points qui s'allument l'un après l'autre.
    for (let i = 0; i < 3; i++) {
        const on = (col % 3) >= i;
        p.rect(9 + i * 6, 12 + bob, 4, 4, on ? C.gold : C.deep);
    }
}

function drawBuild(p, col, columns) {
    // Marteau qui frappe : rotation simulée en quatre poses.
    const swing = Math.sin((col / columns) * Math.PI * 2);
    const lift = Math.round(swing * 4);
    const tilt = Math.round(swing * 3);
    p.line(10 - tilt, 26, 20 + tilt, 10 - lift, WOOD, 3);
    p.rect(17 + tilt, 5 - lift, 11, 8, [158, 152, 138, 255]);
    p.rect(17 + tilt, 5 - lift, 11, 3, [204, 196, 178, 255]);
    p.rect(14 + tilt, 6 - lift, 4, 6, [122, 114, 102, 255]);
    p.frame(17 + tilt, 5 - lift, 11, 8, C.ink, 1);
    // Étincelles au point d'impact.
    if (swing > 0.6) {
        p.rect(8, 27, 3, 1, C.gold);
        p.rect(6, 25, 2, 2, C.gold);
        p.rect(12, 24, 2, 2, C.white);
    }
}

function interactionsSheet() {
    return buildSheet({
        frameW: 32,
        frameH: 32,
        columns: 6,
        rows: ['focus', 'alert', 'loot', 'danger', 'talk', 'build'],
        draw: (cell, rowName, col, columns) => {
            const painters = {
                focus: drawFocus, alert: drawAlert, loot: drawLoot,
                danger: drawDanger, talk: drawTalk, build: drawBuild,
            };
            painters[rowName](cell, col, columns);
        },
    });
}

/* =====================================================================
   3. PLANCHE D'ICÔNES DU HUD (24 × 24)
   ===================================================================== */

const HUD_ICONS = [
    'sun', 'moon', 'hourglass', 'clock',
    'heart', 'drop', 'meat', 'sleep',
    'compass', 'map', 'bag', 'sword',
    'hammer', 'chat', 'star', 'layout',
];

function drawHudIcon(p, name) {
    const ink = C.ink;
    switch (name) {
        case 'sun':
            p.circle(12, 12, 6, C.gold);
            p.circle(12, 12, 4, [255, 243, 193, 255]);
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                p.rect(Math.round(12 + Math.cos(a) * 9) - 1, Math.round(12 + Math.sin(a) * 9) - 1, 2, 2, C.gold);
            }
            break;
        case 'moon':
            p.circle(13, 12, 8, [226, 234, 206, 255]);
            p.circle(9, 10, 7, [0, 0, 0, 0]);
            p.circle(9, 10, 7, C.transparent);
            // Découpe du croissant : on repeint le fond en transparent manuellement.
            for (let y = 0; y < 24; y++) {
                for (let x = 0; x < 24; x++) {
                    if ((x - 9) ** 2 + (y - 10) ** 2 <= 49) {
                        const i = (y * 24 + x) * 4;
                        p.data[i + 3] = 0;
                    }
                }
            }
            p.rect(18, 4, 2, 2, C.white);
            p.rect(4, 17, 2, 2, C.white);
            break;
        case 'hourglass':
            p.rect(5, 3, 14, 2, C.gold);
            p.rect(5, 19, 14, 2, C.gold);
            p.polygon([[6, 5], [18, 5], [12, 12]], SAND);
            p.polygon([[12, 12], [18, 19], [6, 19]], GLASS);
            p.polygon([[12, 15], [16, 19], [8, 19]], SAND);
            p.rect(11, 12, 2, 3, SAND_DARK);
            break;
        case 'clock':
            p.circle(12, 12, 10, ink);
            p.circle(12, 12, 9, C.foam);
            p.circle(12, 12, 7, C.deep);
            p.line(12, 12, 12, 6, C.gold, 2);
            p.line(12, 12, 16, 14, C.gold, 2);
            break;
        case 'heart':
            p.circle(8, 9, 4, C.coral);
            p.circle(15, 9, 4, C.coral);
            p.polygon([[4, 10], [20, 10], [12, 21]], C.coral);
            p.rect(7, 6, 2, 2, [255, 170, 150, 255]);
            break;
        case 'drop':
            p.polygon([[12, 2], [19, 13], [5, 13]], C.blue);
            p.circle(12, 14, 7, C.blue);
            p.rect(8, 11, 2, 3, [206, 238, 248, 255]);
            break;
        case 'meat':
            p.circle(13, 11, 7, [196, 96, 72, 255]);
            p.circle(13, 11, 4, [226, 134, 104, 255]);
            p.line(8, 15, 3, 21, [238, 232, 206, 255], 4);
            p.circle(3, 21, 2, [238, 232, 206, 255]);
            break;
        case 'sleep':
            p.rect(4, 5, 9, 2, C.foam); p.line(13, 5, 4, 12, C.foam, 2); p.rect(4, 11, 9, 2, C.foam);
            p.rect(12, 13, 7, 2, C.gold); p.line(19, 13, 12, 19, C.gold, 2); p.rect(12, 18, 7, 2, C.gold);
            break;
        case 'compass':
            p.circle(12, 12, 10, ink);
            p.circle(12, 12, 9, C.gold);
            p.circle(12, 12, 7, C.deep);
            p.polygon([[12, 4], [15, 12], [12, 10], [9, 12]], C.white);
            p.polygon([[12, 20], [9, 12], [12, 14], [15, 12]], C.coral);
            break;
        case 'map':
            p.polygon([[2, 5], [9, 3], [15, 6], [22, 4], [22, 19], [15, 21], [9, 18], [2, 20]], [206, 182, 128, 255]);
            p.line(9, 3, 9, 18, [146, 120, 76, 255], 1);
            p.line(15, 6, 15, 21, [146, 120, 76, 255], 1);
            p.rect(17, 9, 3, 3, C.coral);
            p.line(5, 10, 8, 14, [146, 120, 76, 255], 1);
            break;
        case 'bag':
            p.rect(5, 7, 14, 14, [150, 100, 54, 255]);
            p.rect(5, 7, 14, 4, [184, 128, 70, 255]);
            p.line(9, 7, 9, 3, [150, 100, 54, 255], 2);
            p.line(15, 7, 15, 3, [150, 100, 54, 255], 2);
            p.rect(9, 3, 7, 2, [150, 100, 54, 255]);
            p.rect(10, 13, 4, 5, C.gold);
            break;
        case 'sword':
            p.polygon([[13, 2], [17, 6], [9, 16], [6, 13]], [206, 200, 184, 255]);
            p.polygon([[13, 3], [15, 5], [9, 14], [8, 12]], [246, 240, 224, 255]);
            p.line(4, 15, 10, 21, C.goldDark, 4);
            p.line(3, 19, 8, 14, C.gold, 2);
            break;
        case 'hammer':
            p.line(6, 20, 15, 10, WOOD, 3);
            p.rect(12, 3, 9, 7, [158, 152, 138, 255]);
            p.rect(12, 3, 9, 2, [204, 196, 178, 255]);
            p.rect(9, 4, 4, 5, [122, 114, 102, 255]);
            break;
        case 'chat':
            p.rect(2, 4, 20, 13, C.ink);
            p.rect(3, 5, 18, 11, C.teal);
            p.polygon([[7, 17], [14, 17], [8, 22]], C.teal);
            p.rect(6, 9, 3, 3, C.gold);
            p.rect(11, 9, 3, 3, C.gold);
            p.rect(16, 9, 3, 3, C.gold);
            break;
        case 'star':
            p.polygon([[12, 2], [15, 9], [22, 9], [16, 14], [19, 21], [12, 17], [5, 21], [8, 14], [2, 9], [9, 9]], C.gold);
            p.polygon([[12, 6], [14, 10], [18, 10], [14, 13], [16, 18], [12, 15], [8, 18], [10, 13], [6, 10], [10, 10]], [255, 240, 186, 255]);
            break;
        case 'layout':
            p.frame(2, 3, 20, 18, C.foam, 2);
            p.rect(4, 5, 5, 14, C.gold);
            p.rect(10, 5, 11, 7, C.sea);
            p.rect(10, 13, 11, 6, C.teal);
            break;
        default:
            p.frame(3, 3, 18, 18, C.foam, 2);
    }
}

function hudIconsSheet() {
    return buildSheet({
        frameW: 24,
        frameH: 24,
        columns: 8,
        rows: ['a', 'b'],
        draw: (cell, rowName, col) => {
            const index = (rowName === 'a' ? 0 : 8) + col;
            drawHudIcon(cell, HUD_ICONS[index]);
        },
    });
}

/* =====================================================================
   ÉCRITURE
   ===================================================================== */

timerSheet().save(path.join(OUT, 'sheet-timer.png'));
interactionsSheet().save(path.join(OUT, 'sheet-interactions.png'));
hudIconsSheet().save(path.join(OUT, 'sheet-hud-icons.png'));

const manifest = {
    generatedBy: 'scripts/generate_ui_sheets.js',
    sheets: {
        timer: {
            file: 'assets/ui/sheet-timer.png',
            frameW: 32, frameH: 32, columns: 8,
            rows: { hourglass: 0, phase: 1, dial: 2, urgent: 3 },
            notes: 'phase : 2 frames par moment de la journée (aube, jour, crépuscule, nuit).',
        },
        interactions: {
            file: 'assets/ui/sheet-interactions.png',
            frameW: 32, frameH: 32, columns: 6,
            rows: { focus: 0, alert: 1, loot: 2, danger: 3, talk: 4, build: 5 },
        },
        hudIcons: {
            file: 'assets/ui/sheet-hud-icons.png',
            frameW: 24, frameH: 24, columns: 8,
            icons: HUD_ICONS,
        },
    },
};
fs.writeFileSync(path.join(OUT, 'sheets.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`UI pixel art: ${path.join(OUT, 'sheets.json')}`);
