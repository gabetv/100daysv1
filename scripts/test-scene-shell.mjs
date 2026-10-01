// Test d'intégration hors navigateur : exécute le vrai `resizeGameView`
// (public/js/ui/effects.js) sur un mini-DOM et vérifie le câblage de la
// stratégie de résolution (verrou mobile, plein écran PC, rendu net).
// Usage : node scripts/test-scene-shell.mjs

let failures = 0;
function check(name, condition, detail = '') {
    if (condition) console.log(`  ok  ${name}`);
    else { failures += 1; console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

/* ------------------------------------------------------------------ */
/* Mini-DOM : juste ce qu'il faut pour importer et exécuter les modules */
/* ------------------------------------------------------------------ */

const elements = new Map();
let viewport = { width: 1280, height: 800, dpr: 1, mobile: false };

function makeElement(id) {
    const el = {
        id,
        style: {},
        dataset: {},
        width: 0,
        height: 0,
        _clientWidth: 0,
        _clientHeight: 0,
        listeners: {},
        classList: {
            _set: new Set(),
            add(...c) { c.forEach(x => this._set.add(x)); },
            remove(...c) { c.forEach(x => this._set.delete(x)); },
            toggle(c, force) {
                const on = force === undefined ? !this._set.has(c) : force;
                on ? this._set.add(c) : this._set.delete(c);
                return on;
            },
            contains(c) { return this._set.has(c); },
        },
        get clientWidth() { return this._clientWidth; },
        get clientHeight() { return this._clientHeight; },
        addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
        removeEventListener() {},
        getContext() {
            const noop = () => {};
            return {
                canvas: el,
                save: noop, restore: noop, clearRect: noop, fillRect: noop,
                beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
                arc: noop, ellipse: noop, fill: noop, stroke: noop,
                drawImage: noop, fillText: noop, measureText: () => ({ width: 10 }),
                setTransform: noop, translate: noop, scale: noop, rotate: noop,
                getImageData: () => ({ data: new Uint8ClampedArray(4) }),
                createLinearGradient: () => ({ addColorStop: noop }),
                createRadialGradient: () => ({ addColorStop: noop }),
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'low',
                globalAlpha: 1, globalCompositeOperation: 'source-over',
                fillStyle: '', strokeStyle: '', lineWidth: 1, font: '',
                textAlign: 'left', textBaseline: 'top',
            };
        },
    };
    return el;
}

globalThis.document = {
    getElementById(id) {
        if (!elements.has(id)) elements.set(id, makeElement(id));
        return elements.get(id);
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => makeElement(`<${tag}>`),
    addEventListener: () => {},
    documentElement: { dataset: {}, style: { setProperty() {} } },
    body: makeElement('body'),
    hidden: false,
};

globalThis.window = {
    devicePixelRatio: 1,
    matchMedia: (query) => ({
        matches: viewport.mobile
            ? true
            : false,
        media: query,
        addEventListener() {}, removeEventListener() {},
    }),
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame: (fn) => setTimeout(() => fn(performance.now()), 0),
    performance: globalThis.performance,
};
globalThis.requestAnimationFrame = window.requestAnimationFrame;
globalThis.Window = globalThis.window.constructor;

// Le conteneur de scène : ses dimensions pilotent le redimensionnement.
function setSceneArea(cssWidth, cssHeight) {
    const container = document.getElementById('main-view-container');
    container._clientWidth = cssWidth;
    container._clientHeight = cssHeight;
}

// Applique une configuration d'appareil complète avant un redimensionnement.
function useDevice({ width, height, dpr, mobile }) {
    viewport = { width, height, dpr, mobile };
    window.devicePixelRatio = dpr;
}

/* ------------------------------------------------------------------ */
/* Import réel du module après installation du DOM                    */
/* ------------------------------------------------------------------ */

const { resizeGameView } = await import('../public/js/ui/effects.js');
const { MOBILE_LOCK_SHORT_SIDE, getSceneQuality } = await import('../public/js/ui/resolution.js');

const container = document.getElementById('main-view-container');
const mainCanvas = document.getElementById('main-view-canvas');
const charactersCanvas = document.getElementById('characters-canvas');
const depthCanvas = document.getElementById('depth-canvas');

console.log('\n== PC : plein écran, plus de letterbox 1408×768 ==');
{
    useDevice({ width: 1280, height: 800, dpr: 1, mobile: false });
    setSceneArea(820, 640);
    resizeGameView();
    check('zone 820×640 entièrement utilisée (avant : 820×447 en 1408×768)',
        mainCanvas.width === 820 && mainCanvas.height === 640, `obtenu ${mainCanvas.width}×${mainCanvas.height}`);
    check('conteneur à 100 % (étiré)', container.style.width === '100%' && container.style.height === '100%');
    check('canvas en 100 %', mainCanvas.style.width === '100%' && charactersCanvas.style.height === '100%');
    check('les 3 canvas partagent la résolution',
        mainCanvas.width === charactersCanvas.width && mainCanvas.width === depthCanvas.width);

    // Écran dense : rendu 2× (avant : 1×, flou à l'affichage).
    useDevice({ width: 1280, height: 800, dpr: 2, mobile: false });
    resizeGameView();
    check('HiDPI @2 → rendu 1640×1280', mainCanvas.width === 1640 && mainCanvas.height === 1280,
        `obtenu ${mainCanvas.width}×${mainCanvas.height}`);
    check('mapping exact → imageRendering auto', mainCanvas.style.imageRendering === 'auto');
}

console.log('\n== Mobile : résolution verrouillée ==');
{
    useDevice({ width: 390, height: 844, dpr: 3, mobile: true });
    setSceneArea(390, 700);
    resizeGameView();
    const expectedW = MOBILE_LOCK_SHORT_SIDE * 3; // 412 logiques × 3
    const expectedH = Math.round(MOBILE_LOCK_SHORT_SIDE / (390 / 700) * 3);
    check(`téléphone 390×700 @3 → canvas ${expectedW}×${expectedH} verrouillé`,
        mainCanvas.width === expectedW, `obtenu ${mainCanvas.width}×${mainCanvas.height}`);

    // Un autre téléphone (taille différente) → même largeur de canvas.
    setSceneArea(360, 620);
    resizeGameView();
    check('autre téléphone → même largeur verrouillée', mainCanvas.width === expectedW,
        `obtenu ${mainCanvas.width}`);

    // Attributs de diagnostic sur <html>.
    check('data-scene-scale exposé', document.documentElement.dataset.sceneScale === '3');
    check('data-scene-locké en mobile', document.documentElement.dataset.sceneLocked === 'on');

    // Retour PC : l'attribut repasse à off.
    useDevice({ width: 1280, height: 800, dpr: 1, mobile: false });
    setSceneArea(820, 640);
    resizeGameView();
    check('data-scene-locké off en PC', document.documentElement.dataset.sceneLocked === 'off');
}

console.log('\n== Qualité adaptative → redimensionnement ==');
{
    const { reportFrameCost } = await import('../public/js/ui/resolution.js');
    useDevice({ width: 1280, height: 800, dpr: 2, mobile: false });
    setSceneArea(820, 640);
    resizeGameView();
    const before = mainCanvas.width;
    for (let i = 0; i < 90; i++) reportFrameCost(60); // fenêtre lente complète
    await new Promise(r => setTimeout(r, 10)); // laisse tourner le rAF du listener
    check('qualité adaptative : canvas réduit après images lentes',
        mainCanvas.width < before && getSceneQuality() < 1,
        `avant ${before}, après ${mainCanvas.width}, qualité ${getSceneQuality()}`);
    check('jamais sous 1 pixel logique', mainCanvas.width >= 820 - 1, `obtenu ${mainCanvas.width}`);
}

console.log(failures === 0 ? '\nTOUS LES TESTS PASSENT\n' : `\n${failures} ÉCHEC(S)\n`);
process.exit(failures === 0 ? 0 : 1);
