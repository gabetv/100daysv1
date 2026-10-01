// js/ui/sprites.js — Moteur d'animations et spritesheets en pixel art
import { getAsset } from './draw.js';

// --- Configuration des spritesheets ---
export const SPRITE_DEFS = {
    campfire: { asset: 'spritesheet_campfire', frameW: 64, frameH: 64, frameCount: 8, fps: 8 },
    creatures: {
        asset: 'spritesheet_creatures', frameW: 64, frameH: 64, frameCount: 8, fps: 7,
        rows: {
            'Loup Agressif': 0, 'wolf': 0,
            'Serpent Venimeux': 1, 'snake': 1,
            'Rat Furtif': 2, 'rat': 2,
            'Gardien du Trésor': 3, 'guardian': 3,
            'bird': 4,
            'fish': 5,
            'crab': 6,
            'butterfly': 7
        }
    },
    effects: {
        asset: 'spritesheet_effects', frameW: 64, frameH: 64, frameCount: 8, fps: 12,
        rows: {
            'chop': 0, 'wood': 0,
            'mine': 1, 'stone': 1,
            'craft': 2, 'build': 2,
            'slash': 3, 'attack': 3, 'combat': 3,
            'splash': 4, 'fish': 4,
            'shine': 5, 'treasure': 5, 'gold': 5,
            'heal': 6, 'gain': 6,
            'levelup': 7, 'level': 7
        }
    },
    water: { asset: 'spritesheet_water', frameW: 64, frameH: 64, frameCount: 8, fps: 6 },
    character: {
        asset: 'spritesheet_character', frameW: 64, frameH: 64, frameCount: 8, fps: 8,
        rows: {
            'idle': 0,
            'walk': 1,
            'chop': 2,
            'attack': 3,
            'forage': 4,
            'victory': 5
        }
    }
};

// --- Effets actifs à l'écran (one-shot animations) ---
const activeEffects = [];

/**
 * Déclenche un effet visuel pixel art ponctuel
 * @param {string} type 'chop' | 'mine' | 'craft' | 'slash' | 'splash' | 'shine' | 'heal' | 'levelup'
 * @param {number} x Position X sur le canvas (en pixels)
 * @param {number} y Position Y sur le canvas (en pixels)
 * @param {number} scale Échelle de l'effet (défaut 1.0)
 */
export function triggerPixelEffect(type, x, y, scale = 1.0) {
    const row = SPRITE_DEFS.effects.rows[type] ?? 0;
    activeEffects.push({
        type,
        row,
        x,
        y,
        scale,
        startTime: Date.now(),
        duration: (SPRITE_DEFS.effects.frameCount / SPRITE_DEFS.effects.fps) * 1000
    });
}

/**
 * Dessine tous les effets pixel art actifs
 */
export function drawActiveEffects(ctx) {
    if (!ctx || !activeEffects.length) return;
    const img = getAsset(SPRITE_DEFS.effects.asset);
    if (!img || !img.complete) return;

    const now = Date.now();
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    for (let i = activeEffects.length - 1; i >= 0; i--) {
        const fx = activeEffects[i];
        const elapsed = now - fx.startTime;
        if (elapsed >= fx.duration) {
            activeEffects.splice(i, 1);
            continue;
        }

        const progress = elapsed / fx.duration;
        const frameIdx = Math.min(SPRITE_DEFS.effects.frameCount - 1, Math.floor(progress * SPRITE_DEFS.effects.frameCount));
        const frameW = SPRITE_DEFS.effects.frameW;
        const frameH = SPRITE_DEFS.effects.frameH;

        const sx = frameIdx * frameW;
        const sy = fx.row * frameH;
        const targetSize = frameW * fx.scale;

        ctx.drawImage(
            img,
            sx, sy, frameW, frameH,
            fx.x - targetSize / 2, fx.y - targetSize / 2,
            targetSize, targetSize
        );
    }

    ctx.restore();
}

/**
 * Dessine le feu de camp animé en pixel art
 */
export function drawAnimatedCampfire(ctx, cx, baseY, targetW, targetH) {
    const img = getAsset(SPRITE_DEFS.campfire.asset);
    const def = SPRITE_DEFS.campfire;
    const now = Date.now();

    // Lueur radiale douce et dynamique autour du feu
    const flicker = 0.82 + Math.sin(now / 110) * 0.12 + Math.sin(now / 47) * 0.06;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glowRadius = targetH * 1.35;
    const g = ctx.createRadialGradient(cx, baseY - targetH * 0.45, 0, cx, baseY - targetH * 0.45, glowRadius);
    g.addColorStop(0, `rgba(255, 175, 65, ${0.40 * flicker})`);
    g.addColorStop(0.45, `rgba(255, 110, 30, ${0.16 * flicker})`);
    g.addColorStop(1, 'rgba(255, 80, 20, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, baseY - targetH * 0.45, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (img && img.complete && img.naturalWidth) {
        // Frame d'animation
        const frameIdx = Math.floor((now / 1000) * def.fps) % def.frameCount;
        const sx = frameIdx * def.frameW;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 8;
        ctx.drawImage(
            img,
            sx, 0, def.frameW, def.frameH,
            cx - targetW / 2, baseY - targetH,
            targetW, targetH
        );
        ctx.restore();
        return true;
    }
    return false;
}

