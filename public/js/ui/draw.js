// js/ui/draw.js
import { TILE_TYPES, ITEM_TYPES, CONFIG, ENEMY_SPRITES, CHARACTER_APPEARANCE, DEFAULT_CHARACTER_APPEARANCE } from '../config.js';
import { getItemImage, getTileImage, tileIconHTML } from './icons.js';
import DOM from './dom.js';
import {
    drawAnimatedCampfire,
    drawAnimatedCreature,
    drawAnimatedWaterWaves,
    drawTreasureGlintPixel,
    drawActiveEffects,
    wildlifeManager,
    triggerPixelEffect
} from './sprites.js';

export { triggerPixelEffect };

const loadedAssets = {};

const TILE_ICONS = { // Utilisé comme fallback si tile.type.icon n'est pas défini
    'Lagon': '🌊', 'Plage': '🏖️', 'Forêt': '🌲', 'Friche': '🍂',
    'Plaine': '🌳', 'Mine': '⛰️', 'Feu de Camp': '🔥', // #29 Gisement de Pierre -> Mine (terrain)
    'Abri Individuel': '⛺', 'Abri Collectif': '🏠', 'Mine (Bâtiment)': '⛏️🏭', // #29 Renamed Mine building
    // Trésor Caché utilise déjà TILE_TYPES.TREASURE_CHEST.icon
    'default': '❓'
};

export function loadAssets(paths) {
    const promises = Object.entries(paths).map(([key, src]) => new Promise((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => { loadedAssets[key] = img; resolve(); };
        img.onerror = () => {
            console.warn(`Asset non chargé : ${key} (${src}) — le jeu continue sans.`);
            resolve();
        };
    }));
    return Promise.all(promises);
}

export function getAsset(key) { return loadedAssets[key]; }

let bgState = { key: null, prevKey: null, since: 0 };
const BG_FADE_MS = 420;

function paintBackgroundImage(ctx, img, w, h, alpha, zoom) {
    if (!img || !img.complete || !img.naturalWidth) return false;
    const canvasAspect = w / h;
    const imageAspect = img.naturalWidth / img.naturalHeight;
    let sx = 0, sy = 0, sWidth = img.naturalWidth, sHeight = img.naturalHeight;

    // Léger balancement + respiration de la caméra (parallaxe douce)
    const t = Date.now();
    const swayX = Math.sin(t / 5200) * (img.naturalWidth * 0.012);
    const swayY = Math.cos(t / 7100) * (img.naturalHeight * 0.008);

    if (imageAspect > canvasAspect) {
        sHeight = img.naturalHeight;
        sWidth = sHeight * canvasAspect;
    } else {
        sWidth = img.naturalWidth;
        sHeight = sWidth / canvasAspect;
    }
    // Zoom d'entrée lors d'un changement de case
    sWidth /= zoom; sHeight /= zoom;
    sx = (img.naturalWidth - sWidth) / 2 + swayX;
    sy = (img.naturalHeight - sHeight) / 2 + swayY;
    sx = Math.max(0, Math.min(img.naturalWidth - sWidth, sx));
    sy = Math.max(0, Math.min(img.naturalHeight - sHeight, sy));

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, w, h);
    ctx.restore();
    return true;
}

export function drawMainBackground(gameState) {
    const { mainViewCtx, mainViewCanvas } = DOM;
    if (!mainViewCtx || !mainViewCanvas) return;

    const w = mainViewCanvas.width, h = mainViewCanvas.height;
    // Les décors et sprites gardent des bords francs, y compris après le
    // recadrage vertical de la scène mobile.
    mainViewCtx.imageSmoothingEnabled = false;

    if (!gameState || !gameState.player || !gameState.map ||
        !gameState.map[gameState.player.y] || !gameState.map[gameState.player.y][gameState.player.x]) {
        mainViewCtx.fillStyle = '#12202a';
        mainViewCtx.fillRect(0, 0, w, h);
        return;
    }

    const playerTile = gameState.map[gameState.player.y][gameState.player.x];
    const key = playerTile.backgroundKey;

    if (key !== bgState.key) {
        bgState = { key, prevKey: bgState.key, since: Date.now() };
    }
    const elapsed = Date.now() - bgState.since;
    const fade = Math.min(1, elapsed / BG_FADE_MS);
    const ease = 1 - Math.pow(1 - fade, 3);

    mainViewCtx.fillStyle = playerTile.type.color || '#0d1a22';
    mainViewCtx.fillRect(0, 0, w, h);

    // Ancienne image en fondu sortant + zoom léger
    if (bgState.prevKey && fade < 1) {
        paintBackgroundImage(mainViewCtx, loadedAssets[bgState.prevKey], w, h, 1 - ease, 1 + 0.05 * ease);
    }
    const drawn = paintBackgroundImage(mainViewCtx, loadedAssets[key], w, h, ease, 1.05 - 0.05 * ease);
    if (!drawn && fade >= 1) {
        mainViewCtx.fillStyle = playerTile.type.color || '#222';
        mainViewCtx.fillRect(0, 0, w, h);
    }

    // Décor contextuel : ajoute un premier plan vivant au-dessus du fond fixe.
    // Il reste sous les personnages afin de préserver la lisibilité des interactions.
    drawBiomeDressing(mainViewCtx, w, h, playerTile);

    // Constructions présentes sur la case
    drawTileProps(mainViewCtx, w, h, playerTile);
}

/* -------------------------------------------------------------------------
 * Décor de scène procédural
 * -------------------------------------------------------------------------
 * Les illustrations de fond donnent l'identité de chaque biome. Cette couche
 * légère ajoute de la profondeur et un mouvement très discret sans multiplier
 * les gros fichiers image : les détails restent déterministes pour une tuile.
 */
function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
        value += 0x6D2B79F5;
        let t = value;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function getTileSeed(tile) {
    const pos = `${tile?.x ?? 0}:${tile?.y ?? 0}:${tile?.type?.name ?? ''}`;
    return hashString(pos);
}

// Les détails de décor sont volontairement quantifiés sur une petite grille.
// Le jeu garde ainsi un grain pixel art même lorsque le canvas est affiché en grand.
function scenePixelUnit(w, h) {
    return Math.max(2, Math.round(Math.min(w, h) / 230));
}

function snapPixel(value, unit) {
    return Math.round(value / unit) * unit;
}

function drawPixelTuft(ctx, x, baseY, height, lean, color, alpha = 1, unit = 2) {
    const steps = Math.max(3, Math.round(height / unit));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    for (let step = 0; step < steps; step++) {
        const progress = step / steps;
        const px = snapPixel(x + lean * (1 - progress), unit);
        const py = snapPixel(baseY - step * unit, unit);
        const width = step > steps * 0.72 ? unit : unit * (step % 3 === 0 ? 2 : 1);
        ctx.fillRect(px, py, width, unit);
    }
    ctx.restore();
}

function drawPixelPebble(ctx, x, y, size, colors, unit = 2) {
    const [shadow, base, highlight] = colors;
    const u = Math.max(unit, snapPixel(Math.max(size / 3, unit), unit));
    const px = snapPixel(x, unit);
    const py = snapPixel(y, unit);
    ctx.fillStyle = shadow;
    ctx.fillRect(px - u, py, u * 2, unit);
    ctx.fillRect(px - u * 2, py - u, u * 4, unit);
    ctx.fillStyle = base;
    ctx.fillRect(px - u, py - u * 2, u * 2, unit);
    ctx.fillRect(px - u * 2, py - u, u * 3, unit);
    if (highlight) {
        ctx.fillStyle = highlight;
        ctx.fillRect(px - u, py - u * 2, u, unit);
    }
}

function drawWaterGlints(ctx, w, h, rand, strength = 1) {
    const time = Date.now() / 1250;
    const unit = scenePixelUnit(w, h);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = '#e8ffff';
    for (let i = 0; i < 13; i++) {
        const y = snapPixel(h * (0.42 + rand() * 0.43), unit);
        const x = snapPixel(((rand() * 1.16 + time * (0.012 + rand() * 0.012)) % 1.16 - 0.08) * w, unit);
        const len = Math.max(unit * 3, snapPixel(w * (0.035 + rand() * 0.08), unit));
        ctx.globalAlpha = (0.12 + rand() * 0.16) * strength;
        ctx.fillRect(x, y, len, unit);
        if (i % 2 === 0) ctx.fillRect(x + unit, y - unit, Math.max(unit, len - unit * 3), unit);
    }
    ctx.restore();
}

function drawForestCanopy(ctx, w, h, rand) {
    const time = Date.now() / 2800;
    const unit = scenePixelUnit(w, h);
    ctx.save();
    for (const side of [-1, 1]) {
        const originX = side < 0 ? -w * 0.05 : w * 1.05;
        const originY = h * (0.04 + rand() * 0.1);
        const radius = w * (0.14 + rand() * 0.05);
        for (let i = 0; i < 24; i++) {
            const size = snapPixel(radius * (0.11 + rand() * 0.14), unit);
            const x = snapPixel(originX - side * radius * (0.08 + rand() * 1.05), unit);
            const y = snapPixel(originY + radius * (-0.08 + rand() * 0.98) + Math.sin(time + i) * unit, unit);
            ctx.globalAlpha = 0.17 + rand() * 0.20;
            ctx.fillStyle = i % 3 === 0 ? '#0d3528' : i % 2 ? '#174c34' : '#28613a';
            ctx.fillRect(x - size / 2, y - size / 2, size, size);
            if (i % 3 === 0) {
                ctx.fillStyle = '#3a7b45';
                ctx.globalAlpha *= 0.55;
                ctx.fillRect(x, y - size / 2, size / 2, size / 2);
            }
        }
    }
    ctx.restore();
}

