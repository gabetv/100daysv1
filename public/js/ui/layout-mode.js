// js/ui/layout-mode.js — Choix de l'affichage : Auto / Mobile / PC.
//
// Le jeu choisit tout seul sa coquille (bureau au-dessus de 900 px de large,
// mobile en dessous ou sur écran tactile ≤ 1100 px). Le joueur peut ici
// forcer la version mobile sur PC — ou la version PC sur une machine tactile —
// depuis le bouton 🖥/📱 du HUD (à côté du son). Le choix est mémorisé.
//
// Deux mécanismes complémentaires, une seule source de vérité :
//
//  • JavaScript — isMobileActive() remplace matchMedia(MOBILE_QUERY) partout
//    (coquille, feuilles mobiles, résolution de la scène) ;
//
//  • CSS — les blocs `@media (max-width: 900px), (pointer: coarse) and
//    (max-width: 1100px)` sont vivants : leur mediaText est réécrit. Forcer
//    « mobile » les passe à `all` (même rendu que sur téléphone, sans
//    dupliquer une seule règle), « pc » les passe à `not all`, et « auto »
//    restaure le texte d'origine mémorisé.
//
// Module importable hors navigateur (tests Node) : rien ne touche window ou
// document au niveau supérieur.

const STORAGE_KEY = 'layoutMode';
export const LAYOUT_MODES = ['auto', 'mobile', 'pc'];

// Même requête que celle utilisée par les feuilles de style du jeu.
const MOBILE_QUERY = '(max-width: 900px), (pointer: coarse) and (max-width: 1100px)';

// Un bloc @media appartient à la coquille mobile quand il combine les deux
// conditions de MOBILE_QUERY (l'ordre et les espaces varient selon l'auteur).
function isMobileMediaText(text) {
    return typeof text === 'string'
        && /max-width\s*:\s*900px/i.test(text)
        && /pointer\s*:\s*coarse/i.test(text)
        && /max-width\s*:\s*1100px/i.test(text);
}

// mediaText d'origine de chaque règle réécrite : indispensable pour repasser
// en « auto », le texte courant ne contient alors plus la condition d'origine.
const originalMediaText = new WeakMap();

function readStoredMode() {
    try {
        if (typeof localStorage !== 'undefined') {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (LAYOUT_MODES.includes(stored)) return stored;
        }
    } catch (_) { /* navigation privée : le réglage reste en mémoire */ }
    return 'auto';
}

let mode = readStoredMode();
const listeners = new Set();

export function getLayoutMode() { return mode; }

/**
 * LA question que tout le code pose à la place de matchMedia(MOBILE_QUERY) :
 * la coquille mobile est-elle active en ce moment ?
 */
export function isMobileActive() {
    if (mode === 'mobile') return true;
    if (mode === 'pc') return false;
    return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia(MOBILE_QUERY).matches;
}

/**
 * Réécrit les @media de la coquille mobile selon le mode choisi. Les feuilles
 * cross-origin (polices Google) sont ignorées gentiment ; les règles déjà
 * réécrites sont retrouvées via `originalMediaText` même quand leur mediaText
 * ne contient plus la condition d'origine.
 */
function applyModeToCss() {
    if (typeof document === 'undefined' || !document.styleSheets) return;
    for (const sheet of document.styleSheets) {
        let rules;
        try { rules = sheet.cssRules; } catch (_) { continue; }
        if (!rules) continue;
        for (const rule of rules) {
            if (typeof CSSMediaRule === 'undefined' || !(rule instanceof CSSMediaRule)) continue;
            if (!originalMediaText.has(rule) && !isMobileMediaText(rule.media.mediaText)) continue;
            if (!originalMediaText.has(rule)) originalMediaText.set(rule, rule.media.mediaText);
            rule.media.mediaText =
                mode === 'mobile' ? 'all' :
                mode === 'pc' ? 'not all' :
                originalMediaText.get(rule);
        }
    }
    document.documentElement.dataset.layout = mode;
}

export function setLayoutMode(next) {
    if (!LAYOUT_MODES.includes(next) || next === mode) return;
    mode = next;
    try { localStorage.setItem(STORAGE_KEY, mode); } catch (_) { /* mode privé */ }
    applyModeToCss();
    listeners.forEach(fn => { try { fn(mode); } catch (_) { /* listener isolé */ } });
}

/** Bascule circulaire auto → mobile → pc → auto. */
export function cycleLayoutMode() {
    setLayoutMode(LAYOUT_MODES[(LAYOUT_MODES.indexOf(mode) + 1) % LAYOUT_MODES.length]);
}

export function onLayoutModeChange(fn) {
    if (typeof fn === 'function') listeners.add(fn);
}

/**
 * À appeler AVANT le premier calcul de coquille et la première mesure du
 * canvas. On ré-applique à `load` : si une feuille arrivait tardivement, ses
 * blocs mobiles sont réécrits à leur tour (l'opération est idempotente).
 */
export function initLayoutMode() {
    applyModeToCss();
    if (typeof window !== 'undefined') {
        window.addEventListener('load', applyModeToCss, { once: true });
    }
}

export default {
    LAYOUT_MODES, getLayoutMode, setLayoutMode, cycleLayoutMode,
    isMobileActive, onLayoutModeChange, initLayoutMode,
};
