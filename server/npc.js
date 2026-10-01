import { CONFIG, TILE_TYPES } from '../public/js/config.js';
import { gameState } from './state.js';
import { addXp } from './player.js';

/**
 * ============================================================
 *  IA DES PNJ — « Les survivants s'organisent »
 * ============================================================
 *  Les PNJ ne se contentent plus d'errer : ils suivent un plan
 *  de reconstruction du camp.
 *
 *  Cycle de vie d'un PNJ :
 *    1. Choisir un projet de construction (plan communautaire)
 *    2. Récolter les ressources manquantes (bois en forêt,
 *       pierre sur les affleurements rocheux)
 *    3. Rejoindre un terrain constructible et bâtir
 *    4. Une fois le plan terminé : stocker du bois au camp
 *
 *  Chaque PNJ expose `activity` (libellé lisible), `goal`,
 *  `target` et `project` — le client s'en sert pour la
 *  mini-carte et les dialogues.
 */

// Plan de reconstruction communautaire, dans l'ordre des priorités.
// `max` = nombre d'exemplaires que les PNJ chercheront à bâtir.
const BUILD_PLAN = [
    { key: 'CAMPFIRE', max: 2 },
    { key: 'SHELTER_INDIVIDUAL', max: 2 },
    { key: 'ETABLI', max: 1 },
    { key: 'ATELIER', max: 1 },
    { key: 'SHELTER_COLLECTIVE', max: 1 },
];

// Rendement de récolte des PNJ (volontairement modeste pour ne pas
// vider l'île avant le passage des joueurs).
const NPC_WOOD_YIELD = 2;
const NPC_STONE_YIELD = 2;
const NPC_STOCKPILE_TARGET = 10;  // Bois apporté au camp quand tout est construit
const NPC_WOOD_RESERVE = 4;       // Actions de bois laissées aux joueurs en mode stock
const NPC_STOCKPILE_CAP = 200;    // Les PNJ arrêtent de stocker au-delà (le camp est plein)

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
            capacity: 90,
            // --- IA de travail ---
            goal: 'idle',          // idle | gather | goto | build | stockpile | flee | wander
            project: null,         // Clé TILE_TYPES du bâtiment en cours (ex: 'CAMPFIRE')
            target: null,          // {x, y} : destination actuelle
            path: [],              // Chemin BFS restant (liste de pas)
            activity: 'Explore les environs',
            buildingsBuilt: 0,
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
                "Gardons espoir.",
                "Un bon abri, voilà ce qu'il nous faut.",
                "Avec assez de bois, on peut tout reconstruire."
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

// ------------------------------------------------------------------
//  Outils internes
// ------------------------------------------------------------------

function notifyAll(message, style = 'system_event') {
    Object.values(gameState.players || {}).forEach(p => {
        if (!p.notifications) p.notifications = [];
        p.notifications.push({ type: 'chat', message, style });
    });
}

function notifyOnTile(x, y, message, style = 'system_info') {
    Object.values(gameState.players || {}).forEach(p => {
        if (p.x === x && p.y === y) {
            if (!p.notifications) p.notifications = [];
            p.notifications.push({ type: 'chat', message, style });
        }
    });
}

/**
 * BFS sur les cases accessibles : renvoie le chemin (liste de pas,
 * sans la case de départ) vers la case la plus proche validant `predicate`.
 * Renvoie null si aucune case n'est joignable.
 */
function findPathToNearest(map, startX, startY, predicate) {
    const height = map.length;
    const width = map[0]?.length || 0;
    if (!width) return null;

    const startTile = map[startY]?.[startX];
    if (startTile && predicate(startTile)) return [];

    const visited = new Set([`${startX},${startY}`]);
    const queue = [{ x: startX, y: startY, path: [] }];
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    while (queue.length > 0) {
        const current = queue.shift();
        for (const [dx, dy] of dirs) {
            const nx = current.x + dx;
            const ny = current.y + dy;
            const key = `${nx},${ny}`;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height || visited.has(key)) continue;
            visited.add(key);
            const tile = map[ny][nx];
            if (!tile?.type?.accessible) continue;
            const path = [...current.path, { x: nx, y: ny }];
            if (predicate(tile)) return path;
            queue.push({ x: nx, y: ny, path });
        }
    }
    return null;
}

