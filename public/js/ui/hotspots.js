// js/ui/hotspots.js — Interactions directement sur l'écran de jeu.
//
// La scène n'est plus une illustration passive : chaque élément dessiné
// (objet au sol, construction, survivant, créature) enregistre une zone
// cliquable. Au survol, un réticule pixel art et une étiquette apparaissent ;
// au clic (ou au tap), l'action correspondante est déclenchée.
//
// Principe de sûreté : on ne réinvente aucune règle de jeu. Une zone pointe
// vers une action déjà proposée par le serveur (`player.availableActions`) et,
// quand le bouton existe dans le panneau Actions, on clique CE bouton pour
// réutiliser sa logique (modales de coffre, d'atelier, de cadenas...).

import { drawSheetFrame, animatedFrame } from './sheets.js';
import { ACTIONS, TILE_TYPES } from '../config.js';
import { sendAction } from '../main.js';
import { openActionList as PanelsOpenActionList } from './panels.js';

let frameSpots = [];
let activeSpots = [];
let hovered = null;
let pointer = null;          // Dernière position connue en coordonnées canvas
let pointerIsTouch = false;
let initialized = false;
let tooltipEl = null;
let lastActivation = 0;

/* ---------------------------------------------------------------------
 * Enregistrement (appelé par draw.js pendant le rendu)
 * ------------------------------------------------------------------- */

export function beginHotspotFrame() {
    frameSpots = [];
}

/**
 * @param {object} spot
 *  x, y     centre de la zone (coordonnées canvas)
 *  w, h     taille de la zone
 *  type     'loot' | 'building' | 'npc' | 'enemy' | 'player' | 'ground'
 *  label    texte affiché au survol
 *  hint     sous-titre (« Clic pour ramasser »)
 *  marker   ligne de la planche d'interactions à afficher au-dessus
 *  priority plus élevé = testé en premier
 */
export function registerHotspot(spot) {
    if (!spot || !Number.isFinite(spot.x) || !Number.isFinite(spot.y)) return;
    frameSpots.push({
        priority: 0,
        w: 48,
        h: 48,
        seed: frameSpots.length * 1.7,
        ...spot,
    });
}

export function commitHotspotFrame() {
    activeSpots = frameSpots;
    frameSpots = [];
    if (pointer) {
        hovered = hitTest(pointer.x, pointer.y);
    } else if (hovered) {
        hovered = activeSpots.find(spot => spot.id === hovered.id) || null;
    }
    syncTooltip();
}

export function getHotspots() { return activeSpots; }

function hitTest(x, y) {
    let best = null;
    let bestScore = -Infinity;
    for (const spot of activeSpots) {
        const halfW = spot.w / 2;
        const halfH = spot.h / 2;
        if (x < spot.x - halfW || x > spot.x + halfW) continue;
        if (y < spot.y - halfH || y > spot.y + halfH) continue;
        // À priorité égale, la plus petite zone gagne : un objet posé devant
        // une grande construction reste atteignable.
        const score = spot.priority * 1e6 - spot.w * spot.h;
        if (score > bestScore) { bestScore = score; best = spot; }
    }
    return best;
}

/* ---------------------------------------------------------------------
 * Rendu des marqueurs
 * ------------------------------------------------------------------- */

export function drawHotspotMarkers(ctx, scale = 1) {
    if (!ctx || !activeSpots.length) return;
    const now = Date.now();

    for (const spot of activeSpots) {
        if (!spot.marker) continue;
        // Discret par défaut, net au survol : la scène reste lisible même
        // quand une douzaine d'éléments sont interactifs.
        const isHovered = hovered && hovered.id === spot.id;
        const size = Math.max(16, (isHovered ? 26 : 21) * scale);
        const bob = Math.sin(now / 430 + spot.seed) * 2.5 * scale;
        const y = (spot.markerY ?? (spot.y - spot.h / 2 - size * 0.55)) + bob;
        const alpha = isHovered ? 1 : (spot.markerAlpha ?? 0.58);
        drawSheetFrame(ctx, 'interactions', spot.marker, animatedFrame('interactions', 6, spot.seed), spot.x, y, size, alpha);
    }

    if (hovered) {
        const size = Math.max(34, Math.max(hovered.w, hovered.h) * 1.08);
        drawSheetFrame(ctx, 'interactions', 'focus', animatedFrame('interactions', 7), hovered.x, hovered.y, size, 1);
    }
}

