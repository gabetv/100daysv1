// scripts/generate_navigation_sheet.js
// ---------------------------------------------------------------------------
// PIXEL ART DE NAVIGATION ET D'HABILLAGE
//
// Produit dans assets/ui/ :
//   sheet-dpad.png        — 8 directions x 3 états (libre / bloqué / enfoncé)
//   panel-parchment.png   — carte en parchemin, 9-slice (bordure 15)
//   button-wood.png       — bouton bois, 9-slice (bordure 14)
//   dpad-plate.png        — plaque de pierre posée sous les neuf touches
//   navigation.json       — manifeste des planches
//
// L'état « bloqué » est le pendant visuel de la règle serveur
// `movePlayer()` : hors carte ou case non `accessible`. La touche devient
// pierre éteinte et la flèche grise — on voit d'un coup d'œil où l'on peut
// aller, sans avoir à cogner contre le décor.
//
// Lancement : npm run generate:nav
// ---------------------------------------------------------------------------

import fs from 'fs';
import path from 'path';
import { PixelCanvas, PALETTE as C } from './lib/pixel-canvas.js';

const OUT = path.resolve('assets/ui');
fs.mkdirSync(OUT, { recursive: true });

const FRAME = 48;
const DIRECTIONS = ['north', 'ne', 'east', 'se', 'south', 'sw', 'west', 'nw'];
const STATES = ['idle', 'blocked', 'active'];

/** Efface une zone (les coins taillés des touches). */
function clearRect(p, x, y, w, h) {
    for (let py = y; py < y + h; py++) {
        for (let px = x; px < x + w; px++) {
            if (px < 0 || py < 0 || px >= p.width || py >= p.height) continue;
            const i = (py * p.width + px) * 4;
            p.data[i] = p.data[i + 1] = p.data[i + 2] = p.data[i + 3] = 0;
        }
    }
}

/** Coins taillés en escalier : la silhouette « touche de console ». */
function bevelCorners(p, x, y, w, h, cut = 3) {
    for (let i = 0; i < cut; i++) {
        const run = cut - i;
        clearRect(p, x, y + i, run, 1);
        clearRect(p, x + w - run, y + i, run, 1);
        clearRect(p, x, y + h - 1 - i, run, 1);
        clearRect(p, x + w - run, y + h - 1 - i, run, 1);
    }
}

const SKINS = {
    idle: {
        edge: [52, 40, 33, 255],
        face: [138, 128, 112, 255],
        light: [196, 183, 158, 255],
        dark: [92, 84, 74, 255],
        rivet: [232, 214, 178, 255],
        arrow: [248, 225, 175, 255],
        arrowEdge: [58, 42, 32, 255],
        arrowLight: [255, 244, 212, 255],
    },
    // Chemin impossible : pierre éteinte, flèche grise, aucun reflet.
    blocked: {
        edge: [44, 36, 32, 255],
        face: [84, 78, 72, 255],
        light: [102, 95, 87, 255],
        dark: [62, 57, 52, 255],
        rivet: [108, 100, 92, 255],
        arrow: [124, 116, 106, 255],
        arrowEdge: [48, 43, 39, 255],
        arrowLight: [138, 129, 118, 255],
    },
    // Touche enfoncée : la lumière passe sous la flèche.
    active: {
        edge: [52, 40, 33, 255],
        face: [172, 122, 72, 255],
        light: [226, 177, 112, 255],
        dark: [120, 78, 46, 255],
        rivet: [255, 238, 196, 255],
        arrow: [255, 246, 214, 255],
        arrowEdge: [74, 44, 28, 255],
        arrowLight: [255, 255, 240, 255],
    },
};

/** Flèche pointant vers le haut, exprimée autour de (0, 0). */
const ARROW = [[0, -12], [10, -1], [4.5, -1], [4.5, 11], [-4.5, 11], [-4.5, -1], [-10, -1]];

