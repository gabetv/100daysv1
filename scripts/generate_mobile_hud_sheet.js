// Planche compacte du HUD mobile inspirée de la maquette de référence.
// Deux rangées de 8 cellules : jauges/actions puis navigation principale.
// Le regroupement évite de charger seize petits PNG indépendants.
import fs from 'fs';
import path from 'path';
import { PixelCanvas } from './lib/pixel-canvas.js';

const OUT = path.resolve('assets/ui');
const CELL = 48;
const COLUMNS = 8;
const ROWS = 2;
fs.mkdirSync(OUT, { recursive: true });

const C = {
    ink: [42, 27, 24, 255],
    outline: [77, 47, 34, 255],
    wood: [111, 66, 43, 255],
    leather: [139, 85, 55, 255],
    parchment: [225, 197, 152, 255],
    parchmentLight: [247, 226, 181, 255],
    gold: [234, 190, 91, 255],
    goldDark: [164, 111, 47, 255],
    red: [226, 62, 67, 255],
    redDark: [141, 42, 44, 255],
    blue: [79, 184, 224, 255],
    blueDark: [37, 106, 157, 255],
    orange: [218, 131, 58, 255],
    yellow: [249, 222, 91, 255],
    green: [72, 142, 73, 255],
    greenLight: [124, 190, 87, 255],
    steel: [178, 172, 156, 255],
    steelDark: [98, 92, 82, 255],
    white: [255, 244, 210, 255],
    shadow: [18, 13, 14, 145],
};

function iconShadow(p) {
    p.rect(9, 38, 30, 3, C.shadow);
    p.rect(13, 41, 22, 2, C.shadow);
}

function outlinePolygon(p, outer, inner, outerColor, innerColor) {
    p.polygon(outer, outerColor);
    p.polygon(inner, innerColor);
}

function drawHeart(p, badge = false) {
    if (badge) {
        p.circle(24, 24, 21, C.ink);
        p.circle(24, 23, 18, C.gold);
        p.circle(24, 23, 15, C.parchment);
    } else iconShadow(p);
    outlinePolygon(p,
        [[7, 16], [11, 9], [18, 7], [24, 12], [30, 7], [38, 9], [42, 16], [40, 25], [24, 41], [8, 25]],
        [[10, 16], [13, 11], [18, 10], [24, 16], [30, 10], [36, 11], [39, 16], [37, 23], [24, 37], [11, 23]],
        C.ink, C.red,
    );
    p.polygon([[13, 14], [18, 12], [22, 16], [17, 18], [14, 21], [11, 18]], [255, 112, 103, 255]);
    p.rect(28, 30, 4, 3, C.redDark);
}

function drawDrop(p) {
    iconShadow(p);
    p.polygon([[25, 3], [38, 23], [39, 30], [35, 38], [27, 42], [18, 40], [11, 34], [10, 27]], C.ink);
    p.polygon([[25, 7], [35, 24], [36, 30], [32, 36], [26, 39], [19, 37], [14, 32], [14, 27]], C.blue);
    p.polygon([[24, 11], [19, 24], [17, 29], [19, 33], [22, 34], [22, 29], [28, 17]], [144, 224, 245, 255]);
    p.rect(29, 35, 4, 2, C.blueDark);
}

function drawMeat(p) {
    iconShadow(p);
    p.line(30, 28, 39, 38, C.ink, 8);
    p.line(31, 27, 39, 35, C.parchmentLight, 4);
    p.circle(40, 39, 5, C.ink); p.circle(40, 39, 3, C.white);
    p.circle(43, 35, 4, C.ink); p.circle(43, 35, 2, C.white);
    p.circle(21, 20, 13, C.ink);
    p.circle(20, 19, 10, C.orange);
    p.circle(15, 14, 5, [241, 166, 83, 255]);
    p.rect(12, 12, 7, 3, [255, 205, 119, 255]);
    p.rect(25, 25, 5, 4, [156, 73, 39, 255]);
}

function drawMoon(p) {
    iconShadow(p);
    // Croissant construit ligne par ligne afin de conserver une transparence réelle.
    const outerX = 24, outerY = 23, outerR = 19;
    const cutX = 31, cutY = 18, cutR = 17;
    for (let y = 3; y < 44; y++) {
        for (let x = 3; x < 45; x++) {
            const inOuter = (x - outerX) ** 2 + (y - outerY) ** 2 <= outerR ** 2;
            const inCut = (x - cutX) ** 2 + (y - cutY) ** 2 <= cutR ** 2;
            if (!inOuter || inCut) continue;
            const edge = (x - outerX) ** 2 + (y - outerY) ** 2 >= (outerR - 3) ** 2;
            p.pixel(x, y, edge ? C.ink : C.yellow);
        }
    }
    p.rect(10, 14, 4, 3, C.white);
    p.rect(11, 13, 2, 5, C.white);
    p.rect(13, 31, 3, 2, C.gold);
}

