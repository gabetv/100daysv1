// server/player.js

import { gameState, endCombat } from './state.js';
import { ITEM_TYPES, CONFIG, TILE_TYPES, SEARCH_ZONE_CONFIG, TREASURE_COMBAT_KIT, ACTIONS, ACTION_COST_CONFIG } from '../public/js/config.js';

// --- UTILITIES ---

/**
 * Adds an item to the player's inventory.
 * @param {object} player The player object.
 * @param {string} itemName The name of the item to add.
 * @param {number} quantity The amount to add.
 * @returns {boolean} True if the item was added, false otherwise.
 */
function addItemToInventory(player, itemName, quantity) {
    const itemDef = ITEM_TYPES[itemName];
    if (!itemDef) return false;

    // For unique items (like tools, weapons), create an instance
    if (itemDef.type === 'tool' || itemDef.type === 'weapon' || itemDef.slot) {
        for (let i = 0; i < quantity; i++) {
            const newKey = `${itemName}_${Date.now()}_${Math.random()}`;
            const itemInstance = {
                name: itemName,
                durability: itemDef.durability,
                currentDurability: itemDef.durability,
            };
            player.inventory[newKey] = itemInstance;
        }
    } else { // For stackable items
        player.inventory[itemName] = (player.inventory[itemName] || 0) + quantity;
    }
    return true;
}

/**
 * Removes an item from the player's inventory.
 * @param {object} player The player object.
 * @param {string} itemKey The key of the item in the inventory.
 * @param {number} quantity The amount to remove.
 * @returns {boolean} True if the item was removed, false otherwise.
 */
function removeItemFromInventory(player, itemKey, quantity = 1) {
    const item = player.inventory[itemKey];
    if (!item) return false;

    if (typeof item === 'number') { // Stackable item
        if (item < quantity) return false;
        player.inventory[itemKey] -= quantity;
        if (player.inventory[itemKey] <= 0) {
            delete player.inventory[itemKey];
        }
    } else { // Unique instance
        delete player.inventory[itemKey];
    }
    return true;
}


// --- CORE ACTIONS (Existing + Refactored) ---

export function movePlayer(player, direction) {
    let { x, y } = player;
    const oldX = x;
    const oldY = y;

    switch (direction) {
        case 'north': y--; break;
        case 'south': y++; break;
        case 'west':  x--; break;
        case 'east':  x++; break;
        case 'nw': x--; y--; break;
        case 'ne': x++; y--; break;
        case 'sw': x--; y++; break;
        case 'se': x++; y++; break;
        default: return;
    }

    if (x < 0 || x >= CONFIG.MAP_WIDTH || y < 0 || y >= CONFIG.MAP_HEIGHT) {
        return;
    }

    const targetTile = gameState.map[y]?.[x];
    if (!targetTile || !targetTile.type.accessible) {
        player.notifications.push({ type: 'floatingText', message: 'Chemin bloqué', style: 'info' });
        return;
    }

    player.x = x;
    player.y = y;
    player.visitedTiles.add(`${x},${y}`);
    console.log(`Player ${player.id} moved from (${oldX},${oldY}) to (${x},${y})`);
}

export function equipItem(player, itemKey) {
    const itemToEquip = player.inventory[itemKey];
    if (!itemToEquip) return;
    
    const itemName = typeof itemToEquip === 'object' ? itemToEquip.name : itemKey;
    const itemDef = ITEM_TYPES[itemName];
    if (!itemDef || !itemDef.slot) return;

    if (player.equipment[itemDef.slot]) {
        unequipItem(player, itemDef.slot);
    }

    player.equipment[itemDef.slot] = itemToEquip;
    removeItemFromInventory(player, itemKey);

    player.notifications.push({ type: 'chat', message: `Vous avez équipé : ${itemName}.`, style: 'gain' });
}

export function unequipItem(player, slot) {
    const equippedItem = player.equipment[slot];
    if (!equippedItem) return;

    const itemName = equippedItem.name;
    addItemToInventory(player, itemName, 1);
    player.equipment[slot] = null;
    player.notifications.push({ type: 'chat', message: `Vous avez déséquipé : ${itemName}.`, style: 'cost' });
}

export function dropItem(player, itemKey, quantity = 1) {
    const item = player.inventory[itemKey];
    if (!item) return;

    const itemName = typeof item === 'object' ? item.name : itemKey;
    const tile = gameState.map[player.y][player.x];
    if (!tile.groundItems) tile.groundItems = {};

    const amountToDrop = (typeof item === 'number') ? Math.min(quantity, item) : 1;

    if (removeItemFromInventory(player, itemKey, amountToDrop)) {
        tile.groundItems[itemName] = (tile.groundItems[itemName] || 0) + amountToDrop;
        player.notifications.push({ type: 'chat', message: `Vous avez jeté ${amountToDrop} ${itemName} au sol.`, style: 'system_info' });
    } else {
        player.notifications.push({ type: 'chat', message: `Impossible de jeter l'objet.`, style: 'system_error' });
    }
}

export function pickupItem(player, itemName, quantity = 1) {
    const tile = gameState.map[player.y][player.x];
    if (!tile.groundItems || !tile.groundItems[itemName]) return;
    
    const amountToPickup = Math.min(quantity, tile.groundItems[itemName]);

    if (addItemToInventory(player, itemName, amountToPickup)) {
        tile.groundItems[itemName] -= amountToPickup;
        if (tile.groundItems[itemName] <= 0) delete tile.groundItems[itemName];
        player.notifications.push({ type: 'chat', message: `Vous avez ramassé ${amountToPickup} ${itemName}.`, style: 'gain' });
    } else {
        player.notifications.push({ type: 'chat', message: `Inventaire plein ou erreur.`, style: 'system_error' });
    }
}

// --- NEWLY IMPLEMENTED ACTIONS ---

