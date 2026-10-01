// js/ui/draw.js
import { TILE_TYPES, ITEM_TYPES, CONFIG, ACTIONS, ENEMY_SPRITES, CHARACTER_APPEARANCE, DEFAULT_CHARACTER_APPEARANCE } from '../config.js';
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
import {
    SKELETON,
    updateCharacterRuntime,
    computeCharacterPose,
    triggerCharacterAnim,
    previewRuntime,
    characterParticles,
    PARTICLE_COLORS,
} from './character-anim.js';
import {
    beginHotspotFrame,
    registerHotspot,
    commitHotspotFrame,
    drawHotspotMarkers,
} from './hotspots.js';
import { getSceneRenderScale, isMobileShell, characterScaleFor } from './resolution.js';

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

let bgState = { sceneKey: null, imageKey: null, prevImageKey: null, since: 0 };
const BG_FADE_MS = 520;

// Certaines constructions disposent d'une vraie illustration de fond. Quand
// elles sont présentes, on l'utilise comme décor principal plutôt que de poser
// une icône flottante par-dessus un biome générique.
const BUILDING_SCENE_BACKGROUNDS = new Set([
    'bg_campfire',
    'bg_shelter_individual',
    'bg_shelter_collective',
    'bg_mine',
]);

function buildingSceneBackground(building) {
    const key = TILE_TYPES[building?.key]?.background?.[0];
    return BUILDING_SCENE_BACKGROUNDS.has(key) ? key : null;
}

function getDominantSceneBuilding(tile) {
    return (tile?.buildings || []).find(building => buildingSceneBackground(building)) || null;
}

function getSceneBackgroundKey(tile) {
    const dominant = getDominantSceneBuilding(tile);
    const buildingBackground = buildingSceneBackground(dominant);

    // La maquette mobile est verticale : un fond dédié évite de recadrer les
    // paysages 16:9 jusqu'à ne garder qu'un morceau de ciel ou d'herbe.
    const mobilePortrait = typeof window !== 'undefined'
        && window.matchMedia('(max-width: 900px) and (orientation: portrait)').matches;
    if (mobilePortrait) {
        if (buildingBackground === 'bg_campfire') return 'bg_campfire_mobile';
        if (buildingBackground) return buildingBackground;
        if (tile?.type?.name === 'Forêt') return 'bg_forest_mobile';
        if (tile?.type?.name === 'Plaine') return 'bg_plains_mobile';
        if (tile?.type?.name === 'Plage' || tile?.type?.name === 'Lagon') return 'bg_sand_mobile';
        if (tile?.type?.name === 'Friche') return 'bg_wasteland_mobile';
        if (tile?.type?.name === 'Mine (Terrain)') return 'bg_stone_mobile';
    }
    return buildingBackground || tile?.backgroundKey;
}

function isBuildingInSceneBackground(tile, building) {
    return building && getDominantSceneBuilding(tile) === building;
}

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

// Ligne de sol approximative par décor. Elle sert d'ancre commune aux objets,
// constructions, ennemis et personnages pour éviter l'effet « flottant ».
// Le profil (base / slope / curve) est partagé avec le cadrage des fonds
// (`sceneFraming`) pour que la ligne peinte et les ancres restent alignées.
function sceneGroundProfile(key, biome = '', role = 'default') {
    let base = 0.78;
    let slope = 0;
    let curve = 0.02;

    if (key === 'bg_sand_mobile') {
        // En portrait, le personnage reste au centre et laisse la zone basse
        // aux cartes de lieu et au pavé directionnel.
        base = 0.67; slope = 0.015; curve = 0.015;
    } else if (key === 'bg_forest_mobile') {
        base = 0.68; slope = 0.005; curve = 0.02;
    } else if (key === 'bg_plains_mobile') {
        base = 0.66; slope = -0.005; curve = 0.018;
    } else if (key === 'bg_wasteland_mobile') {
        base = 0.67; slope = 0.005; curve = 0.015;
    } else if (key === 'bg_stone_mobile') {
        base = 0.68; slope = 0.01; curve = 0.014;
    } else if (key === 'bg_campfire_mobile') {
        // Le foyer est peint vers 70 % de la hauteur. Le joueur reste juste
        // au-dessus, tandis que le hotspot et la lueur suivent le vrai feu.
        base = role === 'player' ? 0.62 : 0.70;
        slope = 0; curve = 0.01;
    } else if (key.startsWith('bg_sand')) {
        // Les plages ont une diagonale de sable/eau : le sol jouable reste
        // surtout dans le tiers inférieur gauche.
        base = 0.83; slope = 0.10; curve = -0.035;
    } else if (key.startsWith('bg_forest')) {
        base = 0.765; slope = 0.015; curve = 0.035;
    } else if (key.startsWith('bg_plains')) {
        base = 0.775; slope = -0.01; curve = 0.025;
    } else if (key.startsWith('bg_wasteland')) {
        base = 0.795; slope = 0.005; curve = 0.018;
    } else if (key.startsWith('bg_stone')) {
        base = 0.785; slope = 0.015; curve = 0.018;
    } else if (key === 'bg_campfire') {
        base = 0.775; slope = 0.018; curve = 0.01;
    } else if (key === 'bg_shelter_individual' || key === 'bg_shelter_collective') {
        base = 0.805; slope = -0.015; curve = 0.018;
    } else if (key === 'bg_mine') {
        base = 0.825; slope = 0.04; curve = 0.012;
    } else if (key === 'bg_treasure_chest') {
        base = 0.80; slope = 0.005; curve = 0.02;
    } else if (biome === 'Mine (Terrain)') {
        base = 0.79; slope = 0.01; curve = 0.018;
    }

    if (role === 'enemy') base -= 0.015;
    if (role === 'loot') base += 0.006;
    if (role === 'foreground') base += 0.06;

    return { base, slope, curve };
}

function sceneGroundY(tile, w, h, xNorm = 0.5, role = 'default') {
    const key = getSceneBackgroundKey(tile) || '';
    const biome = tile?.type?.name || '';
    const x = clamp01(Number(xNorm));
    const centered = x - 0.5;
    const abs = Math.abs(centered);
    const { base, slope, curve } = sceneGroundProfile(key, biome, role);
    const yNorm = base + slope * centered + curve * (abs * 2 - 0.55);
    return Math.round(h * Math.max(0.52, Math.min(0.92, yNorm)));
}

/* -------------------------------------------------------------------------
 * Cadrage des fonds : le sol reste visible sur toutes les largeurs d'écran
 * -------------------------------------------------------------------------
 * La scène s'affiche désormais au format de l'écran (plein cadre sur PC,
 * résolution verrouillée sur mobile). Un fond carré (mine, feu de camp,
 * abris, trésor, carrières) recadré « cover » centrerait son horizon et
 * perdrait sa ligne de sol sous le cadre. On mémorise donc où se trouve le
 * sol dans chaque illustration, et le recadrage le garde à la même hauteur
 * que les ancres `sceneGroundProfile` : personnages, butin et constructions
 * restent posés sur le sol peint, du 16:9 à l'ultra-large.
 *
 * Les valeurs ci-dessous reproduisent exactement l'ancien cadrage (16:9
 * centré) : sur ce format, le rendu est identique au pixel près.
 */
const SCENE_GROUND_LINE = {
    // Fonds mobiles verticaux (768×1376) : toute la hauteur est visible.
    bg_sand_mobile: 0.67,
    bg_forest_mobile: 0.68,
    bg_plains_mobile: 0.66,
    bg_wasteland_mobile: 0.67,
    bg_stone_mobile: 0.68,
    bg_campfire_mobile: 0.70,
    // Fonds carrés (1024×1024) : sol peint vers 65-68 % de l'image.
    bg_campfire: 0.650,
    bg_mine: 0.677,
    bg_treasure_chest: 0.664,
    bg_shelter_individual: 0.666,
    bg_shelter_collective: 0.666,
};
const SCENE_GROUND_LINE_PREFIXES = [
    // Fonds paysages 1408×768 : sol au niveau de l'ancre elle-même.
    ['bg_forest_', 0.765],
    ['bg_plains_', 0.775],
    ['bg_sand_', 0.83],
    ['bg_wasteland_', 0.795],
    // Carrières : fonds carrés, sol plus haut dans l'image.
    ['bg_stone_', 0.6555],
];

function sceneGroundLineForImage(imageKey) {
    if (!imageKey) return null;
    if (Object.prototype.hasOwnProperty.call(SCENE_GROUND_LINE, imageKey)) {
        return SCENE_GROUND_LINE[imageKey];
    }
    const hit = SCENE_GROUND_LINE_PREFIXES.find(([prefix]) => imageKey.startsWith(prefix));
    return hit ? hit[1] : null;
}

/** Cadrage d'un fond : position du sol dans l'image + hauteur cible à l'écran. */
function sceneFraming(imageKey, biome = '') {
    const ground = sceneGroundLineForImage(imageKey);
    if (ground == null) return null;
    const { base } = sceneGroundProfile(imageKey, biome, 'default');
    return { ground, target: base };
}

function characterAnchorForGround(groundY, scale) {
    const pixel = Math.max(2, Math.round(4 * scale));
    return Math.round(groundY - pixel * 7.65);
}

function scenePerspectiveScale(tile, xNorm = 0.5) {
    // Petit ajustement : éléments très à gauche/droite un peu plus petits pour
    // suivre la perspective de la plupart des fonds.
    return 1 - Math.abs(clamp01(xNorm) - 0.5) * 0.10;
}

