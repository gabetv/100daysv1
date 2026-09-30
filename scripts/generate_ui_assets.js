// Génère les éléments d'interface pixel art de l'Île des 100 Jours.
// Aucun moteur graphique ni fichier source externe : seulement des pixels RGBA.
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

class PixelCanvas {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.data = new Uint8Array(width * height * 4);
    }

    pixel(x, y, color) {
        x = Math.round(x); y = Math.round(y);
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
        const i = (y * this.width + x) * 4;
        this.data[i] = color[0];
        this.data[i + 1] = color[1];
        this.data[i + 2] = color[2];
        this.data[i + 3] = color[3] ?? 255;
    }

    rect(x, y, width, height, color) {
        for (let py = y; py < y + height; py++) {
            for (let px = x; px < x + width; px++) this.pixel(px, py, color);
        }
    }

    line(x0, y0, x1, y1, color, thickness = 1) {
        x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
        const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
        const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        while (true) {
            this.rect(x0 - Math.floor(thickness / 2), y0 - Math.floor(thickness / 2), thickness, thickness, color);
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
    }

    circle(cx, cy, radius, color) {
        const rr = radius * radius;
        for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
            for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
                if ((x - cx) ** 2 + (y - cy) ** 2 <= rr) this.pixel(x, y, color);
            }
        }
    }

    polygon(points, color) {
        const minY = Math.floor(Math.min(...points.map(p => p[1])));
        const maxY = Math.ceil(Math.max(...points.map(p => p[1])));
        for (let y = minY; y <= maxY; y++) {
            const nodes = [];
            for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
                const [xi, yi] = points[i], [xj, yj] = points[j];
                if ((yi < y && yj >= y) || (yj < y && yi >= y)) {
                    nodes.push(xi + ((y - yi) / (yj - yi)) * (xj - xi));
                }
            }
            nodes.sort((a, b) => a - b);
            for (let i = 0; i + 1 < nodes.length; i += 2) {
                this.rect(Math.ceil(nodes[i]), y, Math.max(0, Math.floor(nodes[i + 1]) - Math.ceil(nodes[i]) + 1), 1, color);
            }
        }
    }

    png() {
        const stride = this.width * 4 + 1;
        const raw = Buffer.alloc(stride * this.height);
        for (let y = 0; y < this.height; y++) {
            const row = y * stride;
            raw[row] = 0;
            Buffer.from(this.data.buffer, y * this.width * 4, this.width * 4).copy(raw, row + 1);
        }
        const crcTable = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            crcTable[n] = c;
        }
        const chunk = (type, data) => {
            const typeBuffer = Buffer.from(type);
            const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
            let crc = -1;
            for (const byte of Buffer.concat([typeBuffer, data])) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
            const crcBuffer = Buffer.alloc(4); crcBuffer.writeUInt32BE((crc ^ -1) >>> 0);
            return Buffer.concat([length, typeBuffer, data, crcBuffer]);
        };
        const header = Buffer.alloc(13);
        header.writeUInt32BE(this.width, 0); header.writeUInt32BE(this.height, 4);
        header[8] = 8; header[9] = 6;
        return Buffer.concat([
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
            chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
        ]);
    }

    save(filename) {
        fs.writeFileSync(filename, this.png());
        console.log(`UI pixel art: ${filename} (${this.width}x${this.height})`);
    }
}

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

panelFrame().save(path.join(OUT, 'panel-frame.png'));
actionButton().save(path.join(OUT, 'button-action.png'));
compass().save(path.join(OUT, 'compass.png'));
rotateLandscape().save(path.join(OUT, 'rotate-landscape.png'));
actionBurst().save(path.join(OUT, 'action-burst.png'));