export function consumeItem(player, itemKey) {
    const item = player.inventory[itemKey];
    if (!item) return;

    const itemName = typeof item === 'object' ? item.name : itemKey;
    const itemDef = ITEM_TYPES[itemName];
    if (!itemDef || (itemDef.type !== 'consumable' && !itemDef.teachesRecipe)) {
        player.notifications.push({ type: 'chat', message: "Cet objet n'est pas consommable.", style: 'system_warning' });
        return;
    }

    if (removeItemFromInventory(player, itemKey)) {
        if (itemDef.effects) {
            // Apply direct stat effects
            if(itemDef.effects.health) player.health = Math.min(player.maxHealth, player.health + itemDef.effects.health);
            if(itemDef.effects.thirst) player.thirst = Math.min(player.maxThirst, player.thirst + itemDef.effects.thirst);
            if(itemDef.effects.hunger) player.hunger = Math.min(player.maxHunger, player.hunger + itemDef.effects.hunger);
            if(itemDef.effects.sleep) player.sleep = Math.min(player.maxSleep, player.sleep + itemDef.effects.sleep);
            
            // Appliquer les effets de statut
            if (itemDef.effects.status) {
                itemDef.effects.status.forEach(statusEffect => {
                    if (Math.random() < statusEffect.chance) {
                        // Si le statut n'est pas déjà actif, ou si la nouvelle durée est plus longue
                        if (!player.status[statusEffect.name] || player.status[statusEffect.name].duration < statusEffect.duration) {
                            player.status[statusEffect.name] = { duration: statusEffect.duration };
                            player.notifications.push({ type: 'chat', message: `Vous vous sentez maintenant : ${statusEffect.name}.`, style: 'damage' });
                        }
                    }
                });
            }

            // Gérer les objets qui soignent les statuts
            if (itemDef.effects.ifStatus && itemDef.effects.status === 'normale') {
                const statusesToCure = Array.isArray(itemDef.effects.ifStatus) ? itemDef.effects.ifStatus : [itemDef.effects.ifStatus];
                statusesToCure.forEach(statusName => {
                    if (player.status[statusName]) {
                        delete player.status[statusName];
                        player.notifications.push({ type: 'chat', message: `Vous ne vous sentez plus : ${statusName}.`, style: 'gain' });
                    }
                });
            }
        }
        if (itemDef.teachesRecipe) {
            player.knownRecipes[itemDef.teachesRecipe] = true;
            gameState.knownRecipes[itemDef.teachesRecipe] = true; // Also make it known globally
            player.notifications.push({ type: 'floatingText', message: `Nouvelle recette apprise : ${itemDef.teachesRecipe}!`, style: 'gain' });
        }
        player.notifications.push({ type: 'chat', message: `Vous avez utilisé : ${itemName}.`, style: 'system_info' });
    }
}

export function harvestResource(player, action) {
    console.log(`[SERVER] Entering harvestResource for player ${player.id} with action ${action}`); // DEBUG
    const tile = gameState.map[player.y][player.x];
    let resourceName = '';
    let amount = 1;

    switch(action) {
        case 'harvest_wood_mains':
        case 'harvest_wood_hache':
        case 'harvest_wood_scie':
            if (tile.type.name !== 'Forêt' || tile.woodActionsLeft <= 0) {
                player.notifications.push({ type: 'chat', message: "Il n'y a plus de bois à récolter ici.", style: 'system_warning' });
                return;
            }
            tile.woodActionsLeft--;
            resourceName = 'Bois';
            
            // Vérifier l'outil équipé pour ajuster la quantité
            const equippedWeapon = player.equipment.weapon;
            if (equippedWeapon && equippedWeapon.name === 'Hache') {
                amount = ITEM_TYPES['Hache'].power || 5; // Utilise la puissance de la hache
            } else {
                amount = 1; // Récolte à mains nues
            }
            break;
        case 'harvest': // Pierre
             if (tile.type.name !== 'Mine (Terrain)' || tile.harvests <= 0) {
                player.notifications.push({ type: 'chat', message: "Il n'y a plus de pierre à récolter ici.", style: 'system_warning' });
                return;
            }
            tile.harvests--;
            resourceName = 'Pierre';
            break;
        case 'harvest_sand':
            resourceName = 'Sable';
            break;
        case 'harvest_salt_water':
            resourceName = 'Eau salée';
            break;
        default:
            player.notifications.push({ type: 'chat', message: `Action de récolte inconnue: ${action}`, style: 'system_error' });
            return;
    }

    if (resourceName) {
        addItemToInventory(player, resourceName, amount);
        player.notifications.push({ type: 'floatingText', message: `+${amount} ${resourceName}`, style: 'gain' });
    }
}

export function buildStructure(player, structureKey) {
    const tile = gameState.map[player.y][player.x];
    const buildingType = TILE_TYPES[structureKey];

    if (!buildingType || !buildingType.isBuilding || !tile.type.buildable) {
        player.notifications.push({ type: 'chat', message: "Impossible de construire ici.", style: 'system_error' });
        return;
    }
    if (tile.buildings.length >= CONFIG.MAX_BUILDINGS_PER_TILE) {
        player.notifications.push({ type: 'chat', message: "Il y a déjà une construction sur cette case.", style: 'system_warning' });
        return;
    }

    // Check costs
    const costs = buildingType.cost;
    for (const resource in costs) {
        if (resource === 'toolRequired') continue;
        if ((player.inventory[resource] || 0) < costs[resource]) {
            player.notifications.push({ type: 'chat', message: `Ressources manquantes : ${resource}.`, style: 'system_error' });
            return;
        }
    }
    // TODO: Check for required tool

    // Deduct costs
    for (const resource in costs) {
        if (resource === 'toolRequired') continue;
        removeItemFromInventory(player, resource, costs[resource]);
    }

    // Add building to tile
    const newBuilding = {
        key: structureKey,
        ownerId: player.id,
        durability: buildingType.durability,
        maxDurability: buildingType.durability,
        inventory: buildingType.maxInventory ? {} : undefined,
        isLocked: false,
        lockCode: null,
    };
    tile.buildings.push(newBuilding);
    player.notifications.push({ type: 'chat', message: `Vous avez construit : ${buildingType.name}.`, style: 'gain' });
}