function drawMagnifier(p) {
    iconShadow(p);
    p.line(27, 29, 39, 41, C.ink, 8);
    p.line(27, 29, 39, 41, C.wood, 4);
    p.circle(20, 20, 14, C.ink);
    p.circle(20, 20, 10, C.steel);
    p.circle(19, 19, 7, [216, 210, 192, 255]);
    p.rect(13, 13, 6, 3, C.white);
    p.rect(35, 35, 4, 4, C.goldDark);
}

function drawBuild(p) {
    iconShadow(p);
    p.line(13, 39, 35, 12, C.ink, 8);
    p.line(13, 39, 35, 12, C.wood, 4);
    p.polygon([[29, 9], [42, 15], [38, 23], [33, 20], [36, 16], [27, 13]], C.ink);
    p.polygon([[31, 12], [39, 16], [37, 20], [33, 18], [35, 15], [29, 13]], C.steel);
    p.rect(8, 31, 18, 5, C.ink);
    p.rect(10, 32, 15, 2, C.parchment);
}

function drawWheat(p) {
    iconShadow(p);
    p.line(18, 41, 31, 7, C.ink, 5);
    p.line(19, 40, 31, 8, C.goldDark, 2);
    const grains = [[28, 10, -1], [34, 12, 1], [25, 16, -1], [32, 18, 1], [22, 23, -1], [29, 25, 1], [19, 30, -1], [26, 31, 1]];
    grains.forEach(([x, y, side], i) => {
        p.polygon(side < 0 ? [[x, y], [x - 8, y - 3], [x - 5, y + 5]] : [[x, y], [x + 8, y - 4], [x + 5, y + 5]], C.ink);
        p.polygon(side < 0 ? [[x - 1, y], [x - 6, y - 2], [x - 4, y + 3]] : [[x + 1, y], [x + 6, y - 2], [x + 4, y + 3]], i % 2 ? C.gold : C.yellow);
    });
}

function drawInteract(p) {
    iconShadow(p);
    p.circle(32, 15, 9, C.ink);
    p.circle(32, 15, 6, C.steel);
    p.circle(32, 15, 2, C.ink);
    for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        p.line(32 + Math.cos(a) * 7, 15 + Math.sin(a) * 7, 32 + Math.cos(a) * 11, 15 + Math.sin(a) * 11, C.ink, 3);
    }
    p.polygon([[8, 26], [14, 23], [19, 27], [23, 22], [29, 25], [25, 33], [20, 39], [14, 38], [9, 33]], C.ink);
    p.polygon([[11, 27], [14, 26], [19, 30], [23, 25], [26, 27], [22, 33], [19, 36], [15, 35], [11, 31]], C.parchmentLight);
    p.rect(14, 24, 3, 9, C.white);
}

function navMedallion(p, inner = C.parchment) {
    p.circle(24, 26, 21, C.shadow);
    p.circle(24, 23, 21, C.ink);
    p.circle(24, 23, 18, C.goldDark);
    p.circle(24, 23, 15, inner);
    p.rect(14, 39, 20, 3, C.ink);
}

function drawTree(p) {
    navMedallion(p, [92, 137, 78, 255]);
    p.rect(21, 21, 6, 16, C.ink); p.rect(23, 21, 4, 15, C.wood);
    [[15, 19, 8], [24, 14, 10], [33, 20, 8], [21, 22, 9]].forEach(([x, y, r]) => {
        p.circle(x, y, r, C.ink); p.circle(x, y - 1, r - 3, C.green);
    });
    p.rect(18, 12, 8, 3, C.greenLight);
}

function drawLightning(p) {
    navMedallion(p, [117, 83, 50, 255]);
    p.polygon([[25, 5], [13, 25], [22, 24], [17, 43], [38, 18], [28, 18], [35, 5]], C.ink);
    p.polygon([[26, 8], [17, 22], [26, 21], [22, 36], [34, 20], [25, 20], [31, 8]], C.yellow);
    p.rect(24, 9, 3, 8, C.white);
}

