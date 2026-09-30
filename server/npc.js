import { CONFIG } from '../public/js/config.js';
import { gameState } from './state.js';
import { addXp } from './player.js';

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
                reward: { item: 'Viande cuite', amount: 3 },
                isCompleted: false
            };
        } else {
             npcData.availableQuest = {
                id: `quest_food_${i}`,
                title: "Chasseur Affamé",
                description: "J'ai grand faim. 3 Viandes crues seraient un festin !",
                requirement: { item: 'Viande crue', amount: 3 },
                reward: { item: 'Pierre', amount: 15 },
                isCompleted: false
            };
        }
        npcs.push(npcData);
    }
    return npcs;
}

export function updateNpcs(deltaTime) {
    const { npcs, map, players } = gameState;

    for (let i = npcs.length - 1; i >= 0; i--) {
        const npc = npcs[i];

        if (npc.health <= 0) {
            Object.values(players).forEach(p => {
                if (!p.notifications) p.notifications = [];
                p.notifications.push({ type: 'chat', message: `${npc.name} a été vaincu...`, style: 'system_warning' })
            });
            npcs.splice(i, 1);
            continue;
        }

        // Bavardage périodique (seulement si des joueurs sont sur la même case)
        npc.timeSinceLastChat = (npc.timeSinceLastChat || 0) + deltaTime;
        if (npc.timeSinceLastChat >= CONFIG.CHAT_MESSAGE_INTERVAL_MS) {
            npc.timeSinceLastChat = Math.random() * 8000; // Désynchroniser les PNJ
            const line = npc.dialogueLines[Math.floor(Math.random() * npc.dialogueLines.length)];
            npc.chatMessage = { text: line, timestamp: Date.now() };
            Object.values(players).forEach(p => {
                if (p.x === npc.x && p.y === npc.y) {
                    p.notifications.push({ type: 'chat', message: `${npc.name} : « ${line} »`, style: 'system_info' });
                }
            });
        }

        // Errance aléatoire
        npc.timeSinceLastMove += deltaTime;
        if (npc.timeSinceLastMove < CONFIG.NPC_ACTION_INTERVAL_MS) continue;
        npc.timeSinceLastMove = 0;

        if (Math.random() < 0.5) {
            const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
            const nx = npc.x + dx, ny = npc.y + dy;
            if (map[ny]?.[nx]?.type?.accessible) {
                npc.x = nx;
                npc.y = ny;
            }
        }
    }
}

/**
 * Dialogue / quêtes : appelé quand un joueur parle au PNJ présent sur sa case.
 */
export function handleNpcInteraction(player, npc) {
    if (!npc || !player) return;

    const quest = npc.availableQuest;

    // Pas de quête (ou déjà rendue) : simple dialogue
    if (!quest || quest.isCompleted) {
        const line = npc.dialogueLines[Math.floor(Math.random() * npc.dialogueLines.length)];
        player.notifications.push({ type: 'chat', message: `${npc.name} : « ${line} »`, style: 'system_info' });
        return;
    }

    // Le joueur a-t-il les objets requis ?
    const { item, amount } = quest.requirement;
    const owned = typeof player.inventory[item] === 'number' ? player.inventory[item] : 0;

    if (owned >= amount) {
        // Rendre la quête
        player.inventory[item] -= amount;
        if (player.inventory[item] <= 0) delete player.inventory[item];
        player.inventory[quest.reward.item] = (player.inventory[quest.reward.item] || 0) + quest.reward.amount;
        quest.isCompleted = true;
        player.notifications.push({ type: 'chat', message: `${npc.name} : « Merci infiniment ! Tiens, c'est pour toi. » (+10 XP)`, style: 'gain' });
        player.notifications.push({ type: 'floatingText', message: `+${quest.reward.amount} ${quest.reward.item}`, style: 'gain' });
        player.notifications.push({ type: 'floatingText', message: `-${amount} ${item}`, style: 'cost' });
        addXp(player, 10);
    } else {
        player.notifications.push({ type: 'chat', message: `${npc.name} : « ${quest.description} » (${owned}/${amount} ${item} — récompense : ${quest.reward.amount} ${quest.reward.item})`, style: 'system_info' });
    }
}