/* ---------------------------------------------------------------------
 * Étiquette HTML
 * ------------------------------------------------------------------- */

function ensureTooltip() {
    if (tooltipEl && tooltipEl.isConnected) return tooltipEl;
    const container = document.getElementById('main-view-container');
    if (!container) return null;
    tooltipEl = document.getElementById('hotspot-tooltip');
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'hotspot-tooltip';
        tooltipEl.setAttribute('role', 'status');
        tooltipEl.innerHTML = '<strong></strong><small></small>';
        container.appendChild(tooltipEl);
    }
    return tooltipEl;
}

function syncTooltip() {
    const tip = ensureTooltip();
    if (!tip) return;
    const container = document.getElementById('main-view-container');
    const canvas = document.getElementById('characters-canvas');
    if (!hovered || !container || !canvas || !canvas.width) {
        tip.classList.remove('is-visible');
        container?.classList.remove('has-hotspot');
        return;
    }

    const rect = container.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const ratioX = canvasRect.width / canvas.width;
    const ratioY = canvasRect.height / canvas.height;
    const left = (canvasRect.left - rect.left) + hovered.x * ratioX;
    const top = (canvasRect.top - rect.top) + (hovered.y - hovered.h / 2) * ratioY;

    tip.querySelector('strong').textContent = hovered.label || '';
    tip.querySelector('small').textContent = hovered.hint || (pointerIsTouch ? 'Touchez pour agir' : 'Clic pour agir');
    tip.dataset.type = hovered.type || 'ground';
    tip.style.left = `${Math.round(Math.max(8, Math.min(rect.width - 8, left)))}px`;
    tip.style.top = `${Math.round(Math.max(6, top - 10))}px`;
    tip.classList.add('is-visible');
    container.classList.add('has-hotspot');
}

/* ---------------------------------------------------------------------
 * Résolution des actions
 * ------------------------------------------------------------------- */

/** Identifiants d'action déclarés par une construction dans la config. */
function buildingActionIds(key) {
    const def = TILE_TYPES[key];
    if (!def) return [];
    const list = Array.isArray(def.actions) ? def.actions
        : (def.actions && def.actions.id ? [def.actions]
            : (def.action && def.action.id ? [def.action] : []));
    return list.map(action => action.id).filter(Boolean);
}

function availableActions() {
    return window.gameState?.player?.availableActions || [];
}

function findAction({ ids = [], keywords = [] }) {
    const actions = availableActions();
    for (const id of ids) {
        const match = actions.find(action => action.id === id);
        if (match) return match;
    }
    if (!keywords.length) return null;
    return actions.find(action => {
        const haystack = `${action.id} ${action.name}`.toLowerCase();
        return keywords.some(keyword => haystack.includes(keyword));
    }) || null;
}

/** Ouvre la liste complète des actions (repli lisible). */
function openActionList() {
    PanelsOpenActionList();
}

function runAction(action) {
    if (!action) return false;
    // Le bouton du panneau porte toute la logique spéciale (coffre verrouillé,
    // atelier, cadenas...). On le réutilise dès qu'il existe.
    const button = document.getElementById(`action-btn-${action.id}`);
    if (button && !button.disabled) {
        button.click();
        return true;
    }
    sendAction(action.id, {});
    return true;
}

function flashFeedback(spot) {
    const container = document.getElementById('main-view-container');
    if (!container) return;
    const ping = document.createElement('span');
    ping.className = 'hotspot-ping';
    const canvas = document.getElementById('characters-canvas');
    if (canvas && canvas.width) {
        const rect = container.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        ping.style.left = `${(canvasRect.left - rect.left) + spot.x * (canvasRect.width / canvas.width)}px`;
        ping.style.top = `${(canvasRect.top - rect.top) + spot.y * (canvasRect.height / canvas.height)}px`;
    }
    container.appendChild(ping);
    setTimeout(() => ping.remove(), 520);
}

