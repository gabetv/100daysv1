// scripts/generate_spritesheets.js — Moteur de génération de spritesheets pixel art ultra détaillées
import fs from 'fs';
import zlib from 'zlib';

class PixelCanvas {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
    }

    setPixel(x, y, r, g, b, a = 255) {
        x = Math.round(x);
        y = Math.round(y);
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        const idx = (y * this.width + x) * 4;
        if (a >= 255) {
            this.data[idx] = r;
            this.data[idx + 1] = g;
            this.data[idx + 2] = b;
            this.data[idx + 3] = 255;
        } else if (a > 0) {
            const srcA = a / 255;
            const dstA = this.data[idx + 3] / 255;
            const outA = srcA + dstA * (1 - srcA);
            if (outA > 0) {
                this.data[idx] = Math.round((r * srcA + this.data[idx] * dstA * (1 - srcA)) / outA);
                this.data[idx + 1] = Math.round((g * srcA + this.data[idx + 1] * dstA * (1 - srcA)) / outA);
                this.data[idx + 2] = Math.round((b * srcA + this.data[idx + 2] * dstA * (1 - srcA)) / outA);
                this.data[idx + 3] = Math.round(outA * 255);
            }
        }
    }

    fillRect(x, y, w, h, [r, g, b, a = 255]) {
        for (let py = Math.floor(y); py < Math.floor(y + h); py++) {
            for (let px = Math.floor(x); px < Math.floor(x + w); px++) {
                this.setPixel(px, py, r, g, b, a);
            }
        }
    }

    fillCircle(cx, cy, radius, [r, g, b, a = 255]) {
        const r2 = radius * radius;
        for (let py = Math.floor(cy - radius); py <= Math.ceil(cy + radius); py++) {
            for (let px = Math.floor(cx - radius); px <= Math.ceil(cx + radius); px++) {
                const dist2 = (px - cx) * (px - cx) + (py - cy) * (py - cy);
                if (dist2 <= r2) {
                    this.setPixel(px, py, r, g, b, a);
                }
            }
        }
    }

    fillEllipse(cx, cy, rx, ry, [r, g, b, a = 255]) {
        for (let py = Math.floor(cy - ry); py <= Math.ceil(cy + ry); py++) {
            for (let px = Math.floor(cx - rx); px <= Math.ceil(cx + rx); px++) {
                const n = ((px - cx) * (px - cx)) / (rx * rx) + ((py - cy) * (py - cy)) / (ry * ry);
                if (n <= 1) {
                    this.setPixel(px, py, r, g, b, a);
                }
            }
        }
    }

    drawLine(x0, y0, x1, y1, [r, g, b, a = 255], thickness = 1) {
        x0 = Math.round(x0); y0 = Math.round(y0);
        x1 = Math.round(x1); y1 = Math.round(y1);
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        while (true) {
            if (thickness <= 1) {
                this.setPixel(x0, y0, r, g, b, a);
            } else {
                this.fillCircle(x0, y0, (thickness - 1) / 2, [r, g, b, a]);
            }
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }
    }

    toPngBuffer() {
        const rowBytes = this.width * 4 + 1;
        const rawBuf = Buffer.alloc(rowBytes * this.height);

        for (let y = 0; y < this.height; y++) {
            const rowOffset = y * rowBytes;
            rawBuf[rowOffset] = 0;
            for (let x = 0; x < this.width; x++) {
                const srcIdx = (y * this.width + x) * 4;
                const dstIdx = rowOffset + 1 + x * 4;
                rawBuf[dstIdx] = this.data[srcIdx];
                rawBuf[dstIdx + 1] = this.data[srcIdx + 1];
                rawBuf[dstIdx + 2] = this.data[srcIdx + 2];
                rawBuf[dstIdx + 3] = this.data[srcIdx + 3];
            }
        }

        const deflated = zlib.deflateSync(rawBuf);

        const crcTable = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) {
                c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
            }
            crcTable[n] = c;
        }

        function makeChunk(type, data) {
            const typeBuf = Buffer.from(type);
            const lenBuf = Buffer.alloc(4);
            lenBuf.writeUInt32BE(data.length, 0);
            let crc = -1;
            for (const b of Buffer.concat([typeBuf, data])) {
                crc = (crc >>> 8) ^ crcTable[(crc ^ b) & 0xff];
            }
            crc = (crc ^ -1) >>> 0;
            const crcBuf = Buffer.alloc(4);
            crcBuf.writeUInt32BE(crc, 0);
            return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
        }

        const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        const ihdr = Buffer.alloc(13);
        ihdr.writeUInt32BE(this.width, 0);
        ihdr.writeUInt32BE(this.height, 4);
        ihdr[8] = 8;
        ihdr[9] = 6;
        ihdr[10] = 0;
        ihdr[11] = 0;
        ihdr[12] = 0;

        return Buffer.concat([
            sig,
            makeChunk('IHDR', ihdr),
            makeChunk('IDAT', deflated),
            makeChunk('IEND', Buffer.alloc(0))
        ]);
    }

    save(filePath) {
        fs.writeFileSync(filePath, this.toPngBuffer());
        console.log(`Saved ${filePath} (${this.width}x${this.height})`);
    }
}