export function craftItem(player, recipeName, costs, quantity) {
    // Check resources
    for (const resource in costs) {
        if ((player.inventory[resource] || 0) < costs[resource] * quantity) {
            player.notifications.push({ type: 'chat', message: `Ressources manquantes pour fabriquer ${quantity} ${recipeName}.`, style: 'system_error' });
            return;
        }
    }
    // Deduct resources
    for (const resource in costs) {
        removeItemFromInventory(player, resource, costs[resource] * quantity);
    }
    // Add crafted item
    addItemToInventory(player, recipeName, quantity);
    player.notifications.push({ type: 'floatingText', message: `Fabriqué : +${quantity} ${recipeName}`, style: 'gain' });
}

export function searchZone(player) {
    const tile = gameState.map[player.y][player.x];
    const zoneConfig = SEARCH_ZONE_CONFIG[tile.key]; // Utilise la clé de la tuile (ex: 'FOREST')
    if (!zoneConfig) return;

    if (tile.searchActionsLeft !== undefined && tile.searchActionsLeft <= 0) {
        player.notifications.push({ type: 'chat', message: "Il n'y a plus rien à trouver ici.", style: 'system_warning' });
        return;
    }

    if (tile.searchActionsLeft !== undefined) {
        tile.searchActionsLeft--;
    }

    // Objet caché sur cette case (ex : la Clé du Trésor) — 35% de chance de le dénicher
    if (tile.hiddenItem && Math.random() < 0.35) {
        const found = tile.hiddenItem;
        delete tile.hiddenItem;
        addItemToInventory(player, found, 1);
        player.notifications.push({ type: 'chat', message: `✨ Incroyable ! En fouillant, vous avez déniché : ${found} !`, style: 'gain' });
        player.notifications.push({ type: 'floatingText', message: `+1 ${found}`, style: 'gain' });
        return;
    }

    // Rien trouvé cette fois ?
    if (Math.random() < (zoneConfig.noLootChance || 0.2)) {
        player.notifications.push({ type: 'chat', message: "Vous n'avez rien trouvé d'intéressant.", style: 'system_info' });
        return;
    }

    // Tirage du palier de rareté (common / uncommon / rare / veryRare / offTable)
    const tiers = zoneConfig.lootTiers || { common: 1 };
    const roll = Math.random();
    let cumulative = 0;
    let chosenTier = 'common';
    for (const [tier, weight] of Object.entries(tiers)) {
        cumulative += weight;
        if (roll <= cumulative) { chosenTier = tier; break; }
    }

    let lootTable = zoneConfig.specificLoot[chosenTier];
    if (!lootTable || lootTable.length === 0) lootTable = zoneConfig.specificLoot.common;

    if (lootTable && lootTable.length > 0) {
        const foundItem = lootTable[Math.floor(Math.random() * lootTable.length)];
        addItemToInventory(player, foundItem, 1);
        const rarityLabel = { rare: ' (rare !)', veryRare: ' (très rare !)', offTable: ' (exceptionnel !!)' }[chosenTier] || '';
        player.notifications.push({ type: 'chat', message: `En fouillant, vous avez trouvé : ${foundItem}${rarityLabel}.`, style: chosenTier === 'common' ? 'system_info' : 'gain' });
        player.notifications.push({ type: 'floatingText', message: `+1 ${foundItem}`, style: 'gain' });
    } else {
        player.notifications.push({ type: 'chat', message: "Vous n'avez rien trouvé d'intéressant.", style: 'system_info' });
    }
}

/**
 * Ramasse l'objet caché de la case (utilisé par le tutoriel / actions directes).
 */
export function takeHiddenItem(player) {
    const tile = gameState.map[player.y][player.x];
    if (!tile.hiddenItem) {
        player.notifications.push({ type: 'chat', message: "Il n'y a rien de caché ici... ou vous ne l'avez pas encore trouvé.", style: 'system_info' });
        return;
    }
    const found = tile.hiddenItem;
    delete tile.hiddenItem;
    addItemToInventory(player, found, 1);
    player.notifications.push({ type: 'chat', message: `Vous récupérez : ${found} !`, style: 'gain' });
}

/**
 * Cherche du minerai sur un terrain de mine ou via un bâtiment de mine.
 */
export function searchOreTile(player, actionId) {
    const tile = gameState.map[player.y][player.x];

    // Trouver la table de résultats : action du terrain ou d'un bâtiment
    let results = null;
    if (tile.type.action && tile.type.action.id === actionId) {
        results = tile.type.action.results;
    } else {
        for (const building of (tile.buildings || [])) {
            const def = TILE_TYPES[building.key];
            if (def?.action?.id === actionId) { results = def.action.results; break; }
        }
    }

    if (!results) {
        player.notifications.push({ type: 'chat', message: "Impossible de chercher du minerai ici.", style: 'system_warning' });
        return;
    }

    // Tirage : chaque minerai a sa propre chance, on prend le premier obtenu (du plus rare au plus commun)
    const sorted = [...results].sort((a, b) => a.chance - b.chance);
    let found = null;
    for (const entry of sorted) {
        if (Math.random() < entry.chance) { found = entry.item; break; }
    }

    if (found) {
        addItemToInventory(player, found, 1);
        player.notifications.push({ type: 'floatingText', message: `+1 ${found}`, style: 'gain' });
        player.notifications.push({ type: 'chat', message: `⛏️ Vous avez extrait : ${found} !`, style: 'gain' });
    } else {
        player.notifications.push({ type: 'chat', message: "Vous creusez... mais ne trouvez que de la roche sans valeur.", style: 'system_info' });
    }
}

