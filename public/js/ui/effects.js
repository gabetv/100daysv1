// js/ui/effects.js

import { resizeScene3D } from './scene3d.js';
import { computeSceneResolution, getSceneQuality, isMobileShell, onQualityChange, setLastResolution } from './resolution.js';

export function showFloatingText(text, type) {
    const mainView = document.getElementById('main-view-container');
    if (!mainView) return; // S'assurer que mainView existe
    const textEl = document.createElement('div');
    textEl.textContent = text;
    textEl.className = `floating-text ${type}`; // ex: type = 'gain', 'cost', 'info'
    const rect = mainView.getBoundingClientRect();
    textEl.style.left = `${rect.left + rect.width / 2}px`;
    textEl.style.top = `${rect.top + rect.height / 3}px`; // Positionner par rapport à mainView
    document.body.appendChild(textEl);
    setTimeout(() => {
        textEl.remove();
    }, 2000); // Durée d'affichage du texte
}

export function triggerActionFlash(type) {
    const flashEl = document.getElementById('action-flash');
    if (!flashEl) return;
    flashEl.className = ''; // Réinitialiser les classes
    void flashEl.offsetWidth; // Forcer un reflow pour que l'animation redémarre
    flashEl.classList.add(type === 'gain' ? 'flash-gain' : 'flash-cost');
}

export function triggerScreenShake() {
    const mainView = document.getElementById('main-view-container');
    if (!mainView) return;
    mainView.classList.add('action-failed-shake');
    setTimeout(() => {
        mainView.classList.remove('action-failed-shake');
    }, 500);
}

let mapTransitionTimer = null;
let mapTransitionToken = 0;

/**
 * Signale un changement de case sans masquer la scène ni bloquer les commandes.
 * Le décor fait son propre fondu dans draw.js ; cette couche ajoute un repère
 * lisible (direction, biome, coordonnées) pour que le joueur comprenne où il
 * arrive, surtout sur mobile.
 */
export function showMapTransition({ from, to, tile } = {}) {
    const transition = document.getElementById('map-transition');
    if (!transition || !to) return;

    const token = ++mapTransitionToken;
    const dx = Math.sign((to.x ?? 0) - (from?.x ?? to.x ?? 0));
    const dy = Math.sign((to.y ?? 0) - (from?.y ?? to.y ?? 0));
    const direction = {
        '-1,-1': 'NORD-OUEST', '0,-1': 'NORD', '1,-1': 'NORD-EST',
        '-1,0': 'OUEST', '1,0': 'EST',
        '-1,1': 'SUD-OUEST', '0,1': 'SUD', '1,1': 'SUD-EST',
    }[`${dx},${dy}`] || 'NOUVELLE CASE';

    const directionEl = transition.querySelector('[data-map-transition-direction]');
    const titleEl = transition.querySelector('[data-map-transition-title]');
    const coordsEl = transition.querySelector('[data-map-transition-coords]');
    if (directionEl) directionEl.textContent = `→ ${direction}`;
    if (titleEl) titleEl.textContent = tile?.type?.name || 'Nouvelle zone';
    if (coordsEl) coordsEl.textContent = `Position (${to.x}, ${to.y})`;

    if (mapTransitionTimer) clearTimeout(mapTransitionTimer);
    transition.className = 'map-transition';
    transition.classList.add(`direction-${dx}-${dy}`);
    transition.setAttribute('aria-hidden', 'false');

    // Deux frames garantissent que l'animation redémarre sur deux déplacements
    // rapides consécutifs, sans réutiliser un ancien état CSS.
    requestAnimationFrame(() => {
        if (token !== mapTransitionToken) return;
        transition.classList.add('is-visible');
    });
    mapTransitionTimer = setTimeout(() => {
        if (token !== mapTransitionToken) return;
        transition.classList.remove('is-visible');
        transition.setAttribute('aria-hidden', 'true');
    }, 720);
}