// -------------------------------------------------------------
// 1. CAMPFIRE SPRITESHEET (8 frames of 64x64, total 512x64)
// -------------------------------------------------------------
function generateCampfire() {
    const frameW = 64, frameH = 64, frameCount = 8;
    const canvas = new PixelCanvas(frameW * frameCount, frameH);

    for (let f = 0; f < frameCount; f++) {
        const ox = f * frameW;
        const t = (f / frameCount) * Math.PI * 2;

        // Ground shadow
        canvas.fillEllipse(ox + 32, 54, 24, 7, [10, 15, 20, 130]);

        // Stone circle around fire
        const stones = [
            { x: 12, y: 51, r: 4.5, c: [85, 95, 105] },
            { x: 20, y: 55, r: 5, c: [110, 120, 130] },
            { x: 32, y: 57, r: 5.5, c: [95, 105, 115] },
            { x: 44, y: 55, r: 5, c: [115, 125, 135] },
            { x: 52, y: 51, r: 4.5, c: [90, 100, 110] },
            { x: 49, y: 45, r: 4, c: [80, 90, 100] },
            { x: 15, y: 45, r: 4, c: [75, 85, 95] },
        ];
        stones.forEach(s => {
            canvas.fillCircle(ox + s.x, s.y, s.r, [s.c[0] - 30, s.c[1] - 30, s.c[2] - 30, 255]);
            canvas.fillCircle(ox + s.x, s.y - 1, s.r * 0.8, [s.c[0], s.c[1], s.c[2], 255]);
            canvas.fillCircle(ox + s.x - 1, s.y - 2, s.r * 0.4, [s.c[0] + 35, s.c[1] + 35, s.c[2] + 35, 255]);
        });

        // Burning Logs
        canvas.drawLine(ox + 16, 52, ox + 48, 44, [50, 25, 12, 255], 5);
        canvas.drawLine(ox + 17, 51, ox + 47, 43, [95, 50, 24, 255], 3);
        canvas.drawLine(ox + 18, 50, ox + 46, 42, [140, 75, 35, 255], 1);

        canvas.drawLine(ox + 48, 52, ox + 16, 44, [45, 22, 10, 255], 5);
        canvas.drawLine(ox + 47, 51, ox + 17, 43, [88, 45, 20, 255], 3);
        canvas.drawLine(ox + 46, 50, ox + 18, 42, [130, 68, 30, 255], 1);

        // Glowing Coals
        const coalGlow = 0.85 + Math.sin(t * 3) * 0.15;
        for (let py = 43; py <= 51; py++) {
            for (let px = 20; px <= 44; px++) {
                const distCenter = Math.abs(px - 32) + Math.abs(py - 47);
                if (distCenter < 14 && (px + py + f) % 2 === 0) {
                    const r = Math.min(255, Math.round(255 * coalGlow));
                    const g = Math.min(255, Math.round((70 + (14 - distCenter) * 12) * coalGlow));
                    canvas.setPixel(ox + px, py, r, g, 10, 245);
                }
            }
        }

        // Animated multi-layer flames
        const wave1 = Math.sin(t);
        const wave2 = Math.sin(t * 2 + 1.2);
        const wave3 = Math.cos(t * 1.5 + 2.4);

        function drawFlameTongue(baseX, baseY, height, width, colorOuter, colorInner, colorCore, sway) {
            const topY = baseY - height;
            for (let y = baseY; y >= topY; y--) {
                const progress = (baseY - y) / height;
                const currentSway = Math.sin(progress * Math.PI + t * 2) * sway * (progress * 1.4);
                const currentWidth = width * (1 - progress * 0.85);
                const cx = baseX + currentSway;

                for (let x = cx - currentWidth; x <= cx + currentWidth; x++) {
                    const dx = Math.abs(x - cx);
                    const ratio = dx / Math.max(1, currentWidth);
                    if (ratio <= 1) {
                        let c = colorOuter;
                        if (ratio < 0.45 && progress < 0.85) c = colorCore;
                        else if (ratio < 0.75 && progress < 0.92) c = colorInner;
                        canvas.setPixel(ox + x, y, c[0], c[1], c[2], c[3] || 255);
                    }
                }
            }
        }

        // 1. Outer Dark Red Flame
        drawFlameTongue(32 + wave3 * 2, 48, 34 + wave1 * 4, 14, [210, 40, 10, 240], [245, 90, 15, 255], [255, 180, 25, 255], wave2 * 3.5);
        // 2. Left Flame Tongue
        drawFlameTongue(25 + wave1 * 1.5, 47, 26 + wave2 * 3, 10, [220, 50, 10, 230], [250, 110, 20, 255], [255, 200, 40, 255], -2 + wave1 * 2);
        // 3. Right Flame Tongue
        drawFlameTongue(39 - wave2 * 1.5, 47, 28 + wave3 * 3, 10, [220, 50, 10, 230], [250, 110, 20, 255], [255, 200, 40, 255], 2 + wave3 * 2);
        // 4. Center Bright Core Flame
        drawFlameTongue(32 + wave2 * 1.2, 48, 24 + wave1 * 2.5, 8.5, [255, 120, 20, 255], [255, 210, 40, 255], [255, 255, 180, 255], wave1 * 1.5);
        // 5. White-Hot Central Heart
        drawFlameTongue(32, 47, 13 + wave2 * 1.5, 5.5, [255, 200, 50, 255], [255, 250, 140, 255], [255, 255, 240, 255], 0);

        // Rising embers & sparks
        const sparks = [
            { x: 30 + Math.sin(f * 1.7) * 8, y: 20 - (f * 3) % 18, r: 1.2, c: [255, 210, 70] },
            { x: 36 + Math.cos(f * 2.1) * 9, y: 16 - ((f + 3) * 3) % 16, r: 1.4, c: [255, 160, 40] },
            { x: 26 + Math.sin(f * 3.1) * 6, y: 12 - ((f + 5) * 3) % 14, r: 1.2, c: [255, 240, 120] },
            { x: 34 + Math.sin(f * 2.7) * 11, y: 8 - ((f + 2) * 2.5) % 12, r: 1, c: [255, 130, 30] },
        ];
        sparks.forEach(sp => {
            canvas.fillCircle(ox + sp.x, sp.y, sp.r, [sp.c[0], sp.c[1], sp.c[2], 255]);
        });
    }

    canvas.save('assets/spritesheet_campfire.png');
}