function paintBackgroundImage(ctx, img, w, h, alpha, zoom, framing = null) {
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

    // Cadrage vertical « sol verrouillé » : la ligne de sol peinte reste à la
    // même hauteur à l'écran, quelle que soit la largeur de la scène. Sur le
    // format historique 16:9 centré, le calcul retombe exactement sur
    // l'ancien cadrage ; sur un écran plus large ou plus haut, le sol peint
    // et les ancres de personnages restent alignés.
    if (sHeight >= img.naturalHeight - 0.5) {
        sy = 0;
    } else if (framing) {
        const visibleFrac = sHeight / img.naturalHeight;
        sy = (framing.ground - framing.target * visibleFrac) * img.naturalHeight;
    } else {
        sy = (img.naturalHeight - sHeight) / 2;
    }

    sx = Math.max(0, Math.min(img.naturalWidth - sWidth, sx));
    sy = Math.max(0, Math.min(img.naturalHeight - sHeight, sy + swayY));

    ctx.save();
    ctx.globalAlpha = alpha;
    // Les fonds sont des illustrations peintes. Agrandies (écran dense,
    // résolution mobile verrouillée), elles restent propres avec un lissage
    // de haute qualité ; réduites, des pixels francs préservent le grain.
    const drawScale = sWidth / w;
    ctx.imageSmoothingEnabled = drawScale > 0.96;
    ctx.imageSmoothingQuality = 'high';
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

    // Nouvelle image = nouvelle carte des zones interactives. Les décors
    // enregistrent leurs zones ici, les personnages plus bas, puis
    // `drawSceneCharacters` valide l'ensemble.
    beginHotspotFrame();

    if (!gameState || !gameState.player || !gameState.map ||
        !gameState.map[gameState.player.y] || !gameState.map[gameState.player.y][gameState.player.x]) {
        mainViewCtx.fillStyle = '#12202a';
        mainViewCtx.fillRect(0, 0, w, h);
        return;
    }

    const playerTile = gameState.map[gameState.player.y][gameState.player.x];
    const imageKey = getSceneBackgroundKey(playerTile);
    // Chaque case a sa propre identité visuelle, même quand deux cases
    // partagent le même biome. Cela garantit un vrai changement de décor à
    // chaque déplacement au lieu de garder l'ancienne image figée.
    const sceneKey = `${playerTile.x ?? gameState.player.x}:${playerTile.y ?? gameState.player.y}:${imageKey}`;

    if (sceneKey !== bgState.sceneKey) {
        bgState = {
            sceneKey,
            imageKey,
            prevImageKey: bgState.imageKey,
            since: Date.now(),
        };
    }
    const elapsed = Date.now() - bgState.since;
    const fade = Math.min(1, elapsed / BG_FADE_MS);
    const ease = 1 - Math.pow(1 - fade, 3);

    mainViewCtx.fillStyle = playerTile.type.color || '#0d1a22';
    mainViewCtx.fillRect(0, 0, w, h);

    // Ancienne image en fondu sortant + zoom léger
    if (bgState.prevImageKey && fade < 1) {
        paintBackgroundImage(mainViewCtx, loadedAssets[bgState.prevImageKey], w, h, 1 - ease, 1 + 0.05 * ease,
            sceneFraming(bgState.prevImageKey, playerTile?.type?.name));
    }
    const drawn = paintBackgroundImage(mainViewCtx, loadedAssets[bgState.imageKey], w, h, ease, 1.05 - 0.05 * ease,
        sceneFraming(bgState.imageKey, playerTile?.type?.name));
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

    // Le décor vertical de plage contient déjà son écume : la planche de
    // vagues prévue pour les fonds 16:9 couvrirait le sable en portrait.
    if (getSceneBackgroundKey(tile) !== 'bg_sand_mobile') {
        drawAnimatedWaterWaves(ctx, w, h, biome);
    }

    // Faune ambiante vivante en pixel art (oiseaux, poissons, crabes, papillons)
    const dt = 1 / 32;
    wildlifeManager.update(w, h, biome, dt);
    wildlifeManager.draw(ctx);
}

const PROP_FOR_BUILDING = {
    CAMPFIRE: { asset: 'spritesheet_campfire', scale: 0.20, x: 0.50 },
    SHELTER_INDIVIDUAL: { asset: 'prop_shelter', scale: 0.28, x: 0.26, trim: [310, 360, 398, 382] },
    SHELTER_COLLECTIVE: { asset: 'prop_shelter', scale: 0.35, x: 0.27, trim: [310, 360, 398, 382] },
    FORTERESSE: { asset: 'prop_shelter', scale: 0.40, x: 0.25, trim: [310, 360, 398, 382] },
    // Les images pleine page de mine/établi ont un fond opaque ; on privilégie
    // donc les icônes de tuile transparentes pour les intégrer au décor.
    MINE: { scale: 0.32, x: 0.74, preferTileImage: true },
    ATELIER: { scale: 0.18, x: 0.72, preferTileImage: true },
    ETABLI: { scale: 0.16, x: 0.76, preferTileImage: true },
    FORGE: { scale: 0.20, x: 0.22, preferTileImage: true },
    PETIT_PUIT: { scale: 0.17, x: 0.72, preferTileImage: true },
    PUITS_PROFOND: { scale: 0.22, x: 0.72, preferTileImage: true },
    BIBLIOTHEQUE: { scale: 0.22, x: 0.24, preferTileImage: true },
    LABORATOIRE: { scale: 0.24, x: 0.24, preferTileImage: true },
    OBSERVATOIRE: { scale: 0.22, x: 0.74, preferTileImage: true },
    PANNEAU_SOLAIRE: { scale: 0.17, x: 0.76, preferTileImage: true },
};

function drawGroundShadow(ctx, cx, baseY, width, height, alpha = 0.28) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, baseY, width, Math.max(2, height), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

const imageTrimCache = new WeakMap();
function getAutoImageTrim(img) {
    if (!img || !img.naturalWidth || typeof document === 'undefined') return null;
    if (imageTrimCache.has(img)) return imageTrimCache.get(img);
    try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const alpha = data[(y * canvas.width + x) * 4 + 3];
                if (alpha > 8) {
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }
        }
        const trim = maxX >= minX ? [minX, minY, maxX - minX + 1, maxY - minY + 1] : null;
        imageTrimCache.set(img, trim);
        return trim;
    } catch (_) {
        imageTrimCache.set(img, null);
        return null;
    }
}

function drawAnchoredImage(ctx, img, cx, baseY, targetH, { trim = null, shadow = true } = {}) {
    if (!img || !img.complete || !img.naturalWidth) return false;
    const resolvedTrim = trim === 'auto' ? getAutoImageTrim(img) : trim;
    const sx = resolvedTrim ? resolvedTrim[0] : 0;
    const sy = resolvedTrim ? resolvedTrim[1] : 0;
    const sw = resolvedTrim ? resolvedTrim[2] : img.naturalWidth;
    const sh = resolvedTrim ? resolvedTrim[3] : img.naturalHeight;
    const targetW = targetH * (sw / sh);
    if (shadow) drawGroundShadow(ctx, cx, baseY, targetW * 0.36, targetH * 0.055, 0.30);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.shadowColor = 'rgba(0,0,0,0.42)';
    ctx.shadowBlur = Math.max(4, targetH * 0.035);
    ctx.drawImage(img, sx, sy, sw, sh, cx - targetW / 2, baseY - targetH, targetW, targetH);
    ctx.restore();
    return true;
}

/**
 * Dessine les constructions de la case dans le décor (sprites si dispo, sinon pastille icône).
 */
// Les constructions deviennent des cibles directes : un clic sur le coffre
// l'ouvre, un clic sur l'établi lance l'atelier. L'action réelle est résolue
// au moment du clic à partir des actions renvoyées par le serveur.
const BUILDING_HINTS = {
    TREASURE_CHEST: 'Ouvrir le coffre',
    FORTERESSE: 'Dormir ou stocker',
    ETABLI: "Utiliser l'établi",
    ATELIER: "Utiliser l'atelier",
    FORGE: 'Utiliser la forge',
    LABORATOIRE: 'Utiliser le laboratoire',
    CAMPFIRE: 'Cuisiner ou se reposer',
    SHELTER_INDIVIDUAL: 'Dormir',
    SHELTER_COLLECTIVE: 'Dormir',
    MINE: 'Extraire du minerai',
    PETIT_PUIT: "Puiser de l'eau",
    PUIT_PROFOND: "Puiser de l'eau",
    OBSERVATOIRE: 'Observer le ciel',
    BIBLIOTHEQUE: 'Chercher un plan',
    BANANERAIE: 'Arroser ou récolter',
    SUCRERIE: 'Arroser ou récolter',
    COCOTERAIE: 'Arroser ou récolter',
    POULAILLER: 'Abreuver ou récolter',
    ENCLOS_COCHONS: 'Abreuver ou récolter',
    PANNEAU_SOLAIRE: 'Recharger un appareil',
};

/**
 * Le marqueur se déduit de la nature de la construction plutôt que d'une liste
 * figée : tout ce qui stocke porte l'icône « butin », tout poste de travail
 * porte l'icône « artisanat ». Les constructions purement décoratives n'en ont
 * pas et se révèlent au survol.
 */
// Quelques cas où la déduction automatique n'est pas la bonne lecture :
// le feu de camp et les abris sont déjà évidents dans le décor, le coffre au
// trésor n'a pas d'inventaire déclaré mais reste bien du butin.
const BUILDING_MARKER_OVERRIDES = {
    CAMPFIRE: null,
    SHELTER_INDIVIDUAL: null,
    SHELTER_COLLECTIVE: null,
    TREASURE_CHEST: 'loot',
    FORTERESSE: 'loot',
};

function buildingMarkerFor(key, def) {
    if (Object.prototype.hasOwnProperty.call(BUILDING_MARKER_OVERRIDES, key)) {
        return BUILDING_MARKER_OVERRIDES[key];
    }
    if (!def) return null;
    const ids = [
        ...(Array.isArray(def.actions) ? def.actions : []),
        ...(def.action ? [def.action] : []),
    ].map(action => action?.id || '').join(' ');
    if (/^use_|_etabli|_atelier|_forge|laboratoire/.test(ids)) return 'build';
    if (def.maxInventory || def.inventory) return 'loot';
    if (/harvest_|draw_water|search_/.test(ids)) return 'build';
    return null;
}

function registerBuildingHotspot(building, def, x, y, w, h) {
    if (!building || !def) return;
    const key = building.key;
    registerHotspot({
        id: `building:${key}:${Math.round(x)}`,
        type: 'building',
        buildingKey: key,
        x, y,
        w: Math.max(42, w),
        h: Math.max(42, h),
        label: def.name || 'Construction',
        hint: BUILDING_HINTS[key] || 'Voir les actions',
        actionIds: [ACTIONS.OPEN_BUILDING_INVENTORY],
        marker: buildingMarkerFor(key, def),
        markerAlpha: 0.62,
        priority: 2,
    });
}

