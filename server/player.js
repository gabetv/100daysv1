// server/player.js

import { gameState } from './state.js';
import { ITEM_TYPES, CONFIG, TILE_TYPES, SEARCH_ZONE_CONFIG, TREASURE_COMBAT_KIT, ACTIONS } from '../public/js/config.js';

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
        player.notifications.push({ type: 'chat', message: `Impossible de jeter l\'objet.`, style: 'system_error' });
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
                        if (!player.status.includes(statusEffect.name)) {
                            player.status.push(statusEffect.name);
                            player.notifications.push({ type: 'chat', message: `Vous vous sentez maintenant : ${statusEffect.name}.`, style: 'damage' });
                        }
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
    console.log(`[SERVER] Entering searchZone for player ${player.id}`); // DEBUG
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

    // Simple loot logic for now
    const lootTable = zoneConfig.specificLoot.common;
    if (lootTable.length > 0) {
        const foundItem = lootTable[Math.floor(Math.random() * lootTable.length)];
        addItemToInventory(player, foundItem, 1);
        player.notifications.push({ type: 'chat', message: `En fouillant, vous avez trouvé : ${foundItem}.`, style: 'system_info' });
    } else {
        player.notifications.push({ type: 'chat', message: "Vous n'avez rien trouvé d'intéressant.", style: 'system_info' });
    }
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

    player.notifications.push({ type: 'chat', message: "Vous avez ouvert le trésor et trouvé un équipement de combat !", style: 'gain' });
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
    const hasShelter = tile.buildings.some(b => TILE_TYPES[b.key]?.isShelter);

    if (!hasShelter) {
        player.notifications.push({ type: 'chat', message: "Vous avez besoin d'un abri pour dormir en toute sécurité.", style: 'system_warning' });
        return;
    }

    // Restore sleep
    player.sleep = player.maxSleep;

    // Advance time (e.g., by 8 hours)
    // Note: This is a simple implementation. A full time/day cycle would be more complex.
    gameState.time += 8 * 60; // Advance time by 8 hours (in minutes)
    if (gameState.time >= 24 * 60) {
        gameState.time -= 24 * 60;
        gameState.day++;
    }

    player.notifications.push({ type: 'chat', message: "Vous vous réveillez reposé et en pleine forme.", style: 'gain' });
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
    
    // TODO: Add cases for moving items to/from building inventories.

    player.notifications.push({ type: 'chat', message: `Déplacement d'objet non géré.`, style: 'system_warning' });
}

export function fishOnTile(player, action) {
    const tile = gameState.map[player.y][player.x];
    if (tile.type.name !== 'Plage') {
        player.notifications.push({ type: 'chat', message: "Vous ne pouvez pêcher que sur la plage.", style: 'system_warning' });
        return;
    }

    const requiredTool = action === 'fish' ? 'Canne à pêche' : 'Filet de pêche';
    const tool = player.equipment.weapon;

    if (!tool || tool.name !== requiredTool) {
        player.notifications.push({ type: 'chat', message: `Vous avez besoin d'un(e) ${requiredTool} équipé(e).`, style: 'system_warning' });
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

    // Gérer la durabilité de l'outil (simplifié)
    if (tool.durability) {
        tool.durability--;
        if (tool.durability <= 0) {
            player.equipment.weapon = null;
            player.notifications.push({ type: 'chat', message: `${tool.name} s'est cassé !`, style: 'damage' });
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
    console.log('Current tile for action check:', tile); // DEBUG
    if (!tile) return availableActions;

    // Search Zone
    if (['Forêt', 'Plage', 'Plaine'].includes(tile.type.name)) {
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
    if (tile.type.name === 'Plage') {
        availableActions.push({ id: ACTIONS.HARVEST_SAND, name: 'Récolter du sable' });
        availableActions.push({ id: ACTIONS.HARVEST_SALT_WATER, name: 'Prendre de l\'eau salée' });
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

export function updatePlayerState(player, deltaTime) {
    const secondsPassed = deltaTime / 1000;

    // Taux de dégradation par seconde
    const decayRates = {
        hunger: 0.1,
        thirst: 0.15,
        sleep: 0.05,
    };

    player.hunger = Math.max(0, player.hunger - decayRates.hunger * secondsPassed);
    player.thirst = Math.max(0, player.thirst - decayRates.thirst * secondsPassed);
    player.sleep = Math.max(0, player.sleep - decayRates.sleep * secondsPassed);

    // Conséquences des stats à zéro
    if (player.hunger === 0) {
        player.health = Math.max(0, player.health - 0.1 * secondsPassed); // Dégâts de faim
        player.notifications.push({ type: 'floatingText', message: '-1 Santé (Faim)', style: 'damage' });
    }
    if (player.thirst === 0) {
        player.health = Math.max(0, player.health - 0.15 * secondsPassed); // Dégâts de soif
        player.notifications.push({ type: 'floatingText', message: '-1 Santé (Soif)', style: 'damage' });
    }

    // Effets des statuts
    if (player.status.includes('Malade')) {
        player.health = Math.max(0, player.health - 0.05 * secondsPassed);
        player.notifications.push({ type: 'floatingText', message: '-1 Santé (Malade)', style: 'damage' });
    }
}