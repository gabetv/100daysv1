// Test d'interface des actions rapides, sur le vrai game.html.
//
// scripts/test-item-actions.mjs vérifie le comportement serveur et les
// messages construits. Ici on va plus loin : on charge la véritable page
// game.html dans un DOM (jsdom), on branche les vrais écouteurs
// d'interface, puis on pilote les listes d'inventaire comme le ferait un
// joueur : bouton ✚ pour équiper, filtre de la fiche Équipement, bouton
// « Tout ramasser », boutons du coffre.
//
// Ce test nécessite jsdom (non installée par défaut) :
//   npm install --no-save jsdom && node scripts/test-ui-quick-actions.mjs
// Sans jsdom, il se signale et s'arrête proprement.

let domFactory;
try {
    ({ JSDOM: domFactory } = await import('jsdom'));
} catch {
    console.log('jsdom non installée — test d’interface sauté (npm install --no-save jsdom).');
    process.exit(0);
}

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

let failures = 0;
function check(name, condition, detail = '') {
    if (condition) console.log(`  ok  ${name}`);
    else { failures += 1; console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

// --- Le vrai game.html dans un vrai DOM ------------------------------------
const here = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(here, '..', 'public', 'game.html'), 'utf8');
const dom = new domFactory(html, { url: 'http://localhost:3000/game.html', pretendToBeVisual: true });

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 16);
// main.js lit sessionStorage/localStorage pour la session : sans ces
// globales, il croit être déconnecté et tente une redirection.
globalThis.sessionStorage = dom.window.sessionStorage;
globalThis.localStorage = dom.window.localStorage;
dom.window.sessionStorage.setItem('username', 'testeur-ui');

// --- Le serveur fournit un état de jeu réaliste ----------------------------
const { CONFIG } = await import('../server/config.js');
const State = await import('../server/state.js');
State.initializeGameState(CONFIG);
State.addNewPlayer('p1', 'TesteurUI');
const player = State.gameState.players.p1;
const tile = State.gameState.map[player.y][player.x];

// Un peu de matière : pile, objet équipable usé, consommable, sol, coffre.
player.inventory.Bois = 12;
player.inventory['Viande cuite'] = 3;
const swordKey = 'Épée en bois_ui_1';
player.inventory[swordKey] = { name: 'Épée en bois', durability: 10, currentDurability: 6 };
tile.groundItems = { Bois: 4, Pierre: 2 };
tile.buildings = [{ key: 'SHELTER_INDIVIDUAL', inventory: { Bois: 7 }, durability: 100, maxDurability: 100, ownerId: 'p1' }];

const gameState = { ...State.gameState, player };

// --- Les vrais modules d'interface ------------------------------------------
const UI = await import('../public/js/ui.js');
const Modals = await import('../public/js/ui/modals.js');
const Panels = await import('../public/js/ui/panels.js');
const Interactions = await import('../public/js/interactions.js');

const sent = [];
window.handleGlobalPlayerAction = (actionId, data) => sent.push([actionId, data]);
// main.js remet window.gameState à {} à son chargement : on (re)pose l'état
// réel APRÈS les imports, comme le fait la boucle réseau en jeu.
window.gameState = gameState;

// Les écouteurs délégués (boutons ✚/⬇, menu contextuel, glisser-déposer)
// sont posés une fois pour toute la page, comme au démarrage du jeu.
Interactions.initInteractions();