function drawGroundDetails(ctx, w, h, tile, rand) {
    const biome = tile?.type?.name || '';
    const time = Date.now() / 1500;

    if (biome === 'Lagon') {
        drawWaterGlints(ctx, w, h, rand, 1.35);
        return;
    }

    if (biome === 'Plage') {
        drawWaterGlints(ctx, w, h, rand, 0.85);
        ctx.save();
        for (let i = 0; i < 9; i++) {
            const x = w * (0.06 + rand() * 0.88);
            const y = h * (0.77 + rand() * 0.17);
            const r = 1.5 + rand() * 3.5;
            ctx.globalAlpha = i % 3 === 0 ? 0.42 : 0.58;
            drawPixelPebble(ctx, x, y, r * 2.2,
                i % 3 === 0 ? ['#754b30', '#aa7040', '#d29b55'] : ['#b89c63', '#e2c67d', '#fff0bd'],
                scenePixelUnit(w, h));
        }
        for (let i = 0; i < 13; i++) {
            const x = w * (0.02 + rand() * 0.28);
            const baseY = h * (0.94 + rand() * 0.07);
            drawPixelTuft(ctx, x, baseY, h * (0.035 + rand() * 0.045), Math.sin(time + i) * 5, '#6f8d42', 0.72, scenePixelUnit(w, h));
        }
        ctx.restore();
        return;
    }

    if (biome === 'Forêt') {
        drawForestCanopy(ctx, w, h, rand);
    }

    if (biome === 'Mine (Terrain)' || biome === 'Mine (Bâtiment)') {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const x = w * 0.18, y = h * 0.48;
        const glow = 0.25 + Math.sin(Date.now() / 140) * 0.07;
        const g = ctx.createRadialGradient(x, y, 0, x, y, h * 0.16);
        g.addColorStop(0, `rgba(255, 181, 83, ${glow})`);
        g.addColorStop(1, 'rgba(255, 181, 83, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }

    const palette = biome === 'Friche'
        ? ['#704a30', '#8b6239', '#a87b48']
        : biome === 'Mine (Terrain)'
            ? ['#515b5e', '#788286', '#3c464c']
            : biome === 'Forêt'
                ? ['#1b5b38', '#2e7843', '#4c9145']
                : ['#3f8b36', '#5ba444', '#86bf54'];

    // Pierres / touffes discrètes ancrées vers le bas de l'image.
    ctx.save();
    for (let i = 0; i < 17; i++) {
        const x = w * (0.015 + rand() * 0.97);
        const y = h * (0.79 + rand() * 0.18);
        const size = h * (0.006 + rand() * 0.014);
        if (i % 3 === 0 || biome === 'Mine (Terrain)') {
            ctx.globalAlpha = 0.28 + rand() * 0.23;
            const base = palette[i % palette.length];
            drawPixelPebble(ctx, x, y, size * (1.6 + rand()), ['#203137', base, '#a9bab0'], scenePixelUnit(w, h));
        } else {
            drawPixelTuft(ctx, x, y + size, h * (0.028 + rand() * 0.045), Math.sin(time * 1.2 + i) * (3 + rand() * 6), palette[i % palette.length], 0.52, scenePixelUnit(w, h));
        }
    }
    ctx.restore();
}

function drawTreasureGlints(ctx, w, h, tile) {
    if (tile?.type?.name !== 'Trésor Caché' || tile?.isOpened) return;
    drawTreasureGlintPixel(ctx, w * 0.5, h * 0.65, 1.25);
    const t = Date.now() / 450;
    const unit = scenePixelUnit(w, h);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
        const pulse = (Math.sin(t + i * 1.7) + 1) * 0.5;
        const x = snapPixel(w * (0.27 + i * 0.15), unit);
        const y = snapPixel(h * (0.55 + (i % 2) * 0.10), unit);
        const arm = unit * (1 + Math.round(pulse * 2));
        ctx.globalAlpha = 0.28 + pulse * 0.64;
        ctx.fillStyle = '#ffe069';
        ctx.fillRect(x - arm, y, arm * 3, unit);
        ctx.fillRect(x, y - arm, unit, arm * 3);
        ctx.fillStyle = '#fff4bd';
        ctx.fillRect(x, y, unit, unit);
    }
    ctx.restore();
}

function drawBiomeDressing(ctx, w, h, tile) {
    if (!tile?.type) return;
    const biome = tile?.type?.name || '';
    const rand = seededRandom(getTileSeed(tile));
    drawGroundDetails(ctx, w, h, tile, rand);
    drawTreasureGlints(ctx, w, h, tile);

    // Vagues et caustiques animées sur l'eau
    drawAnimatedWaterWaves(ctx, w, h, biome);

    // Faune ambiante vivante en pixel art (oiseaux, poissons, crabes, papillons)
    const dt = 1 / 32;
    wildlifeManager.update(w, h, biome, dt);
    wildlifeManager.draw(ctx);
}

const PROP_FOR_BUILDING = {
    CAMPFIRE: { asset: 'prop_campfire', scale: 0.30, y: 0.80, x: 0.50 },
    SHELTER_INDIVIDUAL: { asset: 'prop_shelter', scale: 0.42, y: 0.74, x: 0.26 },
    SHELTER_COLLECTIVE: { asset: 'prop_shelter', scale: 0.55, y: 0.74, x: 0.26 },
    FORTERESSE: { asset: 'prop_shelter', scale: 0.62, y: 0.74, x: 0.24 },
    MINE: { asset: 'prop_mine', scale: 0.46, y: 0.76, x: 0.78 },
    ATELIER: { asset: 'prop_workbench', scale: 0.34, y: 0.80, x: 0.74 },
    ETABLI: { asset: 'prop_workbench', scale: 0.28, y: 0.80, x: 0.76 },
    FORGE: { asset: 'prop_workbench', scale: 0.34, y: 0.80, x: 0.20 },
};

/**
 * Dessine les constructions de la case dans le décor (sprites si dispo, sinon pastille icône).
 */
function drawTileProps(ctx, w, h, tile) {
    const buildings = tile.buildings || [];
    if (!buildings.length) return;

    const flicker = 0.85 + Math.sin(Date.now() / 110) * 0.15;

    buildings.slice(0, 4).forEach((b, i) => {
        const def = TILE_TYPES[b.key];
        const prop = PROP_FOR_BUILDING[b.key];
        const img = prop ? loadedAssets[prop.asset] : null;

        if (b.key === 'CAMPFIRE') {
            const targetH = h * (prop ? prop.scale : 0.30);
            const targetW = targetH * 1.15;
            const cx = w * ((prop ? prop.x : 0.50) + (i > 0 ? (i % 2 ? 0.14 : -0.14) : 0));
            const baseY = h * (prop ? prop.y : 0.80);

            // Feu de camp animé en pixel art avec spritesheet
            const drewAnimated = drawAnimatedCampfire(ctx, cx, baseY, targetW, targetH);
            if (drewAnimated) return;
        }

        if (img && img.complete && img.naturalWidth) {
            const targetH = h * prop.scale;
            const ratio = img.naturalWidth / img.naturalHeight;
            const targetW = targetH * ratio;
            const cx = w * (prop.x + (i > 0 ? (i % 2 ? 0.14 : -0.14) : 0));
            const baseY = h * prop.y;

            // Ombre au sol
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.ellipse(cx, baseY, targetW * 0.4, targetH * 0.08, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            ctx.drawImage(img, cx - targetW / 2, baseY - targetH, targetW, targetH);
        } else if (def) {
            // Pour les bâtiments qui n'ont pas encore leur grand prop, les
            // illustrations de tuile deviennent de vrais petits repères dans
            // le paysage plutôt qu'une simple icône flottante.
            const tileImg = getTileImage(def.name);
            const cx = w * (0.22 + i * 0.19);
            const baseY = h * (0.79 - (i % 2) * 0.035);
            const landmarkH = h * (0.16 + (i % 2) * 0.025);

            ctx.save();
            ctx.globalAlpha = 0.34;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.ellipse(cx, baseY, landmarkH * 0.48, landmarkH * 0.085, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            ctx.save();
            if (tileImg) {
                const ratio = tileImg.naturalWidth / tileImg.naturalHeight || 1;
                const landmarkW = landmarkH * ratio;
                ctx.shadowColor = 'rgba(0,0,0,0.6)';
                ctx.shadowBlur = 9;
                ctx.drawImage(tileImg, cx - landmarkW / 2, baseY - landmarkH, landmarkW, landmarkH);
            } else {
                const size = Math.max(34, h * 0.075);
                ctx.globalAlpha = 0.94;
                ctx.fillStyle = 'rgba(8, 18, 25, 0.63)';
                ctx.beginPath();
                ctx.arc(cx, baseY - size * 0.52, size * 0.62, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 212, 121, 0.55)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.font = `${Math.round(size * 0.62)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(def.icon || '🏗️', cx, baseY - size * 0.5);
            }
            ctx.restore();
        }
    });
}

// --- Utilitaires de style pour les personnages ---
const SKIN_TONES = ['#f2cba3', '#e0ac7e', '#c68a5f', '#a3653f', '#7d4a2b', '#f7dcc0'];
const HAIR_COLORS = ['#2b1d16', '#4a2c18', '#7a4a21', '#b5651d', '#d9b382', '#8c8c8c', '#1a1a1a'];
const HAIR_STYLES = ['short', 'bun', 'long', 'cap', 'bald', 'mohawk'];

function hashString(str) {
    let h = 0;
    const s = String(str || 'survivant');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
}

function characterLook(character) {
    const h = hashString(character.id || character.name || character.color);
    const appearance = character.appearance;
    const hasAppearance = appearance && typeof appearance === 'object';
    const skinId = CHARACTER_APPEARANCE.skin[appearance?.skin] ? appearance.skin : null;
    const hairId = CHARACTER_APPEARANCE.hair[appearance?.hair] ? appearance.hair : null;
    const style = CHARACTER_APPEARANCE.hairStyle[appearance?.hairStyle]
        ? appearance.hairStyle
        : (hasAppearance ? DEFAULT_CHARACTER_APPEARANCE.hairStyle : HAIR_STYLES[(h >> 6) % HAIR_STYLES.length]);
    const accessory = CHARACTER_APPEARANCE.accessory[appearance?.accessory]
        ? appearance.accessory
        : DEFAULT_CHARACTER_APPEARANCE.accessory;
    const outfitId = CHARACTER_APPEARANCE.outfit[appearance?.outfit] ? appearance.outfit : null;
    return {
        skin: skinId ? CHARACTER_APPEARANCE.skin[skinId].color : SKIN_TONES[h % SKIN_TONES.length],
        hair: hairId ? CHARACTER_APPEARANCE.hair[hairId].color : HAIR_COLORS[(h >> 3) % HAIR_COLORS.length],
        style,
        accessory,
        outfit: outfitId ? CHARACTER_APPEARANCE.outfit[outfitId].color : (character.color || '#4f8fbf'),
        beard: ((h >> 9) % 4) === 0,
        phase: (h % 100) / 100,
    };
}

function shadeColor(hex, amount) {
    const c = String(hex || '#888888').replace('#', '');
    const full = c.length === 3 ? c.split('').map(x => x + x).join('') : c.padEnd(6, '8');
    const num = parseInt(full.slice(0, 6), 16);
    const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
    const r = clamp(((num >> 16) & 255) + amount);
    const g = clamp(((num >> 8) & 255) + amount);
    const b = clamp((num & 255) + amount);
    return `rgb(${r}, ${g}, ${b})`;
}

function roundedRectPath(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
}

function limb(ctx, x1, y1, x2, y2, width, color, outline) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = outline;
    ctx.lineWidth = width + 2.5;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
}

function drawSpeechBubble(ctx, x, topY, text, scale) {
    ctx.save();
    const fontSize = Math.max(11, 14 * scale);
    ctx.font = `600 ${fontSize}px Poppins, sans-serif`;
    const maxWidth = 220 * scale;

    // Découpage du texte en lignes
    const words = String(text).split(' ');
    const lines = [];
    let line = '';
    words.forEach(w => {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
        else line = test;
    });
    if (line) lines.push(line);
    const displayed = lines.slice(0, 3);

    const padX = 12 * scale, padY = 8 * scale, lh = fontSize * 1.25;
    const bw = Math.max(...displayed.map(l => ctx.measureText(l).width)) + padX * 2;
    const bh = displayed.length * lh + padY * 2;
    const bx = x - bw / 2;
    const by = topY - bh - 12 * scale;

    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 10 * scale;
    ctx.fillStyle = 'rgba(12, 26, 35, 0.92)';
    roundedRectPath(ctx, bx, by, bw, bh, 10 * scale);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - 7 * scale, by + bh - 1);
    ctx.lineTo(x, by + bh + 9 * scale);
    ctx.lineTo(x + 7 * scale, by + bh - 1);
    ctx.closePath();
    ctx.fillStyle = 'rgba(12, 26, 35, 0.92)';
    ctx.fill();

    ctx.fillStyle = '#eaf6fb';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    displayed.forEach((l, i) => ctx.fillText(l, x, by + padY + lh * (i + 0.5)));
    ctx.restore();
}

/**
 * Dessine un personnage complet (joueur, autre joueur ou PNJ).
 * Le rendu est mis à l'échelle en fonction de la hauteur du canvas afin de rester
 * lisible sur mobile comme sur grand écran.
 */
function drawLegacyCharacter(ctx, character, x, y, isPlayer = false, animationProgress = 0, scale = 1) {
    const look = characterLook(character);
    const s = scale;
    const outline = 'rgba(10, 18, 24, 0.85)';
    const cloth = look.outfit || character.color || '#4f8fbf';
    const clothDark = shadeColor(cloth, -45);
    const clothLight = shadeColor(cloth, 35);
    const pants = shadeColor(look.hair, 10);

    // Dimensions de base (à l'échelle)
    const headR = 15 * s;
    const bodyW = 30 * s;
    const bodyH = 42 * s;
    const legLen = 26 * s;
    const armLen = 30 * s;

    const t = Date.now() / 1000;
    const moving = animationProgress > 0;
    const walk = moving ? Math.sin(animationProgress * Math.PI * 4) : 0;
    const breathe = Math.sin((t + look.phase * 6) * 1.6) * 1.2 * s;
    const bob = moving ? Math.abs(Math.sin(animationProgress * Math.PI * 4)) * 3 * s : 0;

    // y = position des pieds
    const feetY = y + legLen;
    const hipY = y - bob + breathe * 0.3;
    const bodyBottomY = hipY;
    const bodyTopY = hipY - bodyH;
    const shoulderY = bodyTopY + 8 * s;
    const headCY = bodyTopY - headR + 3 * s + breathe * 0.5;

    ctx.save();

    // --- Ombre portée ---
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, feetY + 3 * s, bodyW * 0.62, 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- Jambes ---
    const legSwing = walk * 9 * s;
    const hipOffset = bodyW * 0.22;
    limb(ctx, x - hipOffset, hipY, x - hipOffset + legSwing, feetY, 9 * s, pants, outline);
    limb(ctx, x + hipOffset, hipY, x + hipOffset - legSwing, feetY, 9 * s, pants, outline);
    // Chaussures
    ctx.fillStyle = '#3c2b20';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.5;
    [[-hipOffset + legSwing, 1], [hipOffset - legSwing, -1]].forEach(([dx, dir]) => {
        roundedRectPath(ctx, x + dx - 6 * s, feetY - 2 * s, 12 * s + dir * 0, 6 * s, 3 * s);
        ctx.fill(); ctx.stroke();
    });

    // --- Bras arrière ---
    const armSwing = walk * 10 * s;
    limb(ctx, x - bodyW * 0.42, shoulderY, x - bodyW * 0.5 - armSwing * 0.3, shoulderY + armLen - armSwing, 8 * s, clothDark, outline);
    ctx.fillStyle = look.skin;
    ctx.beginPath();
    ctx.arc(x - bodyW * 0.5 - armSwing * 0.3, shoulderY + armLen - armSwing, 4.5 * s, 0, Math.PI * 2);
    ctx.fill();

    // --- Torse ---
    const grad = ctx.createLinearGradient(x - bodyW / 2, bodyTopY, x + bodyW / 2, bodyBottomY);
    grad.addColorStop(0, clothLight);
    grad.addColorStop(0.55, cloth);
    grad.addColorStop(1, clothDark);
    ctx.fillStyle = grad;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.42, bodyTopY + 4 * s);
    ctx.quadraticCurveTo(x - bodyW * 0.56, bodyTopY + bodyH * 0.55, x - bodyW * 0.44, bodyBottomY);
    ctx.lineTo(x + bodyW * 0.44, bodyBottomY);
    ctx.quadraticCurveTo(x + bodyW * 0.56, bodyTopY + bodyH * 0.55, x + bodyW * 0.42, bodyTopY + 4 * s);
    ctx.quadraticCurveTo(x, bodyTopY - 3 * s, x - bodyW * 0.42, bodyTopY + 4 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Ceinture
    ctx.fillStyle = '#5a3a22';
    roundedRectPath(ctx, x - bodyW * 0.46, bodyBottomY - 7 * s, bodyW * 0.92, 6 * s, 2 * s);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d8b24a';
    roundedRectPath(ctx, x - 3.5 * s, bodyBottomY - 7 * s, 7 * s, 6 * s, 1.5 * s);
    ctx.fill();

    // Sac à dos (joueur uniquement)
    if (isPlayer) {
        ctx.fillStyle = '#6b4a2f';
        ctx.strokeStyle = outline;
        roundedRectPath(ctx, x + bodyW * 0.34, bodyTopY + 8 * s, 10 * s, bodyH * 0.55, 4 * s);
        ctx.fill(); ctx.stroke();
    }

    // --- Bras avant ---
    limb(ctx, x + bodyW * 0.42, shoulderY, x + bodyW * 0.5 + armSwing * 0.3, shoulderY + armLen + armSwing, 8 * s, cloth, outline);
    ctx.fillStyle = look.skin;
    ctx.beginPath();
    ctx.arc(x + bodyW * 0.5 + armSwing * 0.3, shoulderY + armLen + armSwing, 4.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // --- Équipement visible : arme/outil dans la main avant, bouclier au bras arrière ---
    const equip = character.equipment || {};
    const handX = x + bodyW * 0.5 + armSwing * 0.3;
    const handY = shoulderY + armLen + armSwing;
    if (equip.shield) {
        const shieldDef = ITEM_TYPES[equip.shield.name] || {};
        ctx.save();
        ctx.fillStyle = 'rgba(12, 22, 30, 0.55)';
        ctx.beginPath();
        ctx.arc(x - bodyW * 0.62, shoulderY + armLen * 0.75, 11 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `${Math.round(16 * s)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(shieldDef.icon || '🛡️', x - bodyW * 0.62, shoulderY + armLen * 0.75);
        ctx.restore();
    }
    if (equip.weapon) {
        const wDef = ITEM_TYPES[equip.weapon.name] || {};
        ctx.save();
        ctx.translate(handX + 4 * s, handY - 2 * s);
        ctx.rotate(-0.35 + walk * 0.18);
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = 4 * s;
        const wImg = getItemImage(equip.weapon.name);
        if (wImg) {
            const sizeW = 30 * s;
            ctx.drawImage(wImg, -sizeW / 2, -sizeW / 2, sizeW, sizeW);
        } else {
            ctx.font = `${Math.round(20 * s)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(wDef.icon || '🔧', 0, 0);
        }
        ctx.restore();
    }

    // --- Cou ---
    ctx.fillStyle = shadeColor(look.skin, -30);
    roundedRectPath(ctx, x - 4 * s, bodyTopY - 6 * s, 8 * s, 9 * s, 3 * s);
    ctx.fill();

    // --- Tête ---
    ctx.fillStyle = look.skin;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(x, headCY, headR * 0.92, headR, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ombre du visage
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, headCY, headR * 0.92, headR, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.13)';
    ctx.fillRect(x + headR * 0.25, headCY - headR, headR, headR * 2);
    ctx.restore();

    // Oreilles
    ctx.fillStyle = look.skin;
    ctx.beginPath();
    ctx.ellipse(x - headR * 0.92, headCY + 1 * s, 2.6 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + headR * 0.92, headCY + 1 * s, 2.6 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cheveux
    ctx.fillStyle = look.hair;
    if (look.style !== 'bald') {
        ctx.beginPath();
        if (look.style === 'mohawk') {
            ctx.ellipse(x, headCY - headR * 0.85, headR * 0.22, headR * 0.55, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(x, headCY - headR * 0.35, headR * 0.93, headR * 0.6, 0, Math.PI, 0);
            ctx.fill();
        } else if (look.style === 'cap') {
            ctx.fillStyle = shadeColor(cloth, -25);
            ctx.beginPath();
            ctx.ellipse(x, headCY - headR * 0.28, headR * 0.98, headR * 0.72, 0, Math.PI, 0);
            ctx.fill();
            roundedRectPath(ctx, x - headR * 1.15, headCY - headR * 0.34, headR * 2.3, 3.4 * s, 2 * s);
            ctx.fill();
        } else {
            ctx.ellipse(x, headCY - headR * 0.22, headR * 0.98, headR * 0.82, 0, Math.PI, 0);
            ctx.fill();
            if (look.style === 'long') {
                ctx.beginPath();
                ctx.ellipse(x - headR * 0.85, headCY + headR * 0.25, headR * 0.3, headR * 0.85, 0, 0, Math.PI * 2);
                ctx.ellipse(x + headR * 0.85, headCY + headR * 0.25, headR * 0.3, headR * 0.85, 0, 0, Math.PI * 2);
                ctx.fill();
            } else if (look.style === 'bun') {
                ctx.beginPath();
                ctx.arc(x, headCY - headR * 1.05, headR * 0.35, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Couvre-chef équipé
    if (character.equipment && character.equipment.head) {
        const hDef = ITEM_TYPES[character.equipment.head.name] || {};
        ctx.save();
        ctx.font = `${Math.round(22 * s)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4 * s;
        ctx.fillText(hDef.icon || '🎩', x, headCY - headR * 0.95);
        ctx.restore();
    }

    // Yeux (avec clignement)
    const blink = ((t + look.phase * 5) % 4.2) < 0.12;
    const eyeY = headCY + 1 * s;
    const eyeDX = headR * 0.36;
    if (blink) {
        ctx.strokeStyle = '#2b2b2b';
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.moveTo(x - eyeDX - 2.6 * s, eyeY); ctx.lineTo(x - eyeDX + 2.6 * s, eyeY);
        ctx.moveTo(x + eyeDX - 2.6 * s, eyeY); ctx.lineTo(x + eyeDX + 2.6 * s, eyeY);
        ctx.stroke();
    } else {
        ctx.fillStyle = '#fdfdfd';
        ctx.beginPath();
        ctx.ellipse(x - eyeDX, eyeY, 3.1 * s, 3.4 * s, 0, 0, Math.PI * 2);
        ctx.ellipse(x + eyeDX, eyeY, 3.1 * s, 3.4 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        const gaze = Math.sin(t * 0.6 + look.phase * 3) * 0.9 * s;
        ctx.fillStyle = '#20303a';
        ctx.beginPath();
        ctx.arc(x - eyeDX + gaze, eyeY + 0.4 * s, 1.6 * s, 0, Math.PI * 2);
        ctx.arc(x + eyeDX + gaze, eyeY + 0.4 * s, 1.6 * s, 0, Math.PI * 2);
        ctx.fill();
    }

    // Sourcils
    ctx.strokeStyle = shadeColor(look.hair, -20);
    ctx.lineWidth = 1.8 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - eyeDX - 3 * s, eyeY - 5.5 * s); ctx.lineTo(x - eyeDX + 3 * s, eyeY - 6.4 * s);
    ctx.moveTo(x + eyeDX - 3 * s, eyeY - 6.4 * s); ctx.lineTo(x + eyeDX + 3 * s, eyeY - 5.5 * s);
    ctx.stroke();

    // Bouche (expression selon la santé)
    const hp = character.health, hpMax = character.maxHealth || 10;
    const hurt = typeof hp === 'number' && hp / hpMax < 0.4;
    ctx.strokeStyle = '#7a4033';
    ctx.lineWidth = 1.7 * s;
    ctx.beginPath();
    if (hurt) ctx.arc(x, headCY + headR * 0.72, 3.4 * s, Math.PI * 1.15, Math.PI * 1.85);
    else ctx.arc(x, headCY + headR * 0.4, 4 * s, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();

    // Barbe
    if (look.beard) {
        ctx.fillStyle = look.hair;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.ellipse(x, headCY + headR * 0.62, headR * 0.6, headR * 0.42, 0, 0, Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // --- Étiquette de nom + anneau joueur ---
    if (isPlayer) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 212, 121, 0.75)';
        ctx.lineWidth = 2 * s;
        ctx.setLineDash([5 * s, 5 * s]);
        ctx.beginPath();
        ctx.ellipse(x, feetY + 3 * s, bodyW * 0.7, 8 * s, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    const label = character.name || character.username;
    if (label) {
        ctx.save();
        const fs = Math.max(10, 12 * s);
        ctx.font = `600 ${fs}px Poppins, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const w = ctx.measureText(label).width + 12 * s;
        const ny = headCY - headR - 14 * s;
        ctx.fillStyle = isPlayer ? 'rgba(255, 212, 121, 0.92)' : 'rgba(10, 22, 30, 0.72)';
        roundedRectPath(ctx, x - w / 2, ny - fs * 0.75, w, fs * 1.5, fs * 0.7);
        ctx.fill();
        ctx.fillStyle = isPlayer ? '#12222c' : '#e8f4fa';
        ctx.fillText(label, x, ny);
        ctx.restore();
    }

    // Bulle de dialogue
    if (character.chatMessage && (Date.now() - character.chatMessage.timestamp < 5000)) {
        drawSpeechBubble(ctx, x, headCY - headR - (label ? 28 * s : 10 * s), character.chatMessage.text, s);
    }

    ctx.restore();
}

/* -------------------------------------------------------------------------
 * Survivant pixel-art modulaire
 * -------------------------------------------------------------------------
 * Les décors sont peints en pixels ; le protagoniste doit l'être aussi. Cette
 * version est volontairement dessinée sur une grille, plutôt qu'avec des
 * formes lissées, pour garder des contours nets quelle que soit la taille de
 * l'écran. Les couches (peau, cheveux, tenue et accessoire) sont indépendantes
 * afin que la personnalisation reste visible dans le monde, pas seulement dans
 * un menu.
 */
function drawPixelTool(ctx, item, x, y, p, swing = 0) {
    if (!item) return;
    const name = String(item.name || '');
    const px = (gx, gy, gw, gh, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(x + gx * p), Math.round(y + gy * p), Math.max(1, Math.round(gw * p)), Math.max(1, Math.round(gh * p)));
    };
    const offset = Math.round(swing * 1.5);
    if (/hache/i.test(name)) {
        px(4 + offset, -9, 1, 8, '#694227');
        px(3 + offset, -9, 3, 3, '#c7d3d7');
        px(2 + offset, -8, 1, 2, '#7b8e95');
    } else if (/épée|lance|gourdain/i.test(name)) {
        const blade = /gourdain/i.test(name) ? '#75451f' : '#dce8e9';
        px(4 + offset, -10, 1, 9, blade);
        px(3 + offset, -2, 3, 1, '#d6a64b');
        if (!/gourdain/i.test(name)) px(4 + offset, -11, 1, 2, '#ffffff');
    } else if (/pelle|pioche/i.test(name)) {
        px(4 + offset, -9, 1, 8, '#765132');
        px(3 + offset, -10, 3, 3, '#b9c3c8');
    } else if (/canne|filet/i.test(name)) {
        px(4 + offset, -11, 1, 10, '#a87635');
        px(5 + offset, -11, 2, 1, '#d8ebee');
    } else {
        px(4 + offset, -7, 2, 5, '#d6a64b');
        px(3 + offset, -8, 4, 2, '#eff5ef');
    }
}

function drawPixelCharacter(ctx, character, x, y, isPlayer = false, animationProgress = 0, scale = 1, { showLabel = true } = {}) {
    const look = characterLook(character);
    const p = Math.max(2, Math.round(4 * scale));
    const t = Date.now() / 1000;
    const walking = animationProgress > 0;
    const step = walking ? Math.round(Math.sin(animationProgress * Math.PI * 4) * 1.2) : 0;
    const bob = walking
        ? Math.round(Math.abs(Math.sin(animationProgress * Math.PI * 4)) * p * 0.55)
        : Math.round(Math.sin((t + look.phase) * 1.8) * p * 0.24);
    const hipY = Math.round(y - bob);
    const anchorX = Math.round(x);
    const outfit = look.outfit || '#287c9d';
    const outline = '#122029';
    const pants = shadeColor(look.hair, -5);
    const shadow = '#071118';

    const block = (gx, gy, gw, gh, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(
            Math.round(anchorX + gx * p),
            Math.round(hipY + gy * p),
            Math.max(1, Math.round(gw * p)),
            Math.max(1, Math.round(gh * p)),
        );
    };
    const framed = (gx, gy, gw, gh, color, border = outline) => {
        block(gx - 0.5, gy - 0.5, gw + 1, gh + 1, border);
        block(gx, gy, gw, gh, color);
    };

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Ombre au sol en dalles, puis anneau de sélection du joueur.
    block(-5, 6.5, 10, 1, shadow);
    block(-3.5, 6, 7, 2, shadow);
    if (isPlayer) {
        const ring = '#f8d475';
        block(-6, 7.5, 3, 0.45, ring); block(3, 7.5, 3, 0.45, ring);
        block(-5.6, 6.5, 0.45, 1, ring); block(5.15, 6.5, 0.45, 1, ring);
    }

    // Jambes : le pas alterne sur une grille de pixels.
    framed(-4, 0, 3, 6 + Math.max(0, step), pants);
    framed(1, 0, 3, 6 + Math.max(0, -step), pants);
    block(-4.7 + step * 0.28, 5.4 + Math.max(0, step), 4, 1.6, '#35251d');
    block(0.7 - step * 0.28, 5.4 + Math.max(0, -step), 4, 1.6, '#35251d');

    // Bras arrière et sac : superposés avant la tunique.
    framed(-6, -9, 2, 7 - step, shadeColor(outfit, -28));
    block(-6, -2.5 - step, 2, 1.4, look.skin);
    if (isPlayer || character.equipment?.bag) {
        framed(4, -9, 2.3, 7, '#65442c');
        block(4.5, -7.3, 1.2, 1.1, '#bd8341');
    }

    // Torse et ceinture.
    framed(-4, -11, 8, 11, outfit);
    block(-3, -10, 2, 8, shadeColor(outfit, 22));
    block(-3.8, -2.1, 7.6, 1.2, '#674229');
    block(-0.55, -2.2, 1.1, 1.2, '#e1b84a');

    // Bras avant et main ; l'outil est dessiné au même ancrage.
    framed(4, -9, 2, 7 + step, outfit);
    block(4, -2.3 + step, 2, 1.5, look.skin);
    drawPixelTool(ctx, character.equipment?.weapon, anchorX, hipY, p, step);
    if (character.equipment?.shield) {
        framed(-8, -7, 2.4, 4, '#657983');
        block(-7.55, -6.5, 1.5, 2.6, '#9ebdc4');
    }

    // Cou, tête et oreilles.
    block(-1, -13, 2, 2, shadeColor(look.skin, -24));
    framed(-4, -19, 8, 7, look.skin);
    block(-4.8, -16.6, 0.9, 2.2, look.skin);
    block(3.9, -16.6, 0.9, 2.2, look.skin);
    // Ombre de visage + nez, sans dégradé pour préserver le rendu sprite.
    block(2.8, -17.6, 0.7, 4.5, shadeColor(look.skin, -30));
    block(0.5, -15.2, 1, 0.8, shadeColor(look.skin, -42));

    // Chevelure interchangeable.
    if (look.style !== 'bald') {
        if (look.style === 'mohawk') {
            block(-1, -22, 2, 3.5, look.hair);
            block(-4, -19.5, 8, 2.5, look.hair);
        } else if (look.style === 'cap') {
            block(-4.5, -20, 9, 2.4, shadeColor(outfit, -20));
            block(-5.2, -18, 10.3, 1.2, shadeColor(outfit, -35));
        } else {
            block(-4, -20, 8, 3.2, look.hair);
            block(-3, -17.9, 6, 1.4, look.hair);
            if (look.style === 'long') {
                block(-4.8, -17.3, 1.4, 5.2, look.hair);
                block(3.4, -17.3, 1.4, 5.2, look.hair);
            }
            if (look.style === 'bun') {
                block(-1.8, -22, 3.6, 2.7, look.hair);
            }
        }
    }

    // Visage : deux pixels d'yeux et une bouche. Les yeux clignent doucement.
    const blink = ((t + look.phase * 3) % 4.5) < 0.12;
    block(-2.3, -16.2, 1.1, blink ? 0.35 : 0.9, '#17242b');
    block(1.2, -16.2, 1.1, blink ? 0.35 : 0.9, '#17242b');
    block(-1.3, -13.7, 2.6, 0.5, '#854639');

    // Accessoire cosmétique, isolé afin de ne jamais modifier l'équipement.
    if (look.accessory === 'bandana') {
        block(-4.2, -18, 8.4, 1.15, '#d55a4a');
        block(3.9, -17, 1.5, 1.3, '#d55a4a');
    } else if (look.accessory === 'flower') {
        block(-5.1, -20.4, 1.4, 1.4, '#f7d4e1');
        block(-4.3, -21.2, 1.4, 1.4, '#f7d4e1');
        block(-4.3, -19.6, 1.4, 1.4, '#f7d4e1');
        block(-4.35, -20.4, 0.7, 0.7, '#f0ba43');
    } else if (look.accessory === 'monocle') {
        block(1.0, -16.8, 2.4, 2.4, '#e3d27b');
        block(1.55, -16.25, 1.3, 1.3, look.skin);
        block(3.2, -14.5, 0.5, 2.5, '#e3d27b');
    } else if (look.accessory === 'earring') {
        block(4.2, -14.4, 1, 1.8, '#f1ce62');
    } else if (look.accessory === 'scout') {
        block(-4.3, -18.8, 8.6, 1.1, '#74a85c');
        block(2.5, -18.4, 1.2, 1.2, '#d9edab');
    }

    if (character.equipment?.head) {
        // Le vrai casque/chapeau équipé reste prioritaire sur la coiffure.
        block(-4.6, -20.5, 9.2, 2.5, '#e4c36b');
        block(-5.5, -18.5, 11, 1.2, '#9b7132');
    }

    const label = showLabel ? (character.name || character.username) : '';
    if (label) {
        const fontSize = Math.max(9, Math.round(11 * scale));
        ctx.font = `700 ${fontSize}px Poppins, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const width = ctx.measureText(label).width + p * 3;
        const textY = hipY - 24 * p;
        ctx.fillStyle = isPlayer ? '#f6d681' : 'rgba(8, 22, 30, .82)';
        ctx.fillRect(Math.round(anchorX - width / 2), Math.round(textY - fontSize / 1.65), Math.round(width), Math.round(fontSize * 1.45));
        ctx.fillStyle = isPlayer ? '#13232b' : '#edf8fa';
        ctx.fillText(label, anchorX, textY);
    }
    if (character.chatMessage && (Date.now() - character.chatMessage.timestamp < 5000)) {
        drawSpeechBubble(ctx, anchorX, hipY - 24 * p - (label ? 14 * scale : 0), character.chatMessage.text, scale);
    }
    ctx.restore();
}

function drawCharacter(ctx, character, x, y, isPlayer = false, animationProgress = 0, scale = 1) {
    drawPixelCharacter(ctx, character, x, y, isPlayer, animationProgress, scale);
}

/** Prévisualisation de l'avatar pour le camp et le salon de personnalisation. */
export function drawCharacterPreview(canvas, player = {}, appearance = null) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width || 320;
    const h = canvas.height || 260;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#102f3b';
    ctx.fillRect(0, 0, w, h);
    // Ciel, mer et îlot en dalles : un petit diorama pixel-art autonome.
    ctx.fillStyle = '#1d5264'; ctx.fillRect(0, 0, w, h * 0.54);
    ctx.fillStyle = '#236f82'; ctx.fillRect(0, h * 0.54, w, h * 0.46);
    const tile = Math.max(4, Math.round(w / 44));
    for (let i = 0; i < 22; i++) {
        const px = (i * 37 + 13) % w;
        const py = h * (0.58 + ((i * 11) % 23) / 100);
        ctx.fillStyle = i % 2 ? '#68b7bd' : '#9dd8ce';
        ctx.fillRect(px, py, tile * (1 + i % 3), Math.max(2, tile / 2));
    }
    ctx.fillStyle = '#d5aa5a';
    ctx.fillRect(w * 0.14, h * 0.78, w * 0.72, h * 0.16);
    ctx.fillStyle = '#a87c3b';
    ctx.fillRect(w * 0.2, h * 0.9, w * 0.6, h * 0.07);
    for (let i = 0; i < 15; i++) {
        const px = w * (0.18 + ((i * 19) % 65) / 100);
        const py = h * (0.81 + ((i * 7) % 10) / 100);
        ctx.fillStyle = i % 2 ? '#edcf78' : '#af7a36';
        ctx.fillRect(px, py, tile, tile);
    }
    ctx.restore();
    const previewPlayer = {
        ...player,
        name: '',
        health: player.health ?? 20,
        maxHealth: player.maxHealth ?? 20,
        appearance: appearance || player.appearance,
    };
    drawPixelCharacter(ctx, previewPlayer, w / 2, h * 0.78, true, 0, Math.min(w / 320, h / 250) * 1.2, { showLabel: false });
}

/** Dessine quelques objets laissés au sol pour relier l'inventaire au monde. */
function drawGroundLoot(ctx, w, h, tile, scale) {
    const entries = Object.entries(tile?.groundItems || {}).filter(([, amount]) => Number(amount) > 0).slice(0, 3);
    if (!entries.length) return;

    const positions = [
        [0.24, 0.735], [0.77, 0.75], [0.14, 0.81],
    ];
    const pulse = (Math.sin(Date.now() / 420) + 1) * 0.5;

    entries.forEach(([name, amount], index) => {
        const [px, py] = positions[index];
        const x = w * px;
        const y = h * py;
        const size = Math.max(24, 34 * scale);
        const itemDef = ITEM_TYPES[name] || {};
        const img = getItemImage(name);

        ctx.save();
        // Petit halo : les objets restent visibles, y compris la nuit.
        const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 1.28);
        glow.addColorStop(0, `rgba(255, 218, 116, ${0.18 + pulse * 0.12})`);
        glow.addColorStop(1, 'rgba(255, 218, 116, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, size * 1.28, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(8, 20, 24, 0.58)';
        ctx.beginPath();
        ctx.ellipse(x, y + size * 0.31, size * 0.46, size * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();

        if (img) {
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 4 * scale;
            ctx.drawImage(img, x - size / 2, y - size * 0.75, size, size);
        } else {
            ctx.font = `${Math.round(size * 0.8)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(itemDef.icon || '📦', x, y - size * 0.23);
        }

        if (Number(amount) > 1) {
            const text = String(amount > 99 ? '99+' : amount);
            const fs = Math.max(9, 10 * scale);
            ctx.font = `700 ${fs}px Poppins, sans-serif`;
            const badgeW = ctx.measureText(text).width + 8 * scale;
            const bx = x + size * 0.3;
            const by = y - size * 0.42;
            ctx.fillStyle = 'rgba(8, 18, 24, 0.86)';
            roundedRectPath(ctx, bx - badgeW / 2, by - fs * 0.7, badgeW, fs * 1.4, fs * 0.6);
            ctx.fill();
            ctx.fillStyle = '#fff0c5';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, bx, by);
        }
        ctx.restore();
    });
}

/**
 * Quelques silhouettes au tout premier plan. Elles complètent le décor sans
 * recouvrir les cibles de jeu (le joueur se trouve volontairement au-dessus).
 */
function drawSceneForeground(ctx, w, h, tile, scale) {
    const biome = tile?.type?.name || '';
    if (!['Forêt', 'Plaine', 'Plage', 'Friche'].includes(biome)) return;

    const rand = seededRandom(getTileSeed(tile) ^ 0x9E3779B9);
    const time = Date.now() / 1200;
    const colors = biome === 'Friche'
        ? ['#3c2b1f', '#59402a', '#785535']
        : biome === 'Plage'
            ? ['#637d43', '#809b54', '#ac9a5a']
            : biome === 'Forêt'
                ? ['#0e3928', '#174b30', '#28633a']
                : ['#296c35', '#3f8d3c', '#62a044'];

    ctx.save();
    for (let i = 0; i < 33; i++) {
        const x = w * (rand() * 1.08 - 0.04);
        const baseY = h * (0.93 + rand() * 0.09);
        const height = h * (0.027 + rand() * 0.052) * Math.max(0.85, scale * 0.85);
        const sway = Math.sin(time * 1.25 + i * 0.79) * (3 + rand() * 5);
        drawPixelTuft(ctx, x, baseY, height, sway, colors[i % colors.length], 0.48 + rand() * 0.28, scenePixelUnit(w, h));
    }
    ctx.restore();
}


export function drawSceneCharacters(gameState) {
    if (!gameState || !gameState.player) return;
    const { player, npcs, enemies, map } = gameState;
    const { charactersCtx, charactersCanvas } = DOM;
    if (!charactersCtx || !charactersCanvas) return;

    charactersCtx.imageSmoothingEnabled = false;
    charactersCtx.clearRect(0, 0, charactersCanvas.width, charactersCanvas.height);
    const canvasWidth = charactersCanvas.width;
    const canvasHeight = charactersCanvas.height;
    const currentTile = map?.[player.y]?.[player.x];

    // Échelle des personnages : lisible aussi bien sur mobile que sur grand écran
    const scale = Math.max(0.75, Math.min(1.6, canvasHeight / 620));

    // Les objets déposés deviennent visibles directement dans la scène.
    drawGroundLoot(charactersCtx, canvasWidth, canvasHeight, currentTile, scale);

    // Position de base du joueur (plus bas sur l'écran)
    const playerBaseX = canvasWidth / 2;
    const playerBaseY = canvasHeight * 0.68;

    const charactersOnTile = [];
    // Ajouter le joueur
    charactersOnTile.push({ char: player, x: playerBaseX, y: playerBaseY, isPlayer: true, sortOrder: 1 }); // Joueur au premier plan (sortOrder plus élevé)

    // Ajouter les autres joueurs sur la même tuile
    for (const playerId in gameState.players) {
        if (playerId !== player.id) {
            const otherPlayer = gameState.players[playerId];
            if (otherPlayer.x === player.x && otherPlayer.y === player.y) {
                const sideOffset = (charactersOnTile.length % 2 === 0) ? -1 : 1; // Alterner gauche/droite
                const distanceOffset = (90 + (Math.floor(charactersOnTile.length / 2) * 45)) * scale;
                const offsetX = sideOffset * distanceOffset;
                charactersOnTile.push({ char: otherPlayer, x: playerBaseX + offsetX, y: playerBaseY, isPlayer: false, sortOrder: 0 });
            }
        }
    }

    // Ajouter les PNJ visibles sur la même tuile
    const visibleNpcs = npcs.filter(npc => npc.x === player.x && npc.y === player.y);
    visibleNpcs.forEach((npc, index) => {
        const sideOffset = (index % 2 === 0) ? -1 : 1; // Alterner gauche/droite
        const distanceOffset = (70 + (Math.floor(index / 2) * 40)) * scale; // Éloignement progressif
        const offsetX = sideOffset * distanceOffset;
        charactersOnTile.push({ char: npc, x: playerBaseX + offsetX, y: playerBaseY, isPlayer: false, sortOrder: 0 }); // PNJ derrière le joueur
    });

    // Trier les personnages pour le dessin (le joueur sera dessiné en dernier s'il a le sortOrder le plus élevé)
    charactersOnTile.sort((a, b) => a.sortOrder - b.sortOrder);

    // Gérer l'animation de transition du joueur
    if (player.animationState) {
        const { type, direction, progress } = player.animationState;
        const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const easedProgress = easeInOutCubic(progress);

        charactersOnTile.forEach(p => {
            let modX = 0, modY = 0;
            // Distance de déplacement pour l'animation (plus grande pour le joueur)
            let distanceFactor = p.isPlayer ? 1 : 0.9; // Les PNJ bougent un peu moins
            let baseDistance = (canvasWidth / 2) + (p.char.bodyWidth || 30) + 20; // Distance pour sortir de l'écran

            if (type === 'out') { // Animation de sortie
                let distance = baseDistance * easedProgress * distanceFactor;
                if(direction === 'east') modX = distance;
                else if(direction === 'west') modX = -distance;
                else if(direction === 'south') modY = distance;
                else if(direction === 'north') modY = -distance;
                charactersCtx.globalAlpha = 1 - easedProgress; // Fade out
            } else { // Animation d'entrée (type === 'in')
                let distance = baseDistance * (1 - easedProgress) * distanceFactor; // Commence loin et se rapproche
                if(direction === 'east') modX = -distance; // Vient de la droite
                else if(direction === 'west') modX = distance;  // Vient de la gauche
                else if(direction === 'south') modY = -distance; // Vient du bas
                else if(direction === 'north') modY = distance;  // Vient du haut
                charactersCtx.globalAlpha = easedProgress; // Fade in
            }
            drawCharacter(charactersCtx, p.char, p.x + modX, p.y + modY, p.isPlayer, progress, scale);
        });
        charactersCtx.globalAlpha = 1; // Réinitialiser l'alpha
    } else {
        // Dessiner les personnages normalement si pas d'animation
        charactersOnTile.forEach(p => {
            const animProgress = p.isPlayer ? player.animationProgress || 0 : 0;
            drawCharacter(charactersCtx, p.char, p.x, p.y, p.isPlayer, animProgress, scale);
        });
    }

    // --- Ennemis présents sur la case ---
    const visibleEnemies = enemies.filter(e => e.x === player.x && e.y === player.y && !player.combatState);
    visibleEnemies.slice(0, 3).forEach((enemy, i) => {
        const side = i === 0 ? 0 : (i % 2 ? 1 : -1);
        const enemyX = canvasWidth / 2 + side * 120 * scale;
        const enemyY = canvasHeight * 0.42 + (i === 0 ? 0 : 18 * scale);
        const size = (i === 0 ? 66 : 50) * scale;
        const t = Date.now() / 1000;
        const bob = Math.sin(t * 2 + i) * 4 * scale;

        charactersCtx.save();

        // Ombre
        charactersCtx.globalAlpha = 0.3;
        charactersCtx.fillStyle = '#000';
        charactersCtx.beginPath();
        charactersCtx.ellipse(enemyX, enemyY + size * 0.48, size * 0.34, size * 0.1, 0, 0, Math.PI * 2);
        charactersCtx.fill();
        charactersCtx.globalAlpha = 1;

        // Aura menaçante
        const aura = charactersCtx.createRadialGradient(enemyX, enemyY + bob, 0, enemyX, enemyY + bob, size * 0.85);
        aura.addColorStop(0, 'rgba(220, 40, 40, 0.28)');
        aura.addColorStop(1, 'rgba(220, 40, 40, 0)');
        charactersCtx.fillStyle = aura;
        charactersCtx.beginPath();
        charactersCtx.arc(enemyX, enemyY + bob, size * 0.85, 0, Math.PI * 2);
        charactersCtx.fill();

        // Créature : sprite animé en pixel art avec spritesheet, sinon image fixe ou emoji
        const drewAnimated = drawAnimatedCreature(charactersCtx, enemy.name, enemyX, enemyY, size, bob);
        if (!drewAnimated) {
            const spriteKey = ENEMY_SPRITES[enemy.name];
            const sprite = spriteKey ? loadedAssets[spriteKey] : null;
            if (sprite && sprite.complete && sprite.naturalWidth) {
                const ratio = sprite.naturalWidth / sprite.naturalHeight;
                const sh = size * 1.35;
                const sw = sh * ratio;
                charactersCtx.save();
                charactersCtx.shadowColor = 'rgba(0,0,0,0.45)';
                charactersCtx.shadowBlur = 8 * scale;
                charactersCtx.drawImage(sprite, enemyX - sw / 2, enemyY + bob - sh / 2, sw, sh);
                charactersCtx.restore();
            } else {
                charactersCtx.font = `${Math.round(size)}px sans-serif`;
                charactersCtx.textAlign = 'center';
                charactersCtx.textBaseline = 'middle';
                charactersCtx.fillText(enemy.icon || '❓', enemyX, enemyY + bob);
            }
        }

        // Nom + barre de vie
        const label = enemy.name || 'Créature hostile';
        const barW = Math.max(60, size * 1.15);
        const barY = enemyY - size * 0.62 + bob;
        const ratio = enemy.maxHealth ? Math.max(0, Math.min(1, (enemy.health ?? enemy.maxHealth) / enemy.maxHealth)) : 1;

        charactersCtx.fillStyle = 'rgba(8, 16, 22, 0.72)';
        roundedRectPath(charactersCtx, enemyX - barW / 2, barY, barW, 7 * scale, 3.5 * scale);
        charactersCtx.fill();
        charactersCtx.fillStyle = ratio > 0.5 ? '#e05252' : '#ff8a3d';
        roundedRectPath(charactersCtx, enemyX - barW / 2 + 1, barY + 1, Math.max(2, (barW - 2) * ratio), 5 * scale, 2.5 * scale);
        charactersCtx.fill();

        charactersCtx.font = `600 ${Math.max(10, 11 * scale)}px Poppins, sans-serif`;
        charactersCtx.fillStyle = '#ffd7d7';
        charactersCtx.textAlign = 'center';
        charactersCtx.textBaseline = 'middle';
        charactersCtx.fillText(label, enemyX, barY - 9 * scale);

        charactersCtx.restore();
    });

    // Premier plan végétal / sable : il ancre la scène après les personnages.
    drawSceneForeground(charactersCtx, canvasWidth, canvasHeight, currentTile, scale);

    // 🪤 Piège armé sur la case actuelle
    if (map?.[player.y]?.[player.x]?.trap) {
        charactersCtx.save();
        charactersCtx.font = `${Math.round(32 * scale)}px sans-serif`;
        charactersCtx.textAlign = 'left';
        charactersCtx.textBaseline = 'bottom';
        charactersCtx.fillText('🪤', 14, canvasHeight - 14);
        charactersCtx.restore();
    }

    // Afficher les quantités de ressources restantes sur le côté droit de l'image
    if (map && map[player.y] && map[player.y][player.x]) {
        const currentTile = map[player.y][player.x];
        let resources = [];
        if (currentTile.type.name === TILE_TYPES.FOREST.name) {
            resources.push({ icon: '🌲', count: currentTile.woodActionsLeft || 0, label: 'Bois' });
            resources.push({ icon: '🦊', count: currentTile.huntActionsLeft || 0, label: 'Chasse' });
            resources.push({ icon: '🔍', count: currentTile.searchActionsLeft || 0, label: 'Fouille' });
        } else if (currentTile.type.name === TILE_TYPES.PLAINS.name) {
            resources.push({ icon: '🦊', count: currentTile.huntActionsLeft || 0, label: 'Chasse' });
            resources.push({ icon: '🔍', count: currentTile.searchActionsLeft || 0, label: 'Fouille' });
        } else if (currentTile.type.name === TILE_TYPES.MINE_TERRAIN.name) {
            resources.push({ icon: '⛰️', count: currentTile.harvestsLeft || 0, label: 'Pierre' });
        } else if (currentTile.type.name === TILE_TYPES.PLAGE.name && currentTile.actionsLeft) {
            resources.push({ icon: '🔍', count: currentTile.actionsLeft.search_zone || 0, label: 'Fouilles' });
            resources.push({ icon: '🏖️', count: currentTile.actionsLeft.harvest_sand || 0, label: 'Sable' });
            resources.push({ icon: '🎣', count: currentTile.actionsLeft.fish || 0, label: 'Pêche' });
            resources.push({ icon: '💧', count: currentTile.actionsLeft.harvest_salt_water || 0, label: 'Eau salée' });
        } else if (currentTile.buildings && currentTile.buildings.length > 0 && TILE_TYPES[currentTile.buildings[0].key]?.maxHarvestsPerCycle) {
            const building = currentTile.buildings[0];
            resources.push({ icon: '🔨', count: building.harvestsAvailable || 0, label: 'Récoltes' });
        }

        if (resources.length > 0) {
            // Pastilles de ressources : à gauche, hors des HUD (jour / objectifs)
            const chipH = 30 * scale;
            const chipW = 76 * scale;
            const chipX = 10 * scale;
            const startY = canvasHeight * 0.30;
            charactersCtx.save();
            charactersCtx.font = `bold ${Math.round(17 * scale)}px sans-serif`;
            charactersCtx.textAlign = 'left';
            charactersCtx.textBaseline = 'middle';
            resources.forEach((res, index) => {
                const yPos = startY + index * (chipH + 6 * scale);
                charactersCtx.fillStyle = 'rgba(6, 16, 22, 0.55)';
                roundedRectPath(charactersCtx, chipX, yPos, chipW, chipH, 10 * scale);
                charactersCtx.fill();
                charactersCtx.strokeStyle = 'rgba(255,255,255,0.14)';
                charactersCtx.lineWidth = 1;
                charactersCtx.stroke();
                charactersCtx.fillStyle = res.count > 0 ? '#eaf6fb' : 'rgba(234,246,251,0.45)';
                charactersCtx.fillText(`${res.icon} ${res.count}`, chipX + 10 * scale, yPos + chipH / 2);
            });
            charactersCtx.restore();
        }
    }

    // Dessiner tous les effets d'actions animés en pixel art (coupe, minage, combat, soins, etc.)
    drawActiveEffects(charactersCtx);
}

export function drawMinimap(gameState, config) {
    if (!gameState || !gameState.map || !gameState.player || !config) return;
    const { map, player, npcs, enemies, globallyRevealedTiles } = gameState;
    const { MAP_WIDTH, MAP_HEIGHT, MINIMAP_DOT_SIZE } = config;
    const { minimapCanvas, minimapCtx } = DOM;
    if (!minimapCtx || !minimapCanvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cell = MINIMAP_DOT_SIZE;
    const W = MAP_WIDTH * cell, H = MAP_HEIGHT * cell;
    if (minimapCanvas.width !== Math.round(W * dpr)) {
        minimapCanvas.width = Math.round(W * dpr);
        minimapCanvas.height = Math.round(H * dpr);
        minimapCanvas.style.width = '100%';
        minimapCanvas.style.height = 'auto';
    }
    const ctx = minimapCtx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Fond océan dégradé
    const ocean = ctx.createLinearGradient(0, 0, W, H);
    ocean.addColorStop(0, '#0b2a3a');
    ocean.addColorStop(1, '#06161f');
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, W, H);

    const pad = 0.6;
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const tile = map[y]?.[x];
            if (!tile || !tile.type) continue;
            const tileKey = `${x},${y}`;
            const isWater = tile.type.name === 'Lagon';
            const isVisible = player.visitedTiles.has(tileKey) || globallyRevealedTiles.has(tileKey) || isWater;
            const px = x * cell, py = y * cell;

            if (!isVisible) {
                ctx.fillStyle = 'rgba(10, 18, 24, 0.92)';
                ctx.fillRect(px, py, cell, cell);
                continue;
            }

            const base = tile.type.color || '#888';
            if (isWater) {
                const shimmer = 0.5 + 0.5 * Math.sin(Date.now() / 900 + (x + y) * 0.6);
                ctx.fillStyle = shadeColor(base, -35 + shimmer * 12);
                ctx.fillRect(px, py, cell, cell);
            } else {
                ctx.fillStyle = base;
                roundedRectPath(ctx, px + pad, py + pad, cell - pad * 2, cell - pad * 2, Math.max(1.5, cell * 0.22));
                ctx.fill();
                // Relief léger
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                roundedRectPath(ctx, px + pad, py + pad, cell - pad * 2, (cell - pad * 2) * 0.45, Math.max(1.5, cell * 0.22));
                ctx.fill();
            }

            // Constructions : petit point doré
            if (tile.buildings && tile.buildings.length > 0) {
                ctx.fillStyle = '#ffd479';
                ctx.beginPath();
                ctx.arc(px + cell * 0.5, py + cell * 0.5, Math.max(1.4, cell * 0.16), 0, Math.PI * 2);
                ctx.fill();
            }

            // Ressources restantes : petite jauge en bas de case
            let totalActions = 0;
            if (tile.type.name === TILE_TYPES.FOREST.name) {
                totalActions = (tile.woodActionsLeft || 0) + (tile.huntActionsLeft || 0) + (tile.searchActionsLeft || 0);
            } else if (tile.type.name === TILE_TYPES.PLAINS.name) {
                totalActions = (tile.huntActionsLeft || 0) + (tile.searchActionsLeft || 0);
            } else if (tile.type.name === TILE_TYPES.MINE_TERRAIN.name) {
                totalActions = tile.harvestsLeft || 0;
            } else if (tile.type.name === TILE_TYPES.PLAGE.name && tile.actionsLeft) {
                const a = tile.actionsLeft;
                totalActions = (a.search_zone || 0) + (a.harvest_sand || 0) + (a.fish || 0) + (a.harvest_salt_water || 0);
            } else if (tile.buildings?.length && TILE_TYPES[tile.buildings[0].key]?.maxHarvestsPerCycle) {
                totalActions = tile.buildings[0].harvestsAvailable || 0;
            }
            if (totalActions > 0) {
                const ratio = Math.min(1, totalActions / 30);
                ctx.fillStyle = 'rgba(255,255,255,0.75)';
                ctx.fillRect(px + 1.5, py + cell - 3, (cell - 3) * ratio, 1.8);
            }
        }
    }

    // Halo de découverte autour du joueur
    const cx = (player.x + 0.5) * cell, cy = (player.y + 0.5) * cell;
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell * 4);
    halo.addColorStop(0, 'rgba(255, 212, 121, 0.18)');
    halo.addColorStop(1, 'rgba(255, 212, 121, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);

    // PNJ
    npcs.forEach(npc => {
        const k = `${npc.x},${npc.y}`;
        if (!player.visitedTiles.has(k) && !globallyRevealedTiles.has(k)) return;
        ctx.fillStyle = npc.color || '#ff6347';
        ctx.beginPath();
        ctx.arc((npc.x + 0.5) * cell, (npc.y + 0.5) * cell, cell * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    });

    // Ennemis
    enemies.forEach(enemy => {
        const k = `${enemy.x},${enemy.y}`;
        if (!player.visitedTiles.has(k) && !globallyRevealedTiles.has(k)) return;
        const ex = (enemy.x + 0.5) * cell, ey = (enemy.y + 0.5) * cell;
        ctx.fillStyle = enemy.color || '#dc2626';
        ctx.beginPath();
        ctx.moveTo(ex, ey - cell * 0.32);
        ctx.lineTo(ex + cell * 0.3, ey + cell * 0.26);
        ctx.lineTo(ex - cell * 0.3, ey + cell * 0.26);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1; ctx.stroke();
    });

    // Camp
    if (gameState.shelterLocation) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.setLineDash([2, 2]);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(gameState.shelterLocation.x * cell + 0.5, gameState.shelterLocation.y * cell + 0.5, cell - 1, cell - 1);
        ctx.setLineDash([]);
    }

    // Autres joueurs
    for (const pid in gameState.players) {
        if (pid === player.id) continue;
        const op = gameState.players[pid];
        const k = `${op.x},${op.y}`;
        if (!player.visitedTiles.has(k) && !globallyRevealedTiles.has(k)) continue;
        ctx.fillStyle = '#4299e1';
        ctx.beginPath();
        ctx.arc((op.x + 0.5) * cell, (op.y + 0.5) * cell, cell * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
    }

    // Joueur : point doré avec anneau pulsant
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 420);
    ctx.strokeStyle = `rgba(255, 212, 121, ${0.25 + 0.5 * pulse})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * (0.45 + 0.3 * pulse), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd479';
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0d1a22'; ctx.lineWidth = 1.4; ctx.stroke();
}

export function drawLargeMap(gameState, config) {
    if (!gameState || !gameState.map || !gameState.player || !config) return;
    const { map, player, npcs, enemies, globallyRevealedTiles } = gameState;
    const { MAP_WIDTH, MAP_HEIGHT } = config;
    const { largeMapCanvas, largeMapCtx } = DOM;
    if(!largeMapCtx || !largeMapCanvas) return;

    const headerSize = 30; // Espace pour les coordonnées
    const parentWrapper = largeMapCanvas.parentElement; // Le div #large-map-content-wrapper
    if (!parentWrapper) return;

    // Calculer la taille disponible pour le canvas, en tenant compte de la légende
    const legendWidth = DOM.largeMapLegendEl ? DOM.largeMapLegendEl.offsetWidth + 20 : 0; // +20 pour le gap
    const availableWidth = parentWrapper.clientWidth - legendWidth - 40 ; // -40 pour padding du wrapper
    const availableHeight = parentWrapper.clientHeight - 40; // -40 pour padding du wrapper

    let canvasSize = Math.min(availableWidth, availableHeight);
    canvasSize = Math.max(canvasSize, 200); // Taille minimale

    largeMapCanvas.width = canvasSize;
    largeMapCanvas.height = canvasSize;
    const cellSize = (canvasSize - headerSize) / Math.max(MAP_WIDTH, MAP_HEIGHT); // Cellules carrées

    largeMapCtx.clearRect(0, 0, largeMapCanvas.width, largeMapCanvas.height);
    largeMapCtx.fillStyle = '#1d3557'; // Fond bleu foncé
    largeMapCtx.fillRect(0, 0, largeMapCanvas.width, largeMapCanvas.height);

    // Dessiner les tuiles
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const tileKey = `${x},${y}`;
            const drawX = headerSize + x * cellSize;
            const drawY = headerSize + y * cellSize;

            const tile = map[y]?.[x];
            const isWater = tile?.type.name === 'Lagon';
            const isVisible = player.visitedTiles.has(tileKey) || globallyRevealedTiles.has(tileKey) || isWater;

            if (!isVisible) {
                largeMapCtx.fillStyle = '#000'; // Non découvert
                largeMapCtx.fillRect(drawX, drawY, cellSize, cellSize);
                continue;
            }

            if (!map[y] || !map[y][x] || !map[y][x].type) continue;
            const currentTile = map[y][x];
            largeMapCtx.fillStyle = tile.type.color || '#ff00ff';
            largeMapCtx.fillRect(drawX, drawY, cellSize, cellSize);

            // Icône : image générée si chargée, sinon emoji en fallback
            const tileImg = getTileImage(tile.type.name);
            if (tileImg) {
                const pad = cellSize * 0.1;
                largeMapCtx.drawImage(tileImg, drawX + pad, drawY + pad, cellSize - pad * 2, cellSize - pad * 2);
            } else {
                const icon = tile.type.icon || TILE_ICONS[tile.type.name] || TILE_ICONS.default;
                largeMapCtx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // Ombre pour l'icône
                largeMapCtx.font = `bold ${cellSize * 0.6}px Poppins`;
                largeMapCtx.textAlign = 'center';
                largeMapCtx.textBaseline = 'middle';
                let iconOffsetY = 0; // Ajustement vertical pour certains emojis
                if (icon === '💎' || icon === '🌊' || icon === '🏖️' || icon === '🍂' || icon === '🔥' || icon === '⛏️' || icon === '⛺' || icon === '🏠' || icon === '🌲' || icon === '⛰️' || icon === '🌳' || icon === '⛏️🏭') { // Added Mine Building
                    iconOffsetY = cellSize * 0.05;
                }
                largeMapCtx.fillText(icon, drawX + cellSize / 2, drawY + cellSize / 2 + iconOffsetY);
            }
            
            // Ajouter un indicateur pour le nombre total d'actions restantes
            let totalActions = 0;
            if (tile.type.name === TILE_TYPES.FOREST.name) {
                totalActions = (tile.woodActionsLeft || 0) + (tile.huntActionsLeft || 0) + (tile.searchActionsLeft || 0);
            } else if (tile.type.name === TILE_TYPES.PLAINS.name) {
                totalActions = (tile.huntActionsLeft || 0) + (tile.searchActionsLeft || 0);
            } else if (tile.type.name === TILE_TYPES.MINE_TERRAIN.name) {
                totalActions = tile.harvestsLeft || 0;
            } else if (tile.type.name === TILE_TYPES.PLAGE.name && tile.actionsLeft) {
                totalActions = (tile.actionsLeft.search_zone || 0) + (tile.actionsLeft.harvest_sand || 0) + (tile.actionsLeft.fish || 0) + (tile.actionsLeft.harvest_salt_water || 0);
            } else if (tile.buildings && tile.buildings.length > 0 && TILE_TYPES[tile.buildings[0].key]?.maxHarvestsPerCycle) {
                totalActions = tile.buildings[0].harvestsAvailable || 0;
            }
            
            if (totalActions > 0) {
                largeMapCtx.fillStyle = 'white';
                largeMapCtx.font = `${cellSize * 0.3}px Poppins`;
                largeMapCtx.textAlign = 'right';
                largeMapCtx.textBaseline = 'bottom';
                largeMapCtx.fillText(totalActions, drawX + cellSize - 2, drawY + cellSize - 2);
            }
        }
    }

    // Dessiner la grille et les coordonnées
    largeMapCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    largeMapCtx.lineWidth = 1;
    largeMapCtx.fillStyle = '#f1faee'; // Couleur pour les textes des coordonnées
    largeMapCtx.font = `600 ${Math.min(14, headerSize * 0.5)}px Poppins`; // Taille de police pour les coordonnées
    largeMapCtx.textAlign = 'center';
    largeMapCtx.textBaseline = 'middle';

    for (let i = 0; i < MAP_WIDTH; i++) {
        const xCoordText = headerSize + (i + 0.5) * cellSize;
        largeMapCtx.fillText(i, xCoordText, headerSize / 2); // Coordonnées X en haut
        const lineX = headerSize + i * cellSize;
        if (i > 0) { // Ne pas dessiner la première ligne verticale à gauche
            largeMapCtx.beginPath(); largeMapCtx.moveTo(lineX, headerSize); largeMapCtx.lineTo(lineX, headerSize + MAP_HEIGHT * cellSize); largeMapCtx.stroke();
        }
    }
    for (let i = 0; i < MAP_HEIGHT; i++) {
        const yCoordText = headerSize + (i + 0.5) * cellSize;
        largeMapCtx.fillText(i, headerSize / 2, yCoordText); // Coordonnées Y à gauche
        const lineY = headerSize + i * cellSize;
        if (i > 0) { // Ne pas dessiner la première ligne horizontale en haut
            largeMapCtx.beginPath(); largeMapCtx.moveTo(headerSize, lineY); largeMapCtx.lineTo(headerSize + MAP_WIDTH * cellSize, lineY); largeMapCtx.stroke();
        }
    }
    // Contour de la carte
    largeMapCtx.strokeRect(headerSize, headerSize, MAP_WIDTH * cellSize, MAP_HEIGHT * cellSize);

    // Dessiner les PNJ (cercles)
    npcs.forEach(npc => {
        const tileKey = `${npc.x},${npc.y}`;
        if (player.visitedTiles.has(tileKey) || globallyRevealedTiles.has(tileKey)) {
            const drawX = headerSize + npc.x * cellSize + cellSize / 2;
            const drawY = headerSize + npc.y * cellSize + cellSize / 2;
            largeMapCtx.fillStyle = npc.color;
            largeMapCtx.beginPath(); largeMapCtx.arc(drawX, drawY, cellSize * 0.35, 0, Math.PI * 2); largeMapCtx.fill();
        }
    });

    // Dessiner les Ennemis (icônes)
    enemies.forEach(enemy => {
        const tileKey = `${enemy.x},${enemy.y}`;
        if (player.visitedTiles.has(tileKey) || globallyRevealedTiles.has(tileKey)) {
            const drawX = headerSize + enemy.x * cellSize + cellSize / 2;
            const drawY = headerSize + enemy.y * cellSize + cellSize / 2;
            largeMapCtx.fillStyle = enemy.color || '#ff0000';
            largeMapCtx.font = `bold ${cellSize * 0.7}px Poppins`; // Icône plus grande pour les ennemis
            largeMapCtx.textAlign = 'center';
            largeMapCtx.textBaseline = 'middle';
            largeMapCtx.fillText(enemy.icon || '❓', drawX, drawY);
        }
    });

    // Dessiner le joueur (cercle avec contour)
    const playerDrawX = headerSize + player.x * cellSize + cellSize / 2;
    const playerDrawY = headerSize + player.y * cellSize + cellSize / 2;
    largeMapCtx.fillStyle = player.color;
    largeMapCtx.beginPath(); largeMapCtx.arc(playerDrawX, playerDrawY, cellSize * 0.4, 0, Math.PI * 2); largeMapCtx.fill();
    largeMapCtx.strokeStyle = 'white';
    largeMapCtx.lineWidth = 3; // Contour plus épais
    largeMapCtx.stroke();

    // Dessiner les autres joueurs
    for (const playerId in gameState.players) {
        if (playerId !== player.id) {
            const otherPlayer = gameState.players[playerId];
            const tileKey = `${otherPlayer.x},${otherPlayer.y}`;
            if (player.visitedTiles.has(tileKey) || globallyRevealedTiles.has(tileKey)) {
                const otherPlayerDrawX = headerSize + otherPlayer.x * cellSize + cellSize / 2;
                const otherPlayerDrawY = headerSize + otherPlayer.y * cellSize + cellSize / 2;
                largeMapCtx.fillStyle = '#4299e1'; // Blue for other players
                largeMapCtx.beginPath();
                largeMapCtx.arc(otherPlayerDrawX, otherPlayerDrawY, cellSize * 0.35, 0, Math.PI * 2);
                largeMapCtx.fill();
                largeMapCtx.strokeStyle = 'black';
                largeMapCtx.lineWidth = 2;
                largeMapCtx.stroke();
            }
        }
    }
}


export function populateLargeMapLegend() {
    const { largeMapLegendEl } = DOM;
    if(!largeMapLegendEl) return;

    largeMapLegendEl.innerHTML = '<h3>Légende</h3>';
    const addedTypes = new Set(); // Pour éviter les doublons dans la légende

    // Ajouter les types de tuiles depuis TILE_TYPES
    for (const tileKey in TILE_TYPES) {
        const tileType = TILE_TYPES[tileKey];
        if (!addedTypes.has(tileType.name)) { // Si le nom du type n'a pas encore été ajouté
            const item = document.createElement('div');
            item.className = 'legend-item';
            // Image générée si disponible, sinon emoji en fallback
            const iconHtml = tileIconHTML(tileType.name, tileType.icon || TILE_ICONS[tileType.name] || TILE_ICONS.default, 'legend-tile-icon');
            item.innerHTML = `<div class="legend-color-box" style="background-color: ${tileType.color};"></div><span>${iconHtml} ${tileType.name}</span>`;
            largeMapLegendEl.appendChild(item);
            addedTypes.add(tileType.name); // Marquer ce nom de type comme ajouté
        }
    }
    // Séparateur
    largeMapLegendEl.insertAdjacentHTML('beforeend', '<hr style="border-color: rgba(255,255,255,0.1); margin: 10px 0;">');
    // Entités
    const playerItem = document.createElement('div');
    playerItem.className = 'legend-item';
    playerItem.innerHTML = `<div class="legend-color-box legend-character-icon" style="color: #ffd700;">●</div><span>Vous</span>`; // Utiliser un rond pour le joueur
    largeMapLegendEl.appendChild(playerItem);

    const npcItem = document.createElement('div');
    npcItem.className = 'legend-item';
    npcItem.innerHTML = `<div class="legend-color-box legend-character-icon" style="color: #ff6347;">●</div><span>Survivants (PNJ)</span>`; // Utiliser un rond pour les PNJ
    largeMapLegendEl.appendChild(npcItem);

    const enemyItem = document.createElement('div');
    enemyItem.className = 'legend-item';
    enemyItem.innerHTML = `<div class="legend-color-box legend-character-icon" style="color: #dc2626;">▲</div><span>Ennemis</span>`; // Utiliser un triangle pour les ennemis
    largeMapLegendEl.appendChild(enemyItem);

    const unknownItem = document.createElement('div'); // Tuile non découverte
    unknownItem.className = 'legend-item';
    unknownItem.innerHTML = `<div class="legend-color-box" style="background-color: #000;"></div><span>Non découvert</span>`;
    largeMapLegendEl.appendChild(unknownItem);
}
