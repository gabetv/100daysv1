// Test hors navigateur du pavé directionnel.
//
// Le seul vrai risque de cette fonctionnalité est la divergence : si le client
// grise une flèche que le serveur aurait acceptée (ou l'inverse), le joueur se
// retrouve bloqué sans raison. Ce test confronte donc directement
// `evaluateDirection()` (client) à `movePlayer()` (serveur) sur une carte de
// test, pour les 8 directions et pour chaque case.
//
// Usage : node scripts/test-navigation.mjs

import { DIRECTIONS, evaluateDirection, canMove, updateNavigation } from '../public/js/ui/navigation.js';

let failures = 0;
function check(name, condition, detail = '') {
    if (condition) {
        console.log(`  ok  ${name}`);
    } else {
        failures += 1;
        console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

// --- Réimplémentation littérale de la règle serveur (server/player.js) ------
const WIDTH = 6;
const HEIGHT = 5;

// # = infranchissable (lagon), . = accessible
const LAYOUT = [
    '##....',
    '#..#..',
    '..#...',
    '....##',
    '.#....',
];

function buildMap() {
    return LAYOUT.map((row, y) => [...row].map((c, x) => ({
        type: c === '#'
            ? { name: 'Lagon', accessible: false }
            : { name: 'Plaine', accessible: true },
        x, y,
    })));
}

/** Copie conforme du contrôle de `movePlayer()`. */
function serverAllows(map, player, directionId) {
    const dir = DIRECTIONS.find((d) => d.id === directionId);
    const x = player.x + dir.dx;
    const y = player.y + dir.dy;
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return false;
    const target = map[y]?.[x];
    if (!target || !target.type.accessible) return false;
    return true;
}

// --- 1. Table des directions identique au serveur --------------------------
console.log('\n== Table des directions ==');
{
    const expected = {
        north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0],
        nw: [-1, -1], ne: [1, -1], sw: [-1, 1], se: [1, 1],
    };
    check('8 directions déclarées', DIRECTIONS.length === 8, `obtenu ${DIRECTIONS.length}`);
    for (const [id, [dx, dy]] of Object.entries(expected)) {
        const dir = DIRECTIONS.find((d) => d.id === id);
        check(`${id} → (${dx}, ${dy})`, dir && dir.dx === dx && dir.dy === dy,
            dir ? `obtenu (${dir.dx}, ${dir.dy})` : 'direction absente');
    }
    const columns = DIRECTIONS.map((d) => d.column).sort((a, b) => a - b);
    check('colonnes de planche 0..7 sans doublon',
        columns.join(',') === '0,1,2,3,4,5,6,7', columns.join(','));
}

// --- 2. Client et serveur d'accord sur toute la carte ----------------------
console.log('\n== Client vs serveur : 8 directions x toutes les cases ==');
{
    const map = buildMap();
    let compared = 0;
    let mismatches = 0;
    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            if (!map[y][x].type.accessible) continue;   // on ne part pas du lagon
            const gameState = { map, player: { x, y, visitedTiles: new Set() } };
            for (const dir of DIRECTIONS) {
                const client = canMove(gameState, dir.id);
                const server = serverAllows(map, { x, y }, dir.id);
                compared += 1;
                if (client !== server) {
                    mismatches += 1;
                    console.error(`      (${x},${y}) ${dir.id} : client=${client} serveur=${server}`);
                }
            }
        }
    }
    check(`${compared} comparaisons, aucune divergence`, mismatches === 0, `${mismatches} divergence(s)`);
}

// --- 3. Raisons renvoyées ---------------------------------------------------
console.log('\n== Raisons affichées ==');
{
    const map = buildMap();
    const state = (x, y, visited = []) => ({
        map,
        player: { x, y, visitedTiles: new Set(visited) },
        globallyRevealedTiles: new Set(),
    });

    // Coin haut-gauche de la carte : le Nord sort de la grille.
    const atTopLeft = evaluateDirection(state(0, 2), 'north');
    check('hors carte → reason=blocked ou edge',
        ['edge', 'blocked'].includes(atTopLeft.reason), atTopLeft.reason);

    // (2,0) est accessible, (2,1) aussi ; (2,2) est du lagon.
    const intoWater = evaluateDirection(state(2, 1), 'south');
    check('lagon → reason=blocked', intoWater.reason === 'blocked', intoWater.reason);
    check('lagon connu → nom révélé', intoWater.detail.includes('Lagon'), intoWater.detail);

    const bottomEdge = evaluateDirection(state(0, 4), 'south');
    check('bord bas → reason=edge', bottomEdge.reason === 'edge', bottomEdge.reason);
    check("bord bas → libellé « Bord de l'île »",
        bottomEdge.detail === "Bord de l'île", bottomEdge.detail);

    const free = evaluateDirection(state(2, 0), 'east');
    check('case libre → ok=true', free.ok === true, JSON.stringify(free));
    check('case non visitée → « Zone inexplorée »',
        free.detail === 'Zone inexplorée', free.detail);

    const visited = evaluateDirection(state(2, 0, ['3,0']), 'east');
    check('case visitée → nom du biome', visited.detail === 'Plaine', visited.detail);

    const unknown = evaluateDirection({ player: null, map: null }, 'north');
    check('état incomplet → refus propre', unknown.ok === false, JSON.stringify(unknown));
}

