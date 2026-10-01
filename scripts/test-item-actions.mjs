// Test d'intégration des actions rapides sur les objets.
//
// Le sac gagne des boutons d'action directe (✚ équiper/prendre, ⬇ poser au
// sol, 📥 déposer…) : un clic remplace le menu contextuel et le
// glisser-déposer. Ces raccourcis reposent sur des allers-retours serveur
// courts qu'il faut vérifier pour de vrai :
//
//   1. équiper puis déséquiper un outil usé ne le répare plus ;
//   2. poser au sol puis ramasser conserve l'instance (durabilité) ;
//   3. déposer/reprendre dans un coffre marche pour les piles ET les objets
//      uniques, et signale un coffre plein ;
//   4. « Tout ramasser » et « Tout prendre » vident sol et coffre ;
//   5. côté client, chaque liste rend bien les boutons attendus et le clic
//      construit le bon message serveur (clé, propriétaire, quantité).
//
// Usage : node scripts/test-item-actions.mjs

let failures = 0;
function check(name, condition, detail = '') {
    if (condition) console.log(`  ok  ${name}`);
    else { failures += 1; console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

/* ------------------------------------------------------------------ */
/* 1. Comportement serveur : les vraies fonctions de server/player.js  */
/* ------------------------------------------------------------------ */

const { CONFIG } = await import('../server/config.js');
const State = await import('../server/state.js');
const Player = await import('../server/player.js');

State.initializeGameState(CONFIG);
State.addNewPlayer('p1', 'Testeur');
const player = State.gameState.players.p1;

console.log('\n== Équiper / déséquiper : l' + 'usure est conservée ==');
{
    // Le joueur démarre avec une Hache (durabilité 50/50) : on l'use à 12.
    const hacheKey = Object.keys(player.inventory).find(k => typeof player.inventory[k] === 'object' && player.inventory[k].name === 'Hache');
    check('hache de départ présente', !!hacheKey);
    player.inventory[hacheKey].currentDurability = 12;

    Player.equipItem(player, hacheKey);
    check('la hache équipée garde son usure (12/50)',
        player.equipment.weapon?.currentDurability === 12,
        `obtenu ${player.equipment.weapon?.currentDurability}`);

    Player.unequipItem(player, 'weapon');
    const backKey = Object.keys(player.inventory).find(k => typeof player.inventory[k] === 'object' && player.inventory[k].name === 'Hache');
    check('déséquipée : toujours 12/50 dans le sac (avant : remise à neuf)',
        backKey && player.inventory[backKey].currentDurability === 12,
        `obtenu ${player.inventory[backKey]?.currentDurability}`);
}

console.log('\n== Poser au sol / ramasser : piles et objets uniques ==');
{
    const tile = State.gameState.map[player.y][player.x];
    // Même format de stockage que addItemToInventory : pile et instance.
    player.inventory.Bois = 7;

    Player.dropItem(player, 'Bois', 7);
    check('pile entière posée au sol', tile.groundItems.Bois === 7, `obtenu ${tile.groundItems.Bois}`);
    check('le sac ne contient plus de bois', player.inventory.Bois === undefined);

    Player.pickupItem(player, 'Bois', 3);
    check('ramassage partiel : 3 bois repris', player.inventory.Bois === 3, `obtenu ${player.inventory.Bois}`);
    check('le sol garde le reste (4)', tile.groundItems.Bois === 4, `obtenu ${tile.groundItems.Bois}`);

    Player.pickupItem(player, 'Bois', 99);
    check('ramassage borné au disponible', player.inventory.Bois === 7, `obtenu ${player.inventory.Bois}`);
    check('sol vidé de la pile', tile.groundItems.Bois === undefined);

    // Objet unique : l'instance entière part au sol et revient à l'identique.
    const swordKey = 'Épée en bois_test_1';
    player.inventory[swordKey] = { name: 'Épée en bois', durability: 10, currentDurability: 10 };
    player.inventory[swordKey].currentDurability = 4;
    Player.dropItem(player, swordKey, 1);
    const groundSwordKey = Object.keys(tile.groundItems).find(k => tile.groundItems[k]?.name === 'Épée en bois');
    check("l'épée posée est une instance (pas un compteur)",
        !!groundSwordKey && typeof tile.groundItems[groundSwordKey] === 'object');
    check("son usure a suivi au sol (4)", tile.groundItems[groundSwordKey]?.currentDurability === 4);
    Player.pickupItem(player, groundSwordKey, 1);
    const backSwordKey = Object.keys(player.inventory).find(k => player.inventory[k]?.name === 'Épée en bois');
    check("ramassée : toujours usée (4/…), pas réparée",
        player.inventory[backSwordKey]?.currentDurability === 4,
        `obtenu ${player.inventory[backSwordKey]?.currentDurability}`);
}

console.log('\n== Coffre : dépôt, reprise, objets uniques, coffre plein ==');
{
    const tile = State.gameState.map[player.y][player.x];
    // Un coffre de capacité 2 sur la case courante. Le serveur lit les
    // définitions dans public/js/config.js (source partagée) : on y réduit
    // la capacité d'un vrai bâtiment pour l'exercice.
    const { TILE_TYPES } = await import('../public/js/config.js');
    const realMax = TILE_TYPES.SHELTER_INDIVIDUAL.maxInventory;
    TILE_TYPES.SHELTER_INDIVIDUAL.maxInventory = 2;
    tile.buildings = [{ key: 'SHELTER_INDIVIDUAL', inventory: {}, durability: 100, maxDurability: 100, ownerId: 'p1' }];
    const chest = tile.buildings[0];

    Player.moveItem(player, { itemKey: 'Bois', itemName: 'Bois', quantity: 5,
        source: { owner: 'player-inventory', slot: null }, target: { owner: 'building-inventory', slot: null } });
    check('5 bois déposés dans le coffre', chest.inventory.Bois === 5, `obtenu ${chest.inventory.Bois}`);
    check('le sac garde le reste de la pile (2)', player.inventory.Bois === 2, `obtenu ${player.inventory.Bois}`);

    // Le propriétaire 'shared' (ancienne modale « Stockage Commun ») désigne
    // le même coffre : le reste des bois y part aussi.
    Player.moveItem(player, { itemKey: 'Bois', itemName: 'Bois', quantity: 2,
        source: { owner: 'player-inventory', slot: null }, target: { owner: 'shared', slot: null } });
    check("déposer vers 'shared' aboutit au coffre", chest.inventory.Bois === 7, `obtenu ${chest.inventory.Bois}`);

    // Objet unique : l'instance est déposée telle quelle et revient telle quelle.
    const swordKey = Object.keys(player.inventory).find(k => player.inventory[k]?.name === 'Épée en bois');
    Player.moveItem(player, { itemKey: swordKey, itemName: 'Épée en bois', quantity: 1,
        source: { owner: 'player-inventory', slot: null }, target: { owner: 'building-inventory', slot: null } });
    check("l'épée déposée reste une instance dans le coffre", typeof chest.inventory[swordKey] === 'object');
    check("l'épée dans le coffre garde 4 de durabilité", chest.inventory[swordKey]?.currentDurability === 4);
    check('coffre plein (2 entrées) détecté', Object.keys(chest.inventory).length === 2);

    player.notifications = [];
    Player.moveItem(player, { itemKey: 'Eau pure', itemName: 'Eau pure', quantity: 1,
        source: { owner: 'player-inventory', slot: null }, target: { owner: 'building-inventory', slot: null } });
    check('coffre plein : message au joueur, dépôt refusé',
        player.notifications.some(n => /plein/.test(n.message)) && chest.inventory['Eau pure'] === undefined);

    Player.moveItem(player, { itemKey: swordKey, itemName: 'Épée en bois', quantity: 1,
        source: { owner: 'building-inventory', slot: null }, target: { owner: 'player-inventory', slot: null } });
    check("l'épée reprise du coffre conserve 4 de durabilité",
        player.inventory[swordKey]?.currentDurability === 4,
        `obtenu ${player.inventory[swordKey]?.currentDurability}`);

    // « Tout prendre » vide le coffre d'un coup.
    Player.takeAllItems(player);
    check('« Tout prendre » vide le coffre', Object.keys(chest.inventory).length === 0);
    check('…et remet les 7 bois dans le sac', player.inventory.Bois === 7, `obtenu ${player.inventory.Bois}`);

    TILE_TYPES.SHELTER_INDIVIDUAL.maxInventory = realMax;
}

console.log('\n== « Tout ramasser » ==');
{
    const tile = State.gameState.map[player.y][player.x];
    delete tile.groundItems.Bois; // repartir propre pour la pile déjà ramassée
    tile.groundItems['Pierre'] = 4;
    tile.groundItems['Sel'] = 2;
    Player.pickupAllItems(player);
    check('le sol est vidé', Object.keys(tile.groundItems).length === 0,
        `restant : ${Object.keys(tile.groundItems).join(', ')}`);
    check('4 pierres dans le sac', player.inventory.Pierre === 4, `obtenu ${player.inventory.Pierre}`);
    check('2 sels dans le sac', player.inventory.Sel === 2, `obtenu ${player.inventory.Sel}`);

    player.notifications = [];
    Player.pickupAllItems(player);
    check('rien à ramasser : message d' + 'avertissement, pas de gain',
        player.notifications.some(n => /rien à ramasser/.test(n.message)));
}

/* ------------------------------------------------------------------ */
/* 2. Rendu client : boutons attendus et messages construits          */
/* ------------------------------------------------------------------ */

// Mini-DOM juste assez riche pour charger la chaîne de modules client.
const elements = new Map();
function makeElement(id) {
    const el = {
        id, style: {}, dataset: {}, listeners: {},
        classList: {
            _set: new Set(),
            add(...c) { c.forEach(x => this._set.add(x)); },
            remove(...c) { c.forEach(x => this._set.delete(x)); },
            toggle(c, f) { const on = f === undefined ? !this._set.has(c) : f; on ? this._set.add(c) : this._set.delete(c); return on; },
            contains(c) { return this._set.has(c); },
        },
        addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
        removeEventListener() {},
        appendChild() {}, insertAdjacentHTML() {},
        querySelector: () => null, querySelectorAll: () => [],
        closest: () => null,
        getContext() { const noop = () => {}; return { canvas: el, save: noop, restore: noop, clearRect: noop, fillRect: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, fill: noop, stroke: noop, drawImage: noop, fillText: noop, measureText: () => ({ width: 10 }), setTransform: noop, createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }), imageSmoothingEnabled: true }; },
        innerHTML: '', textContent: '', scrollTop: 0,
        get clientWidth() { return 100; }, get clientHeight() { return 100; },
    };
    return el;
}
globalThis.document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, makeElement(id)); return elements.get(id); },
    querySelector: () => null, querySelectorAll: () => [],
    createElement: (tag) => makeElement(`<${tag}>`),
    addEventListener: () => {},
    documentElement: { dataset: {}, style: { setProperty() {} } },
    body: makeElement('body'),
    hidden: false,
};
globalThis.window = {
    location: { href: '' },
    matchMedia: () => ({ matches: false, media: '', addEventListener() {}, removeEventListener() {} }),
    addEventListener() {}, removeEventListener() {},
    requestAnimationFrame: (fn) => setTimeout(() => fn(performance.now()), 0),
    performance: globalThis.performance,
    gameState: {},
};
globalThis.requestAnimationFrame = globalThis.window.requestAnimationFrame;