function rotate(points, turns, cx, cy, scale = 1) {
    const a = turns * Math.PI * 2;
    const cos = Math.cos(a), sin = Math.sin(a);
    return points.map(([x, y]) => [
        cx + (x * cos - y * sin) * scale,
        cy + (x * sin + y * cos) * scale,
    ]);
}

function navKey(dirIndex, state) {
    const p = new PixelCanvas(FRAME, FRAME);
    const skin = SKINS[state];
    const pressed = state === 'active';
    const top = pressed ? 2 : 0;          // la touche s'enfonce de 2 px
    const depth = pressed ? 1 : 3;        // épaisseur du relief

    // Ombre portée (disparaît quand la touche est enfoncée).
    if (!pressed) {
        p.rect(4, 7, 42, 39, [26, 15, 12, 150]);
        bevelCorners(p, 4, 7, 42, 39, 3);
    }

    // Contour sombre.
    p.rect(2, 2 + top, 44, 42, skin.edge);
    bevelCorners(p, 2, 2 + top, 44, 42, 4);

    // Face.
    p.rect(4, 4 + top, 40, 38, skin.face);
    bevelCorners(p, 4, 4 + top, 40, 38, 3);

    // Relief : lumière en haut à gauche, ombre en bas à droite.
    p.rect(5, 5 + top, 38, 2, skin.light);
    p.rect(5, 5 + top, 2, 36, skin.light);
    p.rect(5, 40 + top - depth, 38, depth, skin.dark);
    p.rect(41, 7 + top, 2, 33, skin.dark);

    // Grain de pierre : quelques éclats pour éviter l'aplat plastique.
    if (state !== 'blocked') {
        p.dither(8, 9 + top, 32, 28, [255, 255, 255, 18], 0.18);
    }
    p.dither(8, 26 + top, 32, 12, [0, 0, 0, 20], 0.16);

    // Clous d'angle.
    [[7, 7], [37, 7], [7, 35], [37, 35]].forEach(([x, y]) => {
        p.rect(x, y + top, 3, 3, skin.edge);
        p.rect(x + 1, y + 1 + top, 1, 1, skin.rivet);
    });

    // Flèche.
    const cx = 24, cy = 23 + top;
    const turns = dirIndex / 8;
    const diagonal = dirIndex % 2 === 1;
    const scale = diagonal ? 0.82 : 0.92;
    const shape = rotate(ARROW, turns, cx, cy, scale);
    p.polygon(rotate(ARROW, turns, cx, cy + 2, scale), skin.arrowEdge);
    p.polygon(shape, skin.arrow);
    // Liseré clair sur la pointe.
    const tip = rotate([[0, -11], [4, -6.5], [-4, -6.5]], turns, cx, cy, scale);
    p.polygon(tip, skin.arrowLight);

    return p;
}

function dpadSheet() {
    const sheet = new PixelCanvas(FRAME * DIRECTIONS.length, FRAME * STATES.length);
    STATES.forEach((state, row) => {
        DIRECTIONS.forEach((_, col) => {
            sheet.blit(navKey(col, state), col * FRAME, row * FRAME);
        });
    });
    return sheet;
}

/** Plaque de pierre posée sous les neuf touches (9-slice, bordure 18). */
function dpadPlate() {
    const S = 72;
    const p = new PixelCanvas(S, S);
    p.rect(3, 5, S - 6, S - 6, [26, 15, 12, 170]);
    p.rect(0, 0, S, S - 2, [45, 35, 30, 255]);
    bevelCorners(p, 0, 0, S, S - 2, 6);
    p.rect(3, 3, S - 6, S - 8, [118, 109, 95, 255]);
    bevelCorners(p, 3, 3, S - 6, S - 8, 5);
    p.rect(6, 6, S - 12, S - 14, [86, 79, 69, 255]);
    bevelCorners(p, 6, 6, S - 12, S - 14, 4);
    p.rect(6, 6, S - 12, 2, [168, 156, 134, 255]);
    p.rect(6, 6, 2, S - 14, [168, 156, 134, 255]);
    p.dither(8, 8, S - 16, S - 18, [0, 0, 0, 26], 0.22);
    // Clous.
    [[9, 9], [S - 13, 9], [9, S - 17], [S - 13, S - 17]].forEach(([x, y]) => {
        p.rect(x, y, 4, 4, [45, 35, 30, 255]);
        p.rect(x + 1, y + 1, 2, 2, [214, 196, 162, 255]);
    });
    return p;
}