/** Compte les bâtiments d'un type donné érigés par les PNJ sur toute la carte. */
function countNpcBuildings(structureKey) {
    let count = 0;
    for (const row of gameState.map) {
        for (const tile of row) {
            for (const b of (tile.buildings || [])) {
                if (b.key === structureKey && b.builtByNpc) count++;
            }
        }
    }
    return count;
}

/** Choisit le prochain projet du plan communautaire non encore couvert. */
function chooseProject(npc) {
    const claimedByOthers = {};
    for (const other of gameState.npcs) {
        if (other.id !== npc.id && other.project) {
            claimedByOthers[other.project] = (claimedByOthers[other.project] || 0) + 1;
        }
    }
    for (const entry of BUILD_PLAN) {
        const def = TILE_TYPES[entry.key];
        if (!def || !def.isBuilding) continue;
        const existing = countNpcBuildings(entry.key) + (claimedByOthers[entry.key] || 0);
        if (existing < entry.max) return entry.key;
    }
    return null; // Tout le plan est couvert
}

/** Ressources encore manquantes pour le projet courant. */
function missingResources(npc, structureKey) {
    const def = TILE_TYPES[structureKey];
    if (!def?.cost) return [];
    const missing = [];
    for (const [resource, amount] of Object.entries(def.cost)) {
        if (resource === 'toolRequired') continue; // Les PNJ improvisent avec les moyens du bord
        const owned = npc.inventory[resource] || 0;
        if (owned < amount) missing.push({ resource, amount: amount - owned });
    }
    return missing;
}

function isWoodTile(tile) {
    return tile.key === 'FOREST' && (tile.woodActionsLeft || 0) > 0;
}

/** En mode stock, les PNJ laissent une réserve de bois aux joueurs. */
function isWoodTileWithReserve(tile) {
    return tile.key === 'FOREST' && (tile.woodActionsLeft || 0) > NPC_WOOD_RESERVE;
}

function isStoneTile(tile) {
    return tile.key === 'MINE_TERRAIN' && (tile.harvests ?? tile.harvestsLeft ?? 0) > 0;
}

function isBuildSite(tile) {
    return tile.type?.buildable
        && (tile.buildings || []).length < CONFIG.MAX_BUILDINGS_PER_TILE;
}

/** Une case avec un bâtiment PNJ disposant d'un inventaire (pour le stock communautaire). */
function isStockpileSite(tile) {
    return (tile.buildings || []).some(b => b.inventory && TILE_TYPES[b.key]?.maxInventory);
}

function enemyAt(x, y) {
    return (gameState.enemies || []).find(e => e.x === x && e.y === y);
}

/** Avance d'un pas le long du chemin calculé. Renvoie true si un pas a été fait. */
function stepAlongPath(npc) {
    if (!Array.isArray(npc.path) || npc.path.length === 0) return false;
    const next = npc.path.shift();
    const tile = gameState.map[next.y]?.[next.x];
    if (!tile?.type?.accessible) { // Le monde a changé : recalculer au prochain tick
        npc.path = [];
        return false;
    }
    npc.x = next.x;
    npc.y = next.y;
    return true;
}

/** Déplacement aléatoire d'une case (errance / fuite). */
function wanderStep(npc, map) {
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of dirs) {
        const nx = npc.x + dx, ny = npc.y + dy;
        if (map[ny]?.[nx]?.type?.accessible) {
            npc.x = nx;
            npc.y = ny;
            return true;
        }
    }
    return false;
}

