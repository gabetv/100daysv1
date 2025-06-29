import { CONFIG } from '../public/js/config.js';
import { gameState } from './state.js';

export function initNpcs(config, map) {
    const npcs = [];
    const npcColors = ['#ff6347', '#4682b4', '#32cd32', '#ee82ee'];
    const npcNames = ["Bob", "Alice", "Charlie", "Diana", "Evan", "Fiona"];

    for (let i = 0; i < config.NUM_NPCS; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * config.MAP_WIDTH);
            y = Math.floor(Math.random() * config.MAP_HEIGHT);
        } while (!map[y][x].type.accessible);

        const npcData = {
            id: `npc_${Date.now()}_${i}`,
            x, y,
            color: npcColors[i % npcColors.length],
            name: npcNames[i % npcNames.length] || `Survivant ${i + 1}`,
            timeSinceLastMove: 0,
            inventory: {},
            capacity: 15,
            goal: 'harvesting',
            targetResource: null,
            health: CONFIG.NPC_BASE_HEALTH,
            maxHealth: CONFIG.NPC_BASE_HEALTH,
            damage: CONFIG.NPC_BASE_DAMAGE,
            targetEnemyId: null,
            availableQuest: null,
            activeQuest: null,
            dialogueLines: [
                "J'espère qu'on va s'en sortir...",
                "Il faut rester vigilant.",
                "Travaillons ensemble pour survivre !",
                "Chaque jour est un nouveau défi.",
                "Gardons espoir."
            ]
        };

        if (i % 2 === 0) {
            npcData.availableQuest = {
                id: `quest_wood_${i}`,
                title: "Besoin de Bois",
                description: "Nous manquons de bois pour le feu. Pourrais-tu m'apporter 10 Bois ?",
                requirement: { item: 'Bois', amount: 10 },
                reward: { item: 'Viande cuite', amount: 2 },
                isCompleted: false
            };
        } else {
             npcData.availableQuest = {
                id: `quest_food_${i}`,
                title: "Chasseur Affamé",
                description: "J'ai grand faim. 3 Viandes crues seraient un festin !",
                requirement: { item: 'Viande crues', amount: 3 },
                reward: { item: 'Pierre', amount: 15 },
                isCompleted: false
            };
        }
        npcs.push(npcData);
    }
    return npcs;
}

export function updateNpcs(deltaTime) {
    const { npcs, map, shelterLocation, enemies, players } = gameState;

    for (let i = npcs.length - 1; i >= 0; i--) {
        const npc = npcs[i];

        npc.timeSinceLastMove += deltaTime;
        if (npc.timeSinceLastMove < CONFIG.NPC_ACTION_INTERVAL_MS) continue;
        npc.timeSinceLastMove = 0;

        if (npc.health <= 0) {
            Object.values(players).forEach(p => {
                if (!p.notifications) p.notifications = [];
                p.notifications.push({ type: 'chat', message: `${npc.name} a été vaincu...`, style: 'system_warning' })
            });
            npcs.splice(i, 1);
            continue;
        }
    }
}

export function handleNpcInteraction(npcId, playerId) {
    const { npcs, players } = gameState;
    const player = players[playerId];
    const npc = npcs.find(n => n.id === npcId);
    if (!npc || !player) return;

    // Quest and dialogue logic here
}