/** Carte en parchemin, 9-slice bordure 15 — pour les cartouches du HUD. */
function panelParchment() {
    const S = 48;
    const p = new PixelCanvas(S, S);
    p.rect(3, 4, S - 5, S - 5, [26, 15, 12, 160]);
    p.rect(0, 0, S - 2, S - 2, C.ink);
    bevelCorners(p, 0, 0, S - 2, S - 2, 3);
    p.rect(2, 2, S - 6, S - 6, C.goldDark);
    p.rect(4, 4, S - 10, S - 10, C.parchment);
    // Fibres du papier + ombre interne en bas.
    p.dither(4, 4, S - 10, S - 10, [255, 247, 224, 120], 0.28);
    p.dither(4, S - 12, S - 10, 6, [150, 116, 76, 70], 0.4);
    p.rect(4, 4, S - 10, 1, [250, 238, 212, 255]);
    // Coins renforcés façon ruban de cuir.
    [[0, 0], [S - 12, 0], [0, S - 14], [S - 12, S - 14]].forEach(([x, y]) => {
        p.rect(x, y, 10, 10, C.ink);
        p.rect(x + 2, y + 2, 6, 6, C.sea);
        p.rect(x + 3, y + 3, 3, 3, C.gold);
    });
    return p;
}

/** Bouton bois, 9-slice bordure 14 — pour les boutons d'action. */
function buttonWood() {
    const p = new PixelCanvas(96, 48);
    p.rect(3, 6, 90, 40, [26, 15, 12, 170]);
    p.rect(0, 2, 96, 42, C.ink);
    p.rect(2, 0, 92, 44, C.goldDark);
    p.rect(4, 2, 88, 40, C.deep);
    p.rect(6, 4, 84, 34, C.panel);
    p.rect(8, 6, 80, 28, C.sea);
    p.rect(8, 6, 80, 3, [176, 115, 76, 255]);
    p.rect(8, 31, 80, 3, [84, 48, 32, 255]);
    // Veines du bois.
    for (let y = 11; y < 31; y += 5) p.dither(10, y, 76, 2, [60, 34, 22, 60], 0.45);
    [[4, 4], [85, 4], [4, 31], [85, 31]].forEach(([x, y]) => {
        p.rect(x, y, 7, 7, C.ink);
        p.rect(x + 2, y + 2, 3, 3, C.gold);
    });
    return p;
}

dpadSheet().save(path.join(OUT, 'sheet-dpad.png'));
dpadPlate().save(path.join(OUT, 'dpad-plate.png'));
panelParchment().save(path.join(OUT, 'panel-parchment.png'));
buttonWood().save(path.join(OUT, 'button-wood.png'));

fs.writeFileSync(path.join(OUT, 'navigation.json'), JSON.stringify({
    generatedBy: 'scripts/generate_navigation_sheet.js',
    dpad: {
        file: 'assets/ui/sheet-dpad.png',
        frameW: FRAME,
        frameH: FRAME,
        columns: DIRECTIONS,
        rows: STATES,
        notes: "La ligne « blocked » est affichée quand la case visée sort de la carte ou n'est pas accessible.",
    },
    nineSlices: {
        'dpad-plate.png': { border: 18 },
        'panel-parchment.png': { border: 15 },
        'button-wood.png': { border: 14 },
    },
}, null, 2) + '\n');
console.log('UI pixel art: assets/ui/navigation.json');