/** Récolte sur la case courante si elle correspond à la ressource visée. */
function tryHarvestHere(npc, resource) {
    const tile = gameState.map[npc.y]?.[npc.x];
    if (!tile) return false;

    if (resource === 'Bois' && isWoodTile(tile)) {
        tile.woodActionsLeft--;
        npc.inventory['Bois'] = (npc.inventory['Bois'] || 0) + NPC_WOOD_YIELD;
        npc.activity = '🪓 Coupe du bois';
        notifyOnTile(npc.x, npc.y, `${npc.name} coupe du bois. (+${NPC_WOOD_YIELD} Bois)`);
        return true;
    }
    if (resource === 'Pierre' && isStoneTile(tile)) {
        if (typeof tile.harvests === 'number') tile.harvests--;
        else if (typeof tile.harvestsLeft === 'number') tile.harvestsLeft--;
        npc.inventory['Pierre'] = (npc.inventory['Pierre'] || 0) + NPC_STONE_YIELD;
        npc.activity = '⛏️ Extrait de la pierre';
        notifyOnTile(npc.x, npc.y, `${npc.name} extrait de la pierre. (+${NPC_STONE_YIELD} Pierre)`);
        return true;
    }
    return false;
}

/** Construit le projet courant sur la case où se trouve le PNJ. */
function buildHere(npc) {
    const tile = gameState.map[npc.y]?.[npc.x];
    const def = TILE_TYPES[npc.project];
    if (!tile || !def || !isBuildSite(tile)) return false;

    // Déduire les coûts de l'inventaire du PNJ
    for (const [resource, amount] of Object.entries(def.cost || {})) {
        if (resource === 'toolRequired') continue;
        npc.inventory[resource] = (npc.inventory[resource] || 0) - amount;
        if (npc.inventory[resource] <= 0) delete npc.inventory[resource];
    }

    tile.buildings.push({
        key: npc.project,
        ownerId: npc.id,
        ownerName: npc.name,
        builtByNpc: true,
        durability: def.durability,
        maxDurability: def.durability,
        inventory: def.maxInventory ? {} : undefined,
        isLocked: false,
        lockCode: null,
    });

    npc.buildingsBuilt = (npc.buildingsBuilt || 0) + 1;
    notifyAll(`🔨 ${npc.name} a construit : ${def.name} en (${npc.x}, ${npc.y}) !`, 'gain');
    npc.chatMessage = { text: `Et voilà, un ${def.name} tout neuf !`, timestamp: Date.now() };
    npc.project = null;
    npc.goal = 'idle';
    npc.target = null;
    npc.path = [];
    npc.activity = 'Admire son travail';
    return true;
}

/**
 * Cherche (et mémorise) un chemin vers la case la plus proche validant `predicate`.
 * Renvoie true si une destination existe.
 */
function setCourseTowards(npc, predicate, activityLabel) {
    const path = findPathToNearest(gameState.map, npc.x, npc.y, predicate);
    if (path === null) return false;
    npc.path = path;
    npc.target = path.length > 0 ? { ...path[path.length - 1] } : { x: npc.x, y: npc.y };
    if (activityLabel) npc.activity = activityLabel;
    return true;
}

// ------------------------------------------------------------------
//  Boucle de mise à jour
// ------------------------------------------------------------------

export function updateNpcs(deltaTime) {
    const { npcs, map, players } = gameState;

    for (let i = npcs.length - 1; i >= 0; i--) {
        const npc = npcs[i];

        // Rétro-compatibilité : anciens mondes sauvegardés sans les champs d'IA
        if (!npc.inventory) npc.inventory = {};
        if (!Array.isArray(npc.path)) npc.path = [];
        if (npc.goal === 'harvesting') npc.goal = 'idle';
        if (!npc.activity) npc.activity = 'Explore les environs';

        if (npc.health <= 0) {
            notifyAll(`${npc.name} a été vaincu...`, 'system_warning');
            npcs.splice(i, 1);
            continue;
        }

        // Bavardage périodique (seulement si des joueurs sont sur la même case)
        npc.timeSinceLastChat = (npc.timeSinceLastChat || 0) + deltaTime;
        if (npc.timeSinceLastChat >= CONFIG.CHAT_MESSAGE_INTERVAL_MS) {
            npc.timeSinceLastChat = Math.random() * 8000; // Désynchroniser les PNJ
            const line = pickDialogue(npc);
            npc.chatMessage = { text: line, timestamp: Date.now() };
            Object.values(players).forEach(p => {
                if (p.x === npc.x && p.y === npc.y) {
                    p.notifications.push({ type: 'chat', message: `${npc.name} : « ${line} »`, style: 'system_info' });
                }
            });
        }

        // Un « tick » d'action toutes les NPC_ACTION_INTERVAL_MS
        npc.timeSinceLastMove += deltaTime;
        if (npc.timeSinceLastMove < CONFIG.NPC_ACTION_INTERVAL_MS) continue;
        npc.timeSinceLastMove = 0;

        // 1) Survie d'abord : fuir un monstre présent sur la case
        const threat = enemyAt(npc.x, npc.y);
        if (threat) {
            npc.goal = 'flee';
            npc.activity = `😱 Fuit ${threat.name || 'un monstre'}`;
            npc.path = [];
            npc.target = null;
            wanderStep(npc, map);
            continue;
        }

        // 2) S'assurer d'avoir un projet (ou passer en mode stock communautaire)
        if (!npc.project) {
            npc.project = chooseProject(npc);
        }

        if (npc.project) {
            runProjectTick(npc);
        } else {
            runStockpileTick(npc, map);
        }
    }
}

