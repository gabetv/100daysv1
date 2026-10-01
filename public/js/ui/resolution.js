// js/ui/resolution.js — Résolution de la scène : verrou mobile, plein écran PC.
//
// Trois règles simples, une seule source de vérité :
//
//   • MOBILE — résolution logique VERROUILLÉE. Le petit côté de la scène fait
//     toujours 412 px logiques, quel que soit le téléphone. Le cadrage, la
//     densité des détails et la taille des sprites sont donc identiques sur
//     tous les appareils ; seule la finesse du rendu (échelle d'appareil,
//     jusqu'à 3×) change pour rester net sur les écrans denses.
//
//   • PC — la scène remplit TOUTE la place disponible (plus d'écran, aucun
//     bandeau noir, plus de format 1408×768 imposé). Le rendu suit la densité
//     de l'écran (jusqu'à 2×) avec un budget de pixels pour rester fluide sur
//     les très grandes dalles.
//
//   • QUALITÉ ADAPTATIVE — la boucle de rendu rapporte le coût réel de chaque
//     image. Si le device peine, l'échelle baisse d'un cran (jamais sous
//     0.55) ; s'il reste de la marge, elle remonte. Les changements sont
//     espacés d'au moins une fenêtre de mesure pour éviter les oscillations.
//
// Ce module ne dépend d'aucun autre : il est importé par la boucle de rendu
// et par le redimensionnement de la scène sans risque de cycle.

// La coquille mobile est déclarée une seule fois pour tout le jeu :
// layout-mode.js tient compte du réglage Auto / Mobile / PC du joueur.
import { isMobileActive } from './layout-mode.js';

/** Petit côté verrouillé de la scène mobile, en pixels logiques. */
export const MOBILE_LOCK_SHORT_SIDE = 412;
/** Échelle d'appareil maximale sur mobile (écrans 3× : iPhone Pro, Pixel…). */
const MOBILE_MAX_DEVICE_SCALE = 3;
/** Échelle d'appareil maximale sur PC (au-delà, le gain est invisible). */
const DESKTOP_MAX_DEVICE_SCALE = 2;
/** Budget de pixels de la scène sur PC (≈ 4096 × 3072). */
const DESKTOP_PIXEL_BUDGET = 12_600_000;

/* Fenêtre de mesure de la qualité adaptative (~2,5 s à 32 fps). */
const QUALITY_WINDOW = 80;
/** P90 au-delà duquel on perd des images : on baisse la qualité. */
const SLOW_P90_MS = 34;
/** Moyenne en dessous de laquelle on considère qu'il reste de la marge. */
const CALM_MEAN_MS = 13;
/** Nombre de fenêtres calmes consécutives avant de remonter d'un cran. */
const CALM_STREAK_TO_UPGRADE = 3;
const MIN_QUALITY = 0.55;
const QUALITY_STEP = 0.25;

export function isMobileShell() {
    return typeof window !== 'undefined' && isMobileActive();
}

/**
 * Calcule la résolution interne de la scène. Fonction pure : tout est passé
 * en paramètre, ce qui la rend testable sans navigateur.
 *
 * @param {object} input
 * @param {number} input.cssWidth   largeur CSS de la zone de scène
 * @param {number} input.cssHeight  hauteur CSS de la zone de scène
 * @param {number} input.dpr        densité de l'écran (window.devicePixelRatio)
 * @param {boolean} input.mobile    coquille mobile ou PC
 * @param {number} [input.quality]  facteur de qualité adaptatif (0.55 → 1)
 * @returns {{width:number, height:number, deviceScale:number, renderScale:number,
 *            locked:boolean, logicalWidth:number, logicalHeight:number}}
 */
export function computeSceneResolution({ cssWidth, cssHeight, dpr, mobile, quality = 1 }) {
    const safeW = Math.max(10, cssWidth || 10);
    const safeH = Math.max(10, cssHeight || 10);
    const devicePixelRatio = Math.max(1, dpr || 1);
    const aspect = safeW / safeH;

    let deviceScale;
    let logicalWidth;
    let logicalHeight;

    if (mobile) {
        // Résolution logique verrouillée : le petit côté vaut toujours
        // MOBILE_LOCK_SHORT_SIDE. Deux téléphones aux tailles différentes
        // affichent exactement le même cadrage.
        if (aspect >= 1) {
            logicalHeight = MOBILE_LOCK_SHORT_SIDE;
            logicalWidth = Math.round(MOBILE_LOCK_SHORT_SIDE * aspect);
        } else {
            logicalWidth = MOBILE_LOCK_SHORT_SIDE;
            logicalHeight = Math.round(MOBILE_LOCK_SHORT_SIDE / aspect);
        }
        deviceScale = Math.min(MOBILE_MAX_DEVICE_SCALE, Math.max(1, Math.round(devicePixelRatio)));
        if (devicePixelRatio < 2) {
            // Coquille mobile forcée sur PC : le verrou 412 px, agrandi sur une
            // grande dalle 1×, serait flou sans correction. On pousse l'échelle
            // de rendu pour couvrir la zone réellement affichée (plafond 3×).
            // Rien ne change sur téléphone : ceux en 1× conservent 1 (le
            // facteur d'ajustement reste < 1) et ceux en 2×/3× sont hors du
            // garde-fou `devicePixelRatio < 2`.
            const fitScale = Math.min(safeW / logicalWidth, safeH / logicalHeight);
            const upscaled = Math.floor(fitScale * 100) / 100;
            deviceScale = Math.min(MOBILE_MAX_DEVICE_SCALE, Math.max(deviceScale, upscaled));
        }
    } else {
        // PC : la scène occupe tout l'espace, la taille logique est celle de
        // la zone disponible — d'où l'effet « écran étiré » sur les dalles
        // larges ou hautes.
        logicalWidth = safeW;
        logicalHeight = safeH;
        deviceScale = Math.min(DESKTOP_MAX_DEVICE_SCALE, devicePixelRatio);
    }

    // La qualité adaptative réduit l'échelle de rendu, jamais sous 1 pixel.
    let renderScale = Math.max(1, deviceScale * Math.max(MIN_QUALITY, Math.min(1, quality)));

    let width = Math.round(logicalWidth * renderScale);
    let height = Math.round(logicalHeight * renderScale);

    // Budget de pixels (PC surtout) : les très grandes dalles à haute densité
    // n'ont pas besoin d'un canvas de 33 Mpx pour être nettes.
    const pixels = width * height;
    const budget = mobile ? DESKTOP_PIXEL_BUDGET : DESKTOP_PIXEL_BUDGET;
    if (pixels > budget) {
        const shrink = Math.sqrt(budget / pixels);
        width = Math.max(10, Math.round(width * shrink));
        height = Math.max(10, Math.round(height * shrink));
        renderScale = width / logicalWidth;
    }

    return {
        width, height,
        deviceScale,
        renderScale: Number(renderScale.toFixed(3)),
        locked: Boolean(mobile),
        logicalWidth, logicalHeight,
    };
}