/**
 * Plante une graine d'arbre : transforme la case (Plaine/Friche) en Forêt.
 */
export function plantTree(player) {
    const tile = gameState.map[player.y][player.x];
    if (!['PLAINS', 'WASTELAND'].includes(tile.key)) {
        player.notifications.push({ type: 'chat', message: "Vous ne pouvez planter d'arbre que sur une plaine ou une friche.", style: 'system_warning' });
        return;
    }
    if ((player.inventory["Graine d'arbre"] || 0) < 1) {
        player.notifications.push({ type: 'chat', message: "Il vous faut une Graine d'arbre.", style: 'system_warning' });
        return;
    }
    removeItemFromInventory(player, "Graine d'arbre", 1);
    convertTileToForest(tile);
    player.notifications.push({ type: 'chat', message: "🌱 Vous plantez une graine... et une jeune forêt s'épanouit !", style: 'gain' });
}

/**
 * Régénère une friche en forêt (coût : 5 Eau pure + 10 Graines d'arbre).
 */
export function regenerateForest(player) {
    const tile = gameState.map[player.y][player.x];
    if (tile.key !== 'WASTELAND') {
        player.notifications.push({ type: 'chat', message: "Seule une friche peut être régénérée.", style: 'system_warning' });
        return;
    }
    const cost = TILE_TYPES.WASTELAND.regeneration?.cost || { 'Eau pure': 5, "Graine d'arbre": 10 };
    for (const item in cost) {
        if ((player.inventory[item] || 0) < cost[item]) {
            player.notifications.push({ type: 'chat', message: `Ressources manquantes : ${cost[item]} ${item}.`, style: 'system_error' });
            return;
        }
    }
    for (const item in cost) removeItemFromInventory(player, item, cost[item]);
    convertTileToForest(tile);
    player.notifications.push({ type: 'chat', message: "🌳 La friche reprend vie et devient une forêt luxuriante !", style: 'gain' });
}

function convertTileToForest(tile) {
    const forestType = TILE_TYPES.FOREST;
    tile.type = forestType;
    tile.key = 'FOREST';
    tile.backgroundKey = forestType.background[Math.floor(Math.random() * forestType.background.length)];
    tile.woodActionsLeft = forestType.woodActionsLeft;
    tile.huntActionsLeft = forestType.huntActionsLeft;
    tile.searchActionsLeft = forestType.searchActionsLeft;
}

/**
 * Sieste près du feu de camp : petit regain de sommeil et de vie.
 */
export function sleepByCampfire(player) {
    const tile = gameState.map[player.y][player.x];
    const campfire = tile.buildings.find(b => b.key === 'CAMPFIRE' && b.durability > 0);
    if (!campfire) {
        player.notifications.push({ type: 'chat', message: "Il n'y a pas de feu de camp allumé ici.", style: 'system_warning' });
        return;
    }
    player.sleep = Math.min(player.maxSleep, player.sleep + 8);
    player.health = Math.min(player.maxHealth, player.health + 2);
    campfire.durability--;
    player.notifications.push({ type: 'chat', message: "🔥 Vous somnolez près du feu... (+8 Sommeil, +2 Santé)", style: 'gain' });
    if (campfire.durability <= 0) {
        tile.buildings = tile.buildings.filter(b => b !== campfire);
        player.notifications.push({ type: 'chat', message: "Le feu de camp s'est éteint.", style: 'damage' });
    }
}

/**
 * Action générique d'un bâtiment (cuisiner, bouillir, puiser de l'eau, récolter une plantation...).
 * Gère costItem / costWood / costAmount et le résultat défini dans la config du bâtiment.
 */
export function useBuildingAction(player, actionId) {
    const tile = gameState.map[player.y][player.x];

    for (const building of (tile.buildings || [])) {
        const def = TILE_TYPES[building.key];
        if (!def) continue;
        const actionsList = Array.isArray(def.actions) ? def.actions : (def.action ? [def.action] : []);
        const act = actionsList.find(a => a && a.id === actionId);
        if (!act) continue;

        // Cas particuliers délégués
        if (actionId === 'sleep_by_campfire') { sleepByCampfire(player); return true; }

        // Vérifier les coûts
        const costs = {};
        if (act.costItem) costs[act.costItem] = act.costAmount || 1;
        if (act.costWood) costs['Bois'] = (costs['Bois'] || 0) + act.costWood;
        for (const item in costs) {
            if ((player.inventory[item] || 0) < costs[item]) {
                player.notifications.push({ type: 'chat', message: `Il vous manque : ${costs[item]} ${item}.`, style: 'system_warning' });
                return true;
            }
        }
        for (const item in costs) removeItemFromInventory(player, item, costs[item]);

        // Donner le résultat
        if (act.result) {
            for (const item in act.result) {
                addItemToInventory(player, item, act.result[item]);
                player.notifications.push({ type: 'floatingText', message: `+${act.result[item]} ${item}`, style: 'gain' });
            }
        }

        // User le bâtiment
        building.durability--;
        if (building.durability <= 0) {
            tile.buildings = tile.buildings.filter(b => b !== building);
            player.notifications.push({ type: 'chat', message: `${def.name} est hors d'usage et s'effondre.`, style: 'damage' });
        }
        return true;
    }

    return false; // Aucun bâtiment ne propose cette action ici
}

/**
 * Tire une fusée / un pistolet de détresse : si les secours voient le signal, c'est GAGNÉ.
 * Doit être utilisé depuis une plage pour être visible du large.
 */