export function activateHotspot(spot) {
    if (!spot) return;
    const now = Date.now();
    if (now - lastActivation < 180) return; // Anti double déclenchement tactile
    lastActivation = now;

    const player = window.gameState?.player;
    if (player && (player.isBusy || player.animationState)) return;

    flashFeedback(spot);
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch (_) {} }

    // Objet au sol : ramassage direct, il n'existe pas d'action serveur dédiée.
    if (spot.type === 'loot' && spot.itemName) {
        // itemKey désigne l'entrée au sol : le nom pour une pile, la clé
        // d'origine pour un outil posé (la durabilité est conservée).
        sendAction(ACTIONS.PICKUP_ITEM_CONTEXT, { itemKey: spot.itemKey || spot.itemName, itemName: spot.itemName });
        return;
    }

    // Son propre personnage : raccourci vers la fiche du survivant.
    if (spot.type === 'player') {
        if (window.UI?.isMobileLayout?.()) window.UI.openMobileTab?.('status');
        else document.getElementById('open-equipment-modal-btn')?.click();
        return;
    }

    if (spot.type === 'building') {
        const ids = [...(spot.actionIds || []), ...buildingActionIds(spot.buildingKey)];
        const matches = availableActions().filter(action => ids.includes(action.id));
        if (matches.length === 1) { runAction(matches[0]); return; }
        if (matches.length > 1) { openActionList(); return; }
    }

    const action = findAction({ ids: spot.actionIds || [], keywords: spot.keywords || [] });
    if (action) { runAction(action); return; }

    openActionList();
}

/* ---------------------------------------------------------------------
 * Entrées pointeur / tactile
 * ------------------------------------------------------------------- */

function toCanvasCoords(clientX, clientY) {
    const canvas = document.getElementById('characters-canvas');
    if (!canvas || !canvas.width) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height),
    };
}

/** Les commandes du HUD gardent la priorité absolue sur la scène. */
function isSceneTarget(target) {
    if (!target) return false;
    if (target.closest('button, a, input, select, textarea, #mobile-tabbar, .mobile-tab')) return false;
    return !!target.closest('#main-view-container');
}

export function initHotspots() {
    if (initialized) return;
    const container = document.getElementById('main-view-container');
    if (!container) return;
    initialized = true;
    ensureTooltip();

    container.addEventListener('pointermove', (event) => {
        if (event.pointerType === 'touch') return;
        if (!isSceneTarget(event.target)) { pointer = null; hovered = null; syncTooltip(); return; }
        const coords = toCanvasCoords(event.clientX, event.clientY);
        if (!coords) return;
        pointerIsTouch = false;
        pointer = coords;
        hovered = hitTest(coords.x, coords.y);
        syncTooltip();
    });

    container.addEventListener('pointerleave', () => {
        pointer = null;
        hovered = null;
        syncTooltip();
    });

    container.addEventListener('click', (event) => {
        if (!isSceneTarget(event.target)) return;
        const coords = toCanvasCoords(event.clientX, event.clientY);
        if (!coords) return;
        const spot = hitTest(coords.x, coords.y);
        if (!spot) return;
        event.stopPropagation();
        activateHotspot(spot);
    });

    // Tactile : un tap bref agit, un vrai balayage reste un déplacement.
    let touchStart = null;
    container.addEventListener('touchstart', (event) => {
        if (event.touches.length !== 1 || !isSceneTarget(event.target)) { touchStart = null; return; }
        touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY, t: Date.now() };
    }, { passive: true });

    container.addEventListener('touchend', (event) => {
        if (!touchStart) return;
        const touch = event.changedTouches[0];
        const moved = Math.hypot(touch.clientX - touchStart.x, touch.clientY - touchStart.y);
        const elapsed = Date.now() - touchStart.t;
        touchStart = null;
        if (moved > 16 || elapsed > 520) return; // c'était un swipe ou un appui long
        const coords = toCanvasCoords(touch.clientX, touch.clientY);
        if (!coords) return;
        const spot = hitTest(coords.x, coords.y);
        if (!spot) return;
        pointerIsTouch = true;
        pointer = coords;
        hovered = spot;
        syncTooltip();
        activateHotspot(spot);
        // L'étiquette tactile disparaît d'elle-même.
        setTimeout(() => { if (hovered === spot) { hovered = null; pointer = null; syncTooltip(); } }, 1400);
    }, { passive: true });

    console.log('Scene hotspots initialized.');
}

export default {
    initHotspots, beginHotspotFrame, registerHotspot, commitHotspotFrame,
    drawHotspotMarkers, activateHotspot, getHotspots,
};
