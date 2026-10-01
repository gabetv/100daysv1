// Génère les éléments d'interface pixel art de l'Île des 100 Jours.
// Aucun moteur graphique ni fichier source externe : seulement des pixels RGBA.
// Le moteur de dessin est partagé avec `generate_ui_sheets.js`.
import fs from 'fs';
import path from 'path';
import { PixelCanvas } from './lib/pixel-canvas.js';

const OUT = path.resolve('assets/ui');
fs.mkdirSync(OUT, { recursive: true });
const C = {
    ink: [5, 18, 24, 255], deep: [8, 31, 38, 255], panel: [15, 48, 55, 255],
    teal: [31, 91, 91, 255], sea: [45, 132, 129, 255], foam: [174, 228, 202, 255],
    gold: [248, 204, 105, 255], orange: [216, 130, 51, 255], shadow: [3, 11, 16, 220],
    coral: [226, 94, 73, 255], white: [245, 239, 203, 255], transparent: [0, 0, 0, 0],
};

function panelFrame() {
    const p = new PixelCanvas(48, 48);
    p.rect(0, 0, 48, 48, C.shadow);
    p.rect(3, 3, 42, 42, C.gold);
    p.rect(5, 5, 38, 38, C.deep);
    p.rect(7, 7, 34, 34, C.panel);
    // Coins taillés et reflets, adaptés au border-image 16.
    [[0, 0], [40, 0], [0, 40], [40, 40]].forEach(([x, y]) => {
        p.rect(x, y, 8, 8, C.ink);
        p.rect(x + 2, y + 2, 4, 4, C.orange);
    });
    for (let i = 10; i < 38; i += 8) {
        p.rect(i, 3, 4, 2, C.white); p.rect(i, 43, 4, 2, C.orange);
        p.rect(3, i, 2, 4, C.white); p.rect(43, i, 2, 4, C.orange);
    }
    return p;
}

function actionButton() {
    const p = new PixelCanvas(96, 48);
    p.rect(3, 6, 90, 39, C.shadow);
    p.rect(0, 3, 96, 38, C.ink);
    p.rect(3, 0, 90, 41, C.gold);
    p.rect(6, 3, 84, 35, C.orange);
    p.rect(7, 4, 82, 29, [179, 87, 38, 255]);
    p.rect(9, 6, 78, 23, [205, 113, 43, 255]);
    p.rect(12, 7, 72, 3, [245, 173, 67, 255]);
    p.rect(12, 29, 72, 3, [118, 52, 29, 255]);
    [[3, 3], [86, 3], [3, 32], [86, 32]].forEach(([x, y]) => p.rect(x, y, 7, 7, C.deep));
    return p;
}

function compass() {
    const p = new PixelCanvas(96, 96);
    p.circle(48, 51, 43, C.shadow);
    p.circle(48, 47, 42, C.ink);
    p.circle(48, 47, 37, C.gold);
    p.circle(48, 47, 34, C.deep);
    p.circle(48, 47, 28, C.panel);
    // Étoile des vents en gros pixels.
    p.polygon([[48, 9], [55, 39], [48, 34], [41, 39]], C.white);
    p.polygon([[48, 85], [41, 54], [48, 60], [55, 54]], C.orange);
    p.polygon([[10, 47], [41, 40], [36, 47], [41, 54]], C.foam);
    p.polygon([[86, 47], [55, 54], [60, 47], [55, 40]], C.sea);
    p.circle(48, 47, 8, C.gold); p.circle(48, 47, 4, C.ink);
    p.rect(45, 0, 6, 7, C.coral); p.rect(47, 1, 2, 4, C.white);
    return p;
}