/**
 * Dessine une créature hostile animée en pixel art
 */
export function drawAnimatedCreature(ctx, enemyName, x, y, size, bob = 0, options = {}) {
    // Compat : anciens appels drawAnimatedCreature(ctx, name, x, y, size, { ... }).
    if (bob && typeof bob === 'object') {
        options = bob;
        bob = options.bob || 0;
    }

    const img = getAsset(SPRITE_DEFS.creatures.asset);
    const def = SPRITE_DEFS.creatures;
    const normalizedName = String(enemyName || '').replace(/\s+alpha$/i, '');
    const row = def.rows[enemyName] ?? def.rows[normalizedName];

    if (img && img.complete && img.naturalWidth && row !== undefined) {
        const now = Date.now();
        const frameOffset = options.frameOffset || 0;
        const frameIdx = (Math.floor((now / 1000) * def.fps) + frameOffset) % def.frameCount;
        const sx = frameIdx * def.frameW;
        const sy = row * def.frameH;

        const facing = options.facing == null ? 1 : Math.sign(options.facing) || 1;
        const squash = Math.max(0.72, Math.min(1.32, options.squash ?? 1));
        const stretch = Math.max(0.72, Math.min(1.32, options.stretch ?? 1));
        const alpha = options.alpha ?? 1;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha *= alpha;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 8;

        const drawH = size * 1.35 * stretch;
        const drawW = size * 1.35 * squash;

        // Les sprites de la planche regardent tous le même côté. En combat on
        // les miroite pour que la bête fixe vraiment le survivant.
        ctx.translate(Math.round(x), Math.round(y + bob));
        if (facing < 0) ctx.scale(-1, 1);
        ctx.drawImage(
            img,
            sx, sy, def.frameW, def.frameH,
            -drawW / 2, -drawH / 2,
            drawW, drawH
        );
        if (options.tint) {
            ctx.shadowBlur = 0;
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = options.tint;
            ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
        }
        ctx.restore();
        return true;
    }
    return false;
}

// --- Faune ambiante vivante (Ambient Wildlife) ---
class WildlifeManager {
    constructor() {
        this.birds = [];
        this.fishes = [];
        this.crabs = [];
        this.butterflies = [];
        this.lastSpawn = Date.now();
    }