// -------------------------------------------------------------
// 2. CREATURES SPRITESHEET (8 rows x 8 frames of 64x64, total 512x512)
// -------------------------------------------------------------
function generateCreatures() {
    const frameW = 64, frameH = 64, frameCount = 8, rowCount = 8;
    const canvas = new PixelCanvas(frameW * frameCount, frameH * rowCount);

    for (let f = 0; f < frameCount; f++) {
        const ox = f * frameW;
        const t = (f / frameCount) * Math.PI * 2;
        const bob = Math.sin(t) * 2;

        // -------------------------------------------------------------
        // ROW 0: WOLF (Loup Agressif)
        // -------------------------------------------------------------
        {
            const oy = 0 * frameH;
            const baseY = oy + 46 + bob;

            // Shadow
            canvas.fillEllipse(ox + 32, oy + 56, 22, 6, [10, 15, 20, 120]);

            // Back Legs & Paws
            const legWalk = Math.sin(t) * 4;
            canvas.drawLine(ox + 16, baseY - 6, ox + 13 - legWalk, baseY + 8, [45, 48, 52, 255], 4);
            canvas.drawLine(ox + 42, baseY - 6, ox + 39 + legWalk, baseY + 8, [45, 48, 52, 255], 4);
            canvas.fillRect(ox + 11 - legWalk, baseY + 7, 5, 3, [30, 33, 36, 255]);
            canvas.fillRect(ox + 37 + legWalk, baseY + 7, 5, 3, [30, 33, 36, 255]);

            // Bushy Tail
            const tailSwish = Math.sin(t * 1.5) * 5;
            canvas.drawLine(ox + 14, baseY - 10, ox + 5, baseY - 14 + tailSwish, [65, 70, 78, 255], 4.5);
            canvas.drawLine(ox + 5, baseY - 14 + tailSwish, ox + 2, baseY - 6 + tailSwish, [95, 102, 112, 255], 3.5);

            // Muscular Torso & Flank
            canvas.fillEllipse(ox + 29, baseY - 8, 16, 9.5, [75, 82, 90, 255]);
            canvas.fillEllipse(ox + 28, baseY - 7, 13, 7.5, [95, 102, 112, 255]);
            canvas.fillEllipse(ox + 30, baseY - 4, 11, 5.5, [160, 168, 178, 255]); // Belly fur

            // Front Legs
            canvas.drawLine(ox + 20, baseY - 5, ox + 19 + legWalk, baseY + 8, [75, 82, 90, 255], 4);
            canvas.drawLine(ox + 46, baseY - 5, ox + 47 - legWalk, baseY + 8, [75, 82, 90, 255], 4);
            canvas.fillRect(ox + 17 + legWalk, baseY + 7, 5, 3, [30, 33, 36, 255]);
            canvas.fillRect(ox + 45 - legWalk, baseY + 7, 5, 3, [30, 33, 36, 255]);

            // Mane & Head
            const headX = ox + 48, headY = baseY - 15 + bob * 0.6;
            canvas.fillCircle(headX, headY, 7.5, [85, 92, 102, 255]);
            canvas.fillCircle(headX - 4, headY + 3, 6, [110, 118, 130, 255]); // Mane

            // Snout
            canvas.drawLine(headX, headY + 2, headX + 10, headY + 3, [125, 135, 145, 255], 4);
            canvas.fillRect(headX + 9, headY + 1, 3, 3, [20, 20, 25, 255]); // Black Nose
            // Fangs
            canvas.setPixel(headX + 7, headY + 5, 255, 255, 255, 255);
            canvas.setPixel(headX + 8, headY + 5, 255, 255, 255, 255);

            // Pointed Ears
            canvas.drawLine(headX - 3, headY - 5, headX - 4, headY - 12, [75, 82, 90, 255], 2.5);
            canvas.drawLine(headX + 2, headY - 5, headX + 3, headY - 12, [95, 102, 112, 255], 2.5);
            canvas.setPixel(headX - 3, headY - 9, 200, 140, 150, 255); // Inner Ear

            // Glowing Amber / Red Predator Eye
            canvas.fillRect(headX + 3, headY - 2, 3, 2, [255, 60, 40, 255]);
            canvas.setPixel(headX + 4, headY - 2, 255, 230, 70, 255);
        }

        // -------------------------------------------------------------
        // ROW 1: SNAKE (Serpent Venimeux)
        // -------------------------------------------------------------
        {
            const oy = 1 * frameH;
            const baseY = oy + 42;

            // Shadow
            canvas.fillEllipse(ox + 32, oy + 54, 24, 5, [10, 15, 20, 110]);

            // Sinuous Body Wave
            const wave = Math.sin(t);
            const snakePts = [
                { x: 12, y: baseY + 7 + wave * 3 },
                { x: 20, y: baseY + 9 - wave * 3 },
                { x: 28, y: baseY + 6 + wave * 4 },
                { x: 36, y: baseY + 8 - wave * 3 },
                { x: 44, y: baseY + 2 + wave * 2.5 },
                { x: 48, y: baseY - 5 + wave * 1.8 },
                { x: 51, y: baseY - 11 + wave * 0.8 },
            ];

            for (let i = 0; i < snakePts.length - 1; i++) {
                const p0 = snakePts[i], p1 = snakePts[i + 1];
                const thick = 5.5 + (i > 3 ? 1.5 : 0);
                canvas.drawLine(ox + p0.x, p0.y, ox + p1.x, p1.y, [20, 75, 38, 255], thick + 2);
                canvas.drawLine(ox + p0.x, p0.y, ox + p1.x, p1.y, [40, 150, 70, 255], thick);
                canvas.drawLine(ox + p0.x, p0.y - 1, ox + p1.x, p1.y - 1, [100, 220, 120, 255], thick * 0.45);
                // Diamondback gold pattern
                if (i % 2 === 0) canvas.fillCircle(ox + (p0.x + p1.x) / 2, (p0.y + p1.y) / 2 + 1, 2, [225, 190, 60, 255]);
            }

            // Viper Head
            const headX = ox + 52, headY = baseY - 12 + wave * 0.8;
            canvas.fillEllipse(headX, headY, 6.5, 4.5, [20, 75, 38, 255]);
            canvas.fillEllipse(headX, headY - 0.5, 5.5, 3.5, [50, 170, 80, 255]);
            canvas.fillRect(headX + 1, headY - 1.5, 3, 2, [255, 215, 0, 255]); // Slit Eye
            canvas.setPixel(headX + 2, headY - 1, 190, 0, 0, 255);

            // Forked Tongue
            const tongueOut = (f % 4 === 1 || f % 4 === 2);
            if (tongueOut) {
                canvas.drawLine(headX + 5, headY, headX + 11, headY, [230, 40, 50, 255], 1.5);
                canvas.setPixel(headX + 12, headY - 1.5, 230, 40, 50, 255);
                canvas.setPixel(headX + 12, headY + 1.5, 230, 40, 50, 255);
            }
        }

        // -------------------------------------------------------------
        // ROW 2: RAT (Rat Furtif)
        // -------------------------------------------------------------
        {
            const oy = 2 * frameH;
            const baseY = oy + 44 + bob * 0.9;

            // Shadow
            canvas.fillEllipse(ox + 32, oy + 54, 18, 5, [10, 15, 20, 110]);

            // Long Scaly Tail
            const tailCurve = Math.sin(t * 2) * 4;
            canvas.drawLine(ox + 16, baseY - 2, ox + 8, baseY - 4 + tailCurve, [195, 135, 145, 255], 2.5);
            canvas.drawLine(ox + 8, baseY - 4 + tailCurve, ox + 2, baseY - 9 + tailCurve * 1.5, [215, 155, 165, 255], 2);

            // Body
            canvas.fillEllipse(ox + 27, baseY - 3, 12, 8, [75, 55, 45, 255]);
            canvas.fillEllipse(ox + 27, baseY - 3, 10, 6, [115, 85, 70, 255]);

            // Legs
            canvas.drawLine(ox + 20, baseY + 1, ox + 19, baseY + 8, [95, 70, 58, 255], 2.5);
            canvas.drawLine(ox + 36, baseY + 1, ox + 37, baseY + 8, [95, 70, 58, 255], 2.5);
            canvas.fillRect(ox + 18, baseY + 7, 3, 2, [215, 155, 165, 255]);
            canvas.fillRect(ox + 36, baseY + 7, 3, 2, [215, 155, 165, 255]);

            // Head & Snout
            const headX = ox + 40, headY = baseY - 5;
            canvas.fillCircle(headX, headY, 6, [105, 78, 65, 255]);
            canvas.drawLine(headX, headY + 1, headX + 8, headY + 2, [135, 102, 85, 255], 3);
            canvas.fillRect(headX + 7, headY + 1, 2, 2, [235, 130, 145, 255]); // Pink Nose

            // Ear
            canvas.fillCircle(headX - 3, headY - 5, 3.5, [105, 78, 65, 255]);
            canvas.fillCircle(headX - 3, headY - 5, 2, [230, 150, 165, 255]);

            // Beady Eye with Glint
            canvas.fillRect(headX + 2, headY - 2, 2, 2, [20, 20, 25, 255]);
            canvas.setPixel(headX + 3, headY - 2, 255, 255, 255, 255);

            // Whiskers
            const wT = Math.sin(t * 3) * 2;
            canvas.drawLine(headX + 5, headY + 1, headX + 12, headY - 2 + wT, [200, 200, 200, 180], 1);
            canvas.drawLine(headX + 5, headY + 2, headX + 12, headY + 5 - wT, [200, 200, 200, 180], 1);
        }

        // -------------------------------------------------------------
        // ROW 3: GUARDIAN (Gardien du Trésor)
        // -------------------------------------------------------------
        {
            const oy = 3 * frameH;
            const baseY = oy + 38 + Math.sin(t) * 3.5;

            // Shadow on ground
            canvas.fillEllipse(ox + 32, oy + 56, 22, 6, [10, 15, 25, 130]);

            // Orbiting Mystic Runic Stones
            for (let r = 0; r < 3; r++) {
                const rAngle = t + (r * Math.PI * 2) / 3;
                const rx = ox + 32 + Math.cos(rAngle) * 24;
                const ry = baseY - 3 + Math.sin(rAngle) * 8;
                canvas.fillCircle(rx, ry, 3.5, [0, 230, 255, 240]);
                canvas.fillCircle(rx, ry, 1.8, [220, 255, 255, 255]);
            }

            // Torso & Armor
            canvas.fillRect(ox + 21, baseY - 9, 22, 19, [35, 45, 55, 255]);
            canvas.fillRect(ox + 23, baseY - 7, 18, 15, [60, 75, 90, 255]);
            canvas.drawLine(ox + 21, baseY - 9, ox + 42, baseY - 9, [220, 180, 50, 255], 2);
            canvas.drawLine(ox + 21, baseY + 9, ox + 42, baseY + 9, [220, 180, 50, 255], 2);

            // Glowing Arcane Chest Core
            const corePulse = 0.8 + Math.sin(t * 2) * 0.2;
            canvas.fillCircle(ox + 32, baseY + 1, 4.5, [0, Math.round(180 * corePulse), 255, 255]);
            canvas.fillCircle(ox + 32, baseY + 1, 2, [200, 255, 255, 255]);

            // Pauldrons
            canvas.fillRect(ox + 14, baseY - 11, 8, 11, [50, 62, 75, 255]);
            canvas.fillRect(ox + 42, baseY - 11, 8, 11, [50, 62, 75, 255]);
            canvas.drawLine(ox + 14, baseY - 11, ox + 21, baseY - 11, [220, 180, 50, 255], 1.5);
            canvas.drawLine(ox + 42, baseY - 11, ox + 49, baseY - 11, [220, 180, 50, 255], 1.5);

            // Stone Helm
            canvas.fillRect(ox + 25, baseY - 22, 14, 12, [40, 50, 62, 255]);
            canvas.fillRect(ox + 26, baseY - 21, 12, 10, [70, 85, 100, 255]);
            // Glowing Eye Visor
            canvas.drawLine(ox + 27, baseY - 17, ox + 36, baseY - 17, [0, 245, 255, 255], 2.5);
            canvas.drawLine(ox + 28, baseY - 17, ox + 35, baseY - 17, [255, 255, 255, 255], 1.5);

            // Crown / Crest
            canvas.drawLine(ox + 25, baseY - 22, ox + 22, baseY - 28, [200, 160, 40, 255], 2.5);
            canvas.drawLine(ox + 38, baseY - 22, ox + 41, baseY - 28, [200, 160, 40, 255], 2.5);
        }

        // -------------------------------------------------------------
        // ROW 4: BIRD (Oiseau / Mouette / Aigle)
        // -------------------------------------------------------------
        {
            const oy = 4 * frameH;
            const baseY = oy + 32;
            const flap = Math.sin(t);

            // Body
            canvas.fillEllipse(ox + 32, baseY, 8, 4, [240, 245, 250, 255]);
            canvas.fillEllipse(ox + 38, baseY - 1, 4, 3.5, [240, 245, 250, 255]);
            canvas.drawLine(ox + 41, baseY - 1, ox + 46, baseY, [255, 160, 20, 255], 2);
            canvas.setPixel(ox + 39, baseY - 2, 20, 20, 30, 255);

            // Wings
            const wingY = baseY - flap * 12;
            canvas.drawLine(ox + 29, baseY, ox + 15, wingY, [210, 220, 235, 255], 4);
            canvas.drawLine(ox + 15, wingY, ox + 6, wingY - flap * 5, [100, 120, 150, 255], 3);
            canvas.drawLine(ox + 33, baseY, ox + 43, wingY, [230, 238, 248, 255], 4);
            canvas.drawLine(ox + 43, wingY, ox + 54, wingY - flap * 5, [120, 140, 170, 255], 3);
        }

        // -------------------------------------------------------------
        // ROW 5: FISH (Poisson bondissant)
        // -------------------------------------------------------------
        {
            const oy = 5 * frameH;
            const progress = f / frameCount;
            const leapY = oy + 48 - Math.sin(progress * Math.PI) * 30;
            const leapX = ox + 14 + progress * 36;

            canvas.fillEllipse(leapX, leapY, 8, 4.5, [255, 130, 20, 255]);
            canvas.fillEllipse(leapX + 1, leapY, 6, 3, [255, 200, 50, 255]);
            canvas.drawLine(leapX - 6, leapY, leapX - 12, leapY - 4, [0, 180, 210, 255], 2.5);
            canvas.drawLine(leapX - 6, leapY, leapX - 12, leapY + 4, [0, 180, 210, 255], 2.5);
            canvas.fillCircle(leapX, leapY - 4, 2.5, [0, 190, 220, 255]);
            canvas.fillRect(leapX + 5, leapY - 1, 2, 2, [20, 20, 30, 255]);
            canvas.setPixel(leapX + 6, leapY - 2, 255, 255, 255, 255);

            if (f === 0 || f === frameCount - 1) {
                canvas.fillCircle(leapX, oy + 50, 3, [180, 235, 255, 220]);
                canvas.fillCircle(leapX - 6, oy + 48, 1.5, [210, 245, 255, 200]);
                canvas.fillCircle(leapX + 6, oy + 48, 1.5, [210, 245, 255, 200]);
            }
        }

        // -------------------------------------------------------------
        // ROW 6: CRAB (Crabe des plages)
        // -------------------------------------------------------------
        {
            const oy = 6 * frameH;
            const baseY = oy + 45;
            const step = Math.sin(t * 2) * 2.5;

            canvas.fillEllipse(ox + 32, oy + 55, 18, 4, [10, 15, 20, 100]);

            // Legs
            canvas.drawLine(ox + 21, baseY, ox + 13, baseY + 8 + step, [180, 35, 25, 255], 2);
            canvas.drawLine(ox + 24, baseY + 1, ox + 17, baseY + 9 - step, [180, 35, 25, 255], 2);
            canvas.drawLine(ox + 43, baseY, ox + 51, baseY + 8 - step, [180, 35, 25, 255], 2);
            canvas.drawLine(ox + 40, baseY + 1, ox + 47, baseY + 9 + step, [180, 35, 25, 255], 2);

            // Carapace
            canvas.fillEllipse(ox + 32, baseY, 11, 6.5, [210, 45, 30, 255]);
            canvas.fillEllipse(ox + 32, baseY - 1, 9, 4.5, [245, 85, 60, 255]);

            // Claws
            const snap = Math.sin(t) * 2.5;
            canvas.drawLine(ox + 24, baseY - 2, ox + 15, baseY - 8, [210, 45, 30, 255], 3.5);
            canvas.fillCircle(ox + 14, baseY - 9, 4.5, [240, 75, 50, 255]);
            canvas.drawLine(ox + 14, baseY - 11, ox + 10, baseY - 14 + snap, [240, 75, 50, 255], 2);

            canvas.drawLine(ox + 40, baseY - 2, ox + 49, baseY - 8, [210, 45, 30, 255], 3.5);
            canvas.fillCircle(ox + 50, baseY - 9, 4.5, [240, 75, 50, 255]);
            canvas.drawLine(ox + 50, baseY - 11, ox + 54, baseY - 14 - snap, [240, 75, 50, 255], 2);

            // Stalk Eyes
            canvas.drawLine(ox + 29, baseY - 5, ox + 28, baseY - 10, [210, 45, 30, 255], 2);
            canvas.drawLine(ox + 35, baseY - 5, ox + 36, baseY - 10, [210, 45, 30, 255], 2);
            canvas.fillCircle(ox + 28, baseY - 10, 2, [255, 255, 255, 255]);
            canvas.fillCircle(ox + 36, baseY - 10, 2, [255, 255, 255, 255]);
            canvas.setPixel(ox + 28, baseY - 10, 10, 10, 20, 255);
            canvas.setPixel(ox + 36, baseY - 10, 10, 10, 20, 255);
        }

        // -------------------------------------------------------------
        // ROW 7: BUTTERFLY (Papillon)
        // -------------------------------------------------------------
        {
            const oy = 7 * frameH;
            const baseY = oy + 32 + Math.sin(t * 1.5) * 5;
            const wingWidth = Math.abs(Math.cos(t * 2)) * 14 + 3;

            canvas.drawLine(ox + 32, baseY - 7, ox + 32, baseY + 7, [40, 25, 45, 255], 2.5);
            canvas.drawLine(ox + 32, baseY - 7, ox + 28, baseY - 12, [40, 25, 45, 255], 1.5);
            canvas.drawLine(ox + 32, baseY - 7, ox + 36, baseY - 12, [40, 25, 45, 255], 1.5);

            // Left Wings
            canvas.fillEllipse(ox + 32 - wingWidth * 0.6, baseY - 4, wingWidth * 0.6, 7, [145, 55, 185, 240]);
            canvas.fillEllipse(ox + 32 - wingWidth * 0.6, baseY - 4, wingWidth * 0.4, 4, [245, 195, 60, 255]);
            canvas.fillEllipse(ox + 32 - wingWidth * 0.5, baseY + 4, wingWidth * 0.5, 5.5, [65, 175, 225, 240]);

            // Right Wings
            canvas.fillEllipse(ox + 32 + wingWidth * 0.6, baseY - 4, wingWidth * 0.6, 7, [145, 55, 185, 240]);
            canvas.fillEllipse(ox + 32 + wingWidth * 0.6, baseY - 4, wingWidth * 0.4, 4, [245, 195, 60, 255]);
            canvas.fillEllipse(ox + 32 + wingWidth * 0.5, baseY + 4, wingWidth * 0.5, 5.5, [65, 175, 225, 240]);
        }
    }

    canvas.save('assets/spritesheet_creatures.png');
}