const ItemActions = await import('../public/js/ui/item-actions.js');

console.log('\n== Boutons rendus selon la liste ==');
{
    check('Hache reconnue équipable', ItemActions.isEquippableItem('Hache'));
    check('Bois reconnu non équipable', !ItemActions.isEquippableItem('Bois'));
    check('Viande cuite reconnue utilisable', ItemActions.isUsableItem('Viande cuite'));
    check('Bois reconnu non utilisable', !ItemActions.isUsableItem('Bois'));

    const sac = ItemActions.itemActionsHTML({ owner: 'player-inventory', itemName: 'Hache', context: 'panel' });
    check('sac + hache → bouton équiper (✚)', /data-quick-action="equip"/.test(sac));
    check('sac + hache → bouton poser au sol (⬇)', /data-quick-action="drop"/.test(sac));

    const food = ItemActions.itemActionsHTML({ owner: 'player-inventory', itemName: 'Viande cuite', context: 'panel' });
    check('sac + viande → bouton utiliser (🍽)', /data-quick-action="use"/.test(food));
    check('sac + viande → bouton poser au sol', /data-quick-action="drop"/.test(food));

    const res = ItemActions.itemActionsHTML({ owner: 'player-inventory', itemName: 'Bois', context: 'panel' });
    check('sac + bois → pas de bouton ✚ (aucune action)', !/data-quick-action="(equip|use)"/.test(res));
    check('sac + bois → bouton poser au sol', /data-quick-action="drop"/.test(res));

    const devantCoffre = ItemActions.itemActionsHTML({ owner: 'player-inventory', itemName: 'Bois', context: 'storage' });
    check('devant un coffre → bouton déposer (📥)', /data-quick-action="store"/.test(devantCoffre));
    check('devant un coffre → pas de bouton équiper', !/data-quick-action="equip"/.test(devantCoffre));

    const dansCoffre = ItemActions.itemActionsHTML({ owner: 'building-inventory', itemName: 'Bois' });
    check('objet du coffre → bouton prendre (✚)', /data-quick-action="take"/.test(dansCoffre));

    const sol = ItemActions.itemActionsHTML({ owner: 'ground', itemName: 'Bois' });
    check('objet au sol → bouton ramasser (✚)', /data-quick-action="pickup"/.test(sol));

    const equipe = ItemActions.itemActionsHTML({ owner: 'equipment', itemName: 'Hache' });
    check('objet équipé → aucun bouton dans la ligne', equipe === '');

    check('le bouton équiper porte un libellé accessible',
        /aria-label="Équiper Hache"/.test(sac), sac);
}