export function fireDistressSignal(player, triggerRescueVictory) {
    const tile = gameState.map[player.y][player.x];

    // Trouver l'objet de détresse dans l'inventaire
    let signalKey = null, signalName = null;
    for (const key in player.inventory) {
        const item = player.inventory[key];
        const name = typeof item === 'object' ? item.name : key;
        if (name === 'Fusée de détresse' || name === 'Pistolet de détresse') {
            signalKey = key; signalName = name;
            if (name === 'Fusée de détresse') break; // Priorité à la fusée (consommable)
        }
    }
    // Ou équipé en arme (pistolet de détresse)
    if (!signalKey && player.equipment.weapon &&
        ['Pistolet de détresse', 'Fusée de détresse'].includes(player.equipment.weapon.name)) {
        signalKey = '__equipped__';
        signalName = player.equipment.weapon.name;
    }

    if (!signalName) {
        player.notifications.push({ type: 'chat', message: "Vous n'avez aucun signal de détresse (fusée ou pistolet).", style: 'system_warning' });
        return;
    }
    if (tile.type.name !== 'Plage') {
        player.notifications.push({ type: 'chat', message: "🏖️ Allez sur une plage : le signal doit être visible depuis le large !", style: 'system_warning' });
        return;
    }

    // Consommer le signal
    if (signalKey === '__equipped__') player.equipment.weapon = null;
    else removeItemFromInventory(player, signalKey, 1);

    player.notifications.push({ type: 'chat', message: `🎆 Vous tirez ${signalName} vers le ciel... une lueur rouge illumine l'horizon !`, style: 'gain' });
    triggerRescueVictory(player);
}

export function openTreasure(player) {
    const tile = gameState.map[player.y][player.x];
    if (tile.type.name !== 'Trésor Caché' || tile.isOpened) return;

    if (!player.inventory['Clé du Trésor']) {
        player.notifications.push({ type: 'chat', message: "Il vous faut la Clé du Trésor pour ouvrir ce coffre.", style: 'system_warning' });
        return;
    }

    removeItemFromInventory(player, 'Clé du Trésor', 1);
    tile.isOpened = true;

    for (const item in TREASURE_COMBAT_KIT) {
        addItemToInventory(player, item, TREASURE_COMBAT_KIT[item]);
    }

    player.notifications.push({ type: 'chat', message: "💎 Vous avez ouvert le trésor : équipement de combat... et une FUSÉE DE DÉTRESSE ! Tirez-la depuis une plage pour alerter les secours !", style: 'gain' });
}

export function huntOnTile(player) {
    const tile = gameState.map[player.y][player.x];
    const tileType = tile.type.name;

    if ((tileType !== TILE_TYPES.FOREST.name && tileType !== TILE_TYPES.PLAINS.name) || !tile.huntActionsLeft || tile.huntActionsLeft <= 0) {
        player.notifications.push({ type: 'chat', message: "Il n'y a rien à chasser ici.", style: 'system_warning' });
        return;
    }

    tile.huntActionsLeft--;

    // Simple loot logic
    const lootTable = {
        'Viande crue': 0.7, // 70% chance
        'Peau de bête': 0.4, // 40% chance
    };

    let lootGained = false;
    for (const [item, chance] of Object.entries(lootTable)) {
        if (Math.random() < chance) {
            addItemToInventory(player, item, 1);
            player.notifications.push({ type: 'floatingText', message: `+1 ${item}`, style: 'gain' });
            lootGained = true;
        }
    }

    if (!lootGained) {
        player.notifications.push({ type: 'chat', message: "Vous avez pisté une proie, mais elle s'est échappée.", style: 'system_info' });
    }
}

export function sleep(player) {
    const tile = gameState.map[player.y][player.x];
    const shelterBuilding = tile.buildings.find(b => TILE_TYPES[b.key]?.isShelter || TILE_TYPES[b.key]?.sleepEffect);

    if (!shelterBuilding) {
        player.notifications.push({ type: 'chat', message: "Vous avez besoin d'un abri pour dormir en toute sécurité.", style: 'system_warning' });
        return;
    }

    // Restaurer le sommeil + bonus de l'abri (les meilleurs abris soignent davantage)
    const effect = TILE_TYPES[shelterBuilding.key]?.sleepEffect;
    player.sleep = player.maxSleep;
    const healthBonus = effect?.health || 2;
    player.health = Math.min(player.maxHealth, player.health + healthBonus);

    player.notifications.push({ type: 'chat', message: `😴 Vous vous réveillez reposé et en pleine forme. (+${healthBonus} Santé)`, style: 'gain' });
}

export function moveItem(player, data) {
    const { itemKey, quantity, source, target } = data;
    const item = player.inventory[itemKey];
    const itemName = typeof item === 'object' ? item.name : itemKey;

    // This is a complex action. We'll handle a few cases.
    // Case 1: Inventory -> Equipment
    if (source.owner === 'player-inventory' && target.owner === 'equipment') {
        equipItem(player, itemKey);
        return;
    }
    // Case 2: Equipment -> Inventory
    if (source.owner === 'equipment' && target.owner === 'player-inventory') {
        unequipItem(player, source.slot);
        return;
    }
    // Case 3: Inventory -> Ground
    if (source.owner === 'player-inventory' && target.owner === 'ground') {
        dropItem(player, itemKey, quantity);
        return;
    }
    // Case 4: Ground -> Inventory
    if (source.owner === 'ground' && target.owner === 'player-inventory') {
        // Note: client sends itemName for ground items, not a key.
        pickupItem(player, data.itemName, quantity);
        return;
    }

    // Case 5: Inventory -> Building
    if (source.owner === 'player-inventory' && target.owner === 'building-inventory') {
        const tile = gameState.map[player.y][player.x];
        const building = tile.buildings[0];
        if (building && TILE_TYPES[building.key]?.maxInventory) {
            if (Object.keys(building.inventory).length < TILE_TYPES[building.key].maxInventory) {
                if (removeItemFromInventory(player, itemKey, quantity)) {
                    building.inventory[itemKey] = (building.inventory[itemKey] || 0) + quantity;
                }
            }
        }
        return;
    }

    // Case 6: Building -> Inventory
    if (source.owner === 'building-inventory' && target.owner === 'player-inventory') {
        const tile = gameState.map[player.y][player.x];
        const building = tile.buildings[0];
        if (building && building.inventory[itemKey]) {
            if (addItemToInventory(player, itemName, quantity)) {
                building.inventory[itemKey] -= quantity;
                if (building.inventory[itemKey] <= 0) {
                    delete building.inventory[itemKey];
                }
            }
        }
        return;
    }
    
    // TODO: Add cases for moving items to/from building inventories.

    player.notifications.push({ type: 'chat', message: `Déplacement d'objet non géré.`, style: 'system_warning' });
}

