// Génère les éléments d'interface pixel art de l'Île des 100 Jours.
// Aucun moteur graphique ni fichier source externe : seulement des pixels RGBA.
// Le moteur de dessin est partagé avec `generate_ui_sheets.js`.
import fs from 'fs';
import path from 'path';
import { PixelCanvas } from './lib/pixel-canvas.js';

const OUT = path.resolve('assets/ui');
fs.mkdirSync(OUT, { recursive: true });
const C = {
    // Palette chaude bois / cuir / parchemin de la maquette mobile.
    ink: [43, 27, 24, 255], deep: [75, 46, 34, 255], panel: [105, 63, 45, 255],
    teal: [48, 91, 100, 255], sea: [63, 139, 151, 255], foam: [213, 224, 203, 255],
    gold: [218, 178, 107, 255], orange: [188, 104, 55, 255], shadow: [20, 13, 14, 220],
    coral: [211, 72, 62, 255], white: [249, 229, 188, 255], transparent: [0, 0, 0, 0],
};

function panelFrame() {
    const p = new PixelCanvas(48, 48);
    // Le centre reste transparent : un seul cadre 9-slice peut ainsi habiller
    // les panneaux sombres, les cartes en parchemin et les tiroirs mobiles.
    p.frame(0, 0, 48, 48, C.shadow, 3);
    p.frame(2, 2, 44, 44, C.ink, 3);
    p.frame(5, 5, 38, 38, C.gold, 3);
    p.frame(8, 8, 32, 32, C.panel, 4);
    p.frame(11, 11, 26, 26, [139, 91, 61, 255], 2);
    // Coins taillés et clous, adaptés au border-image 15.
    [[0, 0], [40, 0], [0, 40], [40, 40]].forEach(([x, y]) => {
        p.rect(x, y, 8, 8, C.ink);
        p.rect(x + 2, y + 2, 5, 5, C.deep);
        p.rect(x + 3, y + 3, 2, 2, C.gold);
    });
    for (let i = 13; i < 36; i += 9) {
        p.rect(i, 3, 4, 2, C.white); p.rect(i, 43, 4, 2, [119, 67, 43, 255]);
        p.rect(3, i, 2, 4, C.white); p.rect(43, i, 2, 4, [119, 67, 43, 255]);
    }
    return p;
}

function actionButton() {
    const p = new PixelCanvas(96, 48);
    p.rect(3, 6, 90, 39, C.shadow);
    p.rect(0, 3, 96, 38, C.ink);
    p.rect(3, 0, 90, 41, C.gold);
    p.rect(6, 3, 84, 35, C.deep);
    p.rect(8, 5, 80, 30, [154, 76, 42, 255]);
    p.rect(10, 7, 76, 24, [203, 109, 48, 255]);
    p.rect(12, 8, 72, 3, [244, 173, 77, 255]);
    p.rect(12, 29, 72, 3, [111, 48, 31, 255]);
    [[3, 3], [86, 3], [3, 32], [86, 32]].forEach(([x, y]) => {
        p.rect(x, y, 7, 7, C.ink);
        p.rect(x + 2, y + 2, 3, 3, C.gold);
    });
    return p;
}

function compass() {
    const p = new PixelCanvas(96, 96);
    p.circle(48, 51, 45, C.shadow);
    p.circle(48, 47, 44, C.ink);
    p.circle(48, 47, 40, [126, 111, 91, 255]);
    p.circle(48, 47, 36, C.gold);
    p.circle(48, 47, 33, C.deep);
    p.circle(48, 47, 27, [28, 78, 92, 255]);
    // Étoile des vents en gros pixels, proche de la boussole de référence.
    p.polygon([[48, 8], [55, 39], [48, 34], [41, 39]], C.white);
    p.polygon([[48, 86], [41, 54], [48, 60], [55, 54]], C.orange);
    p.polygon([[9, 47], [41, 40], [36, 47], [41, 54]], C.foam);
    p.polygon([[87, 47], [55, 54], [60, 47], [55, 40]], C.sea);
    p.circle(48, 47, 9, C.gold); p.circle(48, 47, 5, C.ink);
    p.rect(45, 0, 6, 7, C.coral); p.rect(47, 1, 2, 4, C.white);
    // Clous sur le cerclage.
    [[23, 23], [73, 23], [23, 72], [73, 72]].forEach(([x, y]) => {
        p.circle(x, y, 3, C.ink); p.circle(x, y, 1, C.white);
    });
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
