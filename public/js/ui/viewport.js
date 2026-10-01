// js/ui/viewport.js — Adaptation de la coquille de jeu à la résolution.
//
// Problème corrigé ici : entre 900 px et ~1180 px de large (ou sous 760 px de
// haut), l'ancienne grille à trois colonnes + barre basse ne tenait plus. Les
// panneaux se chevauchaient, la scène tombait à 390 px et certains boutons
// sortaient de l'écran.
//
// Trois coquilles sont maintenant calculées en continu :
//   • `full`    — grand écran : 3 colonnes + dock bas complet ;
//   • `compact` — écran étroit ou peu haut : 2 colonnes, le Statut passe en
//                 tiroir et la barre basse devient un dock à onglets ;
//   • `mobile`  — mise en page tactile existante (inchangée).
//
// S'ajoute un mode « Focus scène » mémorisé, qui masque les panneaux latéraux
// pour les très petites hauteurs ou simplement pour jouer en grand.

import { setDayTimerScale } from './daytimer.js';

const MOBILE_QUERY = '(max-width: 900px), (pointer: coarse) and (max-width: 1100px)';
const COMPACT_MAX_WIDTH = 1180;
const COMPACT_MAX_HEIGHT = 760;
const STORAGE_KEY = 'shellPreferences';

const DOCK_SECTIONS = [
    { id: 'bottom-bar-chat-panel', label: 'Journal', icon: 'chat' },
    { id: 'bottom-bar-equipment-panel', label: 'Équip.', icon: 'bag' },
    { id: 'minimap-section', label: 'Carte', icon: 'map' },
];

let state = {
    shell: 'full',
    narrow: false,
    short: false,
    focus: false,
    drawerOpen: false,
    dockOpen: true,
    dockTab: 'bottom-bar-chat-panel',
};
let initialized = false;
let resizeRaf = null;

function readPreferences() {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        if (typeof raw.focus === 'boolean') state.focus = raw.focus;
        if (typeof raw.dockOpen === 'boolean') state.dockOpen = raw.dockOpen;
        if (typeof raw.dockTab === 'string' && DOCK_SECTIONS.some(s => s.id === raw.dockTab)) state.dockTab = raw.dockTab;
    } catch (_) { /* préférences optionnelles */ }
}

function savePreferences() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            focus: state.focus, dockOpen: state.dockOpen, dockTab: state.dockTab,
        }));
    } catch (_) { /* mode privé : on continue sans mémoriser */ }
}

export function isMobileShell() {
    return window.matchMedia(MOBILE_QUERY).matches;
}

/** Prévient la scène qu'elle doit se remesurer, une fois le layout stabilisé. */
function requestRelayout() {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        window.dispatchEvent(new Event('resize'));
    });
}

/* ---------------------------------------------------------------------
 * Calcul de la coquille
 * ------------------------------------------------------------------- */

/**
 * Deux contraintes indépendantes, deux réponses distinctes :
 *   • `narrow` (largeur) décide du nombre de colonnes — le Statut passe en
 *     tiroir, sinon la scène tomberait sous 400 px ;
 *   • `short`  (hauteur) décide de la barre basse — elle devient un dock à
 *     onglets, ce qui rend ~45 px à la scène.
 * Un 1280×720 n'est donc pas traité comme un 960×900.
 */
function computeConstraints() {
    if (isMobileShell()) return { mobile: true, narrow: false, short: false };
    return {
        mobile: false,
        narrow: window.innerWidth < COMPACT_MAX_WIDTH,
        short: window.innerHeight < COMPACT_MAX_HEIGHT,
    };
}

function densityName(width) {
    if (width < 420) return 'xs';
    if (width < 700) return 'sm';
    if (width < 1024) return 'md';
    if (width < 1440) return 'lg';
    return 'xl';
}

function heightName(height) {
    if (height < 560) return 'tiny';
    if (height < 680) return 'short';
    if (height < 820) return 'medium';
    return 'tall';
}

/**
 * Échelle typographique continue. Elle évite l'effet « tout est énorme » sur
 * un 1366×768 et « tout est minuscule » sur un 4K.
 */