export function fishOnTile(player, action) {
    const tile = gameState.map[player.y][player.x];
    if (tile.type.name !== 'Plage') {
        player.notifications.push({ type: 'chat', message: "Vous ne pouvez pêcher que sur la plage.", style: 'system_warning' });
        return;
    }

    const requiredTool = action === 'net_fish' ? 'Filet de pêche' : 'Canne à pêche';

    // L'outil peut être équipé... ou simplement dans l'inventaire
    let tool = null;
    if (player.equipment.weapon?.name === requiredTool) {
        tool = player.equipment.weapon;
    } else {
        for (const key in player.inventory) {
            const item = player.inventory[key];
            if (typeof item === 'object' && item.name === requiredTool) { tool = item; break; }
        }
    }

    if (!tool) {
        player.notifications.push({ type: 'chat', message: `Vous avez besoin d'un(e) ${requiredTool}.`, style: 'system_warning' });
        return;
    }

    // Logique de pêche simple
    const fishCaught = Math.random() < 0.6; // 60% de chance d'attraper quelque chose

    if (fishCaught) {
        const amount = action === 'fish' ? 1 : Math.floor(Math.random() * 3) + 1; // Le filet attrape plus
        addItemToInventory(player, 'Poisson cru', amount);
        player.notifications.push({ type: 'floatingText', message: `+${amount} Poisson cru`, style: 'gain' });
    } else {
        player.notifications.push({ type: 'chat', message: "Ça ne mord pas cette fois...", style: 'system_info' });
    }

    // Gérer la durabilité de l'outil
    if (tool.currentDurability !== undefined) {
        tool.currentDurability--;
        if (tool.currentDurability <= 0) {
            if (player.equipment.weapon === tool) {
                player.equipment.weapon = null;
            } else {
                for (const key in player.inventory) {
                    if (player.inventory[key] === tool) { delete player.inventory[key]; break; }
                }
            }
            player.notifications.push({ type: 'chat', message: `${tool.name} s'est cassé(e) !`, style: 'damage' });
        }
    }
}

export function cookOnTile(player, rawItem) {
    const tile = gameState.map[player.y][player.x];
    const campfire = tile.buildings.find(b => b.key === 'CAMPFIRE' && b.durability > 0);

    if (!campfire) {
        player.notifications.push({ type: 'chat', message: "Vous avez besoin d'un feu de camp pour cuisiner.", style: 'system_warning' });
        return;
    }

    const cookable = {
        'Poisson cru': 'Poisson cuit',
        'Viande crue': 'Viande cuite',
        'Oeuf cru': 'Oeuf cuit'
    };

    const cookedItem = cookable[rawItem];

    if (!cookedItem) {
        player.notifications.push({ type: 'chat', message: `Vous ne pouvez pas cuisiner cela.`, style: 'system_warning' });
        return;
    }

    if (!player.inventory[rawItem] || player.inventory[rawItem] < 1) {
        player.notifications.push({ type: 'chat', message: `Vous n'avez pas de ${rawItem}.`, style: 'system_warning' });
        return;
    }

    // Consommer l'objet cru et ajouter l'objet cuit
    removeItemFromInventory(player, rawItem, 1);
    addItemToInventory(player, cookedItem, 1);

    player.notifications.push({ type: 'floatingText', message: `+1 ${cookedItem}`, style: 'gain' });

    // Endommager le feu de camp
    campfire.durability--;
    if (campfire.durability <= 0) {
        player.notifications.push({ type: 'chat', message: "Le feu de camp s'est éteint.", style: 'damage' });
        // Optionnel : retirer le feu de camp de la tuile
        tile.buildings = tile.buildings.filter(b => b.key !== 'CAMPFIRE');
    }
}

export function dismantleBuilding(player) {
    const tile = gameState.map[player.y][player.x];
    if (!tile.buildings || tile.buildings.length === 0) {
        player.notifications.push({ type: 'chat', message: "Il n'y a rien à démanteler ici.", style: 'system_warning' });
        return;
    }

    const building = tile.buildings[0]; // Assuming one building per tile for now
    if (building.ownerId !== player.id) {
        player.notifications.push({ type: 'chat', message: "Vous ne pouvez pas démanteler un bâtiment qui ne vous appartient pas.", style: 'system_error' });
        return;
    }

    const buildingDef = TILE_TYPES[building.key];
    if (buildingDef && buildingDef.cost) {
        for (const resource in buildingDef.cost) {
            if (resource === 'toolRequired') continue;
            const refundAmount = Math.floor(buildingDef.cost[resource] * 0.5); // 50% refund
            if (refundAmount > 0) {
                addItemToInventory(player, resource, refundAmount);
                player.notifications.push({ type: 'floatingText', message: `+${refundAmount} ${resource}`, style: 'gain' });
            }
        }
    }

    tile.buildings = []; // Remove the building
    player.notifications.push({ type: 'chat', message: `Vous avez démantelé : ${buildingDef.name}.`, style: 'system_info' });
}