// -------------------------------------------------------------
// 3. EFFECTS & ACTION FX SPRITESHEET (8 rows x 8 frames of 64x64, total 512x512)
// -------------------------------------------------------------
function generateEffects() {
    const frameW = 64, frameH = 64, frameCount = 8, rowCount = 8;
    const canvas = new PixelCanvas(frameW * frameCount, frameH * rowCount);

    for (let f = 0; f < frameCount; f++) {
        const ox = f * frameW;
        const progress = f / (frameCount - 1);

        // -------------------------------------------------------------
        // ROW 0: AXE CHOP (Coupe de bois)
        // -------------------------------------------------------------
        {
            const oy = 0 * frameH;
            const cx = ox + 32, cy = oy + 32;

            if (f <= 3) {
                const angle = -Math.PI * 0.4 + (f / 3) * Math.PI * 0.8;
                const ax = cx + Math.cos(angle) * 18;
                const ay = cy + Math.sin(angle) * 18;
                canvas.drawLine(cx, cy, ax, ay, [220, 240, 255, 200], 3);
                canvas.fillCircle(ax, ay, 5.5, [160, 175, 190, 255]);
                canvas.drawLine(ax - 3, ay - 3, ax + 3, ay + 3, [240, 248, 255, 255], 2.5);
            }
            if (f >= 2) {
                const p = (f - 2) / 5;
                const chipCount = 10;
                for (let c = 0; c < chipCount; c++) {
                    const cAngle = (c / chipCount) * Math.PI * 2;
                    const cDist = p * 32;
                    const cpx = cx + Math.cos(cAngle) * cDist;
                    const cpy = cy + Math.sin(cAngle) * cDist + (p * p) * 12;
                    canvas.fillRect(cpx - 2, cpy - 2, 4, 4, [145, 90, 45, Math.round(255 * (1 - p * 0.7))]);
                    canvas.fillRect(cpx - 1, cpy - 1, 2.5, 2.5, [215, 155, 85, 255]);
                }
                if (f === 2 || f === 3) {
                    canvas.fillCircle(cx, cy, (4 - f) * 4, [255, 240, 180, 240]);
                }
            }
        }

        // -------------------------------------------------------------
        // ROW 1: PICKAXE MINING (Minage de pierre)
        // -------------------------------------------------------------
        {
            const oy = 1 * frameH;
            const cx = ox + 32, cy = oy + 32;

            if (f <= 3) {
                const angle = -Math.PI * 0.5 + (f / 3) * Math.PI * 0.9;
                const px = cx + Math.cos(angle) * 20;
                const py = cy + Math.sin(angle) * 20;
                canvas.drawLine(cx, cy, px, py, [100, 60, 30, 255], 3);
                canvas.drawLine(px - 4, py + 3, px + 4, py - 3, [180, 190, 205, 255], 4);
            }
            if (f >= 2) {
                const p = (f - 2) / 5;
                const rockCount = 12;
                for (let r = 0; r < rockCount; r++) {
                    const rAngle = (r / rockCount) * Math.PI * 2;
                    const rDist = p * 34;
                    const rpx = cx + Math.cos(rAngle) * rDist;
                    const rpy = cy + Math.sin(rAngle) * rDist + (p * p) * 14;
                    canvas.fillRect(rpx - 2.5, rpy - 2.5, 5, 4, [85, 95, 105, 255]);
                    canvas.fillRect(rpx - 1.5, rpy - 1.5, 3, 2.5, [145, 160, 175, 255]);
                }
                if (f === 2 || f === 3) {
                    canvas.fillCircle(cx, cy, (4 - f) * 5, [255, 230, 120, 255]);
                }
            }
        }

        // -------------------------------------------------------------
        // ROW 2: CRAFT / BUILD (Fabrication / Construction)
        // -------------------------------------------------------------
        {
            const oy = 2 * frameH;
            const cx = ox + 32, cy = oy + 32;

            const sparkCount = 12;
            for (let s = 0; s < sparkCount; s++) {
                const sAngle = -Math.PI * 0.1 - (s / sparkCount) * Math.PI * 0.8;
                const sDist = progress * 30;
                const spx = cx + Math.cos(sAngle) * sDist;
                const spy = cy + Math.sin(sAngle) * sDist;
                canvas.fillCircle(spx, spy, 2, [255, 220, 40, Math.round(255 * (1 - progress))]);
                canvas.setPixel(spx, spy, 255, 255, 220, 255);
            }

            if (f >= 2) {
                const pDist = (progress - 0.25) * 22;
                canvas.fillCircle(cx - 10, cy - pDist, 5.5, [210, 215, 225, Math.round(180 * (1 - progress))]);
                canvas.fillCircle(cx + 10, cy - pDist * 1.2, 6.5, [190, 200, 215, Math.round(180 * (1 - progress))]);
            }

            const starR = Math.sin(progress * Math.PI) * 10;
            if (starR > 0) {
                canvas.drawLine(cx - starR, cy, cx + starR, cy, [255, 235, 100, 255], 2);
                canvas.drawLine(cx, cy - starR, cx, cy + starR, [255, 235, 100, 255], 2);
            }
        }

        // -------------------------------------------------------------
        // ROW 3: SWORD SLASH / COMBAT (Coup d'épée / Dégâts)
        // -------------------------------------------------------------
        {
            const oy = 3 * frameH;
            const cx = ox + 32, cy = oy + 32;

            const startAngle = -Math.PI * 0.8 + progress * Math.PI * 0.4;
            const endAngle = startAngle + Math.PI * 0.75;
            const radius = 24;

            for (let a = startAngle; a <= endAngle; a += 0.06) {
                const sx = cx + Math.cos(a) * radius;
                const sy = cy + Math.sin(a) * radius;
                const alpha = Math.round(255 * Math.sin(progress * Math.PI));
                canvas.fillCircle(sx, sy, 3.5, [160, 220, 255, alpha]);
                canvas.fillCircle(sx, sy, 1.5, [255, 255, 255, alpha]);
            }

            if (f >= 2 && f <= 5) {
                canvas.fillCircle(cx, cy, (f - 1) * 5, [255, 60, 40, 200]);
                canvas.fillCircle(cx, cy, (f - 1) * 2.5, [255, 240, 180, 255]);
            }
        }

        // -------------------------------------------------------------
        // ROW 4: WATER SPLASH / FISHING (Éclaboussure / Pêche)
        // -------------------------------------------------------------
        {
            const oy = 4 * frameH;
            const cx = ox + 32, cy = oy + 42;

            const ringR = progress * 24;
            for (let a = 0; a < Math.PI * 2; a += 0.08) {
                const rx = cx + Math.cos(a) * ringR;
                const ry = cy + Math.sin(a) * ringR * 0.4;
                const alpha = Math.round(220 * (1 - progress));
                canvas.setPixel(rx, ry, 190, 235, 255, alpha);
                canvas.setPixel(rx, ry + 1, 140, 210, 240, Math.round(alpha * 0.6));
            }

            const dropCount = 10;
            for (let d = 0; d < dropCount; d++) {
                const dAngle = -Math.PI * 0.1 - (d / dropCount) * Math.PI * 0.8;
                const dDist = Math.sin(progress * Math.PI) * 24;
                const dpx = cx + Math.cos(dAngle) * dDist;
                const dpy = cy + Math.sin(dAngle) * dDist;
                canvas.fillCircle(dpx, dpy, 2, [215, 245, 255, 240]);
                canvas.setPixel(dpx, dpy, 255, 255, 255, 255);
            }
        }

        // -------------------------------------------------------------
        // ROW 5: TREASURE SHINE (Brillance Trésor / Étoile dorée)
        // -------------------------------------------------------------
        {
            const oy = 5 * frameH;
            const cx = ox + 32, cy = oy + 32;

            const flareR = Math.sin(progress * Math.PI) * 22;
            if (flareR > 0) {
                for (let r = 0; r <= flareR; r++) {
                    const alpha = Math.round(255 * (1 - r / flareR));
                    canvas.setPixel(cx + r, cy, 255, 220, 80, alpha);
                    canvas.setPixel(cx - r, cy, 255, 220, 80, alpha);
                    canvas.setPixel(cx, cy + r, 255, 220, 80, alpha);
                    canvas.setPixel(cx, cy - r, 255, 220, 80, alpha);

                    const dr = Math.round(r * 0.6);
                    canvas.setPixel(cx + dr, cy + dr, 255, 240, 140, alpha);
                    canvas.setPixel(cx - dr, cy + dr, 255, 240, 140, alpha);
                    canvas.setPixel(cx + dr, cy - dr, 255, 240, 140, alpha);
                    canvas.setPixel(cx - dr, cy - dr, 255, 240, 140, alpha);
                }
                canvas.fillCircle(cx, cy, 3.5, [255, 255, 240, 255]);
            }
        }

        // -------------------------------------------------------------
        // ROW 6: HEAL / HEART (Soin & Récupération)
        // -------------------------------------------------------------
        {
            const oy = 6 * frameH;
            const cx = ox + 32, cy = oy + 44 - progress * 24;

            const alpha = Math.round(255 * (1 - progress * 0.35));

            const heartMatrix = [
                [0, 1, 1, 0, 1, 1, 0],
                [1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1],
                [0, 1, 1, 1, 1, 1, 0],
                [0, 0, 1, 1, 1, 0, 0],
                [0, 0, 0, 1, 0, 0, 0],
            ];

            for (let hy = 0; hy < 6; hy++) {
                for (let hx = 0; hx < 7; hx++) {
                    if (heartMatrix[hy][hx]) {
                        const px = cx + (hx - 3) * 2.5;
                        const py = cy + (hy - 3) * 2.5;
                        canvas.fillRect(px, py, 2.5, 2.5, [240, 45, 85, alpha]);
                        if (hy <= 2 && hx <= 2) canvas.fillRect(px, py, 2, 2, [255, 140, 170, alpha]);
                    }
                }
            }

            const spCount = 5;
            for (let s = 0; s < spCount; s++) {
                const sa = (s / spCount) * Math.PI * 2 + progress * 2.5;
                const sd = 12 + progress * 10;
                const spx = cx + Math.cos(sa) * sd;
                const spy = cy + Math.sin(sa) * sd;
                canvas.drawLine(spx - 3, spy, spx + 3, spy, [90, 245, 130, alpha], 1.5);
                canvas.drawLine(spx, spy - 3, spx, spy + 3, [90, 245, 130, alpha], 1.5);
            }
        }

        // -------------------------------------------------------------
        // ROW 7: LEVEL UP / CELEBRATION (Niveau supérieur)
        // -------------------------------------------------------------
        {
            const oy = 7 * frameH;
            const cx = ox + 32, cy = oy + 32;

            const beamH = progress * 42;
            canvas.drawLine(cx, oy + 56, cx, oy + 56 - beamH, [255, 215, 0, Math.round(255 * (1 - progress))], 4);
            canvas.drawLine(cx, oy + 56, cx, oy + 56 - beamH, [255, 255, 200, 255], 2);

            const starCount = 8;
            for (let st = 0; st < starCount; st++) {
                const sAngle = (st / starCount) * Math.PI * 2 + progress * 3;
                const sRadius = progress * 24;
                const sx = cx + Math.cos(sAngle) * sRadius;
                const sy = cy + Math.sin(sAngle) * sRadius - progress * 10;
                canvas.fillCircle(sx, sy, 2.2, [255, 220, 60, 255]);
                canvas.setPixel(sx, sy, 255, 255, 255, 255);
            }
        }
    }

    canvas.save('assets/spritesheet_effects.png');
}