console.log('\n== Clic : le bon message part vers le serveur ==');
{
    const sent = [];
    globalThis.window.handleGlobalPlayerAction = (actionId, data) => sent.push([actionId, data]);

    const row = makeElement('row');
    Object.assign(row.dataset, { itemKey: 'cle-1', itemName: 'Hache', itemCount: '3', owner: 'player-inventory' });
    const button = makeElement('btn');
    button.dataset.quickAction = 'equip';
    button.closest = (sel) => (sel === '.inventory-item' ? row : null);

    sent.length = 0;
    ItemActions.runQuickAction(button, {});
    check('✚ équiper → equip_item_context avec la clé', sent[0]?.[0] === 'equip_item_context' && sent[0]?.[1].itemKey === 'cle-1',
        JSON.stringify(sent[0]));

    button.dataset.quickAction = 'drop';
    sent.length = 0;
    ItemActions.runQuickAction(button, {});
    check('⬇ poser au sol (clic) → toute la pile (3)', sent[0]?.[1].quantity === 3, JSON.stringify(sent[0]));
    sent.length = 0;
    ItemActions.runQuickAction(button, { shiftKey: true });
    check('⬇ poser au sol (Maj+clic) → un seul', sent[0]?.[1].quantity === 1, JSON.stringify(sent[0]));

    button.dataset.quickAction = 'pickup';
    Object.assign(row.dataset, { itemKey: 'Hache_123', itemName: 'Hache', itemCount: '1', owner: 'ground' });
    sent.length = 0;
    ItemActions.runQuickAction(button, {});
    check('✚ ramasser → pickup avec la clé du sol (instance)', sent[0]?.[0] === 'pickup_item_context' && sent[0]?.[1].itemKey === 'Hache_123',
        JSON.stringify(sent[0]));

    button.dataset.quickAction = 'store';
    Object.assign(row.dataset, { itemKey: 'Bois', itemName: 'Bois', itemCount: '9', owner: 'player-inventory' });
    sent.length = 0;
    ItemActions.runQuickAction(button, {});
    check('📥 déposer → move_item vers building-inventory, pile entière',
        sent[0]?.[0] === 'move_item' && sent[0]?.[1].target.owner === 'building-inventory' && sent[0]?.[1].quantity === 9,
        JSON.stringify(sent[0]));

    button.dataset.quickAction = 'take';
    Object.assign(row.dataset, { itemKey: 'Bois', itemName: 'Bois', itemCount: '9', owner: 'building-inventory' });
    sent.length = 0;
    ItemActions.runQuickAction(button, { shiftKey: true });
    check('✚ prendre (Maj+clic) → move_item vers le sac, un seul',
        sent[0]?.[1].source.owner === 'building-inventory' && sent[0]?.[1].target.owner === 'player-inventory' && sent[0]?.[1].quantity === 1,
        JSON.stringify(sent[0]));

    const unequipBtn = makeElement('unequip');
    unequipBtn.dataset.quickAction = 'unequip';
    unequipBtn.dataset.slotType = 'weapon';
    unequipBtn.closest = () => null;
    sent.length = 0;
    ItemActions.runQuickAction(unequipBtn, {});
    check("× déséquiper → unequip_item_context avec l'emplacement",
        sent[0]?.[0] === 'unequip_item_context' && sent[0]?.[1].slot === 'weapon',
        JSON.stringify(sent[0]));
}

console.log('');
if (failures > 0) {
    console.error(`${failures} vérification(s) en échec.`);
    process.exit(1);
}
console.log('Actions rapides : cohérentes du clic au serveur.');
