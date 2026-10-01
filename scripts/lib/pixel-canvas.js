// scripts/lib/pixel-canvas.js
// Micro-moteur de dessin pixel art + encodeur PNG sans aucune dépendance.
// Partagé par tous les générateurs d'assets (`generate_ui_assets.js`,
// `generate_ui_sheets.js`, ...) pour garder un seul langage visuel.

import fs from 'fs';
import zlib from 'zlib';

export class PixelCanvas {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.data = new Uint8Array(width * height * 4);
    }

    /** Écrit un pixel (avec mélange alpha si la couleur est translucide). */
    pixel(x, y, color) {
        x = Math.round(x); y = Math.round(y);
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
        const i = (y * this.width + x) * 4;
        const a = color[3] ?? 255;
        if (a >= 255) {
            this.data[i] = color[0];
            this.data[i + 1] = color[1];
            this.data[i + 2] = color[2];
            this.data[i + 3] = 255;
            return;
        }
        if (a <= 0) return;
        const srcA = a / 255;
        const dstA = this.data[i + 3] / 255;
        const outA = srcA + dstA * (1 - srcA);
        if (outA <= 0) return;
        for (let c = 0; c < 3; c++) {
            this.data[i + c] = Math.round(
                (color[c] * srcA + this.data[i + c] * dstA * (1 - srcA)) / outA,
            );
        }
        this.data[i + 3] = Math.round(outA * 255);
    }

    rect(x, y, width, height, color) {
        for (let py = y; py < y + height; py++) {
            for (let px = x; px < x + width; px++) this.pixel(px, py, color);
        }
    }

    /** Cadre creux de `thickness` pixels. */
    frame(x, y, width, height, color, thickness = 1) {
        this.rect(x, y, width, thickness, color);
        this.rect(x, y + height - thickness, width, thickness, color);
        this.rect(x, y, thickness, height, color);
        this.rect(x + width - thickness, y, thickness, height, color);
    }

    line(x0, y0, x1, y1, color, thickness = 1) {
        x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
        const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
        const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (;;) {
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

    /** Anneau plein entre deux rayons (utile pour les jauges circulaires). */
    ring(cx, cy, outer, inner, color) {
        const ro = outer * outer, ri = inner * inner;
        for (let y = Math.floor(cy - outer); y <= Math.ceil(cy + outer); y++) {
            for (let x = Math.floor(cx - outer); x <= Math.ceil(cx + outer); x++) {
                const d = (x - cx) ** 2 + (y - cy) ** 2;
                if (d <= ro && d >= ri) this.pixel(x, y, color);
            }
        }
    }

    /**
     * Secteur d'anneau : sert aux cadrans de progression.
     * Les angles sont en tours (0 = 12h, sens horaire).
     */
    arc(cx, cy, outer, inner, fromTurn, toTurn, color) {
        // Un tour complet (ou plus) remplit l'anneau entier : sans ce cas
        // particulier, 0 → 1 se normalise en 0 → 0 et ne dessine rien.
        if (toTurn - fromTurn >= 1) return this.ring(cx, cy, outer, inner, color);
        const ro = outer * outer, ri = inner * inner;
        const norm = (t) => ((t % 1) + 1) % 1;
        const a0 = norm(fromTurn), a1 = norm(toTurn);
        for (let y = Math.floor(cy - outer); y <= Math.ceil(cy + outer); y++) {
            for (let x = Math.floor(cx - outer); x <= Math.ceil(cx + outer); x++) {
                const dx = x - cx, dy = y - cy;
                const d = dx * dx + dy * dy;
                if (d > ro || d < ri) continue;
                // atan2 orienté « 12h = 0 », sens horaire.
                const t = norm(Math.atan2(dx, -dy) / (Math.PI * 2));
                const inside = a0 <= a1 ? (t >= a0 && t <= a1) : (t >= a0 || t <= a1);
                if (inside) this.pixel(x, y, color);
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

    /** Trame de Bayer 4×4 : donne le grain « console 16 bits ». */
    dither(x, y, width, height, color, density = 0.5) {
        const matrix = [
            [0, 8, 2, 10], [12, 4, 14, 6],
            [3, 11, 1, 9], [15, 7, 13, 5],
        ];
        for (let py = y; py < y + height; py++) {
            for (let px = x; px < x + width; px++) {
                const threshold = matrix[((py % 4) + 4) % 4][((px % 4) + 4) % 4] / 16;
                if (threshold < density) this.pixel(px, py, color);
            }
        }
    }

    /** Recopie une sous-image (sert à composer les planches de sprites). */
    blit(source, dx, dy) {
        for (let y = 0; y < source.height; y++) {
            for (let x = 0; x < source.width; x++) {
                const i = (y * source.width + x) * 4;
                const a = source.data[i + 3];
                if (!a) continue;
                this.pixel(dx + x, dy + y, [source.data[i], source.data[i + 1], source.data[i + 2], a]);
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
            chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
        ]);
    }

    save(filename) {
        fs.writeFileSync(filename, this.png());
        console.log(`UI pixel art: ${filename} (${this.width}x${this.height})`);
    }
}

/** Palette commune à tout le HUD de l'Île des 100 Jours. */
/**
 * PALETTE « CARNET DE SURVIE » — unique source de vérité du pixel art.
 *
 * Elle reprend, pixel pour pixel, les jetons CSS de `public/game-shell.css`
 * (`--shell-*` / `--survival-*`). Toute planche générée par les scripts est
 * donc automatiquement dans les mêmes bois, cuirs et parchemins que l'écran —
 * c'est ce qui évite les icônes sarcelle posées sur des panneaux bois.
 *
 * Les clés historiques (`teal`, `sea`) sont conservées pour ne rien casser,
 * mais désignent maintenant les deux bois intermédiaires.
 */
export const PALETTE = {
    // Rampe bois, de l'encre au parchemin.
    ink: [43, 27, 24, 255],          // #2b1b18  --shell-ink
    deep: [59, 41, 36, 255],         // #3b2924  --shell-deep
    panel: [91, 57, 45, 255],        // #5b392d  --shell-panel
    teal: [113, 73, 54, 255],        // #714936  --shell-panel-2 (ex-sarcelle)
    sea: [140, 82, 55, 255],         // #8c5237  --survival-leather (ex-mer)
    line: [179, 122, 79, 255],       // #b37a4f  --shell-line
    parchment: [227, 200, 156, 255], // #e3c89c  --survival-parchment
    foam: [241, 221, 186, 255],      // #f1ddba  --shell-foam
    white: [247, 232, 202, 255],     // #f7e8ca  texte principal

    // Accents.
    gold: [224, 183, 111, 255],      // #e0b76f  --shell-gold
    goldDark: [179, 122, 79, 255],   // #b37a4f
    orange: [189, 109, 62, 255],     // #bd6d3e  --shell-orange
    coral: [212, 71, 67, 255],       // #d44743  --shell-coral
    green: [120, 169, 91, 255],      // #78a95b  --shell-green
    greenDark: [74, 110, 57, 255],
    stone: [130, 120, 104, 255],     // #827868  --survival-stone
    stoneLight: [176, 165, 143, 255],
    stoneDark: [84, 77, 67, 255],

    // Seule famille froide autorisée : l'eau (soif, lagon, ciel de jour).
    blue: [85, 184, 219, 255],       // #55b8db  --shell-blue
    blueDark: [38, 108, 148, 255],
    night: [62, 68, 120, 255],       // ciel de nuit

    shadow: [26, 15, 12, 220],
    transparent: [0, 0, 0, 0],
};

export default PixelCanvas;