/* ---------------------------------------------------------------------
 * Qualité adaptative
 * ------------------------------------------------------------------- */

let quality = 1;
let samples = [];
let calmStreak = 0;
let lastChangeAt = 0;
const listeners = new Set();

/* Dernière résolution appliquée à la scène : le dessin (draw.js) en déduit
 * l'échelle de rendu pour garder des tailles affichées stables, quelle que
 * soit la densité de l'appareil (les ancres ont été calibrées ≤ 2×). */
let lastResolution = { renderScale: 1, logicalWidth: 0, logicalHeight: 0 };

/** Mémorisé par resizeGameView après chaque application. */
export function setLastResolution(res) {
    if (res && typeof res.renderScale === 'number') {
        lastResolution = {
            renderScale: res.renderScale,
            logicalWidth: res.logicalWidth || 0,
            logicalHeight: res.logicalHeight || 0,
        };
    }
}

/** Échelle de rendu actuelle de la scène (pixels canvas par pixel logique). */
export function getSceneRenderScale() {
    return Math.max(1, lastResolution.renderScale || 1);
}

/** Dimensions logiques actuelles de la scène (indépendantes de la densité). */
export function getSceneLogicalSize() {
    return { width: lastResolution.logicalWidth, height: lastResolution.logicalHeight };
}

/**
 * Échelle des personnages et créatures de la scène.
 *
 * Formule historique : clamp(hauteur_canvas / 620, 0.75, 1.6), où la hauteur
 * du canvas était en pixels CSS sur PC (mapping 1×) et au plus 2× sur mobile.
 * On l'applique à la hauteur « équivalente » d'époque, puis on la re-projette
 * sur l'échelle de rendu réelle : la taille affichée reste celle calibrée
 * avant le plein écran PC et la résolution mobile verrouillée, quelle que
 * soit la densité (1×, 2×, 3×) ou la qualité adaptative.
 */
export function characterScaleFor(canvasHeight, renderScale, mobile) {
    const rs = Math.max(1, renderScale || 1);
    const logicalHeight = Math.max(1, canvasHeight) / rs;
    const legacyMapping = mobile ? Math.min(rs, 2) : 1;
    return Math.max(0.75, Math.min(1.6, (logicalHeight * legacyMapping) / 620))
        * (rs / legacyMapping);
}

function setQuality(next) {
    const clamped = Math.max(MIN_QUALITY, Math.min(1, Number(next.toFixed(3))));
    if (clamped === quality) return;
    quality = clamped;
    lastChangeAt = performance.now();
    listeners.forEach(fn => { try { fn(quality); } catch (_) { /* listener isolé */ } });
}

/**
 * La boucle de rendu rapporte ici le coût réel (ms) de chaque image dessinée.
 * Toutes les QUALITY_WINDOW images, on décide : baisser, monter, ou ne rien
 * faire. Un changement force un redimensionnement du canvas via les listeners.
 */
export function reportFrameCost(ms) {
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return;
    samples.push(ms);
    if (samples.length < QUALITY_WINDOW) return;

    const sorted = [...samples].sort((a, b) => a - b);
    samples = [];
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;

    if (p90 > SLOW_P90_MS && quality > MIN_QUALITY) {
        calmStreak = 0;
        setQuality(quality - QUALITY_STEP);
    } else if (mean < CALM_MEAN_MS && quality < 1) {
        calmStreak += 1;
        if (calmStreak >= CALM_STREAK_TO_UPGRADE) {
            calmStreak = 0;
            setQuality(quality + QUALITY_STEP);
        }
    } else {
        calmStreak = 0;
    }
}

/** Force un niveau de qualité (outils de debug / futurs réglages graphiques). */
export function setSceneQuality(next) { setQuality(next); }

export function getSceneQuality() { return quality; }

/** S'abonne aux changements de qualité (retour à un redimensionnement). */
export function onQualityChange(fn) {
    if (typeof fn === 'function') listeners.add(fn);
    return () => listeners.delete(fn);
}

/** État complet, pour la console ou un futur écran de réglages. */
export function getSceneResolutionInfo() {
    return {
        quality,
        mobile: isMobileShell(),
        lock: MOBILE_LOCK_SHORT_SIDE,
        lastChangeAt,
    };
}