function drawScroll(p) {
    navMedallion(p, [106, 72, 50, 255]);
    p.rect(12, 10, 25, 28, C.ink);
    p.rect(15, 11, 20, 26, C.parchmentLight);
    p.circle(15, 12, 5, C.ink); p.circle(15, 12, 3, C.parchment);
    p.circle(35, 36, 5, C.ink); p.circle(35, 36, 3, C.parchment);
    p.line(19, 18, 31, 18, C.leather, 2);
    p.line(19, 23, 29, 23, C.leather, 2);
    p.line(19, 28, 27, 28, C.leather, 2);
    p.circle(29, 32, 4, C.redDark);
}

function drawBag(p) {
    navMedallion(p, [111, 76, 51, 255]);
    p.polygon([[15, 14], [32, 14], [38, 21], [37, 39], [11, 39], [10, 22]], C.ink);
    p.polygon([[17, 17], [30, 17], [34, 22], [33, 36], [14, 36], [13, 23]], C.leather);
    p.frame(18, 7, 12, 12, C.ink, 3);
    p.rect(18, 24, 13, 8, C.goldDark);
    p.rect(20, 25, 9, 5, C.wood);
    p.rect(22, 14, 3, 22, C.parchment);
}

function drawArmor(p) {
    navMedallion(p, [86, 84, 76, 255]);
    p.polygon([[14, 10], [20, 7], [24, 12], [28, 7], [35, 11], [40, 23], [34, 26], [32, 41], [16, 41], [14, 26], [8, 23]], C.ink);
    p.polygon([[15, 13], [20, 10], [24, 15], [29, 10], [34, 13], [37, 22], [31, 23], [29, 38], [19, 38], [17, 23], [11, 22]], C.steel);
    p.rect(22, 15, 4, 22, C.steelDark);
    p.rect(17, 19, 14, 3, C.white);
    p.rect(16, 28, 16, 3, C.goldDark);
}

function drawLetter(p) {
    navMedallion(p, [115, 67, 48, 255]);
    p.rect(8, 12, 32, 25, C.ink);
    p.rect(11, 15, 26, 19, C.parchmentLight);
    p.polygon([[11, 15], [24, 25], [37, 15]], C.parchment);
    p.line(11, 34, 21, 24, C.goldDark, 2);
    p.line(37, 34, 27, 24, C.goldDark, 2);
    p.circle(33, 34, 6, C.ink); p.circle(33, 34, 4, C.redDark);
}

function drawMap(p) {
    navMedallion(p, [109, 89, 56, 255]);
    p.polygon([[7, 12], [19, 8], [29, 12], [41, 8], [40, 37], [29, 41], [19, 37], [8, 41]], C.ink);
    p.polygon([[10, 14], [19, 11], [19, 34], [10, 37]], C.parchmentLight);
    p.polygon([[21, 11], [28, 14], [28, 38], [21, 35]], C.parchment);
    p.polygon([[30, 14], [38, 11], [37, 35], [30, 38]], [242, 216, 165, 255]);
    p.line(14, 29, 19, 24, C.redDark, 2);
    p.line(22, 22, 27, 27, C.redDark, 2);
    p.circle(33, 19, 3, C.red); p.rect(32, 21, 2, 6, C.redDark);
}

const rows = [
    [drawHeart, drawDrop, drawMeat, drawMoon, drawMagnifier, drawBuild, drawWheat, drawInteract],
    [drawTree, drawLightning, drawScroll, drawBag, drawArmor, (p) => drawHeart(p, true), drawLetter, drawMap],
];

const sheet = new PixelCanvas(CELL * COLUMNS, CELL * ROWS);
rows.forEach((drawers, row) => drawers.forEach((draw, column) => {
    const cell = new PixelCanvas(CELL, CELL);
    draw(cell);
    sheet.blit(cell, column * CELL, row * CELL);
}));

const file = path.join(OUT, 'sheet-mobile-hud.png');
sheet.save(file);
fs.writeFileSync(path.join(OUT, 'mobile-hud.json'), `${JSON.stringify({
    generatedBy: 'scripts/generate_mobile_hud_sheet.js',
    file: 'assets/ui/sheet-mobile-hud.png',
    frameW: CELL,
    frameH: CELL,
    columns: COLUMNS,
    rows: {
        vitalsAndActions: ['health', 'thirst', 'hunger', 'sleep', 'search', 'build', 'harvest', 'interact'],
        navigation: ['scene', 'actions', 'quests', 'inventory', 'equipment', 'status', 'chat', 'map'],
    },
}, null, 2)}\n`);