// --- ACTION AVAILABILITY ---

/**
 * Determines the list of available actions for a player based on their current context.
 * @param {object} player The player object.
 * @returns {Array<object>} A list of available action objects, e.g., [{ id: 'harvest_wood', name: 'Récolter du bois' }]
 */
export function getAvailableActions(player) {
    const availableActions = [];
    if (!player || !gameState.map) return availableActions;

    const tile = gameState.map[player.y]?.[player.x];
    if (!tile) return availableActions;

    // Combat : un ennemi rôde sur cette case
    const enemyHere = gameState.enemies.find(e => e.x === player.x && e.y === player.y);
    if (enemyHere && !player.combatState) {
        availableActions.push({ id: ACTIONS.INITIATE_COMBAT, name: `⚔️ Attaquer ${enemyHere.name}` });
    }

    // PNJ : un survivant est là
    const npcHere = gameState.npcs.find(n => n.x === player.x && n.y === player.y);
    if (npcHere) {
        availableActions.push({ id: ACTIONS.TALK_TO_NPC, name: `💬 Parler à ${npcHere.name}` });
    }

    // Search Zone
    if (['Forêt', 'Plage', 'Plaine', 'Friche'].includes(tile.type.name) && (tile.searchActionsLeft === undefined || tile.searchActionsLeft > 0)) {
        availableActions.push({ id: ACTIONS.SEARCH_ZONE, name: 'Fouiller la zone' });
    }

    // Hunt
    if (['Forêt', 'Plaine'].includes(tile.type.name) && tile.huntActionsLeft > 0) {
        availableActions.push({ id: ACTIONS.HUNT, name: 'Chasser' });
    }

    // Harvest
    if (tile.type.name === 'Forêt' && tile.woodActionsLeft > 0) {
        const equippedWeapon = player.equipment.weapon;
        if (equippedWeapon && equippedWeapon.name === 'Scie') {
            availableActions.push({ id: ACTIONS.HARVEST_WOOD_SCIE, name: 'Récolter du bois (Scie)' });
        } else if (equippedWeapon && equippedWeapon.name === 'Hache') {
            availableActions.push({ id: ACTIONS.HARVEST_WOOD_HACHE, name: 'Récolter du bois (Hache)' });
        } else {
            availableActions.push({ id: ACTIONS.HARVEST_WOOD_MAINS, name: 'Récolter du bois (Mains)' });
        }
    }
    if (tile.type.name === 'Mine (Terrain)' && tile.harvests > 0) {
        availableActions.push({ id: ACTIONS.HARVEST_STONE, name: 'Récolter de la pierre' });
    }
    // Minerai : action propre au terrain (ex : Mine)
    if (tile.type.action && tile.type.action.id && tile.type.action.name) {
        availableActions.push({ id: tile.type.action.id, name: tile.type.action.name });
    }
    if (tile.type.name === 'Plage') {
        availableActions.push({ id: ACTIONS.HARVEST_SAND, name: 'Récolter du sable' });
        availableActions.push({ id: ACTIONS.HARVEST_SALT_WATER, name: "Prendre de l'eau salée" });

        // Pêche (canne ou filet, équipé ou dans le sac)
        const hasTool = (name) => player.equipment.weapon?.name === name ||
            Object.values(player.inventory).some(it => typeof it === 'object' && it.name === name);
        if (hasTool('Canne à pêche')) availableActions.push({ id: ACTIONS.FISH, name: '🎣 Pêcher (Canne)' });
        if (hasTool('Filet de pêche')) availableActions.push({ id: ACTIONS.NET_FISH, name: '🕸️ Pêcher (Filet)' });

        // Signal de détresse : LA porte de sortie de l'île !
        const hasSignal = Object.values(player.inventory).some(it => {
            const n = typeof it === 'object' ? it.name : null;
            return n === 'Fusée de détresse' || n === 'Pistolet de détresse';
        }) || player.inventory['Fusée de détresse'] || player.inventory['Pistolet de détresse'] ||
            ['Fusée de détresse', 'Pistolet de détresse'].includes(player.equipment.weapon?.name);
        if (hasSignal && !gameState.victory) {
            availableActions.push({ id: ACTIONS.FIRE_DISTRESS_FLARE, name: '🎆 Tirer le signal de détresse !' });
        }
    }

    // Plantation / régénération
    if (['PLAINS', 'WASTELAND'].includes(tile.key) && (player.inventory["Graine d'arbre"] || 0) >= 1) {
        availableActions.push({ id: ACTIONS.PLANT_TREE, name: '🌱 Planter un arbre' });
    }
    if (tile.key === 'WASTELAND') {
        availableActions.push({ id: ACTIONS.REGENERATE_FOREST, name: '🌳 Régénérer la forêt (5 Eau pure, 10 Graines)' });
    }

    // Build
    if (tile.type.buildable && tile.buildings.length < CONFIG.MAX_BUILDINGS_PER_TILE) {
        availableActions.push({ id: ACTIONS.OPEN_BUILD_MODAL, name: 'Construire' });
    }

    // Treasure
    if (tile.type.name === 'Trésor Caché' && !tile.isOpened) {
        // Check for key
        if (player.inventory['Clé du Trésor']) {
            availableActions.push({ id: ACTIONS.OPEN_TREASURE, name: 'Ouvrir le trésor' });
        }
    }
    
    // Building-specific actions
    if (tile.buildings && tile.buildings.length > 0) {
        const hasShelter = tile.buildings.some(b => TILE_TYPES[b.key]?.isShelter);
        if (hasShelter) {
            availableActions.push({ id: ACTIONS.SLEEP, name: 'Dormir' });
        }

        const building = tile.buildings[0];
        if (building.ownerId === player.id) {
            availableActions.push({ id: ACTIONS.DISMANTLE_BUILDING, name: 'Démanteler' });
        }
        if (TILE_TYPES[building.key]?.maxInventory) {
            availableActions.push({ id: ACTIONS.OPEN_BUILDING_INVENTORY, name: 'Ouvrir le coffre' });
        }
        const buildingDef = TILE_TYPES[building.key];
        // Ensure buildingDef exists before trying to access its properties
        if (buildingDef) {
            if (buildingDef.actions) {
                if (Array.isArray(buildingDef.actions)) {
                    buildingDef.actions.forEach(act => {
                        if (act && act.id && act.name) {
                            availableActions.push({ id: act.id, name: act.name });
                        }
                    });
                } else if (typeof buildingDef.actions === 'object' && buildingDef.actions.id && buildingDef.actions.name) {
                    availableActions.push({ id: buildingDef.actions.id, name: buildingDef.actions.name });
                }
            } else if (buildingDef.action && buildingDef.action.id && buildingDef.action.name) { // Fallback for single action
                 availableActions.push({ id: buildingDef.action.id, name: buildingDef.action.name });
            }
        }
    }

    return availableActions;
}