function computeUiScale(width, height) {
    const raw = Math.min(width / 1440, height / 900);
    // Bornes volontairement serrées : la place se gagne par la mise en page
    // (tiroir, dock, colonnes fluides), pas en rendant le texte illisible.
    return Math.max(0.88, Math.min(1.1, Number(raw.toFixed(3))));
}

export function applyViewport() {
    const root = document.documentElement;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const { mobile, narrow, short } = computeConstraints();
    const shell = mobile ? 'mobile' : (narrow || short ? 'compact' : 'full');
    const changed = shell !== state.shell || narrow !== state.narrow || short !== state.short;
    Object.assign(state, { shell, narrow, short });

    root.dataset.shell = shell;
    root.dataset.narrow = narrow ? 'on' : 'off';
    root.dataset.short = short ? 'on' : 'off';
    root.dataset.density = densityName(width);
    root.dataset.vheight = heightName(height);
    root.style.setProperty('--ui-scale', String(computeUiScale(width, height)));
    // Hauteur réelle utilisable : contourne la barre d'URL mobile.
    root.style.setProperty('--app-height', `${height}px`);

    if (!narrow) setDrawerOpen(false, { silent: true });
    // Les jauges de survie remontent sur la scène dès que le panneau Statut
    // n'est plus visible en permanence.
    document.body.classList.toggle('show-scene-vitals', !mobile && (narrow || state.focus));

    if (mobile) {
        document.body.classList.remove('focus-scene', 'dock-collapsed', 'dock-tabbed');
        DOCK_SECTIONS.forEach(section => document.getElementById(section.id)?.classList.remove('dock-hidden'));
    } else {
        document.body.classList.toggle('focus-scene', state.focus);
        document.body.classList.toggle('dock-tabbed', short);
        document.body.classList.toggle('dock-collapsed', short && !state.dockOpen);
        if (short) applyDockTab(state.dockTab);
        else DOCK_SECTIONS.forEach(section => document.getElementById(section.id)?.classList.remove('dock-hidden'));
    }

    // Le minuteur suit la densité : sprites plus petits sur un HUD compact.
    setDayTimerScale(mobile ? 26 : (shell === 'compact' ? 30 : 34));

    syncControls();
    if (changed) requestRelayout();
}

/* ---------------------------------------------------------------------
 * Tiroir « Statut » (panneau de gauche en mode compact)
 * ------------------------------------------------------------------- */

export function setDrawerOpen(open, { silent = false } = {}) {
    // Le tiroir n'existe qu'en largeur contrainte : ailleurs le panneau Statut
    // est déjà affiché en permanence.
    state.drawerOpen = !!open && state.narrow;
    document.body.classList.toggle('left-drawer-open', state.drawerOpen);
    const panel = document.getElementById('left-panel');
    if (panel) panel.setAttribute('aria-hidden', state.drawerOpen || !state.narrow ? 'false' : 'true');
    syncControls();
    if (!silent) requestRelayout();
}

export function toggleDrawer() { setDrawerOpen(!state.drawerOpen); }

/* ---------------------------------------------------------------------
 * Dock bas à onglets (mode compact)
 * ------------------------------------------------------------------- */

function applyDockTab(tabId) {
    state.dockTab = tabId;
    DOCK_SECTIONS.forEach(section => {
        const el = document.getElementById(section.id);
        if (el) el.classList.toggle('dock-hidden', section.id !== tabId);
    });
    document.querySelectorAll('.dock-tab').forEach(button => {
        button.classList.toggle('active', button.dataset.dockTarget === tabId);
    });
}

export function setDockTab(tabId) {
    if (!DOCK_SECTIONS.some(section => section.id === tabId)) return;
    if (!state.dockOpen) setDockOpen(true, { silent: true });
    applyDockTab(tabId);
    savePreferences();
    requestRelayout();
}

export function setDockOpen(open, { silent = false } = {}) {
    state.dockOpen = !!open;
    document.body.classList.toggle('dock-collapsed', state.short && !state.dockOpen);
    savePreferences();
    syncControls();
    if (!silent) requestRelayout();
}