function drawTileProps(ctx, w, h, tile) {
    const buildings = tile.buildings || [];
    if (!buildings.length) return;

    buildings.slice(0, 4).forEach((building, i) => {
        const def = TILE_TYPES[building.key];
        if (!def) return;

        // Si la construction est déjà peinte dans le fond actif (feu, abri,
        // mine...), on évite de la redessiner par-dessus et on garde juste les
        // effets d'ambiance éventuels.
        if (isBuildingInSceneBackground(tile, building)) {
            // La construction est peinte dans le décor : elle reste cliquable.
            const bgX = building.key === 'CAMPFIRE' ? 0.50 : 0.48;
            const bgBase = sceneGroundY(tile, w, h, bgX, 'prop');
            const bgSize = h * 0.26;
            registerBuildingHotspot(building, def, w * bgX, bgBase - bgSize / 2, bgSize * 1.1, bgSize);

            if (building.key === 'CAMPFIRE') {
                const x = 0.50;
                const cx = w * x;
                const baseY = sceneGroundY(tile, w, h, x, 'prop');
                const flicker = 0.75 + Math.sin(Date.now() / 110) * 0.12;
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                const glow = ctx.createRadialGradient(cx, baseY - h * 0.13, 0, cx, baseY - h * 0.13, h * 0.34);
                glow.addColorStop(0, `rgba(255, 175, 65, ${0.18 * flicker})`);
                glow.addColorStop(1, 'rgba(255, 95, 30, 0)');
                ctx.fillStyle = glow;
                ctx.fillRect(0, 0, w, h);
                ctx.restore();
            }
            return;
        }

        const prop = PROP_FOR_BUILDING[building.key] || { scale: 0.16, x: 0.24 + i * 0.17, preferTileImage: true };
        const xNorm = clamp01(prop.x + (i > 0 ? (i % 2 ? 0.08 : -0.08) : 0));
        const cx = w * xNorm;
        const baseY = sceneGroundY(tile, w, h, xNorm, 'prop');
        const targetH = h * prop.scale * scenePerspectiveScale(tile, xNorm);

        registerBuildingHotspot(building, def, cx, baseY - targetH / 2, targetH * 1.05, targetH);

        if (building.key === 'CAMPFIRE') {
            const targetW = targetH * 1.12;
            // Le feu animé est ancré par sa base au sol, sans carré noir issu
            // de l'illustration pleine page.
            const drewAnimated = drawAnimatedCampfire(ctx, cx, baseY, targetW, targetH);
            if (drewAnimated) return;
        }

        const img = (!prop.preferTileImage && prop.asset) ? loadedAssets[prop.asset] : null;
        if (drawAnchoredImage(ctx, img, cx, baseY, targetH, { trim: prop.trim })) return;

        // Fallback propre et transparent : l'icône de tuile devient un repère
        // de scène posé sur le sol, jamais une bulle flottante.
        const tileImg = getTileImage(def.name);
        if (drawAnchoredImage(ctx, tileImg, cx, baseY, targetH, { shadow: true, trim: 'auto' })) return;

        const size = Math.max(34, targetH * 0.7);
        drawGroundShadow(ctx, cx, baseY, size * 0.42, size * 0.06, 0.28);
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.font = `${Math.round(size)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(def.icon || '🏗️', cx, baseY + 2);
        ctx.restore();
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
/* -------------------------------------------------------------------------
 * Survivant pixel-art articulé
 * -------------------------------------------------------------------------
 * Le personnage n'est plus une pile de blocs figés : un squelette léger
 * (hanches, épaules, coudes, genoux) est posé à chaque image par le moteur
 * d'animation (character-anim.js) puis peint en pixels « tamponnés » — des
 * petits carrés alignés sur la grille, comme les décors. Les couches
 * personnalisables (peau, cheveux, tenue, accessoire, équipement) restent
 * indépendantes : le look choisi en jeu se voit bouger dans le monde.
 *
 * Convention locale : origine = point d'ancrage du personnage, +y vers le
 * bas, le sol à SKELETON.FEET_Y. Le survivant regarde vers +x ; la scène
 * est mise en miroir pour l'ouest.
 * ------------------------------------------------------------------------- */

/** Teinte de secours quand une couleur manque. */
const FALLBACK_COLOR = '#7f8a90';

function parseColorChannels(c) {
    const s = String(c || FALLBACK_COLOR).trim();
    if (s[0] === '#') {
        const hex = s.length === 4 ? s.slice(1).split('').map(ch => ch + ch).join('') : s.slice(1, 7);
        const n = parseInt(hex, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const m = s.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (m) return [+m[1], +m[2], +m[3]];
    return [127, 138, 144];
}

function mixColors(a, b, t) {
    const ca = parseColorChannels(a), cb = parseColorChannels(b);
    const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
    const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
    const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
    return `rgb(${r}, ${g}, ${bl})`;
}

const charLerp = (a, b, t) => a + (b - a) * t;

/** Ligne épaisse « pixel art » : des carrés tamponnés le long du segment. */
function stampLine(ctx, x0, y0, x1, y1, wPx, color) {
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const size = Math.max(1, Math.round(wPx));
    const half = Math.floor(size / 2);
    const steps = Math.max(1, Math.ceil(dist / Math.max(1, size * 0.35)));
    ctx.fillStyle = color;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        ctx.fillRect(Math.round(x0 + dx * t) - half, Math.round(y0 + dy * t) - half, size, size);
    }
}

/** Segment de membre avec contour : tampon large sombre puis remplissage. */
function stampLimb(ctx, x0, y0, x1, y1, wUnits, p, color, outlineColor) {
    const wPx = wUnits * p;
    stampLine(ctx, x0, y0, x1, y1, wPx + Math.max(2, Math.round(p * 0.7)), outlineColor);
    stampLine(ctx, x0, y0, x1, y1, wPx, color);
}

/** Correspondance nom d'objet → type d'outil dessiné en main. */
function toolTypeForItem(item) {
    const name = String(item?.name || '');
    if (!name) return null;
    if (/hache/i.test(name)) return 'axe';
    if (/pioche/i.test(name)) return 'pick';
    if (/pelle/i.test(name)) return 'shovel';
    if (/épée|lame|sabre|katana|gourdin/i.test(name)) return 'sword';
    if (/lance|harpon/i.test(name)) return 'spear';
    if (/canne|rod/i.test(name)) return 'rod';
    if (/filet/i.test(name)) return 'net';
    if (/marteau/i.test(name)) return 'hammer';
    return null;
}

/**
 * Dessine un outil tenu en main, aligné sur l'avant-bras.
 * Toutes les coordonnées sont en unités locales (espace déjà miroité).
 */
function drawHeldTool(ctx, type, hx, hy, angle, p, C) {
    if (!type) return;
    const dirX = Math.sin(angle), dirY = Math.cos(angle);
    const P = v => Math.round(v * p);
    const at = d => ({ x: hx + dirX * d, y: hy + dirY * d });
    const outline = '#122029';
    const block = (bx, by, bw, bh, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(P(bx), P(by), Math.max(1, P(bw)), Math.max(1, P(bh)));
    };
    const handle = (d0, d1, color, w = 1.1) => {
        const a = at(d0), b = at(d1);
        stampLine(ctx, P(a.x), P(a.y), P(b.x), P(b.y), Math.max(1.6, w * p), color);
    };

    if (type === 'axe') {
        handle(0, 7.2, C('#6b4a2c'));
        handle(0.5, 7.2, C('#8a6238'), 0.6);
        const tip = at(7.2);
        block(tip.x - 1.9, tip.y - 1.5, 3.4, 3, outline);
        block(tip.x - 1.4, tip.y - 1, 2.6, 2.2, C('#c9d4d9'));
        block(tip.x - 1.4, tip.y - 1, 1.1, 2.2, C('#eef4f6'));
    } else if (type === 'pick') {
        handle(0, 7, C('#7a5636'));
        const tip = at(7);
        stampLine(ctx, P(tip.x - 2.2), P(tip.y - 1.6), P(tip.x + 2.2), P(tip.y - 1.6), Math.max(1.8, p), outline);
        stampLine(ctx, P(tip.x - 1.7), P(tip.y - 1.4), P(tip.x + 1.7), P(tip.y - 1.4), Math.max(1.4, 0.8 * p), C('#b8c3c9'));
        stampLine(ctx, P(tip.x - 1.6), P(tip.y - 1.9), P(tip.x - 1.6), P(tip.y + 0.4), Math.max(1.4, 0.8 * p), C('#a7b3ba'));
        stampLine(ctx, P(tip.x + 1.6), P(tip.y - 1.9), P(tip.x + 1.6), P(tip.y + 0.4), Math.max(1.4, 0.8 * p), C('#a7b3ba'));
    } else if (type === 'shovel') {
        handle(0, 7.4, C('#7a5636'));
        const tip = at(7.4);
        block(tip.x - 1.6, tip.y - 1.6, 3.2, 3.4, outline);
        block(tip.x - 1.15, tip.y - 1.2, 2.3, 2.8, C('#aab6bd'));
        block(tip.x - 1.15, tip.y - 1.2, 2.3, 1, C('#cfdade'));
    } else if (type === 'sword') {
        handle(-0.6, 1.2, C('#5d4128'));
        const g = at(1.2);
        block(g.x - 1.7, g.y - 0.6, 3.4, 1.3, C('#d6a64b'));
        stampLine(ctx, P(g.x), P(g.y), P(g.x + dirX * 7.4), P(g.y + dirY * 7.4), Math.max(1.6, 1.2 * p), C('#dce8e9'));
        const tipBlock = at(8.4);
        block(tipBlock.x - 0.5, tipBlock.y - 0.5, 1, 1, C('#ffffff'));
    } else if (type === 'spear') {
        handle(-1.6, 8.6, C('#8a6238'), 0.9);
        const tip = at(8.6);
        block(tip.x - 0.8, tip.y - 1.9, 1.7, 2.4, outline);
        block(tip.x - 0.45, tip.y - 1.5, 1, 1.8, C('#dce8e9'));
    } else if (type === 'rod') {
        handle(0, 9.6, C('#a87635'), 0.75);
        handle(7.8, 9.6, C('#c99a54'), 0.55);
        const tip = at(9.6);
        block(tip.x - 0.5, tip.y - 1.4, 1.1, 1.4, C('#e8f2f4'));
        // Ligne de pêche tendue vers l'eau, bouchon rouge.
        ctx.strokeStyle = 'rgba(226, 240, 244, 0.75)';
        ctx.lineWidth = Math.max(1, Math.round(p * 0.35));
        ctx.beginPath();
        ctx.moveTo(P(tip.x), P(tip.y));
        ctx.lineTo(P(tip.x + 2.4), P(SKELETON.FEET_Y));
        ctx.stroke();
        block(tip.x + 2, SKELETON.FEET_Y - 1.1, 0.9, 1.3, C('#e2574b'));
    } else if (type === 'net') {
        handle(0, 4.6, C('#a87635'), 0.8);
        const tip = at(4.6);
        ctx.strokeStyle = C('#d8e4d2');
        ctx.lineWidth = Math.max(1, Math.round(p * 0.4));
        ctx.beginPath();
        ctx.arc(P(tip.x + 1.6), P(tip.y), Math.max(2, P(2.6)), 0, Math.PI * 2);
        ctx.stroke();
    } else if (type === 'hammer') {
        handle(0, 4.8, C('#7a5636'));
        const tip = at(4.8);
        block(tip.x - 1.9, tip.y - 1.4, 3.8, 2.6, outline);
        block(tip.x - 1.5, tip.y - 1, 3, 1.8, C('#9faeb6'));
        block(tip.x - 1.5, tip.y - 1, 3, 0.7, C('#c8d3d9'));
    } else if (type === 'spoon') {
        handle(0, 4, C('#8a6238'), 0.7);
        const tip = at(4);
        block(tip.x - 0.9, tip.y - 1.3, 1.8, 2.2, C('#c9d4d9'));
    } else if (type === 'canteen') {
        block(hx - 1.5, hy - 1.6, 3, 3.1, outline);
        block(hx - 1.1, hy - 1.2, 2.2, 2.3, C('#7f9aa4'));
        block(hx - 0.4, hy - 2.1, 0.9, 0.7, C('#5d7681'));
    } else if (type === 'food') {
        block(hx - 1.4, hy - 1.3, 2.9, 2.3, outline);
        block(hx - 1.1, hy - 1, 2.3, 1.7, C('#d19a5b'));
        block(hx - 1.1, hy - 1, 2.3, 0.6, C('#e8bd85'));
    } else if (type === 'guitar') {
        // Tenu en diagonale contre le buste, manche vers l'avant-haut.
        stampLine(ctx, P(hx - 1), P(hy + 1.6), P(hx + 2.4), P(hy - 3.4), Math.max(1.6, p), C('#6b4a2c'));
        block(hx - 2.9, hy + 1.2, 3.6, 4.2, outline);
        block(hx - 2.5, hy + 1.6, 2.8, 3.4, C('#b3543f'));
        block(hx - 2.5, hy + 1.6, 2.8, 1, C('#d06a50'));
        block(hx - 1.7, hy + 2.4, 0.7, 0.7, '#122029');
        block(hx - 0.4, hy + 3.1, 0.7, 0.7, '#122029');
    }
}

/** Petits motifs de particules (poussière, étincelles, Z de sommeil…). */
function drawParticle(ctx, part, p) {
    const color = PARTICLE_COLORS[part.kind] || PARTICLE_COLORS.dust;
    const fade = 1 - part.life / part.maxLife;
    ctx.globalAlpha = Math.max(0, Math.min(1, fade * 1.6));
    ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    const x = Math.round(part.x * p), y = Math.round(part.y * p);
    const s = Math.max(1, Math.round(part.size * p * 0.8));
    if (part.kind === 'zzz') {
        // Un « Z » de trois traits.
        const t = Math.max(1, Math.round(p * 0.5));
        const w = Math.max(2, Math.round(p * 0.9));
        ctx.fillRect(x, y, w, t);
        ctx.fillRect(x + w - t, y + t, t, t);
        ctx.fillRect(x + w - 2 * t, y + 2 * t, t, t);
        ctx.fillRect(x, y + 3 * t, w, t);
    } else if (part.kind === 'note') {
        ctx.fillRect(x, y, s, Math.max(1, s * 2));
        ctx.fillRect(x, y - Math.round(s * 0.6), Math.round(s * 1.4), Math.max(1, Math.round(s * 0.8)));
    } else if (part.kind === 'heart') {
        ctx.fillRect(x, y, Math.max(1, s - 1), s);
        ctx.fillRect(x + s, y, Math.max(1, s - 1), s);
        ctx.fillRect(x, y + 1, s * 2 - 1, Math.max(1, s - 1));
    } else if (part.kind === 'spark' || part.kind === 'sparkle') {
        ctx.fillRect(x - s, y, s * 3, Math.max(1, s - 1));
        ctx.fillRect(x, y - s, Math.max(1, s - 1), s * 3);
    } else {
        ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1;
}

/**
 * Dessine un personnage complet (joueur, autre joueur ou PNJ) à partir de sa
 * pose calculée par character-anim.js.
 */
export function drawPixelCharacter(ctx, character, x, y, isPlayer = false, animationProgress = 0, scale = 1, opts = {}) {
    const { showLabel = true, faceHint = 0 } = opts;
    const look = characterLook(character);
    const p = Math.max(2, Math.round(4 * scale));

    // --- Pose : le moteur d'animation observe le personnage à chaque image.
    // Les aperçus (personnalisation, avatar de combat) fournissent la leur.
    let rt, pose;
    if (opts.pose && opts.runtime) {
        rt = opts.runtime;
        pose = opts.pose;
    } else {
        rt = updateCharacterRuntime(character, { isPlayer });
        pose = computeCharacterPose(character, rt, { isPlayer, faceHint });
    }
    // Compat : l'ancien paramètre de progression déclenchait une marche.
    if (animationProgress > 0 && !rt.action) {
        const c = animationProgress * Math.PI * 4;
        pose.legFront = { h: Math.sin(c) * 0.62, k: Math.max(0, Math.cos(c)) * 0.85 };
        pose.legBack = { h: -Math.sin(c) * 0.62, k: Math.max(0, -Math.cos(c)) * 0.85 };
        pose.armFront = { s: -Math.sin(c) * 0.5, e: 0.4 };
        pose.armBack = { s: Math.sin(c) * 0.5, e: 0.4 };
        pose.bob = -Math.abs(Math.sin(c)) * 0.85;
        pose.lean = 0.09;
    }

    const outfit = look.outfit || character.color || '#287c9d';
    const pants = shadeColor(outfit, -64);
    const boots = shadeColor(pants, -26);
    const outline = '#122029';
    const tint = pose.tint;
    const C = tint > 0 ? (c => mixColors(c, '#ff4b45', tint * 0.6)) : (c => c);

    // --- Squelette : positions des articulations (unités locales) ---
    const feetY = SKELETON.FEET_Y;
    const hipDrop = pose.crouch * 4.6 + pose.sit * 8.4;
    const hipY = feetY - SKELETON.HIP_H + hipDrop + pose.bob;
    const shoulderY = hipY - SKELETON.TORSO_H;
    const hipCX = pose.sway;
    const leanShift = Math.sin(pose.lean) * SKELETON.TORSO_H;
    const shoulderCX = hipCX + leanShift;
    const headCX = shoulderCX + pose.headTurn * 0.5 + pose.headNod * 0.9;
    const headCY = shoulderY - SKELETON.NECK_H - SKELETON.HEAD_HH + pose.headNod * 2.1;

    const hipF = { x: hipCX + SKELETON.HIP_X, y: hipY };
    const hipB = { x: hipCX - SKELETON.HIP_X, y: hipY };
    const shF = { x: shoulderCX + SKELETON.SHOULDER_X, y: shoulderY + 0.6 };
    const shB = { x: shoulderCX - SKELETON.SHOULDER_X, y: shoulderY + 0.6 };

    const limbEnd = (base, a1, l1, a2, l2) => {
        const jx = base.x + Math.sin(a1) * l1, jy = base.y + Math.cos(a1) * l1;
        const ex = jx + Math.sin(a1 + a2) * l2, ey = jy + Math.cos(a1 + a2) * l2;
        return { jx, jy, ex, ey };
    };
    const legF = limbEnd(hipF, pose.legFront.h, SKELETON.LEG.upper, -pose.legFront.k, SKELETON.LEG.lower);
    const legB = limbEnd(hipB, pose.legBack.h, SKELETON.LEG.upper, -pose.legBack.k, SKELETON.LEG.lower);
    const armF = limbEnd(shF, pose.armFront.s, SKELETON.ARM.upper, pose.armFront.e, SKELETON.ARM.fore);
    const armB = limbEnd(shB, pose.armBack.s, SKELETON.ARM.upper, pose.armBack.e, SKELETON.ARM.fore);

    const anchorX = Math.round(x);
    const anchorY = Math.round(y);
    const P = v => Math.round(v * p);

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // --- Espace local : ancrage, miroir selon la direction, décalage de pose.
    ctx.save();
    ctx.translate(anchorX, anchorY);
    if (pose.facing < 0) ctx.scale(-1, 1);
    ctx.translate(Math.round(pose.offsetX * p), Math.round(pose.offsetY * p));

    const block = (gx, gy, gw, gh, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(P(gx), P(gy), Math.max(1, P(gw)), Math.max(1, P(gh)));
    };
    const limb = (a, b, w, color) => stampLimb(ctx, P(a.x), P(a.y), P(b.x), P(b.y), w, p, C(color), outline);

    // 1. Ombre au sol (suit le personnage) + anneau de sélection du joueur.
    const shadowW = 5.6 * pose.shadowScale + pose.crouch * 1.6 + pose.sit * 2.6;
    ctx.fillStyle = 'rgba(7, 17, 24, 0.42)';
    ctx.beginPath();
    ctx.ellipse(0, P(feetY + 0.2), P(shadowW), P(1.5), 0, 0, Math.PI * 2);
    ctx.fill();
    if (isPlayer) {
        const pulse = 0.55 + Math.sin(Date.now() / 420) * 0.25;
        ctx.strokeStyle = `rgba(248, 212, 117, ${pulse})`;
        ctx.lineWidth = Math.max(1.5, p * 0.45);
        ctx.beginPath();
        ctx.ellipse(0, P(feetY + 0.3), P(shadowW + 1.6), P(1.9), 0, 0, Math.PI * 2);
        ctx.stroke();
    }

    // 2. Bras arrière (derrière le buste).
    limb(shB, { x: armB.jx, y: armB.jy }, SKELETON.ARM.w, shadeColor(outfit, -30));
    limb({ x: armB.jx, y: armB.jy }, { x: armB.ex, y: armB.ey }, SKELETON.ARM.w - 0.3, shadeColor(look.skin, -18));

    // 3. Sac à dos (équipé, ou propre au joueur).
    if (character.equipment?.bag || isPlayer) {
        block(shoulderCX - SKELETON.TORSO_W / 2 - 2.1, shoulderY + 1, 3.2, 6.4, outline);
        block(shoulderCX - SKELETON.TORSO_W / 2 - 1.75, shoulderY + 1.35, 2.5, 5.7, C('#65442c'));
        block(shoulderCX - SKELETON.TORSO_W / 2 - 1.75, shoulderY + 2.8, 2.5, 1.1, C('#bd8341'));
    }

    // 4. Boucle de cheveux longue, derrière le buste.
    if (look.style === 'long') {
        const sway = pose.hairSway * 0.8;
        block(headCX - SKELETON.HEAD_HW + 0.2 + sway * 0.4, headCY - 1, 2.6, 8.5, C(shadeColor(look.hair, -14)));
    }

    // 5. Jambes : l'arrière puis l'avant, bottes comprises.
    limb(hipB, { x: legB.jx, y: legB.jy }, SKELETON.LEG.w, shadeColor(pants, -14));
    limb({ x: legB.jx, y: legB.jy }, { x: legB.ex, y: legB.ey }, SKELETON.LEG.w - 0.3, shadeColor(pants, -14));
    block(legB.ex - 1.7, legB.ey - 0.6, 3.4, 1.9, C(boots));
    limb(hipF, { x: legF.jx, y: legF.jy }, SKELETON.LEG.w, pants);
    limb({ x: legF.jx, y: legF.jy }, { x: legF.ex, y: legF.ey }, SKELETON.LEG.w - 0.3, pants);
    block(legF.ex - 1.7, legF.ey - 0.6, 3.4, 1.9, C(boots));

    // 6. Buste : colonne cisaillée selon l'inclinaison. Le contour est posé
    //    en premier passe complète, sinon chaque rangée mord sur la teinte de
    //    la précédente et le buste se couvre de coutures sombres.
    const torsoBaseW = SKELETON.TORSO_W;
    const torsoTopW = torsoBaseW - 1.2;
    const rows = Math.max(4, Math.round(SKELETON.TORSO_H));
    for (let j = 0; j <= rows; j++) {
        const tt = j / rows;
        const cx = charLerp(hipCX, shoulderCX, tt);
        const y = charLerp(hipY, shoulderY, tt);
        const halfW = charLerp(torsoBaseW, torsoTopW, tt) / 2;
        block(cx - halfW - 0.6, y - 0.8, halfW * 2 + 1.2, 1.6, outline);
    }
    for (let j = 0; j <= rows; j++) {
        const tt = j / rows;
        const cx = charLerp(hipCX, shoulderCX, tt);
        const y = charLerp(hipY, shoulderY, tt);
        const halfW = charLerp(torsoBaseW, torsoTopW, tt) / 2;
        block(cx - halfW, y - 0.5, halfW * 2, 1, C(outfit));
    }
    // Ceinture, col et pli de lumière sur le tissu.
    const beltY = hipY - 1.6;
    block(hipCX - torsoBaseW / 2, beltY, torsoBaseW, 1.3, C('#5d4229'));
    block(hipCX - 0.65, beltY - 0.1, 1.3, 1.5, C('#e1b84a'));
    block(shoulderCX - torsoTopW / 2, shoulderY, torsoTopW, 1, C(shadeColor(outfit, 26)));
    block(shoulderCX - torsoTopW / 2 + 0.4, shoulderY + 1, 1.6, SKELETON.TORSO_H - 2.5, C(shadeColor(outfit, 18)));

    // 7. Cou.
    block(shoulderCX - 1, shoulderY - 1.4, 2, 1.9, C(shadeColor(look.skin, -22)));

    // 8. Tête : bloc arrondi. Contour complet puis peau, même logique anti-
    //    couture que le buste.
    const HW = SKELETON.HEAD_HW, HH = SKELETON.HEAD_HH;
    for (let j = 0; j < HH * 2; j++) {
        const rowY = headCY - HH + j;
        const inset = (j === 0 || Math.ceil(HH * 2) - 1 === j) ? 1.4 : ((j === 1 || j === Math.ceil(HH * 2) - 2) ? 0.5 : 0);
        block(headCX - HW - 0.5 + inset * 0.5, rowY - 0.75, (HW - inset) * 2 + 1, 1.5, outline);
    }
    for (let j = 0; j < HH * 2; j++) {
        const rowY = headCY - HH + j;
        const inset = (j === 0 || Math.ceil(HH * 2) - 1 === j) ? 1.4 : ((j === 1 || j === Math.ceil(HH * 2) - 2) ? 0.5 : 0);
        block(headCX - HW + inset, rowY - 0.5, (HW - inset) * 2, 1, C(look.skin));
    }
    // Oreille côté arrière + ombrage du front, nez sur le bord avant.
    block(headCX - HW - 0.6, headCY + 0.1, 1, 2, C(look.skin));
    block(headCX - HW + 0.3, headCY - 1.2, 0.8, 2.4, shadeColor(look.skin, -26));
    block(headCX + HW - 0.5, headCY + 0.2, 1.1, 1.3, C(shadeColor(look.skin, -34)));

    // 9. Visage : sourcils, yeux (clignement + regard), bouche, joues.
    const eyeY = headCY - 0.7 + pose.headNod * 0.6;
    const glance = pose.headTurn;
    const browColor = shadeColor(look.hair, -18);
    if (pose.mouth === 'grimace') {
        block(headCX + 0.1 + glance, eyeY - 1.8, 1.6, 0.6, browColor);
        block(headCX + 2.2 - glance * 0.5, eyeY - 1.5, 1.6, 0.6, browColor);
    }
    const eyeH = pose.eyes > 0.5 ? 1.15 : 0.35;
    block(headCX + 0.2 + glance * 0.6, eyeY, 1.15, eyeH, C('#17242b'));
    block(headCX + 2.3 + glance * 0.6, eyeY, 1.15, eyeH, C('#17242b'));
    if (pose.eyes > 0.5) {
        block(headCX + 0.95 + glance * 0.6, eyeY, 0.4, 0.4, '#f4fbfd');
        block(headCX + 3.05 + glance * 0.6, eyeY, 0.4, 0.4, '#f4fbfd');
    }
    const mouthY = headCY + 1.9;
    if (pose.mouth === 'smile') {
        block(headCX + 0.9, mouthY, 2.4, 0.6, C('#854639'));
        block(headCX + 0.5, mouthY - 0.6, 0.7, 0.7, C('#854639'));
        block(headCX + 3, mouthY - 0.6, 0.7, 0.7, C('#854639'));
        block(headCX - 1.6, mouthY - 0.2, 1.2, 0.7, C('#e89a94'));
        block(headCX + 3.6, mouthY - 0.2, 1.2, 0.7, C('#e89a94'));
    } else if (pose.mouth === 'open') {
        block(headCX + 1.1, mouthY - 0.4, 2, 1.7, C('#6e3a30'));
        block(headCX + 1.3, mouthY + 0.5, 1.6, 0.8, C('#c96a5c'));
    } else if (pose.mouth === 'small') {
        block(headCX + 1.3, mouthY, 1.2, 0.6, C('#854639'));
    } else if (pose.mouth === 'grimace') {
        block(headCX + 0.9, mouthY, 2.5, 0.9, C('#5d352d'));
        block(headCX + 1.1, mouthY, 2.1, 0.4, C('#dfe8e6'));
    } else {
        block(headCX + 1.1, mouthY, 1.7, 0.55, C('#854639'));
    }

    // 10. Chevelure et accessoire cosmétique.
    drawCharacterHair(ctx, look, headCX, headCY, HW, HH, block, C, pose, outfit);

    // 11. Équipement de tête (casque / chapeau) par-dessus la chevelure.
    if (character.equipment?.head) {
        block(headCX - HW - 0.9, headCY - HH - 1.2, HW * 2 + 1.8, 1, outline);
        block(headCX - HW - 0.5, headCY - HH - 0.8, HW * 2 + 1, 0.8, C('#9b7132'));
        block(headCX - HW + 0.3, headCY - HH - 3, HW * 2 - 0.6, 2.4, C('#e4c36b'));
        block(headCX - HW + 0.3, headCY - HH - 3, HW * 2 - 0.6, 0.8, C('#f2d98b'));
    }

    // 12. Bras avant + main, puis outil et bouclier.
    limb(shF, { x: armF.jx, y: armF.jy }, SKELETON.ARM.w, outfit);
    limb({ x: armF.jx, y: armF.jy }, { x: armF.ex, y: armF.ey }, SKELETON.ARM.w - 0.3, look.skin);
    block(armF.ex - 1, armF.ey - 1, 2, 2, C(look.skin));

    const equippedTool = toolTypeForItem(character.equipment?.weapon);
    const activeTool = pose.tool?.type || equippedTool;
    if (activeTool) {
        const forearmAngle = pose.armFront.s + pose.armFront.e;
        // Au repos, l'outil équipé pend le long de la cuisse ; en action, la
        // pose impose son alignement pour que le fer suive l'arc du geste.
        const REST_BIAS = { axe: 0.5, pick: 0.55, sword: -0.12, spear: -0.05, rod: 0.25, shovel: 0.45, hammer: 0.5, net: -0.35 };
        const bias = pose.tool ? (pose.tool.angleBias ?? 0.12) : (REST_BIAS[activeTool] ?? 0.15);
        drawHeldTool(ctx, activeTool, armF.ex, armF.ey, forearmAngle + bias, p, C);
        // Seconde main sur le manche des outils à deux mains.
        if (pose.tool?.twoHand) {
            const gripD = activeTool === 'rod' ? 3.4 : 2.4;
            const gx = armF.ex + Math.sin(forearmAngle + bias) * gripD;
            const gy = armF.ey + Math.cos(forearmAngle + bias) * gripD;
            block(gx - 0.9, gy - 0.9, 1.8, 1.8, C(shadeColor(look.skin, -12)));
        }
    }
    if (character.equipment?.shield) {
        const sx = armB.ex, sy = armB.jy + (armB.ey - armB.jy) * 0.4;
        block(sx - 1.8, sy - 2.6, 3.6, 5.2, outline);
        block(sx - 1.4, sy - 2.2, 2.8, 4.4, C('#657983'));
        block(sx - 0.7, sy - 1.4, 1.4, 2.8, C('#9ebdc4'));
    }

    // 13. Particules du personnage (poussière, Z, notes…).
    for (const part of characterParticles(rt)) drawParticle(ctx, part, p);

    ctx.restore(); // fin de l'espace local miroité

    // --- Étiquette et bulle : jamais miroitées, mais suivant la pose.
    const bodyShiftX = pose.facing * pose.offsetX * p;
    const bodyShiftY = pose.offsetY * p;
    const headTopPy = anchorY + Math.round(bodyShiftY + (headCY - HH - 4.6) * p);
    const labelX = Math.round(anchorX + bodyShiftX);
    const label = showLabel ? (character.name || character.username) : '';
    if (label) {
        const fontSize = Math.max(9, Math.round(11 * scale));
        ctx.font = `700 ${fontSize}px Poppins, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const width = ctx.measureText(label).width + p * 3;
        const textY = headTopPy - fontSize * 1.1;
        ctx.fillStyle = isPlayer ? '#f6d681' : 'rgba(8, 22, 30, .82)';
        ctx.fillRect(Math.round(labelX - width / 2), Math.round(textY - fontSize / 1.65), Math.round(width), Math.round(fontSize * 1.45));
        ctx.fillStyle = isPlayer ? '#13232b' : '#edf8fa';
        ctx.fillText(label, labelX, textY);
    }
    if (character.chatMessage && (Date.now() - character.chatMessage.timestamp < 5000)) {
        drawSpeechBubble(ctx, labelX, headTopPy - (label ? 14 * scale : 2), character.chatMessage.text, scale);
    }
    ctx.restore();
}

/** Chevelures et accessoires cosmétiques, au-dessus de la tête. */
function drawCharacterHair(ctx, look, cx, cy, HW, HH, block, C, pose, outfit) {
    const hair = look.hair;
    const sway = pose.hairSway;
    const style = look.style;

    if (style === 'bald') {
        block(cx + 1, cy - HH + 0.3, 1.6, 0.6, C(shadeColor(look.skin, 38)));
    } else if (style === 'cap') {
        // Casquette en tissu coordonné à la tenue.
        const capC = shadeColor(outfit, -26);
        block(cx - HW - 0.4, cy - HH - 1.9, HW * 2 + 1.2, 0.9, '#122029');
        block(cx - HW - 0.1, cy - HH - 1.5, HW * 2 + 0.6, 2.3, C(capC));
        block(cx - HW - 0.1, cy - HH - 1.5, HW * 2 + 0.6, 0.7, C(shadeColor(capC, 22)));
        block(cx + HW - 0.4, cy - HH + 0.9, 3.1, 0.9, C(shadeColor(capC, -14))); // visière avant
        block(cx - 0.5, cy - HH - 2.4, 1, 0.6, C(shadeColor(capC, 30)));
    } else if (style === 'mohawk') {
        block(cx - 0.7 + sway * 0.2, cy - HH - 3.6, 1.5, 4.4, C(shadeColor(hair, -12)));
        block(cx - 0.5 + sway * 0.2, cy - HH - 3.6, 1, 4.4, C(hair));
        block(cx - 0.7, cy - HH + 0.4, 1.6, 1.1, C(hair));
    } else {
        // Calotte commune aux coupes courtes, longues, chignon.
        block(cx - HW - 0.4, cy - HH - 1.6, HW * 2 + 1.1, 0.8, '#122029');
        block(cx - HW - 0.1, cy - HH - 1.2, HW * 2 + 0.5, 2.6, C(hair));
        block(cx - HW - 0.1, cy - HH - 1.2, HW * 2 + 0.5, 0.8, C(shadeColor(hair, 20)));
        // Nuque et frange.
        block(cx - HW - 0.2, cy - HH + 1.2, 2.2, 2.2, C(hair));
        block(cx + HW - 2.4, cy - HH + 1.3, 2.6, 1, C(shadeColor(hair, -10)));
        if (style === 'long') {
            // Mèches descendant sur les épaules, avec un peu d'inertie.
            block(cx + HW - 0.9 + sway * 0.5, cy - HH + 1.6, 1.8, 6.4, C(hair));
            block(cx - HW - 0.7 + sway * 0.4, cy - HH + 1.6, 1.9, 5.8, C(shadeColor(hair, -12)));
        }
        if (style === 'bun') {
            block(cx - 1.6 - sway * 0.2, cy - HH - 3.2, 3.3, 2.8, C(shadeColor(hair, -8)));
            block(cx - 1.2 - sway * 0.2, cy - HH - 2.9, 2.5, 2.2, C(hair));
        }
    }

    // Accessoire cosmétique (indépendant de l'équipement).
    if (look.accessory === 'bandana') {
        block(cx - HW - 0.3, cy - HH + 1.5, HW * 2 + 0.9, 1.05, C('#d55a4a'));
        block(cx - HW - 0.3, cy - HH + 1.5, HW * 2 + 0.9, 0.4, C('#e8796a'));
        // Nœud qui claque derrière la tête.
        const flap = Math.sin(Date.now() / 140) * 0.35 + sway * 0.6;
        block(cx - HW - 1.6, cy - HH + 1.7, 1.4, 1, C('#d55a4a'));
        block(cx - HW - 2.4 + flap * 0.5, cy - HH + 1.5, 1.2, 0.9, C('#c04a3c'));
    } else if (look.accessory === 'flower') {
        block(cx - 2.6, cy - HH - 1.4, 1.3, 1.3, C('#f7d4e1'));
        block(cx - 1.6, cy - HH - 2.2, 1.3, 1.3, C('#f7d4e1'));
        block(cx - 1.7, cy - HH - 0.6, 1.3, 1.3, C('#f7d4e1'));
        block(cx - 1.9, cy - HH - 1.4, 0.9, 0.9, C('#f0ba43'));
    } else if (look.accessory === 'monocle') {
        // Anneau autour de l'œil avant + chaînette.
        block(cx + 1.9, cy - 1.5, 2.1, 0.5, C('#e3d27b'));
        block(cx + 1.9, cy + 0.1, 2.1, 0.5, C('#e3d27b'));
        block(cx + 1.9, cy - 1.5, 0.5, 2.1, C('#e3d27b'));
        block(cx + 3.5, cy - 1.5, 0.5, 2.1, C('#e3d27b'));
        block(cx + 3.7, cy + 0.9, 0.45, 2.2, C('#e3d27b'));
    } else if (look.accessory === 'earring') {
        block(cx - HW - 0.7, cy + 2.2, 0.9, 1.6, C('#f1ce62'));
    } else if (look.accessory === 'scout') {
        block(cx - HW - 0.3, cy - HH + 0.9, HW * 2 + 0.9, 1, C('#74a85c'));
        block(cx + 2.1, cy - HH + 0.9, 1.1, 1.1, C('#d9edab'));
        // Plume plantée dans le bandeau.
        block(cx - HW - 0.6, cy - HH - 2.6, 0.8, 2.4, C('#d9824f'));
        block(cx - HW - 1.2, cy - HH - 3.2, 1, 1.2, C('#e8a06c'));
    }
}

function drawCharacter(ctx, character, x, y, isPlayer = false, animationProgress = 0, scale = 1, opts = {}) {
    drawPixelCharacter(ctx, character, x, y, isPlayer, animationProgress, scale, opts);
}

/* -------------------------------------------------------------------------
 * Aperçus animés (personnalisation, camp, avatar de combat)
 * -------------------------------------------------------------------------
 * Un même calendrier d'images redessine les aperçus visibles : le survivant
 * y respire, cligne des yeux et salue de temps en temps, exactement comme
 * dans la scène. La boucle s'arrête d'elle-même quand plus aucun aperçu
 * n'est affiché.
 * ------------------------------------------------------------------------- */
const animatedCanvases = new Map(); // canvas → { paint }
let animatedLoopId = null;

function registerAnimatedCanvas(canvas, paint) {
    animatedCanvases.set(canvas, { paint });
    ensureAnimatedLoop();
}

function ensureAnimatedLoop() {
    if (animatedLoopId) return;
    let last = 0;
    const loop = (ts) => {
        animatedLoopId = null;
        if (ts - last < 33) { // cadence modérée : l'aperçu n'a pas besoin de 60 i/s
            animatedLoopId = requestAnimationFrame(loop);
            return;
        }
        last = ts;
        for (const [canvas, entry] of animatedCanvases) {
            if (!canvas.isConnected) { animatedCanvases.delete(canvas); continue; }
            if ((canvas.clientWidth | 0) < 4) continue; // masqué : rien à dessiner
            try { entry.paint(); } catch (e) { /* un aperçu ne casse pas la boucle */ }
        }
        // La boucle s'éteint quand plus aucun aperçu n'est enregistré ; elle
        // est relancée par le prochain appel à registerAnimatedCanvas.
        if (animatedCanvases.size > 0) animatedLoopId = requestAnimationFrame(loop);
    };
    animatedLoopId = requestAnimationFrame(loop);
}

/** Décor du diorama d'aperçu : ciel, mer et îlot en dalles. */
function paintPreviewDiorama(ctx, w, h) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#102f3b';
    ctx.fillRect(0, 0, w, h);
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
}