console.log('\n== Fiche Équipement : filtre et boutons ==');
{
    UI.setupMiscModalListeners();
    Modals.showEquipmentModal(gameState);

    const list = document.getElementById('equipment-player-inventory');
    const rows = [...list.querySelectorAll('.inventory-item')];
    // Objets équipables du joueur : la hache et la canne de départ + l'épée.
    check('filtre « Équipables » par défaut : seuls les objets équipables sont listés',
        rows.length === 3 && ['Canne à pêche', 'Épée en bois', 'Hache'].every(n => rows.some(r => r.dataset.itemName === n))
            && !rows.some(r => r.dataset.itemName === 'Bois' || r.dataset.itemName === 'Viande cuite'),
        `obtenu : ${rows.map(r => r.dataset.itemName).join(', ')}`);
    check("chaque ligne porte le bouton ✚ équiper", rows.every(r => !!r.querySelector('[data-quick-action="equip"]')));
    check("chaque ligne porte le bouton ⬇ poser au sol", rows.every(r => !!r.querySelector('[data-quick-action="drop"]')));
    const sword = rows.find(r => r.dataset.itemName === 'Épée en bois');
    check("badge d'emplacement « Arme/Outil » affiché",
        sword.querySelector('.slot-chip')?.textContent === 'Arme/Outil');
    check("la durabilité est visible (6/10)",
        sword.querySelector('.inventory-name')?.textContent.includes('(6/10)'));

    const capacity = document.getElementById('equipment-player-capacity').textContent;
    check("le compteur annonce les équipables et le total", /3 équipables · 6 \/ 50/.test(capacity), `obtenu « ${capacity} »`);

    // Bascule « Tout le sac » : les ressources apparaissent aussi.
    document.getElementById('equipment-filter-all').click();
    const allRows = [...document.querySelectorAll('#equipment-player-inventory .inventory-item')];
    check('« Tout le sac » liste tout (6 entrées)', allRows.length === 6,
        `obtenu : ${allRows.map(r => r.dataset.itemName).join(', ')}`);
    const bois = allRows.find(r => r.dataset.itemName === 'Bois');
    check('le bois garde son bouton ⬇ poser au sol', !!bois.querySelector('[data-quick-action="drop"]'));
    check('le bois n’a pas de bouton ✚ (rien à équiper ni utiliser)', !bois.querySelector('[data-quick-action="equip"], [data-quick-action="use"]'));
    const viande = allRows.find(r => r.dataset.itemName === 'Viande cuite');
    check('la viande cuite propose ✚ utiliser', !!viande.querySelector('[data-quick-action="use"]'));

    document.getElementById('equipment-filter-equippable').click();
    check('retour au filtre équipables', [...document.querySelectorAll('#equipment-player-inventory .inventory-item')].length === 3);

    // Le clic sur ✚ envoie l'équipement avec la bonne clé. La ligne est
    // requêtée à nouveau : les allers-retours du filtre ont recréé le DOM.
    sent.length = 0;
    const equipBtn = [...document.querySelectorAll('#equipment-player-inventory .inventory-item')]
        .find(r => r.dataset.itemName === 'Épée en bois')?.querySelector('[data-quick-action="equip"]');
    equipBtn.click();
    check('clic ✚ → equip_item_context avec la clé d’instance',
        sent[0]?.[0] === 'equip_item_context' && sent[0]?.[1].itemKey === swordKey,
        JSON.stringify(sent[0]));

    // Bouton × de déséquipement sur un emplacement occupé.
    player.equipment.weapon = { name: 'Épée en bois', durability: 10, currentDurability: 6 };
    Modals.updateEquipmentModal(gameState);
    const slotBtn = document.querySelector('#equipment-slots [data-slot-type="weapon"] .slot-unequip-btn');
    check('emplacement arme occupé → bouton × de déséquipement', !!slotBtn);
    sent.length = 0;
    slotBtn.click();
    check('clic × → unequip_item_context (slot weapon)',
        sent[0]?.[0] === 'unequip_item_context' && sent[0]?.[1].slot === 'weapon',
        JSON.stringify(sent[0]));
}

console.log('\n== Panneau Sac : boutons par objet ==');
{
    Panels.updateInventory(player);
    const rows = [...document.querySelectorAll('#inventory-categories .inventory-item')];
    check('le panneau Sac liste les 6 entrées du sac', rows.length === 6, `obtenu ${rows.length}`);
    const sword = rows.find(r => r.dataset.itemName === 'Épée en bois');
    check('épée → ✚ équiper présent', !!sword.querySelector('[data-quick-action="equip"]'));
    const viande = rows.find(r => r.dataset.itemName === 'Viande cuite');
    check('viande → 🍽 utiliser présent', !!viande.querySelector('[data-quick-action="use"]'));
    const bois = rows.find(r => r.dataset.itemName === 'Bois');
    check('bois → ⬇ poser au sol présent, pas de ✚',
        !!bois.querySelector('[data-quick-action="drop"]') && !bois.querySelector('[data-quick-action="equip"]'));
}