/** Tick de travail quand le PNJ a un projet de construction. */
function runProjectTick(npc) {
    const def = TILE_TYPES[npc.project];
    if (!def) { npc.project = null; return; }

    const missing = missingResources(npc, npc.project);

    // --- Phase RÉCOLTE ---
    if (missing.length > 0) {
        const need = missing[0];
        npc.goal = 'gather';
        npc.targetResource = need.resource;

        // Déjà sur une bonne case ? On récolte.
        if (tryHarvestHere(npc, need.resource)) return;

        // Sinon on avance vers la ressource la plus proche.
        if (npc.path.length === 0) {
            const predicate = need.resource === 'Bois' ? isWoodTile : isStoneTile;
            const label = need.resource === 'Bois'
                ? `🪓 Cherche du bois (${npc.inventory['Bois'] || 0}/${def.cost['Bois'] || 0})`
                : `⛏️ Cherche de la pierre (${npc.inventory['Pierre'] || 0}/${def.cost['Pierre'] || 0})`;
            if (!setCourseTowards(npc, predicate, label)) {
                // Ressource introuvable (tout est épuisé) : errer en attendant la régénération quotidienne
                npc.activity = `🤔 Attend que les ressources repoussent (${need.resource})`;
                npc.goal = 'wander';
                if (Math.random() < 0.5) wanderStep(npc, gameState.map);
                return;
            }
        }
        stepAlongPath(npc);
        return;
    }

    // --- Phase CONSTRUCTION ---
    npc.goal = 'build';
    npc.targetResource = null;
    const hereTile = gameState.map[npc.y]?.[npc.x];
    if (hereTile && isBuildSite(hereTile)) {
        buildHere(npc);
        return;
    }
    if (npc.path.length === 0) {
        if (!setCourseTowards(npc, isBuildSite, `🔨 Cherche un terrain pour bâtir : ${def.name}`)) {
            npc.activity = '🤔 Ne trouve aucun terrain constructible';
            npc.goal = 'wander';
            if (Math.random() < 0.5) wanderStep(npc, gameState.map);
            return;
        }
    }
    npc.activity = `🚶 Va bâtir : ${def.name}`;
    stepAlongPath(npc);
}

/** Stock total de bois déjà entreposé par les PNJ dans les bâtiments-coffres. */
function campWoodStock() {
    let total = 0;
    for (const row of gameState.map) {
        for (const tile of row) {
            for (const b of (tile.buildings || [])) {
                if (b.inventory && TILE_TYPES[b.key]?.maxInventory) total += b.inventory['Bois'] || 0;
            }
        }
    }
    return total;
}