/** Prévisualisation de l'avatar pour le camp et le salon de personnalisation. */
export function drawCharacterPreview(canvas, player = {}, appearance = null) {
    if (!canvas) return;
    const paint = () => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const w = canvas.width || 320;
        const h = canvas.height || 260;
        paintPreviewDiorama(ctx, w, h);
        const previewPlayer = {
            ...player,
            name: '',
            health: player.health ?? 20,
            maxHealth: player.maxHealth ?? 20,
            appearance: appearance || player.appearance,
        };
        // Runtime isolé du monde : l'aperçu ne déclenche ni marche ni dégâts.
        const rt = previewRuntime(previewPlayer);
        const pose = computeCharacterPose(previewPlayer, rt, { isPlayer: true, preview: true });
        drawPixelCharacter(ctx, previewPlayer, w / 2, h * 0.74, true, 0, Math.min(w / 320, h / 250) * 1.2, { showLabel: false, pose, runtime: rt });
    };
    paint();
    registerAnimatedCanvas(canvas, paint);
}

/** Avatar du joueur dans la scène de combat : on redessine le vrai survivant
 * (apparence + équipement) au lieu d'utiliser une image générique. */
export function drawCombatPlayerAvatar(canvas, player = {}, { defending = false, hurt = false, mode = null } = {}) {
    if (!canvas) return;
    const state = { player, defending, hurt, mode };
    const paint = () => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const w = canvas.width || 180;
        const h = canvas.height || 160;
        const { player: p, defending: def, hurt: hr, mode: m } = state;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, w, h);

        // Socle façon RPG : quelques pixels d'herbe/terre sous les pieds.
        const cx = w * 0.5;
        const groundY = h * 0.82;
        ctx.fillStyle = 'rgba(5, 16, 20, 0.38)';
        ctx.beginPath();
        ctx.ellipse(cx, groundY, w * 0.30, h * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
        const unit = Math.max(2, Math.round(w / 72));
        for (let i = 0; i < 18; i++) {
            const px = (w * 0.22 + ((i * 17) % Math.round(w * 0.56)));
            const py = groundY - unit + ((i % 3) - 1) * unit;
            ctx.fillStyle = i % 2 ? '#6aa75d' : '#d6b466';
            ctx.fillRect(Math.round(px), Math.round(py), unit * (1 + (i % 2)), unit);
        }

        const combatPlayer = {
            ...p,
            name: '',
            appearance: p.appearance,
            health: p.health ?? 20,
            maxHealth: p.maxHealth ?? 20,
            combatState: null,
        };
        const scale = Math.min(w / 170, h / 145) * 1.15;
        const rt = previewRuntime(combatPlayer, 'preview:combat');
        // L'avatar adopte la posture demandée : garde en combat, coup porté,
        // encaissement — les mêmes poses que la scène.
        if (m && m !== rt._lastMode) {
            rt._lastMode = m;
            triggerCharacterAnim(rt.key, m, { force: true });
        } else if (!m) {
            rt._lastMode = null;
        }
        if (hr) triggerCharacterAnim(rt.key, 'hurt', { force: true });
        const pose = computeCharacterPose(combatPlayer, rt, { isPlayer: true });
        drawPixelCharacter(ctx, combatPlayer, cx, h * 0.73, true, 0, scale, { showLabel: false, pose, runtime: rt });

        if (def) {
            ctx.strokeStyle = 'rgba(126, 221, 255, 0.82)';
            ctx.lineWidth = Math.max(2, unit);
            ctx.setLineDash([unit * 3, unit * 2]);
            ctx.beginPath();
            ctx.ellipse(cx, h * 0.48, w * 0.28, h * 0.36, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.restore();
    };
    paint();
    registerAnimatedCanvas(canvas, paint);
}

/** Dessine quelques objets laissés au sol pour relier l'inventaire au monde. */
function drawGroundLoot(ctx, w, h, tile, scale) {
    // Les objets au sol sont soit des piles (nombre), soit des instances
    // d'objets uniques (outil posé avec sa durabilité).
    const entries = Object.entries(tile?.groundItems || {})
        .map(([key, value]) => {
            if (typeof value === 'object' && value && value.name) return { key, name: value.name, amount: 1 };
            const amount = Number(value) || 0;
            return amount > 0 ? { key, name: key, amount } : null;
        })
        .filter(Boolean)
        .slice(0, 3);
    if (!entries.length) return;

    const positions = [0.24, 0.77, 0.14];
    const pulse = (Math.sin(Date.now() / 420) + 1) * 0.5;

    entries.forEach((entry, index) => {
        const { name, amount } = entry;
        const px = positions[index];
        const x = w * px;
        const size = Math.max(24, 34 * scale);
        const groundY = sceneGroundY(tile, w, h, px, 'loot');
        // y est le centre visuel de l'icône ; son bas et son ombre restent au sol.
        const y = groundY - size * 0.28;
        const itemDef = ITEM_TYPES[name] || {};
        const img = getItemImage(name);

        // Ramassage au clic directement sur l'objet posé au sol.
        registerHotspot({
            id: `loot:${entry.key}`,
            type: 'loot',
            itemName: name,
            itemKey: entry.key,
            x,
            y: groundY - size * 0.45,
            w: size * 1.5,
            h: size * 1.6,
            label: amount > 1 ? `${name} ×${amount}` : name,
            hint: 'Ramasser',
            marker: 'loot',
            priority: 4,
        });

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
        ctx.ellipse(x, groundY, size * 0.46, size * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();

        if (img) {
            drawAnchoredImage(ctx, img, x, groundY, size * 0.86, { trim: 'auto', shadow: false });
        } else {
            ctx.font = `${Math.round(size * 0.8)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(itemDef.icon || '📦', x, groundY + 1);
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

    // Échelle des personnages : lisible aussi bien sur mobile que sur grand
    // écran. Le calcul (voir characterScaleFor dans resolution.js) reproduit
    // la taille affichée calibrée avant le plein écran PC et la résolution
    // mobile verrouillée, sur toutes les densités d'écran.
    const scale = characterScaleFor(canvasHeight, getSceneRenderScale(), isMobileShell());

    // Les objets déposés deviennent visibles directement dans la scène.
    drawGroundLoot(charactersCtx, canvasWidth, canvasHeight, currentTile, scale);

    // Position de base : les pieds sont ancrés à la ligne de sol du fond actif.
    const playerBaseX = canvasWidth / 2;
    const playerGroundY = sceneGroundY(currentTile, canvasWidth, canvasHeight, 0.50, 'player');
    const playerBaseY = characterAnchorForGround(playerGroundY, scale);

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
                const x = playerBaseX + offsetX;
                const xNorm = clamp01(x / canvasWidth);
                const y = characterAnchorForGround(sceneGroundY(currentTile, canvasWidth, canvasHeight, xNorm, 'player'), scale);
                charactersOnTile.push({ char: otherPlayer, x, y, isPlayer: false, sortOrder: 0 });
            }
        }
    }

    // Ajouter les PNJ visibles sur la même tuile
    const visibleNpcs = npcs.filter(npc => npc.x === player.x && npc.y === player.y);
    visibleNpcs.forEach((npc, index) => {
        const sideOffset = (index % 2 === 0) ? -1 : 1; // Alterner gauche/droite
        const distanceOffset = (70 + (Math.floor(index / 2) * 40)) * scale; // Éloignement progressif
        const offsetX = sideOffset * distanceOffset;
        const x = playerBaseX + offsetX;
        const xNorm = clamp01(x / canvasWidth);
        const y = characterAnchorForGround(sceneGroundY(currentTile, canvasWidth, canvasHeight, xNorm, 'player'), scale);
        charactersOnTile.push({ char: npc, x, y, isPlayer: false, sortOrder: 0 }); // PNJ derrière le joueur
    });

    // Chaque survivant devient une cible : parler à un PNJ, consulter sa fiche.
    charactersOnTile.forEach(entry => {
        const body = 58 * scale;
        if (entry.isPlayer) {
            registerHotspot({
                id: 'player:self',
                type: 'player',
                x: entry.x,
                y: entry.y - body * 0.25,
                w: body,
                h: body * 1.7,
                label: 'Vous',
                hint: 'Ouvrir votre fiche',
                actionIds: [],
                keywords: [],
                priority: 3,
                onActivate: 'self',
            });
            return;
        }
        const isNpc = !!entry.char?.isNpc || Array.isArray(entry.char?.dialogue) || !!entry.char?.availableQuest;
        registerHotspot({
            id: `${isNpc ? 'npc' : 'survivor'}:${entry.char?.id || entry.char?.name || entry.x}`,
            type: isNpc ? 'npc' : 'survivor',
            x: entry.x,
            y: entry.y - body * 0.25,
            w: body,
            h: body * 1.7,
            label: entry.char?.name || (isNpc ? 'Survivant' : 'Joueur'),
            hint: isNpc ? 'Parler' : 'Voir les actions',
            actionIds: isNpc ? [ACTIONS.TALK_TO_NPC] : ['pvp_attack'],
            marker: isNpc ? 'talk' : null,
            priority: 3,
        });
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
            drawCharacter(charactersCtx, p.char, p.x + modX, p.y + modY, p.isPlayer, progress, scale, {
                faceHint: p.isPlayer ? 0 : playerBaseX - p.x,
            });
        });
        charactersCtx.globalAlpha = 1; // Réinitialiser l'alpha
    } else {
        // Dessiner les personnages normalement si pas d'animation
        charactersOnTile.forEach(p => {
            const animProgress = p.isPlayer ? player.animationProgress || 0 : 0;
            drawCharacter(charactersCtx, p.char, p.x, p.y, p.isPlayer, animProgress, scale, {
                // Les autres survivants et les PNJ font face au joueur :
                // la scène semble répondre à sa présence.
                faceHint: p.isPlayer ? 0 : playerBaseX - p.x,
            });
        });
    }

    // --- Ennemis présents sur la case ---
    const visibleEnemies = enemies.filter(e => e.x === player.x && e.y === player.y && !player.combatState);
    const enemySlots = [
        { x: 0.66, size: 70, z: 0 },
        { x: 0.80, size: 54, z: 1 },
        { x: 0.53, size: 54, z: 2 },
    ];
    visibleEnemies.slice(0, 3).forEach((enemy, i) => {
        const slot = enemySlots[i] || enemySlots[0];
        const xNorm = slot.x;
        const enemyX = canvasWidth * xNorm;
        const enemyBaseY = sceneGroundY(currentTile, canvasWidth, canvasHeight, xNorm, 'enemy') + slot.z * 8 * scale;
        const size = slot.size * scale * scenePerspectiveScale(currentTile, xNorm);
        const drawH = size * 1.35;
        const centerY = enemyBaseY - drawH / 2;

        // Attaquer en visant directement la créature.
        registerHotspot({
            id: `enemy:${enemy.id || enemy.name}:${i}`,
            type: 'enemy',
            x: enemyX,
            y: centerY,
            w: size * 1.2,
            h: drawH,
            label: enemy.name || 'Créature hostile',
            hint: 'Attaquer',
            actionIds: [ACTIONS.INITIATE_COMBAT],
            keywords: ['attaquer'],
            marker: 'danger',
            priority: 5,
        });

        charactersCtx.save();

        // Ombre exactement au contact du sol.
        drawGroundShadow(charactersCtx, enemyX, enemyBaseY, size * 0.42, size * 0.08, 0.32);

        // Aura menaçante posée derrière la créature, pas autour d'un point flottant.
        const auraY = enemyBaseY - drawH * 0.43;
        const aura = charactersCtx.createRadialGradient(enemyX, auraY, 0, enemyX, auraY, size * 0.92);
        aura.addColorStop(0, 'rgba(220, 40, 40, 0.24)');
        aura.addColorStop(1, 'rgba(220, 40, 40, 0)');
        charactersCtx.fillStyle = aura;
        charactersCtx.beginPath();
        charactersCtx.arc(enemyX, auraY, size * 0.92, 0, Math.PI * 2);
        charactersCtx.fill();

        // Créature : l'animation reste, mais la base du sprite colle au sol.
        const drewAnimated = drawAnimatedCreature(charactersCtx, enemy.name, enemyX, centerY, size, 0);
        if (!drewAnimated) {
            const spriteKey = ENEMY_SPRITES[enemy.name];
            const sprite = spriteKey ? loadedAssets[spriteKey] : null;
            if (sprite && sprite.complete && sprite.naturalWidth) {
                drawAnchoredImage(charactersCtx, sprite, enemyX, enemyBaseY, drawH, { trim: 'auto', shadow: false });
            } else {
                charactersCtx.font = `${Math.round(size)}px sans-serif`;
                charactersCtx.textAlign = 'center';
                charactersCtx.textBaseline = 'bottom';
                charactersCtx.fillText(enemy.icon || '❓', enemyX, enemyBaseY + 2);
            }
        }

        // Nom + barre de vie au-dessus de la silhouette ancrée.
        const label = enemy.name || 'Créature hostile';
        const barW = Math.max(60, size * 1.15);
        const barY = enemyBaseY - drawH - 18 * scale;
        const hp = enemy.currentHealth ?? enemy.health ?? enemy.maxHealth ?? 1;
        const maxHp = enemy.health ?? enemy.maxHealth ?? hp;
        const ratio = maxHp ? Math.max(0, Math.min(1, hp / maxHp)) : 1;

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

    // 🪤 Piège armé sur la case actuelle, posé sur le même sol que les autres objets.
    if (map?.[player.y]?.[player.x]?.trap) {
        const trapXNorm = 0.12;
        const trapX = canvasWidth * trapXNorm;
        const trapY = sceneGroundY(currentTile, canvasWidth, canvasHeight, trapXNorm, 'loot');
        charactersCtx.save();
        drawGroundShadow(charactersCtx, trapX + 12 * scale, trapY, 20 * scale, 3 * scale, 0.24);
        charactersCtx.font = `${Math.round(32 * scale)}px sans-serif`;
        charactersCtx.textAlign = 'left';
        charactersCtx.textBaseline = 'bottom';
        charactersCtx.fillText('🪤', trapX, trapY + 2);
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

    // Le sol lui-même devient interactif : toucher la zone devant le survivant
    // lance la fouille / la récolte proposée ici. C'est la porte d'entrée la
    // plus naturelle sur mobile, où il n'y a pas de survol.
    const groundActions = player.availableActions || [];
    const groundAction = groundActions.find(action => /fouill|cherch|recherch|search|récolt|harvest/i.test(`${action.id} ${action.name}`));
    if (groundAction) {
        const groundLine = sceneGroundY(currentTile, canvasWidth, canvasHeight, 0.5, 'loot');
        registerHotspot({
            id: 'ground:here',
            type: 'ground',
            x: canvasWidth / 2,
            y: Math.min(canvasHeight - 10, groundLine + canvasHeight * 0.05),
            w: canvasWidth * 0.52,
            h: canvasHeight * 0.16,
            label: groundAction.name,
            hint: 'Agir sur cette zone',
            actionIds: [groundAction.id],
            priority: -1,
        });
    }

    // Les zones interactives de l'image sont figées puis décorées.
    commitHotspotFrame();
    drawHotspotMarkers(charactersCtx, scale);
}

const minimapTrail = [];
let lastTrailKey = '';

function hasRevealed(collection, key) {
    if (!collection) return false;
    if (collection instanceof Set) return collection.has(key);
    if (Array.isArray(collection)) return collection.includes(key);
    return Boolean(collection[key]);
}

function rememberMinimapStep(player) {
    const key = `${player.x},${player.y}`;
    if (key === lastTrailKey) return;
    lastTrailKey = key;
    minimapTrail.push({ x: player.x, y: player.y, t: Date.now() });
    while (minimapTrail.length > 22) minimapTrail.shift();
}

export function drawMinimap(gameState, config) {
    if (!gameState || !gameState.map || !gameState.player || !config) return;
    const { map, player, npcs = [], enemies = [], globallyRevealedTiles } = gameState;
    const { MAP_WIDTH, MAP_HEIGHT, MINIMAP_DOT_SIZE } = config;
    const { minimapCanvas, minimapCtx } = DOM;
    if (!minimapCtx || !minimapCanvas) return;

    rememberMinimapStep(player);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // La mini-carte est légèrement plus lisible que la grille de config brute.
    const cell = Math.max(7, MINIMAP_DOT_SIZE || 8);
    const W = MAP_WIDTH * cell;
    const H = MAP_HEIGHT * cell;
    if (minimapCanvas.width !== Math.round(W * dpr) || minimapCanvas.height !== Math.round(H * dpr)) {
        minimapCanvas.width = Math.round(W * dpr);
        minimapCanvas.height = Math.round(H * dpr);
        minimapCanvas.style.width = '100%';
        minimapCanvas.style.height = 'auto';
    }
    const ctx = minimapCtx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;

    // Fond océan / parchemin de navigation.
    const ocean = ctx.createLinearGradient(0, 0, W, H);
    ocean.addColorStop(0, '#0d4252');
    ocean.addColorStop(0.48, '#0a2a38');
    ocean.addColorStop(1, '#04121a');
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, W, H);

    // Grille nautique discrète, plus forte toutes les 5 cases.
    ctx.save();
    ctx.strokeStyle = 'rgba(190, 232, 220, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= MAP_WIDTH; x++) {
        ctx.globalAlpha = x % 5 === 0 ? 0.9 : 0.45;
        ctx.beginPath();
        ctx.moveTo(x * cell + 0.5, 0);
        ctx.lineTo(x * cell + 0.5, H);
        ctx.stroke();
    }
    for (let y = 0; y <= MAP_HEIGHT; y++) {
        ctx.globalAlpha = y % 5 === 0 ? 0.9 : 0.45;
        ctx.beginPath();
        ctx.moveTo(0, y * cell + 0.5);
        ctx.lineTo(W, y * cell + 0.5);
        ctx.stroke();
    }
    ctx.restore();

    let explored = 0;
    const pad = Math.max(0.7, cell * 0.08);
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const tile = map[y]?.[x];
            if (!tile || !tile.type) continue;
            const tileKey = `${x},${y}`;
            const isWater = tile.type.name === 'Lagon';
            const isVisited = hasRevealed(player.visitedTiles, tileKey);
            const isGlobal = hasRevealed(globallyRevealedTiles, tileKey);
            const isVisible = isVisited || isGlobal || isWater;
            const px = x * cell;
            const py = y * cell;

            if (!isVisible) {
                // Brouillard avec contour si la case touche une zone explorée.
                ctx.fillStyle = 'rgba(5, 10, 15, 0.90)';
                ctx.fillRect(px, py, cell, cell);
                const nearKnown = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) =>
                    hasRevealed(player.visitedTiles, `${x + dx},${y + dy}`) ||
                    hasRevealed(globallyRevealedTiles, `${x + dx},${y + dy}`));
                if (nearKnown) {
                    ctx.fillStyle = 'rgba(255, 212, 121, 0.09)';
                    ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
                }
                continue;
            }
            if (!isWater) explored++;

            const base = tile.type.color || '#888';
            if (isWater) {
                const shimmer = 0.5 + 0.5 * Math.sin(Date.now() / 800 + (x * 0.8 + y * 0.55));
                ctx.fillStyle = shadeColor(base, -32 + shimmer * 14);
                ctx.fillRect(px, py, cell, cell);
                ctx.fillStyle = `rgba(180, 239, 236, ${0.05 + shimmer * 0.08})`;
                ctx.fillRect(px + cell * 0.18, py + cell * 0.35, cell * 0.64, Math.max(1, cell * 0.12));
            } else {
                const lit = isVisited ? 0 : -10;
                ctx.fillStyle = shadeColor(base, lit);
                roundedRectPath(ctx, px + pad, py + pad, cell - pad * 2, cell - pad * 2, Math.max(1.5, cell * 0.23));
                ctx.fill();
                ctx.fillStyle = isVisited ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)';
                roundedRectPath(ctx, px + pad, py + pad, cell - pad * 2, (cell - pad * 2) * 0.42, Math.max(1.5, cell * 0.23));
                ctx.fill();
            }

            // Constructions : marqueur doré avec petite base sombre.
            if (tile.buildings && tile.buildings.length > 0) {
                ctx.fillStyle = 'rgba(0,0,0,0.36)';
                ctx.fillRect(px + cell * 0.31, py + cell * 0.31, cell * 0.38, cell * 0.38);
                ctx.fillStyle = '#ffd479';
                ctx.fillRect(px + cell * 0.36, py + cell * 0.27, cell * 0.28, cell * 0.46);
                ctx.fillStyle = '#8b5b2e';
                ctx.fillRect(px + cell * 0.42, py + cell * 0.50, cell * 0.16, cell * 0.23);
            }

            // Ressources restantes : petite jauge en bas de case.
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
                ctx.fillStyle = 'rgba(8, 18, 22, 0.62)';
                ctx.fillRect(px + 1, py + cell - 3.5, cell - 2, 2.2);
                ctx.fillStyle = 'rgba(255, 241, 188, 0.82)';
                ctx.fillRect(px + 1.5, py + cell - 3, (cell - 3) * ratio, 1.4);
            }
        }
    }

    // Trajet récent du joueur : aide à comprendre d'où l'on vient.
    if (minimapTrail.length > 1) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        minimapTrail.forEach((step, index) => {
            if (index === 0) return;
            const prev = minimapTrail[index - 1];
            const alpha = 0.18 + (index / minimapTrail.length) * 0.42;
            ctx.strokeStyle = `rgba(255, 229, 143, ${alpha})`;
            ctx.lineWidth = Math.max(1.2, cell * 0.16);
            ctx.beginPath();
            ctx.moveTo((prev.x + 0.5) * cell, (prev.y + 0.5) * cell);
            ctx.lineTo((step.x + 0.5) * cell, (step.y + 0.5) * cell);
            ctx.stroke();
        });
        ctx.restore();
    }

    const isKnown = (x, y) => hasRevealed(player.visitedTiles, `${x},${y}`) || hasRevealed(globallyRevealedTiles, `${x},${y}`);

    // Halo de découverte autour du joueur.
    const cx = (player.x + 0.5) * cell;
    const cy = (player.y + 0.5) * cell;
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell * 4.2);
    halo.addColorStop(0, 'rgba(255, 212, 121, 0.22)');
    halo.addColorStop(1, 'rgba(255, 212, 121, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);

    // Camp / abri : icône maison prioritaire.
    if (gameState.shelterLocation) {
        const sx = (gameState.shelterLocation.x + 0.5) * cell;
        const sy = (gameState.shelterLocation.y + 0.5) * cell;
        ctx.fillStyle = '#fff1bd';
        ctx.beginPath();
        ctx.moveTo(sx, sy - cell * 0.38);
        ctx.lineTo(sx + cell * 0.42, sy - cell * 0.02);
        ctx.lineTo(sx + cell * 0.32, sy - cell * 0.02);
        ctx.lineTo(sx + cell * 0.32, sy + cell * 0.34);
        ctx.lineTo(sx - cell * 0.32, sy + cell * 0.34);
        ctx.lineTo(sx - cell * 0.32, sy - cell * 0.02);
        ctx.lineTo(sx - cell * 0.42, sy - cell * 0.02);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#5a351c'; ctx.lineWidth = 1.2; ctx.stroke();
    }

    // PNJ.
    npcs.forEach(npc => {
        if (!isKnown(npc.x, npc.y)) return;
        const nx = (npc.x + 0.5) * cell;
        const ny = (npc.y + 0.5) * cell;
        ctx.fillStyle = npc.color || '#60a5fa';
        ctx.beginPath();
        ctx.arc(nx, ny, cell * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#eff6ff'; ctx.lineWidth = 1; ctx.stroke();
    });

    // Ennemis : triangles rouges + halo d'alerte.
    enemies.forEach(enemy => {
        if (!isKnown(enemy.x, enemy.y)) return;
        const ex = (enemy.x + 0.5) * cell;
        const ey = (enemy.y + 0.5) * cell;
        ctx.fillStyle = 'rgba(248, 73, 88, 0.16)';
        ctx.beginPath();
        ctx.arc(ex, ey, cell * 0.58, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = enemy.color || '#ef4444';
        ctx.beginPath();
        ctx.moveTo(ex, ey - cell * 0.38);
        ctx.lineTo(ex + cell * 0.35, ey + cell * 0.28);
        ctx.lineTo(ex - cell * 0.35, ey + cell * 0.28);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1; ctx.stroke();
    });

    // Autres joueurs.
    for (const pid in gameState.players || {}) {
        if (pid === player.id) continue;
        const op = gameState.players[pid];
        if (!op || !isKnown(op.x, op.y)) continue;
        ctx.fillStyle = '#67e8f9';
        ctx.beginPath();
        ctx.arc((op.x + 0.5) * cell, (op.y + 0.5) * cell, cell * 0.29, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#052735'; ctx.lineWidth = 1.2; ctx.stroke();
    }

    // Joueur : repère doré animé + flèche.
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 380);
    ctx.strokeStyle = `rgba(255, 226, 138, ${0.38 + 0.48 * pulse})`;
    ctx.lineWidth = Math.max(1.6, cell * 0.16);
    ctx.beginPath();
    ctx.arc(cx, cy, cell * (0.52 + 0.25 * pulse), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffe28a';
    ctx.beginPath();
    ctx.moveTo(cx, cy - cell * 0.42);
    ctx.lineTo(cx + cell * 0.36, cy + cell * 0.34);
    ctx.lineTo(cx, cy + cell * 0.18);
    ctx.lineTo(cx - cell * 0.36, cy + cell * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2d1b12'; ctx.lineWidth = 1.2; ctx.stroke();

    // Bordure interne et vignette pour détacher la carte de l'interface.
    ctx.strokeStyle = 'rgba(255, 241, 188, 0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    const coordsChip = document.getElementById('minimap-coords-chip');
    if (coordsChip) {
        const totalLand = Math.max(1, MAP_WIDTH * MAP_HEIGHT);
        coordsChip.textContent = `(${player.x}, ${player.y}) · ${Math.round((explored / totalLand) * 100)}%`;
        coordsChip.title = `${explored} cases repérées hors lagon`;
    }
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