// -------------------------------------------------------------
// 4. WATER WAVES & LAGOON SPRITESHEET (8 frames of 64x64, total 512x64)
// -------------------------------------------------------------
function generateWater() {
    const frameW = 64, frameH = 64, frameCount = 8;
    const canvas = new PixelCanvas(frameW * frameCount, frameH);

    for (let f = 0; f < frameCount; f++) {
        const ox = f * frameW;
        const t = (f / frameCount) * Math.PI * 2;

        for (let y = 0; y < frameH; y++) {
            const yr = y / frameH;
            const r = Math.round(20 + yr * 25);
            const g = Math.round(110 + yr * 60);
            const b = Math.round(160 + yr * 55);
            canvas.drawLine(ox, y, ox + frameW - 1, y, [r, g, b, 255], 1);
        }

        const waveCount = 5;
        for (let w = 0; w < waveCount; w++) {
            const baseY = 10 + w * 12;
            for (let x = 0; x < frameW; x++) {
                const waveY = baseY + Math.sin((x / frameW) * Math.PI * 4 + t + w * 1.3) * 3 + Math.cos((x / frameW) * Math.PI * 2 - t) * 2;
                canvas.setPixel(ox + x, waveY, 230, 250, 255, 220);
                canvas.setPixel(ox + x, waveY + 1, 140, 230, 250, 180);
                if ((x + f * 7 + w * 13) % 19 === 0) {
                    canvas.fillCircle(ox + x, waveY, 1.5, [255, 255, 255, 255]);
                }
            }
        }
    }

    canvas.save('assets/spritesheet_water.png');
}