console.log('\n== Objets au sol : ramassage direct et « Tout ramasser » ==');
{
    Panels.updateGroundItemsPanel(tile);
    const rows = [...document.querySelectorAll('.ground-items-list .inventory-item')];
    check('deux objets listés au sol', rows.length === 2, `obtenu ${rows.length}`);
    check('chaque objet au sol a son bouton ✚ ramasser',
        rows.every(r => !!r.querySelector('[data-quick-action="pickup"]')));

    const pickupAllBtn = document.getElementById('pickup-all-btn');
    check('« Tout ramasser » visible quand il y a des objets', !pickupAllBtn.hidden);
    sent.length = 0;
    pickupAllBtn.click();
    check('clic « Tout ramasser » → pickup_all_items', sent[0]?.[0] === 'pickup_all_items');

    // Le clic sur une ligne (pas un bouton) ouvre le menu contextuel.
    const menu = document.getElementById('item-context-menu');
    rows[0].click();
    check('clic simple sur un objet au sol → menu contextuel ouvert',
        !menu.classList.contains('hidden') && document.getElementById('context-menu-title').textContent === 'Bois');
    const ramasserBtn = [...menu.querySelectorAll('button')].find(b => b.textContent === 'Ramasser');
    sent.length = 0;
    ramasserBtn.click();
    check('menu « Ramasser » → pickup avec la clé de la pile',
        sent[0]?.[0] === 'pickup_item_context' && sent[0]?.[1].itemKey === 'Bois',
        JSON.stringify(sent[0]));

    Panels.updateGroundItemsPanel({ groundItems: {} });
    check('« Tout ramasser » masqué quand le sol est vide', document.getElementById('pickup-all-btn').hidden);
}

console.log('\n== Coffre : dépôt, prise, rafraîchissement ==');
{
    UI.setupChestModalListeners();
    Modals.showChestModal(gameState);

    const playerRows = [...document.querySelectorAll('#chest-player-inventory .inventory-item')];
    const chestRows = [...document.querySelectorAll('#chest-building-inventory .inventory-item')];
    check('le sac côté coffre propose 📥 déposer',
        playerRows.every(r => !!r.querySelector('[data-quick-action="store"]')));
    check('le contenu du coffre propose ✚ prendre',
        chestRows.length === 1 && !!chestRows[0].querySelector('[data-quick-action="take"]'));

    const takeAllBtn = document.getElementById('chest-take-all-btn');
    check('« Tout prendre » actif (coffre non vide)', takeAllBtn && !takeAllBtn.disabled);
    sent.length = 0;
    takeAllBtn.click();
    check('clic « Tout prendre » → take_all_items', sent[0]?.[0] === 'take_all_items');

    sent.length = 0;
    chestRows[0].querySelector('[data-quick-action="take"]').click();
    check('clic ✚ du coffre → move_item coffre → sac',
        sent[0]?.[0] === 'move_item' && sent[0]?.[1].source.owner === 'building-inventory'
        && sent[0]?.[1].target.owner === 'player-inventory' && sent[0]?.[1].quantity === 7,
        JSON.stringify(sent[0]));

    sent.length = 0;
    playerRows.find(r => r.dataset.itemName === 'Bois').querySelector('[data-quick-action="store"]').click();
    check('clic 📥 du sac → move_item sac → coffre, pile entière (12)',
        sent[0]?.[1].quantity === 12, JSON.stringify(sent[0]));

    // Le coffre se rafraîchit tout seul après un état serveur.
    tile.buildings[0].inventory = { Pierre: 2 };
    player.inventory.Bois = 5;
    Modals.refreshChestModal(gameState);
    const refreshed = [...document.querySelectorAll('#chest-building-inventory .inventory-item')];
    check('refreshChestModal reflète le nouvel état (Pierre, 7 bois partis)',
        refreshed.length === 1 && refreshed[0].dataset.itemName === 'Pierre');
}

console.log('\n== Menu contextuel au clic simple dans les listes ==');
{
    const swordRow = [...document.querySelectorAll('#inventory-categories .inventory-item')]
        .find(r => r.dataset.itemName === 'Épée en bois');
    swordRow.querySelector('[data-quick-action="equip"]').click();
    const menu = document.getElementById('item-context-menu');
    check('un clic sur un bouton ✚ n’ouvre PAS le menu contextuel', menu.classList.contains('hidden'));
    swordRow.click();
    check('un clic sur la ligne ouvre le menu (Équiper, Jeter…)', !menu.classList.contains('hidden'));
    const actions = [...menu.querySelectorAll('button')].map(b => b.textContent);
    check('menu complet pour une épée : Équiper et Jeter au sol',
        actions.includes('Équiper') && actions.includes('Jeter au sol'), actions.join(', '));
}

console.log('');
if (failures > 0) {
    console.error(`${failures} vérification(s) en échec.`);
    process.exit(1);
}
console.log('Interface : les actions rapides sont câblées et lisibles.');
