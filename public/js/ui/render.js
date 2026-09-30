// js/ui/render.js — Boucle de rendu : le décor, l'ambiance et les personnages sont animés en continu

import { drawMainBackground, drawSceneCharacters, drawMinimap } from './draw.js';
import { drawAtmosphere, getLighting } from './atmosphere.js';
import DOM from './dom.js';
import { initScene3D, resizeScene3D, drawScene3D, refreshScene3D } from './scene3d.js';

let running = false;
let rafId = null;
let lastDraw = 0;
let lastMinimap = 0;
let lastScenePosition = '';
const TARGET_FPS = 32;

function shouldSkip() {
    if (document.hidden) return true;
    // Une modale plein écran couvre la scène : inutile de dessiner
    const blocking = ['inventory-modal', 'equipment-modal', 'build-modal', 'workshop-modal',
                      'chest-modal', 'combat-modal', 'large-map-modal', 'victory-overlay'];
    return blocking.some(id => {
        const el = document.getElementById(id);
        return el && !el.classList.contains('hidden');
    });
}

function frame(ts) {
    rafId = requestAnimationFrame(frame);
    if (!running) return;
    if (ts - lastDraw < 1000 / TARGET_FPS) return;
    lastDraw = ts;

    const gs = window.gameState;
    if (!gs || !gs.player || !gs.map) return;
    if (shouldSkip()) return;

    try {
        drawMainBackground(gs);
        const canvas = DOM.mainViewCanvas;
        if (canvas && DOM.mainViewCtx) {
            drawAtmosphere(DOM.mainViewCtx, canvas.width, canvas.height, gs);
        }
        if (DOM.depthCanvas) {
            if (!DOM.depthCanvas.dataset.ready) {
                DOM.depthCanvas.dataset.ready = initScene3D(DOM.depthCanvas) ? 'true' : 'fallback';
                if (DOM.depthCanvas.dataset.ready === 'true') resizeScene3D(DOM.depthCanvas);
            }
            if (DOM.depthCanvas.dataset.ready === 'true') {
                const position = `${gs.player.x}:${gs.player.y}:${gs.player.combatState ? 'combat' : 'free'}`;
                if (position !== lastScenePosition) {
                    lastScenePosition = position;
                    refreshScene3D(gs);
                }
                drawScene3D(gs, ts);
            }
        }
        drawSceneCharacters(gs);
        updateTimeBadge(gs);

        // Mini-carte animée (rythme réduit)
        if (ts - lastMinimap > 180 && gs.config) {
            lastMinimap = ts;
            const mm = DOM.minimapCanvas;
            if (mm && mm.offsetParent !== null) drawMinimap(gs, gs.config);
        }
    } catch (e) {
        console.error('Erreur de rendu :', e);
    }
}

let lastPhase = null;
function updateTimeBadge(gs) {
    const el = document.getElementById('daytime-display');
    if (!el) return;
    const light = getLighting();
    if (light.label !== lastPhase) {
        lastPhase = light.label;
        el.textContent = light.label;
        el.dataset.phase = light.phase;
    }
}

export function startRenderLoop() {
    if (running) return;
    running = true;
    if (!rafId) rafId = requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', () => { lastDraw = 0; });
    console.log('Render loop started.');
}

export function stopRenderLoop() { running = false; }

export default { startRenderLoop, stopRenderLoop };
