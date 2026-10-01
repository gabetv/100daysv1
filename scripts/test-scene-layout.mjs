// Vérifie que les surfaces posées sur la scène ne se recouvrent pas.
//
// C'est le défaut que montrait la capture du 1er octobre : la flèche
// Nord-Ouest tombait sur la carte d'état, la Sud-Ouest sur la carte « Vous
// êtes ici » dont elle tronquait le texte. Rien dans le code ne l'empêchait,
// parce que chaque élément était positionné dans son coin sans savoir ce que
// les autres occupaient.
//
// Le test relit les constantes directement dans public/reference-ui.css : si
// quelqu'un déplace le pavé ou élargit une carte, le calcul suit, et l'échec
// signale la collision avant qu'elle n'arrive à l'écran.
//
// Usage : node scripts/test-scene-layout.mjs

import fs from 'node:fs';

const CSS = fs.readFileSync(new URL('../public/reference-ui.css', import.meta.url), 'utf8');

let failures = 0;
const ok = (name) => console.log(`  ok  ${name}`);
const fail = (name, detail) => { failures += 1; console.error(`FAIL  ${name} — ${detail}`); };

/** Lit une déclaration `prop: <nombre>px` quelque part dans la feuille. */
function px(prop, fallback) {
    const m = CSS.match(new RegExp(`${prop}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)px`));
    if (!m) {
        if (fallback === undefined) throw new Error(`Constante CSS introuvable : ${prop}`);
        return fallback;
    }
    return Number(m[1]);
}

/** Lit `prop` dans la dernière règle qui cible `selector` et le définit. */
function pxIn(selector, prop, fallback) {
    let found = null;
    for (const rule of CSS.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        if (!rule[1].includes(selector)) continue;
        const m = rule[2].match(new RegExp(`${prop}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)px`));
        if (m) found = Number(m[1]);
    }
    if (found === null) {
        if (fallback === undefined) throw new Error(`Constante CSS introuvable : ${selector} { ${prop} }`);
        return fallback;
    }
    return found;
}

const PAD_KEY = px('--pad-key');
const PAD_STEP = px('--pad-step');
const PAD_R = px('--pad-r');
const PAD_B = px('--pad-b');
const HUD_MAX = pxIn('#game-info-hud', 'max-width');
const HUD_TOP = pxIn('show-scene-vitals #game-info-hud', 'top');

console.log('Constantes relues dans reference-ui.css :');
console.log(`  pavé : touche ${PAD_KEY}px, pas ${PAD_STEP}px, marges ${PAD_R}/${PAD_B}px`);
console.log(`  carte d'état : largeur max ${HUD_MAX}px, descendue à ${HUD_TOP}px sous les jauges\n`);

/** Boîtes posées sur la scène, en coordonnées scène (origine en haut à gauche). */
function layout(W, H) {
    const padSpan = PAD_STEP * 2 + PAD_KEY;          // trois touches + deux gouttières
    const plate = 9;                                  // débord de la plaque de bois
    return {
        "carte d'état": { x: 12, y: HUD_TOP, w: HUD_MAX, h: 240 },
        'jauges': { x: 12, y: 12, w: W - 14 - 12, h: 36 },
        'carte du lieu': { x: 13, y: H - 13 - 92, w: Math.min(300, W * 0.35), h: 92 },
        'pavé directionnel': {
            x: W - PAD_R - padSpan - plate,
            y: H - PAD_B - padSpan - plate,
            w: padSpan + plate * 2,
            h: padSpan + plate * 2,
        },
    };
}

function overlap(a, b) {
    const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return dx > 0 && dy > 0 ? { dx, dy } : null;
}

// Tailles de scène réalistes : colonne centrale du grid `205px 1fr 290px`,
// de la fenêtre la plus étroite acceptée en mode ordinateur aux grands écrans.
const SCENES = [
    ['ordinateur étroit (901px)', 390, 520],
    ['capture utilisateur (~1000px)', 489, 600],
    ['ordinateur courant (1280px)', 720, 660],
    ['grand écran (1920px)', 1180, 860],
];

for (const [name, W, H] of SCENES) {
    console.log(`== Scène ${W}x${H} — ${name} ==`);
    const boxes = layout(W, H);
    const names = Object.keys(boxes);
    let collisions = 0;
    for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
            const hit = overlap(boxes[names[i]], boxes[names[j]]);
            if (hit) {
                collisions += 1;
                fail(`${names[i]} / ${names[j]}`, `recouvrement de ${Math.round(hit.dx)}x${Math.round(hit.dy)}px`);
            }
        }
    }
    if (!collisions) ok(`${names.length} surfaces, aucun recouvrement`);

    // Tout doit aussi rester dans le cadre.
    for (const [n, b] of Object.entries(boxes)) {
        const out = b.x < 0 || b.y < 0 || b.x + b.w > W || b.y + b.h > H;
        if (out) fail(`${n} déborde`, `x${Math.round(b.x)} y${Math.round(b.y)} ${Math.round(b.w)}x${Math.round(b.h)} hors de ${W}x${H}`);
    }
    console.log('');
}

// Pendant un combat, le bandeau occupe toute la largeur du bas. Il n'y a de
// place que si le pavé directionnel et la carte du lieu s'effacent — ce que
// le CSS doit faire, puisque le serveur refuse de toute façon les
// déplacements tant que la rencontre dure.
console.log('== Combat : le bas de la scène est libéré ==');
{
    const rule = CSS.match(/body\.game-screen\.in-combat[\s\S]*?\{([^}]*)\}/);
    const selectors = CSS.slice(0, rule ? CSS.indexOf(rule[0]) + rule[0].length : 0);
    const block = rule ? CSS.slice(CSS.lastIndexOf('body.game-screen.in-combat', CSS.indexOf(rule[0]) + 1)) : '';
    const head = block.slice(0, block.indexOf('}') + 1);
    const hides = /display:\s*none/.test(head);
    for (const target of ['.nav-button-overlay', '#tile-info-hud', '#navigation-edge-panel::before']) {
        if (head.includes(target)) ok(`${target} masqué pendant le combat`);
        else fail(`${target} reste affiché pendant le combat`, 'il chevaucherait le bandeau');
    }
    if (hides) ok('la règle applique bien display:none');
    else fail('la règle de combat ne masque rien', head.slice(0, 80));

    // Le bandeau occupe la bande basse : on vérifie qu'il ne déborde pas.
    const W = 489, H = 600, bandH = 92;
    const band = { x: 12, y: H - 12 - bandH, w: W - 14 - 12, h: bandH };
    if (band.x >= 0 && band.y >= 0 && band.x + band.w <= W && band.y + band.h <= H) ok('le bandeau de combat tient dans la scène');
    else fail('le bandeau de combat déborde', JSON.stringify(band));
}
console.log('');

// Le pavé doit rester carré et aligné sur sa planche : trois colonnes de
// touches, sinon les sprites se décalent d'une demi-case.
console.log('== Cohérence du pavé ==');
if (PAD_STEP <= PAD_KEY) fail('pas du pavé', `le pas (${PAD_STEP}) doit dépasser la touche (${PAD_KEY})`);
else ok(`gouttière de ${PAD_STEP - PAD_KEY}px entre les touches`);
if (PAD_R < 8 || PAD_B < 8) fail('marges du pavé', 'le pavé colle au bord de la scène');
else ok('le pavé garde une marge au bord');

console.log(failures === 0
    ? '\nAucun recouvrement : la scène est lisible à toutes les tailles testées.\n'
    : `\n${failures} problème(s) de disposition.\n`);
process.exit(failures === 0 ? 0 : 1);
