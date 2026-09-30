// js/ui/draw.js
import { TILE_TYPES, ITEM_TYPES, CONFIG, ENEMY_SPRITES } from '../config.js';
import { getItemImage } from './icons.js';
import DOM from './dom.js';

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

    // Constructions présentes sur la case
    drawTileProps(mainViewCtx, w, h, playerTile);
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

            if (b.key === 'CAMPFIRE') {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                const g = ctx.createRadialGradient(cx, baseY - targetH * 0.35, 0, cx, baseY - targetH * 0.35, targetH * 1.1);
                g.addColorStop(0, `rgba(255, 180, 80, ${0.35 * flicker})`);
                g.addColorStop(1, 'rgba(255, 120, 30, 0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(cx, baseY - targetH * 0.35, targetH * 1.1, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            ctx.drawImage(img, cx - targetW / 2, baseY - targetH, targetW, targetH);
        } else if (def) {
            // Pastille d'icône élégante en repli
            const size = Math.max(34, h * 0.075);
            const cx = w * (0.22 + i * 0.16);
            const cy = h * 0.72;
            ctx.save();
            ctx.globalAlpha = 0.92;
            ctx.fillStyle = 'rgba(8, 18, 25, 0.55)';
            ctx.beginPath();
            ctx.arc(cx, cy, size * 0.62, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 212, 121, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.font = `${Math.round(size * 0.62)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(def.icon || '🏗️', cx, cy + size * 0.03);
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
    if (character._look) return character._look;
    const h = hashString(character.id || character.name || character.color);
    const look = {
        skin: SKIN_TONES[h % SKIN_TONES.length],
        hair: HAIR_COLORS[(h >> 3) % HAIR_COLORS.length],
        style: HAIR_STYLES[(h >> 6) % HAIR_STYLES.length],
        beard: ((h >> 9) % 4) === 0,
        phase: (h % 100) / 100,
    };
    try { Object.defineProperty(character, '_look', { value: look, enumerable: false }); } catch (_) {}
    return look;
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
function drawCharacter(ctx, character, x, y, isPlayer = false, animationProgress = 0, scale = 1) {
    const look = characterLook(character);
    const s = scale;
    const outline = 'rgba(10, 18, 24, 0.85)';
    const cloth = character.color || '#4f8fbf';
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


export function drawSceneCharacters(gameState) {
    if (!gameState || !gameState.player) return;
    const { player, npcs, enemies, map } = gameState;
    const { charactersCtx, charactersCanvas } = DOM;
    if (!charactersCtx || !charactersCanvas) return;

    charactersCtx.clearRect(0, 0, charactersCanvas.width, charactersCanvas.height);
    const canvasWidth = charactersCanvas.width;
    const canvasHeight = charactersCanvas.height;

    // Échelle des personnages : lisible aussi bien sur mobile que sur grand écran
    const scale = Math.max(0.75, Math.min(1.6, canvasHeight / 620));

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

        // Créature : sprite généré si disponible, sinon emoji
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

            // Utiliser tile.type.icon si disponible, sinon TILE_ICONS comme fallback
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
            // Utiliser tile.type.icon si disponible, sinon TILE_ICONS comme fallback
            const icon = tileType.icon || TILE_ICONS[tileType.name] || TILE_ICONS.default;
            item.innerHTML = `<div class="legend-color-box" style="background-color: ${tileType.color};"></div><span>${icon} ${tileType.name}</span>`;
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