// --- PLAYER STATE UPDATE ---

// Évite de spammer la même notification à chaque tick (500 ms)
const DAMAGE_NOTIF_COOLDOWN_MS = 5000;
function notifyThrottled(player, cause, notification) {
    const now = Date.now();
    if (!player._notifCooldowns) player._notifCooldowns = {};
    if (!player._notifCooldowns[cause] || now - player._notifCooldowns[cause] >= DAMAGE_NOTIF_COOLDOWN_MS) {
        player._notifCooldowns[cause] = now;
        player.notifications.push(notification);
    }
}

export function updatePlayerState(player, deltaTime) {
    const secondsPassed = deltaTime / 1000;

    // Conséquences des stats à zéro
    if (player.hunger === 0) {
        player.health = Math.max(0, player.health - 0.1 * secondsPassed); // Dégâts de faim
        notifyThrottled(player, 'hunger', { type: 'floatingText', message: '-1 Santé (Faim)', style: 'damage' });
    }
    if (player.thirst === 0) {
        player.health = Math.max(0, player.health - 0.15 * secondsPassed); // Dégâts de soif
        notifyThrottled(player, 'thirst', { type: 'floatingText', message: '-1 Santé (Soif)', style: 'damage' });
    }

    // Gérer les effets et la durée des statuts
    for (const statusName in player.status) {
        const status = player.status[statusName];
        
        // Appliquer l'effet du statut
        switch (statusName) {
            case 'Malade':
                player.health = Math.max(0, player.health - 0.05 * secondsPassed);
                notifyThrottled(player, 'malade', { type: 'floatingText', message: '-1 Santé (Malade)', style: 'damage' });
                break;
            case 'Empoisonné':
                player.health = Math.max(0, player.health - 0.2 * secondsPassed);
                notifyThrottled(player, 'poison', { type: 'floatingText', message: '-2 Santé (Poison)', style: 'damage' });
                break;
            case 'Alcoolisé':
                // Effet potentiellement amusant, comme une chance de se déplacer dans la mauvaise direction (géré dans movePlayer)
                break;
        }

        // Décrémenter la durée
        status.duration -= secondsPassed;
        if (status.duration <= 0) {
            delete player.status[statusName];
            player.notifications.push({ type: 'chat', message: `Vous ne vous sentez plus : ${statusName}.`, style: 'gain' });
        }
    }

    // Régénération passive : bien nourri et hydraté, le corps récupère doucement
    if (player.health > 0 && player.health < player.maxHealth &&
        player.hunger > player.maxHunger * 0.5 && player.thirst > player.maxThirst * 0.5) {
        player.health = Math.min(player.maxHealth, player.health + 0.03 * secondsPassed);
    }

    // Mort et réapparition au camp de départ
    if (player.health <= 0) {
        respawnPlayer(player);
    }
}

/**
 * Fait réapparaître un joueur mort au point de départ avec des stats réduites.
 * @param {object} player - Le joueur à faire réapparaître.
 */
function respawnPlayer(player) {
    if (player.combatState) endCombat(player, false); // Sortir du combat en cours
    player.deaths = (player.deaths || 0) + 1;
    player.x = 10;
    player.y = 10;
    player.health = Math.ceil(player.maxHealth / 2);
    player.hunger = Math.ceil(player.maxHunger / 2);
    player.thirst = Math.ceil(player.maxThirst / 2);
    player.sleep = Math.ceil(player.maxSleep / 2);
    player.status = [];
    player.isBusy = false;
    if (player.visitedTiles instanceof Set) player.visitedTiles.add('10,10');
    player.notifications.push({ type: 'chat', message: `💀 Vous avez succombé... Vous vous réveillez au camp, affaibli (mort n°${player.deaths}).`, style: 'damage' });
}

export function applyActionCost(player) {
    if (!player) return;

    player.hunger = Math.max(0, player.hunger - (ACTION_COST_CONFIG.costRange.hunger.min + Math.random() * (ACTION_COST_CONFIG.costRange.hunger.max - ACTION_COST_CONFIG.costRange.hunger.min)));
    player.thirst = Math.max(0, player.thirst - (ACTION_COST_CONFIG.costRange.thirst.min + Math.random() * (ACTION_COST_CONFIG.costRange.thirst.max - ACTION_COST_CONFIG.costRange.thirst.min)));
    player.sleep = Math.max(0, player.sleep - (ACTION_COST_CONFIG.costRange.sleep.min + Math.random() * (ACTION_COST_CONFIG.costRange.sleep.max - ACTION_COST_CONFIG.costRange.sleep.min)));
}