    update(w, h, biome, dt) {
        const now = Date.now();

        // 1. Oiseaux en Forêt, Plaine ou Plage
        if (['Forêt', 'Plaine', 'Plage'].includes(biome)) {
            if (this.birds.length < 3 && now - this.lastSpawn > 4000) {
                this.birds.push({
                    x: -60,
                    y: h * (0.12 + Math.random() * 0.25),
                    vx: 75 + Math.random() * 40,
                    vy: (Math.random() - 0.5) * 15,
                    scale: 0.65 + Math.random() * 0.35,
                    seed: Math.random() * 10
                });
                this.lastSpawn = now;
            }
        }
        for (let i = this.birds.length - 1; i >= 0; i--) {
            const b = this.birds[i];
            b.x += b.vx * dt;
            b.y += Math.sin(now / 600 + b.seed) * 8 * dt;
            if (b.x > w + 80) this.birds.splice(i, 1);
        }

        // 2. Poissons en Lagon ou Plage
        if (['Lagon', 'Plage'].includes(biome)) {
            if (this.fishes.length < 2 && Math.random() < 0.015) {
                this.fishes.push({
                    x: w * (0.2 + Math.random() * 0.6),
                    y: h * (0.68 + Math.random() * 0.18),
                    scale: 0.75 + Math.random() * 0.3,
                    startTime: now,
                    duration: 1200
                });
            }
        }
        for (let i = this.fishes.length - 1; i >= 0; i--) {
            if (now - this.fishes[i].startTime > this.fishes[i].duration) {
                this.fishes.splice(i, 1);
            }
        }

        // 3. Crabes sur la Plage
        if (biome === 'Plage') {
            if (this.crabs.length < 3 && Math.random() < 0.02) {
                this.crabs.push({
                    x: w * (0.15 + Math.random() * 0.7),
                    y: h * (0.82 + Math.random() * 0.10),
                    dir: Math.random() > 0.5 ? 1 : -1,
                    scale: 0.6 + Math.random() * 0.3,
                    life: 6000 + Math.random() * 6000,
                    spawnTime: now
                });
            }
        }
        for (let i = this.crabs.length - 1; i >= 0; i--) {
            const c = this.crabs[i];
            c.x += c.dir * 18 * dt;
            if (now - c.spawnTime > c.life || c.x < -40 || c.x > w + 40) {
                this.crabs.splice(i, 1);
            }
        }

        // 4. Papillons en Plaine ou Forêt
        if (['Plaine', 'Forêt'].includes(biome)) {
            if (this.butterflies.length < 4 && Math.random() < 0.025) {
                this.butterflies.push({
                    x: Math.random() * w,
                    y: h * (0.55 + Math.random() * 0.3),
                    vx: (Math.random() - 0.5) * 35,
                    vy: (Math.random() - 0.5) * 20,
                    scale: 0.55 + Math.random() * 0.3,
                    seed: Math.random() * 10,
                    spawnTime: now,
                    life: 8000 + Math.random() * 6000
                });
            }
        }
        for (let i = this.butterflies.length - 1; i >= 0; i--) {
            const bt = this.butterflies[i];
            bt.x += bt.vx * dt + Math.sin(now / 400 + bt.seed) * 12 * dt;
            bt.y += bt.vy * dt + Math.cos(now / 500 + bt.seed) * 10 * dt;
            if (now - bt.spawnTime > bt.life || bt.x < -30 || bt.x > w + 30) {
                this.butterflies.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        if (!ctx) return;
        const img = getAsset(SPRITE_DEFS.creatures.asset);
        if (!img || !img.complete) return;

        const def = SPRITE_DEFS.creatures;
        const now = Date.now();
        ctx.save();
        ctx.imageSmoothingEnabled = false;

        // Dessiner les oiseaux (row 4)
        const birdRow = def.rows.bird;
        this.birds.forEach(b => {
            const frameIdx = Math.floor((now / 1000) * 8) % def.frameCount;
            const sx = frameIdx * def.frameW;
            const sy = birdRow * def.frameH;
            const size = def.frameW * b.scale;
            ctx.drawImage(img, sx, sy, def.frameW, def.frameH, b.x, b.y, size, size);
        });

        // Dessiner les poissons bondissants (row 5)
        const fishRow = def.rows.fish;
        this.fishes.forEach(f => {
            const progress = (now - f.startTime) / f.duration;
            const frameIdx = Math.min(def.frameCount - 1, Math.floor(progress * def.frameCount));
            const sx = frameIdx * def.frameW;
            const sy = fishRow * def.frameH;
            const size = def.frameW * f.scale;
            ctx.drawImage(img, sx, sy, def.frameW, def.frameH, f.x - size / 2, f.y - size / 2, size, size);
        });

        // Dessiner les crabes (row 6)
        const crabRow = def.rows.crab;
        this.crabs.forEach(c => {
            const frameIdx = Math.floor((now / 1000) * 6) % def.frameCount;
            const sx = frameIdx * def.frameW;
            const sy = crabRow * def.frameH;
            const size = def.frameW * c.scale;
            ctx.drawImage(img, sx, sy, def.frameW, def.frameH, c.x - size / 2, c.y - size / 2, size, size);
        });

        // Dessiner les papillons (row 7)
        const btfRow = def.rows.butterfly;
        this.butterflies.forEach(bt => {
            const frameIdx = Math.floor((now / 1000) * 10) % def.frameCount;
            const sx = frameIdx * def.frameW;
            const sy = btfRow * def.frameH;
            const size = def.frameW * bt.scale;
            ctx.drawImage(img, sx, sy, def.frameW, def.frameH, bt.x - size / 2, bt.y - size / 2, size, size);
        });

        ctx.restore();
    }
}

export const wildlifeManager = new WildlifeManager();

/**
 * Dessine des vagues animées sur le lagon / la plage
 */
export function drawAnimatedWaterWaves(ctx, w, h, biome) {
    if (!['Lagon', 'Plage'].includes(biome)) return;
    const img = getAsset(SPRITE_DEFS.water.asset);
    if (!img || !img.complete) return;

    const def = SPRITE_DEFS.water;
    const now = Date.now();
    const frameIdx = Math.floor((now / 1000) * def.fps) % def.frameCount;
    const sx = frameIdx * def.frameW;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = biome === 'Lagon' ? 0.35 : 0.22;
    ctx.globalCompositeOperation = 'screen';

    // Répétition des tuiles de vagues animées sur le bas / milieu de l'écran d'eau
    const tileH = h * 0.12;
    const tileW = tileH;
    const startY = biome === 'Lagon' ? h * 0.42 : h * 0.68;

    for (let x = -tileW; x < w + tileW; x += tileW) {
        ctx.drawImage(
            img,
            sx, 0, def.frameW, def.frameH,
            x, startY, tileW, tileH
        );
        ctx.drawImage(
            img,
            ((frameIdx + 3) % def.frameCount) * def.frameW, 0, def.frameW, def.frameH,
            x + tileW * 0.5, startY + tileH * 0.5, tileW, tileH
        );
    }

    ctx.restore();
}

/**
 * Dessine l'étincelle scintillante d'un coffre ou trésor
 */
export function drawTreasureGlintPixel(ctx, cx, cy, scale = 1.0) {
    const img = getAsset(SPRITE_DEFS.effects.asset);
    if (!img || !img.complete) return;

    const def = SPRITE_DEFS.effects;
    const now = Date.now();
    const frameIdx = Math.floor((now / 1000) * 6) % def.frameCount;
    const sx = frameIdx * def.frameW;
    const sy = def.rows.shine * def.frameH;
    const size = def.frameW * scale;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(
        img,
        sx, sy, def.frameW, def.frameH,
        cx - size / 2, cy - size / 2,
        size, size
    );
    ctx.restore();
}
