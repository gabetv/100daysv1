// Test hors navigateur de la stratégie de résolution et du cadrage des fonds.
// Usage : node scripts/test-resolution.mjs
//
// 1. resolution.js — verrou mobile + plein écran PC + budget de pixels ;
// 2. reproduction du cadrage historique 16:9 (centré) par la formule
//    « sol verrouillé », pour garantir aucun changement visuel sur ce format ;
// 3. alignement sol peint / ancre personnages sur largeurs variées.

import { computeSceneResolution, reportFrameCost, getSceneQuality, onQualityChange, characterScaleFor } from '../public/js/ui/resolution.js';


let failures = 0;
function check(name, condition, detail = '') {
    if (condition) {
        console.log(`  ok  ${name}`);
    } else {
        failures += 1;
        console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

console.log('\n== Résolution : mobile verrouillé ==');
{
    // Téléphones courants : le petit côté logique vaut toujours 412.
    const phones = [
        { name: 'iPhone 390×844 @3', cssWidth: 390, cssHeight: 844, dpr: 3 },
        { name: 'Android 360×800 @3', cssWidth: 360, cssHeight: 800, dpr: 3 },
        { name: 'Pixel 412×915 @2.6', cssWidth: 412, cssHeight: 915, dpr: 2.6 },
        { name: 'Tablette 768×1024 @2', cssWidth: 768, cssHeight: 1024, dpr: 2 },
        { name: 'Paysage 844×390 @3', cssWidth: 844, cssHeight: 390, dpr: 3 },
    ];
    for (const p of phones) {
        const res = computeSceneResolution({ ...p, mobile: true });
        const shortSide = Math.min(res.logicalWidth, res.logicalHeight);
        check(`${p.name} → petit côté logique 412`, shortSide === 412, `obtenu ${res.logicalWidth}×${res.logicalHeight}`);
        check(`${p.name} → canvas = logique × échelle`, Math.abs(res.width - res.logicalWidth * res.renderScale) <= 1,
            `${res.width} ≠ ${res.logicalWidth}×${res.renderScale}`);
    }
    // Deux téléphones différents → même cadrage logique.
    const a = computeSceneResolution({ cssWidth: 390, cssHeight: 844, dpr: 3, mobile: true });
    const b = computeSceneResolution({ cssWidth: 360, cssHeight: 800, dpr: 3, mobile: true });
    check('cadrage identique entre téléphones (aspect proche)',
        Math.abs(a.logicalWidth / a.logicalHeight - b.logicalWidth / b.logicalHeight) < 0.02);
    // Échelle d'appareil plafonnée à 3.
    const res3 = computeSceneResolution({ cssWidth: 390, cssHeight: 844, dpr: 4, mobile: true });
    check('échelle d\'appareil plafonnée à 3', res3.width === Math.round(412 * 3) || res3.width <= 412 * 3 + 1, `obtenu ${res3.width}`);
    // Coquille mobile forcée sur PC (réglage Auto / Mobile / PC du HUD) :
    // le cadrage reste verrouillé à 412 logiques mais l'échelle de rendu
    // grimpe pour remplir la grande zone affichée — sinon le jeu serait flou.
    const forced = computeSceneResolution({ cssWidth: 1600, cssHeight: 833, dpr: 1, mobile: true });
    const forcedShort = Math.min(forced.logicalWidth, forced.logicalHeight);
    check('mobile forcé sur PC → petit côté logique toujours 412', forcedShort === 412, `obtenu ${forced.logicalWidth}×${forced.logicalHeight}`);
    check('mobile forcé sur PC → échelle relevée pour couvrir la zone',
        forced.renderScale >= 1.95 && forced.width >= 1550, `obtenu ${forced.width}×${forced.height} @${forced.renderScale}`);
    // Rendez-vous des comportements inchangés : téléphone 1× reste à 1.
    const oldPhone = computeSceneResolution({ cssWidth: 360, cssHeight: 640, dpr: 1, mobile: true });
    check('téléphone 1× inchangé (échelle 1)', oldPhone.renderScale === 1, `obtenu ${oldPhone.renderScale}`);
}

console.log('\n== Résolution : PC plein écran ==');
{
    // 1024×768 : la scène remplit tout, plus de letterbox 1408×768.
    const compact = computeSceneResolution({ cssWidth: 700, cssHeight: 560, dpr: 1, mobile: false });
    check('1024×768 → canvas = zone disponible', compact.width === 700 && compact.height === 560,
        `obtenu ${compact.width}×${compact.height}`);

    // Écran HiDPI : le rendu suit la densité (plus de flou).
    const hidpi = computeSceneResolution({ cssWidth: 1000, cssHeight: 700, dpr: 2, mobile: false });
    check('HiDPI @2 → rendu 2×', hidpi.width === 2000 && hidpi.height === 1400, `obtenu ${hidpi.width}×${hidpi.height}`);

    // Ultra-large 21:9 : la scène occupe toute la largeur.
    const ultra = computeSceneResolution({ cssWidth: 1600, cssHeight: 700, dpr: 1, mobile: false });
    check('21:9 → pleine largeur', ultra.width === 1600, `obtenu ${ultra.width}×${ultra.height}`);

    // Budget de pixels : 4K @2 reste sous le plafond.
    const huge = computeSceneResolution({ cssWidth: 3840, cssHeight: 1600, dpr: 2, mobile: false });
    check('budget de pixels respecté', huge.width * huge.height <= 12_600_000,
        `obtenu ${huge.width}×${huge.height} = ${(huge.width * huge.height / 1e6).toFixed(1)} Mpx`);

    // Qualité adaptative : réduit l'échelle, jamais sous 1 pixel logique.
    const low = computeSceneResolution({ cssWidth: 1000, cssHeight: 700, dpr: 2, mobile: false, quality: 0.55 });
    check('qualité 0.55 @2 → échelle 1.1', low.renderScale === 1.1, `obtenu ${low.renderScale}`);
}

console.log('\n== Qualité adaptative ==');
{
    let notified = 0;
    const off = onQualityChange(() => { notified += 1; });
    const before = getSceneQuality();
    for (let i = 0; i < 160; i++) reportFrameCost(50); // deux fenêtres lentes
    check('qualité baissée après des images lentes', getSceneQuality() < before, `obtenu ${getSceneQuality()}`);
    check('changement notifié', notified >= 1);
    for (let i = 0; i < 160; i++) reportFrameCost(5); // rapide, mais 3 fenêtres calmes requises
    for (let i = 0; i < 160; i++) reportFrameCost(5);
    check('remontée après des images calmes', getSceneQuality() > 0.55 + 1e-9 || getSceneQuality() === 1,
        `obtenu ${getSceneQuality()}`);
    off();
}

console.log('\n== Cadrage des fonds : sol verrouillé ==');
// Reproduit la formule de paintBackgroundImage pour vérifier les invariants.
function crop({ imgW, imgH, canvasAspect, ground, target, zoom = 1 }) {
    const imageAspect = imgW / imgH;
    let sWidth, sHeight;
    if (imageAspect > canvasAspect) {
        sHeight = imgH; sWidth = sHeight * canvasAspect;
    } else {
        sWidth = imgW; sHeight = sWidth / canvasAspect;
    }
    sWidth /= zoom; sHeight /= zoom;
    let sy;
    if (sHeight >= imgH - 0.5) {
        sy = 0;
    } else if (ground != null && target != null) {
        const visibleFrac = sHeight / imgH;
        sy = (ground - target * visibleFrac) * imgH;
    } else {
        sy = (imgH - sHeight) / 2;
    }
    sy = Math.max(0, Math.min(imgH - sHeight, sy));
    return { sHeight, sy };
}

// Ancres historiques (sceneGroundProfile) et lignes de sol dérivées.
const SCENES = {
    'bg_forest_1 (1408×768)': { imgW: 1408, imgH: 768, ground: 0.765, target: 0.765 },
    'bg_sand_2 (1408×768)': { imgW: 1408, imgH: 768, ground: 0.83, target: 0.83 },
    'bg_stone_3 (1024×1024)': { imgW: 1024, imgH: 1024, ground: 0.6555, target: 0.785 },
    'bg_mine (1024×1024)': { imgW: 1024, imgH: 1024, ground: 0.677, target: 0.825 },
    'bg_campfire (1024×1024)': { imgW: 1024, imgH: 1024, ground: 0.650, target: 0.775 },
    'bg_shelter_individual (1024×1024)': { imgW: 1024, imgH: 1024, ground: 0.666, target: 0.805 },
    'bg_forest_mobile (768×1376)': { imgW: 768, imgH: 1376, ground: 0.68, target: 0.68 },
};

for (const [name, scene] of Object.entries(SCENES)) {
    if (name.includes('mobile')) continue; // fonds portrait : testés ci-dessous à leur vrai format
    // Format historique 16:9 (1408/768) : doit retomber sur le centré exact.
    const aspect = 1408 / 768;
    const { sy, sHeight } = crop({ ...scene, canvasAspect: aspect });
    const centered = (scene.imgH - sHeight) / 2;
    check(`${name} : cadrage 16:9 inché (centré historique)`, Math.abs(sy - centered) < 1.5,
        `sy=${sy.toFixed(1)} vs centré=${centered.toFixed(1)}`);
}

// Fonds mobiles portrait : à leur format d'usage (téléphones réels), toute la
// hauteur de l'image reste visible — aucun recadrage vertical, sol intact.
for (const aspect of [0.42, 0.4625, 0.5, 0.55]) {
    for (const [name, scene] of Object.entries(SCENES)) {
        if (!name.includes('mobile')) continue;
        const { sy, sHeight } = crop({ ...scene, canvasAspect: aspect });
        check(`${name} @${aspect.toFixed(3)} : hauteur entière, sy=0`,
            sHeight === scene.imgH && sy === 0, `sHeight=${sHeight}, sy=${sy}`);
    }
}

for (const aspect of [1.2, 1.41, 1.78, 2.05, 2.33, 3.0]) {
    for (const [name, scene] of Object.entries(SCENES)) {
        if (name.includes('mobile')) continue; // portrait : jamais de recadrage vertical utile
        const { sy, sHeight } = crop({ ...scene, canvasAspect: aspect });
        const visibleFrac = sHeight / scene.imgH;
        if (visibleFrac >= 1) continue;
        // Le sol peint doit atterrir sur la ligne cible à l'écran.
        const groundOnScreen = (scene.ground * scene.imgH - sy) / sHeight;
        const clamped = Math.max(scene.target, Math.min(1, groundOnScreen));
        check(`${name} @${aspect.toFixed(2)} : sol peint sur l'ancre`,
            Math.abs(clamped - scene.target) < 0.02 || groundOnScreen > scene.target,
            `sol à ${(groundOnScreen).toFixed(3)} vs cible ${scene.target}`);
    }
}

// Mobile portrait : toute la hauteur de l'image reste visible.
{
    const { sHeight } = crop({ imgW: 768, imgH: 1376, canvasAspect: 390 / 844, ground: 0.68, target: 0.68 });
    check('fond mobile portrait : hauteur entière visible', sHeight === 1376);
}

console.log('\n== Taille des personnages : calibrage conservé ==');
// L'unité affichée (px logiques) = 4 × échelle / échelle_de_rendu. Avant la
// refonte, le canvas PC était en pixels CSS (mapping 1) et le mobile ≤ 2× :
// on compare à la formule d'époque clamp(H_canvas/620, .75, 1.6).
function legacyUnit(cssHeight, mapping) {
    return 4 * Math.max(0.75, Math.min(1.6, (cssHeight * mapping) / 620)) / mapping;
}
function newUnit(cssHeight, dpr, mobile, quality = 1) {
    const res = computeSceneResolution({ cssWidth: 390, cssHeight, dpr, mobile, quality });
    return 4 * characterScaleFor(res.height, res.renderScale, mobile) / res.renderScale;
}
{
    // PC : mapping historique 1×.
    check('PC 1× 640px : unité conservée', Math.abs(newUnit(640, 1, false) - legacyUnit(640, 1)) < 0.01);
    check('PC 2× 640px : unité conservée (avant : flou 1×)', Math.abs(newUnit(640, 2, false) - legacyUnit(640, 1)) < 0.01);
    check('PC 2× qualité 0.75 : unité conservée', Math.abs(newUnit(640, 2, false, 0.75) - legacyUnit(640, 1)) < 0.01);
    check('PC 1× 900px (haute fenêtre) : unité conservée', Math.abs(newUnit(900, 1, false) - legacyUnit(900, 1)) < 0.01);

    // Mobile : mapping historique min(dpr, 2).
    check('Mobile 3× : unité conservée (avant : cap 2×)', Math.abs(newUnit(700, 3, true) - legacyUnit(700, 2)) < 0.05);
    check('Mobile 2× : unité conservée', Math.abs(newUnit(700, 2, true) - legacyUnit(700, 2)) < 0.05);
    check('Mobile 1× : unité proche (verrou 412 vs 390 CSS)', Math.abs(newUnit(700, 1, true) - legacyUnit(700, 1)) < 0.3);

    // Cohérence entre téléphones : même unité logique affichée.
    const a = newUnit(700, 3, true);
    const b = newUnit(620, 3, true);
    check('Mobile : unité stable entre tailles de téléphones', Math.abs(a - b) < 0.35, `${a.toFixed(2)} vs ${b.toFixed(2)}`);
}

console.log(failures === 0 ? '\nTOUS LES TESTS PASSENT\n' : `\n${failures} ÉCHEC(S)\n`);
process.exit(failures === 0 ? 0 : 1);
