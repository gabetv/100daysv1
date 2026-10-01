// js/ui/sheets.js — Lecture des planches pixel art d'interface.
//
// Les planches sont produites par `npm run generate:sheets`
// (scripts/generate_ui_sheets.js). Ce module en expose deux usages :
//   • `applySpriteFrame()` pour animer une frame dans un élément HTML ;
//   • `drawSheetFrame()`   pour dessiner une frame sur un canvas.

export const UI_SHEETS = {
    timer: {
        src: '/assets/ui/sheet-timer.png',
        frameW: 32, frameH: 32, columns: 8,
        rows: { hourglass: 0, phase: 1, dial: 2, urgent: 3 },
    },
    interactions: {
        src: '/assets/ui/sheet-interactions.png',
        frameW: 32, frameH: 32, columns: 6,
        rows: { focus: 0, alert: 1, loot: 2, danger: 3, talk: 4, build: 5 },
    },
    hudIcons: {
        src: '/assets/ui/sheet-hud-icons.png',
        frameW: 24, frameH: 24, columns: 8,
        rows: { a: 0, b: 1 },
        icons: [
            'sun', 'moon', 'hourglass', 'clock',
            'heart', 'drop', 'meat', 'sleep',
            'compass', 'map', 'bag', 'sword',
            'hammer', 'chat', 'star', 'layout',
        ],
    },
};

const images = {};
let loading = null;

/** Précharge les planches. Le jeu continue même si une planche manque. */
export function loadUISheets() {
    if (loading) return loading;
    loading = Promise.all(Object.entries(UI_SHEETS).map(([key, sheet]) => new Promise((resolve) => {
        const img = new Image();
        img.src = sheet.src;
        img.onload = () => { images[key] = img; resolve(); };
        img.onerror = () => {
            console.warn(`Planche d'interface non chargée : ${sheet.src}`);
            resolve();
        };
    })));
    return loading;
}

export function getSheetImage(name) { return images[name] || null; }

function rowIndex(sheet, row) {
    if (typeof row === 'number') return row;
    return sheet.rows?.[row] ?? 0;
}

/**
 * Affiche une frame de planche dans un élément HTML (sprite CSS).
 * L'élément doit avoir une taille fixe ; la planche est mise à l'échelle.
 */
export function applySpriteFrame(element, sheetName, row, col, renderedSize) {
    const sheet = UI_SHEETS[sheetName];
    if (!element || !sheet) return;
    const size = Number(renderedSize) || element.clientWidth || sheet.frameW;
    const scale = size / sheet.frameW;
    const rows = Object.keys(sheet.rows || { a: 0 }).length;
    const r = rowIndex(sheet, row);
    const c = ((Math.round(col) % sheet.columns) + sheet.columns) % sheet.columns;

    element.style.backgroundImage = `url('${sheet.src}')`;
    element.style.backgroundSize = `${sheet.columns * sheet.frameW * scale}px ${rows * sheet.frameH * scale}px`;
    element.style.backgroundPosition = `${-c * sheet.frameW * scale}px ${-r * sheet.frameH * scale}px`;
    element.style.backgroundRepeat = 'no-repeat';
    element.style.imageRendering = 'pixelated';
}

/** Icône du HUD par son nom (sheet-hud-icons.png). */
export function applyHudIcon(element, iconName, renderedSize) {
    const sheet = UI_SHEETS.hudIcons;
    const index = sheet.icons.indexOf(iconName);
    if (index < 0) return;
    applySpriteFrame(element, 'hudIcons', Math.floor(index / sheet.columns), index % sheet.columns, renderedSize);
}

/**
 * Applique les icônes de planche à tous les `[data-hud-icon]` du document.
 * Appelé au démarrage puis après toute injection de markup.
 */
export function hydrateHudIcons(root = document) {
    root.querySelectorAll('[data-hud-icon]').forEach((element) => {
        // La largeur calculée reste correcte même pour un élément masqué
        // (bouton `hidden`), contrairement à `clientWidth` qui vaut alors 0.
        const declared = parseFloat(getComputedStyle(element).width);
        const size = Number.isFinite(declared) && declared > 0
            ? declared
            : (element.clientWidth || 18);
        applyHudIcon(element, element.dataset.hudIcon, size);
    });
}

/** Dessine une frame de planche sur un canvas, centrée sur (x, y). */
export function drawSheetFrame(ctx, sheetName, row, col, x, y, size, alpha = 1) {
    const sheet = UI_SHEETS[sheetName];
    const img = images[sheetName];
    if (!ctx || !sheet || !img || !img.complete || !img.naturalWidth) return false;
    const r = rowIndex(sheet, row);
    const c = ((Math.round(col) % sheet.columns) + sheet.columns) % sheet.columns;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
        img,
        c * sheet.frameW, r * sheet.frameH, sheet.frameW, sheet.frameH,
        Math.round(x - size / 2), Math.round(y - size / 2), Math.round(size), Math.round(size),
    );
    ctx.restore();
    return true;
}

/** Index de frame courant pour une animation en boucle. */
export function animatedFrame(sheetName, fps = 8, offset = 0) {
    const sheet = UI_SHEETS[sheetName];
    const columns = sheet?.columns || 8;
    return Math.floor((Date.now() / (1000 / fps)) + offset) % columns;
}

export default { UI_SHEETS, loadUISheets, applySpriteFrame, applyHudIcon, hydrateHudIcons, drawSheetFrame, animatedFrame, getSheetImage };
