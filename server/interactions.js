// server/interactions.js

import { gameState, startCombat, triggerRescueVictory } from './state.js';
import { ACTIONS } from '../public/js/config.js';
import * as Player from './player.js';
import { handleCombatAction } from './combat.js'; // Importer la logique de combat
import { findEnemyOnTile } from './enemy.js';
import { handleNpcInteraction } from './npc.js';
import { applyActionCost } from './player.js';

// Actions "gratuites" qui ne doivent pas consommer faim/soif/sommeil
const FREE_ACTIONS = new Set([
    ACTIONS.SEND_CHAT_MESSAGE,
    'combat_action',
    'join',
    ACTIONS.TUTORIAL_NEXT,
    ACTIONS.TUTORIAL_SKIP,
    ACTIONS.TUTORIAL_HIDE_AND_MOVE,
    ACTIONS.CUSTOMIZE_CHARACTER,
    ACTIONS.TALK_TO_NPC,
    ACTIONS.OPEN_LARGE_MAP,
    ACTIONS.OPEN_BUILDING_INVENTORY,
    ACTIONS.SET_LOCK,
    ACTIONS.REMOVE_LOCK,
    ACTIONS.OPEN_ALL_PARCHEMINS,
    // Gestion du sac : ces actions ne doivent jamais vider faim/soif/sommeil.
    ACTIONS.MOVE_ITEM,
    ACTIONS.CONSUME_ITEM_CONTEXT,
    ACTIONS.EQUIP_ITEM_CONTEXT,
    ACTIONS.UNEQUIP_ITEM_CONTEXT,
    ACTIONS.DROP_ITEM_CONTEXT,
    ACTIONS.PICKUP_ITEM_CONTEXT,
]);

export function handlePlayerAction(actionId, data, playerId, broadcastToClients) {
    const player = gameState.players[playerId];
    if (!player) return;

    // Les déplacements réussis consomment un peu d'énergie ; un mur ou une
    // diagonale impossible ne doit pas punir le joueur.
    if (!FREE_ACTIONS.has(actionId) && actionId !== ACTIONS.MOVE) {
        applyActionCost(player);
    }

    // Basic busy check
    // if (player.isBusy) {
    //     console.log(`Action '${actionId}' blocked for player ${playerId} (busy).`);
    //     return;
    // }
    
    console.log(`[SERVER] Action received from ${playerId}: ${actionId}`, data || '');

    switch (actionId) {
        case ACTIONS.SEND_CHAT_MESSAGE: {
            const message = typeof data?.message === 'string' ? data.message.trim().slice(0, 240) : '';
            const now = Date.now();
            const sender = gameState.players[playerId];
            // Un petit cooldown évite le spam qui surcharge le journal de tous les joueurs.
            if (!message || !sender || now - (sender.lastChatAt || 0) < 700) break;
            sender.lastChatAt = now;
            sender.chatMessage = { text: message, timestamp: now };

            if (broadcastToClients) {
                broadcastToClients(JSON.stringify({
                    type: 'chat',
                    payload: { sender: sender.name || 'Survivant', message },
                }));
            }
            break;
        }
        // --- INVENTORY, APPARENCE & MOVEMENT ---
        case ACTIONS.CUSTOMIZE_CHARACTER:
            Player.customizeAppearance(player, data?.appearance);
            break;
        case ACTIONS.MOVE:
            if (data && data.direction && Player.movePlayer(player, data.direction)) {
                applyActionCost(player);
            }
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
            Player.takeHiddenItem(player);
            break;

        case ACTIONS.FISH:
        case ACTIONS.NET_FISH:
            Player.fishOnTile(player, actionId);
            break;

        case ACTIONS.PLANT_TREE:
            Player.plantTree(player);
            break;

        case ACTIONS.REGENERATE_FOREST:
            Player.regenerateForest(player);
            break;

        case ACTIONS.SLEEP_BY_CAMPFIRE:
            Player.sleepByCampfire(player);
            break;

        case ACTIONS.SEARCH_ORE_TILE:
        case 'search_ore_building':
            Player.searchOreTile(player, actionId);
            break;

        case ACTIONS.FIRE_DISTRESS_GUN:
        case ACTIONS.FIRE_DISTRESS_FLARE:
            Player.fireDistressSignal(player, triggerRescueVictory);
            break;

        case 'pvp_attack':
            Player.attackPlayer(player);
            break;

        case ACTIONS.TALK_TO_NPC: {
            const npc = gameState.npcs.find(n => n.x === player.x && n.y === player.y);
            if (npc) handleNpcInteraction(player, npc);
            else player.notifications.push({ type: 'chat', message: "Il n'y a personne à qui parler ici.", style: 'system_info' });
            break;
        }

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

        case 'combat_action': // Tours de combat (par joueur)
            if (data && data.type) {
                handleCombatAction(playerId, data.type); // ex: 'attack' ou 'flee'
            }
            break;

        case ACTIONS.DISMANTLE_BUILDING:
            Player.dismantleBuilding(player);
            break;

        // --- OBJETS UTILISABLES (piège, panneau solaire, boussole, sifflet, kit, guitare...) ---
        case ACTIONS.PLACE_TRAP:
        case ACTIONS.PLACE_SOLAR_PANEL_FIXED:
        case ACTIONS.CHARGE_BATTERY_PORTABLE_SOLAR:
        case ACTIONS.ATTRACT_NPC_ATTENTION:
        case ACTIONS.FIND_MINE_COMPASS:
        case ACTIONS.REPAIR_BUILDING:
        case ACTIONS.PLAY_ELECTRIC_GUITAR:
            Player.useItemByAction(player, actionId);
            break;

        case ACTIONS.OPEN_ALL_PARCHEMINS:
            Player.openAllParchemins(player);
            break;

        case ACTIONS.OBSERVE_WEATHER:
            Player.observeWeather(player);
            break;

        case ACTIONS.SET_LOCK:
            Player.setLock(player, data?.code);
            break;

        case ACTIONS.REMOVE_LOCK:
            Player.removeLock(player);
            break;

        // --- ACTIONS GÉRÉES CÔTÉ CLIENT (modales / tutoriel) ---
        case ACTIONS.OPEN_LARGE_MAP:
        case ACTIONS.OPEN_BUILDING_INVENTORY:
        case ACTIONS.USE_ATELIER:
        case ACTIONS.USE_ETABLI:
        case ACTIONS.USE_FORGE:
        case ACTIONS.TUTORIAL_HIDE_AND_MOVE:
        case ACTIONS.TUTORIAL_NEXT:
        case ACTIONS.TUTORIAL_SKIP:
            break;

        default:
            // Peut-être une action de bâtiment (cuisiner, bouillir, puiser, récolter une plantation...)
            if (!Player.useBuildingAction(player, actionId)) {
                console.warn(`Action non reconnue ou non gérée par le serveur: ${actionId}`);
            }
            break;
    }
}