/** Tick quand tout le plan est construit : stock de bois pour le camp. */
function runStockpileTick(npc, map) {
    const woodCarried = npc.inventory['Bois'] || 0;

    // Camp déjà bien approvisionné : les PNJ patrouillent au lieu de
    // vider les forêts de l'île (les ressources restent aux joueurs).
    if (woodCarried < NPC_STOCKPILE_TARGET && campWoodStock() >= NPC_STOCKPILE_CAP) {
        npc.goal = 'wander';
        npc.activity = '🧭 Patrouille autour du camp';
        npc.target = null;
        npc.path = [];
        if (Math.random() < 0.5) wanderStep(npc, map);
        return;
    }

    // Dépôt : apporter le bois à un bâtiment-coffre du camp
    if (woodCarried >= NPC_STOCKPILE_TARGET) {
        const hereTile = map[npc.y]?.[npc.x];
        if (hereTile && isStockpileSite(hereTile)) {
            const chest = hereTile.buildings.find(b => b.inventory && TILE_TYPES[b.key]?.maxInventory);
            chest.inventory['Bois'] = (chest.inventory['Bois'] || 0) + woodCarried;
            delete npc.inventory['Bois'];
            npc.activity = '📦 Dépose du bois au camp';
            notifyAll(`📦 ${npc.name} a déposé ${woodCarried} Bois dans ${TILE_TYPES[chest.key].name}.`, 'system_info');
            npc.goal = 'idle';
            npc.path = [];
            npc.target = null;
            return;
        }
        npc.goal = 'stockpile';
        if (npc.path.length === 0) {
            if (!setCourseTowards(npc, isStockpileSite, '📦 Rapporte du bois au camp')) {
                // Aucun entrepôt : simple errance
                npc.goal = 'wander';
                npc.activity = '🧭 Patrouille autour du camp';
                if (Math.random() < 0.5) wanderStep(npc, map);
                return;
            }
        }
        stepAlongPath(npc);
        return;
    }

    // Collecte de bois pour le stock (en laissant une réserve aux joueurs)
    npc.goal = 'gather';
    npc.targetResource = 'Bois';
    const hereTile = map[npc.y]?.[npc.x];
    if (hereTile && isWoodTileWithReserve(hereTile) && tryHarvestHere(npc, 'Bois')) return;
    if (npc.path.length === 0) {
        if (!setCourseTowards(npc, isWoodTileWithReserve, `🪓 Récolte pour le camp (${woodCarried}/${NPC_STOCKPILE_TARGET} Bois)`)) {
            npc.goal = 'wander';
            npc.activity = '🧭 Patrouille autour du camp';
            if (Math.random() < 0.5) wanderStep(npc, map);
            return;
        }
    }
    stepAlongPath(npc);
}

/** Ligne de dialogue : privilégie l'activité en cours pour l'immersion. */
function pickDialogue(npc) {
    const activityLines = [];
    if (npc.project && TILE_TYPES[npc.project]) {
        const def = TILE_TYPES[npc.project];
        const missing = missingResources(npc, npc.project);
        if (missing.length > 0) {
            activityLines.push(`Encore ${missing[0].amount} ${missing[0].resource} et je pourrai bâtir un ${def.name}.`);
            activityLines.push(`Je récolte de quoi construire un ${def.name}.`);
        } else {
            activityLines.push(`J'ai tout ce qu'il faut, je cherche où bâtir mon ${def.name} !`);
        }
    } else if ((npc.buildingsBuilt || 0) > 0) {
        activityLines.push("Le camp prend forme, pas vrai ?");
        activityLines.push("Je rapporte du bois pour les réserves.");
    }
    const pool = activityLines.length > 0 && Math.random() < 0.6 ? activityLines : npc.dialogueLines;
    return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Dialogue / quêtes : appelé quand un joueur parle au PNJ présent sur sa case.
 */
export function handleNpcInteraction(player, npc) {
    if (!npc || !player) return;

    const quest = npc.availableQuest;

    // Pas de quête (ou déjà rendue) : dialogue teinté par l'activité en cours
    if (!quest || quest.isCompleted) {
        const line = pickDialogue(npc);
        player.notifications.push({ type: 'chat', message: `${npc.name} : « ${line} »`, style: 'system_info' });
        if (npc.activity) {
            player.notifications.push({ type: 'chat', message: `(${npc.name} — ${npc.activity})`, style: 'system_info' });
        }
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
