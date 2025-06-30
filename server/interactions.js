// server/interactions.js

import { gameState, startCombat } from './state.js';
import { ACTIONS } from '../public/js/config.js';
import * as Player from './player.js';
import { handleCombatAction } from './combat.js'; // Importer la logique de combat
import { findEnemyOnTile } from './enemy.js';
import { applyActionCost } from './player.js';

export function handlePlayerAction(actionId, data, playerId, broadcastToClients) {
    const player = gameState.players[playerId];
    if (!player) return;

    applyActionCost(player);

    // Basic busy check
    // if (player.isBusy) {
    //     console.log(`Action '${actionId}' blocked for player ${playerId} (busy).`);
    //     return;
    // }
    
    console.log(`[SERVER] Action received from ${playerId}: ${actionId}`, data || '');

    switch (actionId) {
        case ACTIONS.SEND_CHAT_MESSAGE:
            if (data && data.message && broadcastToClients) {
                const sender = gameState.players[playerId];
                // Add message to player state to be displayed above their head
                if (sender) {
                    sender.chatMessage = {
                        text: data.message,
                        timestamp: Date.now()
                    };
                }

                // Broadcast to all clients for chat window
                const chatMessage = {
                    type: 'chat',
                    payload: {
                        sender: sender ? sender.name : 'Unknown',
                        message: data.message,
                    },
                };
                broadcastToClients(JSON.stringify(chatMessage));
            }
            break;
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
        case ACTIONS.COOK:
            if (data && data.raw) {
                Player.cookOnTile(player, data.raw);
            }
            break;

        case ACTIONS.TAKE_HIDDEN_ITEM:
            Player.fishOnTile(player, actionId);
            break;

        case ACTIONS.REGENERATE_FOREST:
        case ACTIONS.HARVEST_SAND:
        case ACTIONS.HARVEST_STONE:
        case ACTIONS.HARVEST_SALT_WATER:
        case ACTIONS.HARVEST_WOOD_HACHE:
        case ACTIONS.HARVEST_WOOD_SCIE:
        case ACTIONS.HARVEST_WOOD_MAINS:
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
        case ACTIONS.HUNT:
            Player.huntOnTile(player);
            break;
        case ACTIONS.OPEN_TREASURE:
            Player.openTreasure(player);
            break;
        case ACTIONS.SLEEP:
            Player.sleep(player);
            break;

        case ACTIONS.INITIATE_COMBAT:
            const enemy = findEnemyOnTile(player.x, player.y, gameState.enemies);
            if (enemy) {
                startCombat(player, enemy);
            } else {
                player.notifications.push({ type: 'chat', message: "Il n'y a rien à attaquer ici.", style: 'system_warning' });
            }
            break;

        case 'combat_action': // Nouvelle action pour gérer les tours de combat
            if (data && data.type) {
                handleCombatAction(data.type); // ex: 'attack' ou 'flee'
            }
            break;

        // --- ACTIONS TO BE IMPLEMENTED ---
        case ACTIONS.FISH:
        case ACTIONS.NET_FISH:
        case ACTIONS.PLANT_TREE:
        case ACTIONS.SLEEP_BY_CAMPFIRE:
        case ACTIONS.USE_BUILDING_ACTION:
        case ACTIONS.DISMANTLE_BUILDING:
            Player.dismantleBuilding(player);
            break;
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
            // Handled client-side by opening the modal
            break;
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
             player.notifications.push({ type: 'chat', message: `L'action '${actionId}' n'est pas encore implémentée.`, style: 'system_warning' });
             console.warn(`Action not yet implemented: ${actionId}`);
             break;

        default:
            console.warn(`Action non reconnue ou non gérée par le serveur: ${actionId}`);
            break;
    }
}