function rotateLandscape() {
    const p = new PixelCanvas(192, 128);
    // Éclat de soleil derrière le téléphone.
    for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        p.line(96 + Math.cos(a) * 47, 62 + Math.sin(a) * 34, 96 + Math.cos(a) * 59, 62 + Math.sin(a) * 43, C.gold, 4);
    }
    // Téléphone horizontal en perspective pixel art.
    p.rect(27, 34, 142, 68, C.shadow);
    p.rect(22, 28, 142, 68, C.gold);
    p.rect(27, 33, 132, 58, C.ink);
    p.rect(35, 38, 114, 48, C.deep);
    // Petit paysage insulaire à l'écran.
    p.rect(37, 40, 110, 20, [40, 113, 132, 255]);
    p.rect(37, 60, 110, 24, [48, 128, 114, 255]);
    p.polygon([[66, 81], [82, 55], [99, 81]], [62, 123, 66, 255]);
    p.rect(81, 51, 4, 22, [103, 59, 32, 255]);
    p.polygon([[83, 42], [65, 56], [83, 52], [101, 56]], [78, 153, 69, 255]);
    p.circle(127, 50, 7, C.gold);
    p.rect(153, 56, 5, 12, C.orange);
    // Flèches de rotation.
    p.line(20, 108, 55, 118, C.foam, 4); p.polygon([[55, 118], [45, 106], [43, 121]], C.foam);
    p.line(172, 17, 137, 7, C.foam, 4); p.polygon([[137, 7], [147, 19], [149, 4]], C.foam);
    return p;
}

function actionBurst() {
    const p = new PixelCanvas(64, 64);
    const rays = [
        [[29, 0], [36, 0], [35, 18], [29, 18]], [[29, 46], [35, 46], [36, 64], [29, 64]],
        [[0, 29], [18, 29], [18, 35], [0, 36]], [[46, 29], [64, 29], [64, 36], [46, 35]],
        [[7, 7], [23, 19], [19, 23]], [[57, 7], [41, 19], [45, 23]],
        [[7, 57], [19, 41], [23, 45]], [[57, 57], [45, 41], [41, 45]],
    ];
    rays.forEach(points => p.polygon(points, C.gold));
    p.polygon([[32, 14], [38, 27], [52, 32], [38, 38], [32, 52], [26, 38], [12, 32], [26, 27]], C.white);
    p.polygon([[32, 23], [36, 30], [43, 32], [36, 35], [32, 42], [29, 35], [21, 32], [29, 30]], C.orange);
    p.rect(30, 30, 5, 5, C.gold);
    return p;
}

function mapRoute() {
    const p = new PixelCanvas(160, 96);
    // Mini-carte de navigation : elle apparaît pendant le fondu de changement
    // de case et doit rester lisible même réduite sur un petit écran.
    p.rect(4, 7, 152, 82, C.shadow);
    p.rect(7, 4, 146, 82, C.gold);
    p.rect(10, 7, 140, 76, C.deep);
    p.rect(13, 10, 134, 70, [17, 67, 75, 255]);
    for (let y = 14; y < 78; y += 8) p.rect(13, y, 134, 2, [27, 92, 95, 210]);
    for (let x = 17; x < 147; x += 10) p.rect(x, 10, 2, 70, [27, 92, 95, 145]);
    // Îlot en gros pixels, avec relief et plage.
    p.polygon([[42, 61], [48, 37], [65, 26], [91, 28], [110, 42], [104, 66], [79, 74], [56, 70]], [35, 101, 64, 255]);
    p.polygon([[49, 54], [55, 37], [72, 31], [86, 35], [78, 46], [61, 50]], [72, 143, 71, 255]);
    p.polygon([[79, 46], [86, 35], [103, 43], [99, 62], [85, 68], [75, 59]], [46, 119, 67, 255]);
    p.line(50, 63, 66, 69, [231, 196, 111, 255], 3);
    p.line(66, 69, 78, 58, [231, 196, 111, 255], 3);
    p.line(78, 58, 94, 47, [231, 196, 111, 255], 3);
    [[50, 63], [66, 69], [78, 58], [94, 47]].forEach(([x, y]) => p.rect(x - 2, y - 2, 5, 5, C.white));
    p.circle(94, 47, 4, C.coral);
    // Rose des vents discrète en haut à droite.
    p.rect(123, 16, 18, 3, C.gold); p.rect(131, 8, 3, 18, C.gold);
    p.polygon([[132, 8], [138, 18], [132, 16], [126, 18]], C.white);
    p.rect(130, 16, 5, 5, C.coral);
    return p;
}

panelFrame().save(path.join(OUT, 'panel-frame.png'));
actionButton().save(path.join(OUT, 'button-action.png'));
compass().save(path.join(OUT, 'compass.png'));
rotateLandscape().save(path.join(OUT, 'rotate-landscape.png'));
actionBurst().save(path.join(OUT, 'action-burst.png'));
mapRoute().save(path.join(OUT, 'map-route.png'));