// -------------------------------------------------------------
// 5. SURVIVOR CHARACTER SPRITESHEET (6 rows x 8 frames of 64x64)
// -------------------------------------------------------------
function generateSurvivor() {
    const frameW = 64, frameH = 64, frameCount = 8, rowCount = 6;
    const canvas = new PixelCanvas(frameW * frameCount, frameH * rowCount);

    for (let f = 0; f < frameCount; f++) {
        const ox = f * frameW;
        const t = (f / frameCount) * Math.PI * 2;
        const bob = Math.sin(t) * 1.5;

        // Common survivor colors
        const skin = [242, 203, 163];
        const shirt = [58, 125, 178];
        const pants = [70, 52, 40];
        const hair = [74, 44, 24];

        // ROW 0: Idle Breath
        {
            const oy = 0 * frameH;
            const baseY = oy + 42 + bob;

            canvas.fillEllipse(ox + 32, oy + 54, 14, 4, [10, 15, 20, 110]); // Shadow

            // Legs
            canvas.fillRect(ox + 27, baseY, 4, 10, pants);
            canvas.fillRect(ox + 33, baseY, 4, 10, pants);
            canvas.fillRect(ox + 26, baseY + 9, 5, 3, [35, 25, 18, 255]);
            canvas.fillRect(ox + 33, baseY + 9, 5, 3, [35, 25, 18, 255]);

            // Torso
            canvas.fillRect(ox + 25, baseY - 12, 14, 13, shirt);
            canvas.fillRect(ox + 28, baseY - 12, 8, 13, [75, 145, 200, 255]); // Shirt highlight

            // Arms
            canvas.fillRect(ox + 22, baseY - 11, 3, 10, shirt);
            canvas.fillRect(ox + 22, baseY - 1, 3, 3, skin);
            canvas.fillRect(ox + 39, baseY - 11, 3, 10, shirt);
            canvas.fillRect(ox + 39, baseY - 1, 3, 3, skin);

            // Head
            canvas.fillCircle(ox + 32, baseY - 18, 6, skin);
            // Hair
            canvas.fillEllipse(ox + 32, baseY - 22, 6.5, 4, hair);
            // Eyes
            const blink = (f === 2 || f === 6);
            if (!blink) {
                canvas.fillRect(ox + 34, baseY - 18, 2, 2, [30, 30, 40, 255]);
                canvas.setPixel(ox + 35, baseY - 18, 255, 255, 255, 255);
            } else {
                canvas.drawLine(ox + 34, baseY - 18, ox + 36, baseY - 18, [30, 30, 40, 255], 1);
            }
        }

        // ROW 1: Walk Cycle
        {
            const oy = 1 * frameH;
            const walkStep = Math.sin(t) * 6;
            const baseY = oy + 42 + Math.abs(Math.sin(t)) * 2;

            canvas.fillEllipse(ox + 32, oy + 54, 14, 4, [10, 15, 20, 110]);

            // Legs
            canvas.drawLine(ox + 29, baseY, ox + 27 - walkStep, baseY + 10, pants, 4);
            canvas.drawLine(ox + 35, baseY, ox + 37 + walkStep, baseY + 10, pants, 4);

            // Torso
            canvas.fillRect(ox + 25, baseY - 12, 14, 13, shirt);

            // Arms (swinging)
            canvas.drawLine(ox + 23, baseY - 10, ox + 21 + walkStep * 0.8, baseY + 1, shirt, 3);
            canvas.drawLine(ox + 41, baseY - 10, ox + 43 - walkStep * 0.8, baseY + 1, shirt, 3);

            // Head
            canvas.fillCircle(ox + 32, baseY - 18, 6, skin);
            canvas.fillEllipse(ox + 32, baseY - 22, 6.5, 4, hair);
            canvas.fillRect(ox + 34, baseY - 18, 2, 2, [30, 30, 40, 255]);
        }

        // ROW 2: Chop / Action
        {
            const oy = 2 * frameH;
            const baseY = oy + 42;
            const swing = (f / frameCount) * Math.PI * 0.8 - Math.PI * 0.3;

            canvas.fillEllipse(ox + 32, oy + 54, 14, 4, [10, 15, 20, 110]);
            canvas.fillRect(ox + 27, baseY, 4, 10, pants);
            canvas.fillRect(ox + 33, baseY, 4, 10, pants);
            canvas.fillRect(ox + 25, baseY - 12, 14, 13, shirt);

            // Swinging Axe
            const handX = ox + 32 + Math.cos(swing) * 14;
            const handY = baseY - 12 + Math.sin(swing) * 14;
            canvas.drawLine(ox + 32, baseY - 10, handX, handY, shirt, 3);
            canvas.drawLine(handX, handY, handX + Math.cos(swing) * 8, handY + Math.sin(swing) * 8, [180, 190, 205, 255], 3);

            canvas.fillCircle(ox + 32, baseY - 18, 6, skin);
            canvas.fillEllipse(ox + 32, baseY - 22, 6.5, 4, hair);
            canvas.fillRect(ox + 34, baseY - 18, 2, 2, [30, 30, 40, 255]);
        }

        // ROW 3: Combat Attack
        {
            const oy = 3 * frameH;
            const baseY = oy + 42;
            const thrust = Math.sin(t) * 5;

            canvas.fillEllipse(ox + 32, oy + 54, 14, 4, [10, 15, 20, 110]);
            canvas.fillRect(ox + 25, baseY, 4, 10, pants);
            canvas.fillRect(ox + 35, baseY, 4, 10, pants);
            canvas.fillRect(ox + 25, baseY - 12, 14, 13, shirt);

            // Sword Thrust
            canvas.drawLine(ox + 32, baseY - 8, ox + 44 + thrust, baseY - 6, [200, 220, 240, 255], 3);
            canvas.fillRect(ox + 46 + thrust, baseY - 7, 3, 2, [255, 255, 255, 255]);

            canvas.fillCircle(ox + 32, baseY - 18, 6, skin);
            canvas.fillEllipse(ox + 32, baseY - 22, 6.5, 4, hair);
            canvas.fillRect(ox + 34, baseY - 18, 2, 2, [30, 30, 40, 255]);
        }

        // ROW 4: Forage / Kneel
        {
            const oy = 4 * frameH;
            const baseY = oy + 46;

            canvas.fillEllipse(ox + 32, oy + 54, 14, 4, [10, 15, 20, 110]);
            canvas.fillRect(ox + 26, baseY - 3, 12, 6, pants);
            canvas.fillRect(ox + 25, baseY - 14, 12, 12, shirt);

            // Searching hands
            canvas.drawLine(ox + 30, baseY - 8, ox + 38, baseY - 2, skin, 2.5);

            canvas.fillCircle(ox + 30, baseY - 18, 6, skin);
            canvas.fillEllipse(ox + 30, baseY - 22, 6.5, 4, hair);
            canvas.fillRect(ox + 33, baseY - 17, 2, 2, [30, 30, 40, 255]);
        }

        // ROW 5: Victory Cheer
        {
            const oy = 5 * frameH;
            const baseY = oy + 42 + Math.abs(Math.sin(t * 2)) * 3;

            canvas.fillEllipse(ox + 32, oy + 54, 14, 4, [10, 15, 20, 110]);
            canvas.fillRect(ox + 27, baseY, 4, 10, pants);
            canvas.fillRect(ox + 33, baseY, 4, 10, pants);
            canvas.fillRect(ox + 25, baseY - 12, 14, 13, shirt);

            // Arms raised up
            canvas.drawLine(ox + 25, baseY - 10, ox + 18, baseY - 22, shirt, 3);
            canvas.drawLine(ox + 39, baseY - 10, ox + 46, baseY - 22, shirt, 3);
            canvas.fillCircle(ox + 18, baseY - 23, 2, skin);
            canvas.fillCircle(ox + 46, baseY - 23, 2, skin);

            canvas.fillCircle(ox + 32, baseY - 18, 6, skin);
            canvas.fillEllipse(ox + 32, baseY - 22, 6.5, 4, hair);
            canvas.fillRect(ox + 30, baseY - 18, 2, 2, [30, 30, 40, 255]);
            canvas.fillRect(ox + 34, baseY - 18, 2, 2, [30, 30, 40, 255]);
            canvas.drawLine(ox + 30, baseY - 15, ox + 34, baseY - 15, [180, 50, 40, 255], 1.5); // Smile
        }
    }

    canvas.save('assets/spritesheet_character.png');
}

console.log('Generating pixel art spritesheets...');
generateCampfire();
generateCreatures();
generateEffects();
generateWater();
generateSurvivor();
console.log('All spritesheets generated successfully!');