export function triggerShake(element) {
    if (!element) return;
    element.classList.add('action-failed-shake');
    setTimeout(() => {
        element.classList.remove('action-failed-shake');
    }, 500); // Durée de l'animation de secousse
}

export function resizeGameView() {
    const wrapper = document.getElementById('main-view-wrapper');
    const container = document.getElementById('main-view-container');
    if (!wrapper || !container) {
        console.error("[effects.js] resizeGameView: Wrapper or container not found.");
        return;
    }

    const mainViewCanvas = document.getElementById('main-view-canvas');
    const depthCanvas = document.getElementById('depth-canvas');
    const charactersCanvas = document.getElementById('characters-canvas');
    const mobile = isMobileShell();

    // Le conteneur remplit toujours la zone disponible : sur PC la scène
    // s'étire au maximum de l'écran (plus de format 1408×768 ni de bandes),
    // sur mobile elle occupe tout l'écran comme avant.
    container.style.width = '100%';
    container.style.height = '100%';
    [mainViewCanvas, charactersCanvas].forEach(c => {
        if (!c) return;
        c.style.width = '100%';
        c.style.height = '100%';
    });

    // clientWidth/clientHeight excluent le cadre : le canvas couvre exactement
    // la zone utile du conteneur.
    const cssWidth = container.clientWidth;
    const cssHeight = container.clientHeight;
    if (cssWidth < 10 || cssHeight < 10) return; // pas encore affichable

    const dpr = window.devicePixelRatio || 1;
    const res = computeSceneResolution({ cssWidth, cssHeight, dpr, mobile, quality: getSceneQuality() });
    setLastResolution(res);

    // Canvas agrandi ou réduit ? On ne réaffecte les dimensions que si
    // nécessaire : setter canvas.width — même à l'identique — efface le
    // bitmap et force un re-upload GPU.
    const resized = [mainViewCanvas, charactersCanvas, depthCanvas].some(c =>
        c && (c.width !== res.width || c.height !== res.height));
    if (resized) {
        if (mainViewCanvas) { mainViewCanvas.width = res.width; mainViewCanvas.height = res.height; }
        if (charactersCanvas) { charactersCanvas.width = res.width; charactersCanvas.height = res.height; }
        if (depthCanvas) { depthCanvas.width = res.width; depthCanvas.height = res.height; }
    }

    // Rendu net dans toutes les situations : si le canvas contient moins de
    // pixels que l'écran physique (agrandissement net, typiquement quand la
    // qualité adaptative a baissé d'un cran), on garde des pixels francs ;
    // sinon le navigateur lisse légèrement le mapping — indispensable pour un
    // canvas verrouillé affiché sur des tailles d'écran variées.
    const deviceWidth = cssWidth * dpr;
    const upscaleFactor = deviceWidth / res.width;
    const rendering = upscaleFactor > 1.2 ? 'pixelated' : 'auto';
    [mainViewCanvas, charactersCanvas].forEach(c => {
        if (c) c.style.imageRendering = rendering;
    });

    document.documentElement.dataset.sceneScale = String(res.renderScale);
    document.documentElement.dataset.sceneLocked = mobile ? 'on' : 'off';
    if (resized) console.log(`[scene] ${res.width}×${res.height} (échelle ${res.renderScale}${mobile ? ', résolution mobile verrouillée' : ', plein écran'})`);

    // WebGL utilise la taille CSS et choisit son propre DPR pour éviter le flou.
    if (depthCanvas) resizeScene3D(depthCanvas);

    if (window.gameState && window.gameState.player && window.UI) {
        try {
            window.UI.drawMainBackground(window.gameState);
            window.UI.drawSceneCharacters(window.gameState);
        } catch (_) {}
    }
}

// Un cran de qualité adaptative (voir resolution.js) change la résolution du
// canvas : on re-mesure, au prochain frame pour laisser le layout respirer.
let qualityResizeQueued = false;
onQualityChange(() => {
    if (qualityResizeQueued) return;
    qualityResizeQueued = true;
    requestAnimationFrame(() => {
        qualityResizeQueued = false;
        resizeGameView();
    });
});
