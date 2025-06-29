// server/interactions.js

import { gameState } from './state.js';
import { ACTIONS } from '../public/js/config.js';
import * as Player from './player.js';

export function handlePlayerAction(actionId, data, playerId) {
    const player = gameState.players[playerId];
    if (!player) return;

    // Basic busy check
    // if (player.isBusy) {
    //     console.log(`Action '${actionId}' blocked for player ${playerId} (busy).`);
    //     return;
    // }
    
    console.log(`[SERVER] Action received from ${playerId}: ${actionId}`, data || '');

    switch (actionId) {
        // --- INVENTORY & MOVEMENT ---
        case ACTIONS.MOVE:
            if (data && data.direction) Player.movePlayer(player, data.direction);
            break;
        case ACTIONS.EQUIP_ITEM_CONTEXT:
            if (data && data.itemKey) Player.equipItem(player, data.itemKey);
            break;
        case ACTIONS.UNEQUIP_ITEM_CONTEXT:
            if (data && data.slot) Player.unequipItem(player, data.slot);
            break;
        case ACTIONS.DROP_ITEM_CONTEXT:
            if (data && data.itemKey) Player.dropItem(player, data.itemKey, 1);
            break;
        case ACTIONS.PICKUP_ITEM_CONTEXT:
            if (data && data.itemName) Player.pickupItem(player, data.itemName, 1);
            break;
        case ACTIONS.MOVE_ITEM:
            if (data) Player.moveItem(player, data);
            break;
        case ACTIONS.CONSUME_ITEM_CONTEXT:
            if (data && data.itemKey) Player.consumeItem(player, data.itemKey);
            break;

        // --- WORLD INTERACTION & CRAFTING ---
        case ACTIONS.HARVEST_WOOD_HACHE:
        case ACTIONS.HARVEST_WOOD_SCIE:
        case ACTIONS.HARVEST_WOOD_MAINS:
        case ACTIONS.HARVEST_SAND:
        case ACTIONS.HARVEST_STONE:
        case ACTIONS.HARVEST_SALT_WATER:
            Player.harvestResource(player, actionId);
            break;
        case ACTIONS.BUILD_STRUCTURE:
            if (data && data.structureKey) Player.buildStructure(player, data.structureKey);
            break;
        case ACTIONS.CRAFT_ITEM_WORKSHOP:
            if (data && data.recipeName && data.costs && data.quantity) {
                Player.craftItem(player, data.recipeName, data.costs, data.quantity);
            }
            break;
        case ACTIONS.SEARCH_ZONE:
            Player.searchZone(player);
            break;
        case ACTIONS.OPEN_TREASURE:
            Player.openTreasure(player);
            break;
        case ACTIONS.SLEEP:
            Player.sleep(player);
            break;

        // --- ACTIONS TO BE IMPLEMENTED ---
        case ACTIONS.FISH:
        case ACTIONS.NET_FISH:
        case ACTIONS.REGENERATE_FOREST:
        case ACTIONS.PLANT_TREE:
        case ACTIONS.SLEEP_BY_CAMPFIRE:
        case ACTIONS.COOK:
        case ACTIONS.TAKE_HIDDEN_ITEM:
        case ACTIONS.USE_BUILDING_ACTION:
        case ACTIONS.DISMANTLE_BUILDING:
        case ACTIONS.OPEN_ALL_PARCHEMINS:
        case ACTIONS.FIRE_DISTRESS_GUN:
        case ACTIONS.FIRE_DISTRESS_FLARE:
        case ACTIONS.PLACE_SOLAR_PANEL_FIXED:
        case ACTIONS.CHARGE_BATTERY_PORTABLE_SOLAR:
        case ACTIONS.PLACE_TRAP:
        case ACTIONS.ATTRACT_NPC_ATTENTION:
        case ACTIONS.FIND_MINE_COMPASS:
        case ACTIONS.REPAIR_BUILDING:
        case ACTIONS.SET_LOCK:
        case ACTIONS.REMOVE_LOCK:
        case ACTIONS.OPEN_LARGE_MAP:
        case ACTIONS.TALK_TO_NPC:
        case ACTIONS.OPEN_BUILDING_INVENTORY:
        case ACTIONS.SEARCH_ORE_TILE:
        case ACTIONS.PLAY_ELECTRIC_GUITAR:
        case ACTIONS.USE_ATELIER:
        case ACTIONS.USE_ETABLI:
        case ACTIONS.USE_FORGE:
        case ACTIONS.OBSERVE_WEATHER:
        case ACTIONS.GENERATE_PLAN:
        case ACTIONS.TUTORIAL_HIDE_AND_MOVE:
        case ACTIONS.TUTORIAL_NEXT:
        case ACTIONS.TUTORIAL_SKIP:
        case ACTIONS.INITIATE_COMBAT:
             player.notifications.push({ type: 'chat', message: `L'action '${actionId}' n'est pas encore implémentée.`, style: 'system_warning' });
             console.warn(`Action not yet implemented: ${actionId}`);
             break;

        default:
            console.warn(`Action non reconnue ou non gérée par le serveur: ${actionId}`);
            break;
    }
}