function buildDockTabs() {
    const bar = document.getElementById('bottom-bar');
    if (!bar || bar.querySelector('.dock-tabs')) return;
    const strip = document.createElement('div');
    strip.className = 'dock-tabs';
    strip.setAttribute('role', 'tablist');
    strip.setAttribute('aria-label', 'Sections du dock');
    DOCK_SECTIONS.forEach(section => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dock-tab';
        button.dataset.dockTarget = section.id;
        button.innerHTML = `<i class="sheet-icon" data-hud-icon="${section.icon}"></i><span>${section.label}</span>`;
        button.addEventListener('click', () => setDockTab(section.id));
        strip.appendChild(button);
    });
    const collapse = document.createElement('button');
    collapse.type = 'button';
    collapse.className = 'dock-tab dock-collapse';
    collapse.title = 'Réduire le dock';
    collapse.textContent = '▾';
    collapse.addEventListener('click', () => setDockOpen(!state.dockOpen));
    strip.appendChild(collapse);
    bar.prepend(strip);
}

/* ---------------------------------------------------------------------
 * Mode focus
 * ------------------------------------------------------------------- */

export function toggleFocus(force) {
    const next = typeof force === 'boolean' ? force : !state.focus;
    if (next === state.focus) return;
    state.focus = next;
    savePreferences();
    applyViewport();
}

/** Le mode focus masque les panneaux : on le quitte pour montrer les actions. */
export function ensurePanelsVisible() {
    if (state.focus && state.shell !== 'mobile') toggleFocus(false);
    if (state.short && !state.dockOpen) setDockOpen(true);
}

/* ---------------------------------------------------------------------
 * Boutons de la scène
 * ------------------------------------------------------------------- */

function syncControls() {
    const focusBtn = document.getElementById('toggle-focus-btn');
    if (focusBtn) {
        focusBtn.classList.toggle('is-active', state.focus);
        focusBtn.setAttribute('aria-pressed', String(state.focus));
        focusBtn.title = state.focus ? 'Réafficher les panneaux' : 'Focus sur la scène';
    }
    const drawerBtn = document.getElementById('toggle-status-btn');
    if (drawerBtn) {
        // En mode focus les panneaux sont masqués : ces bascules n'ont plus de sens.
        drawerBtn.hidden = !state.narrow || state.focus;
        drawerBtn.classList.toggle('is-active', state.drawerOpen);
        drawerBtn.setAttribute('aria-pressed', String(state.drawerOpen));
    }
    const dockBtn = document.getElementById('toggle-dock-btn');
    if (dockBtn) {
        dockBtn.hidden = !state.short || state.focus;
        dockBtn.classList.toggle('is-active', state.dockOpen);
        dockBtn.setAttribute('aria-pressed', String(state.dockOpen));
        dockBtn.title = state.dockOpen ? 'Masquer le dock bas' : 'Afficher le dock bas';
    }
    const collapse = document.querySelector('.dock-collapse');
    if (collapse) collapse.textContent = state.dockOpen ? '▾' : '▴';
}

export function initViewport() {
    if (initialized) return;
    initialized = true;
    readPreferences();
    buildDockTabs();

    document.getElementById('toggle-focus-btn')?.addEventListener('click', toggleFocus);
    document.getElementById('toggle-status-btn')?.addEventListener('click', toggleDrawer);
    document.getElementById('toggle-dock-btn')?.addEventListener('click', () => setDockOpen(!state.dockOpen));
    document.getElementById('left-drawer-backdrop')?.addEventListener('click', () => setDrawerOpen(false));

    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const tag = (event.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || event.target.isContentEditable) return;
        if (event.key === 'Escape' && state.drawerOpen) { setDrawerOpen(false); return; }
        // F : plein écran de la scène (raccourci clavier discret)
        if (event.key.toLowerCase() === 'f') toggleFocus();
    });

    let timer = null;
    const onResize = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(applyViewport, 60);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(applyViewport, 220));

    applyViewport();
    console.log('Viewport shell initialized:', state.shell);
}

export default {
    initViewport, applyViewport, toggleFocus, toggleDrawer, setDockTab, setDockOpen,
    isMobileShell, ensurePanelsVisible,
};