// --- 4. Carte entièrement fermée -------------------------------------------
console.log('\n== Îlot isolé ==');
{
    const map = [[
        { type: { name: 'Lagon', accessible: false } },
        { type: { name: 'Lagon', accessible: false } },
        { type: { name: 'Lagon', accessible: false } },
    ], [
        { type: { name: 'Lagon', accessible: false } },
        { type: { name: 'Plaine', accessible: true } },
        { type: { name: 'Lagon', accessible: false } },
    ], [
        { type: { name: 'Lagon', accessible: false } },
        { type: { name: 'Lagon', accessible: false } },
        { type: { name: 'Lagon', accessible: false } },
    ]];
    const gameState = { map, player: { x: 1, y: 1, visitedTiles: new Set() } };
    const open = DIRECTIONS.filter((d) => canMove(gameState, d.id));
    check('aucune direction ouverte', open.length === 0, open.map((d) => d.id).join(','));
}

// --- 5. Attributs posés sur les boutons (DOM simulé) -----------------------
console.log('\n== Mise à jour des touches ==');
{
    // Faux DOM minimal : juste ce que `updateNavigation()` touche.
    const makeButton = (id) => ({
        id,
        dataset: {},
        classList: {
            _set: new Set(),
            toggle(name, on) { on ? this._set.add(name) : this._set.delete(name); },
            contains(name) { return this._set.has(name); },
        },
        attributes: {},
        setAttribute(k, v) { this.attributes[k] = v; },
        getAttribute(k) { return this.attributes[k]; },
        title: '',
    });
    const buttons = Object.fromEntries(DIRECTIONS.map((d) => [`nav-${d.id}`, makeButton(`nav-${d.id}`)]));
    const bodyClasses = { _set: new Set(), toggle(n, on) { on ? this._set.add(n) : this._set.delete(n); }, contains(n) { return this._set.has(n); } };
    globalThis.document = {
        getElementById: (id) => buttons[id] || null,
        body: { classList: bodyClasses },
    };

    const map = buildMap();
    // (2,0) : Nord = hors carte, Sud = (2,1) libre, Est = (3,0) libre.
    updateNavigation({ map, player: { x: 2, y: 0, visitedTiles: new Set() } });

    check('Nord hors carte → data-nav-state=blocked',
        buttons['nav-north'].dataset.navState === 'blocked', buttons['nav-north'].dataset.navState);
    check('Nord → aria-disabled=true',
        buttons['nav-north'].getAttribute('aria-disabled') === 'true');
    check('Nord → classe is-blocked', buttons['nav-north'].classList.contains('is-blocked'));
    check('Sud libre → data-nav-state=free',
        buttons['nav-south'].dataset.navState === 'free', buttons['nav-south'].dataset.navState);
    check('Sud → aria-disabled=false',
        buttons['nav-south'].getAttribute('aria-disabled') === 'false');
    check('colonne de planche conservée',
        buttons['nav-south'].dataset.navColumn === '4', buttons['nav-south'].dataset.navColumn);
    check('infobulle explicite', /Nord —/.test(buttons['nav-north'].title), buttons['nav-north'].title);
    check('aria-label explicite',
        /indisponible/.test(buttons['nav-north'].getAttribute('aria-label')),
        buttons['nav-north'].getAttribute('aria-label'));

    // Survivant occupé : toutes les touches passent en « busy », pas en « blocked ».
    updateNavigation({ map, player: { x: 2, y: 0, isBusy: true, visitedTiles: new Set() } });
    const allBusy = DIRECTIONS.every((d) => buttons[`nav-${d.id}`].dataset.navState === 'busy');
    check('action en cours → toutes les touches en busy', allBusy);
    check('busy ≠ blocked', !buttons['nav-south'].classList.contains('is-blocked'));

    // Combat : le serveur refuse les déplacements, les touches doivent le dire.
    updateNavigation({ map, player: { x: 2, y: 0, combatState: { turn: 'player' }, visitedTiles: new Set() } });
    const allCombat = DIRECTIONS.every((d) => buttons[`nav-${d.id}`].dataset.navState === 'busy');
    check('combat en cours → toutes les touches verrouillées', allCombat);
    check('infobulle de combat explicite',
        /Combat en cours/.test(buttons['nav-south'].title), buttons['nav-south'].title);
    check('combat ≠ direction bloquée', !buttons['nav-south'].classList.contains('is-blocked'));

    // Îlot isolé : la classe de secours arrive sur <body>.
    const isolated = [
        [{ type: { name: 'Lagon', accessible: false } }, { type: { name: 'Lagon', accessible: false } }, { type: { name: 'Lagon', accessible: false } }],
        [{ type: { name: 'Lagon', accessible: false } }, { type: { name: 'Plaine', accessible: true } }, { type: { name: 'Lagon', accessible: false } }],
        [{ type: { name: 'Lagon', accessible: false } }, { type: { name: 'Lagon', accessible: false } }, { type: { name: 'Lagon', accessible: false } }],
    ];
    updateNavigation({ map: isolated, player: { x: 1, y: 1, visitedTiles: new Set() } });
    check('îlot isolé → body.nav-all-blocked', bodyClasses.contains('nav-all-blocked'));

    updateNavigation({ map, player: { x: 2, y: 0, visitedTiles: new Set() } });
    check('retour en terrain ouvert → classe retirée', !bodyClasses.contains('nav-all-blocked'));

    delete globalThis.document;
}

console.log(failures === 0
    ? '\nTous les tests de navigation passent.\n'
    : `\n${failures} test(s) en échec.\n`);
process.exit(failures === 0 ? 0 : 1);
