// server/state.js

import { TILE_TYPES, CONFIG, ITEM_TYPES } from '../public/js/config.js';
import { initNpcs } from './npc.js';
import { initEnemies } from './enemy.js';

export let gameState = {};

/**
 * Initialise ou réinitialise l'état complet du jeu.
 * @param {object} config - L'objet de configuration du jeu.
 */
export function initializeGameState(config) {
    console.log("Initializing game state...");
    const map = generateMap(config.MAP_WIDTH, config.MAP_HEIGHT);
    gameState = {
        map: map,
        players: {},
        npcs: [],
        enemies: [],
        globallyRevealedTiles: new Set(),
        day: 1,
        time: 0,
        config: config,
        victory: null,
        knownRecipes: {}, // Recettes connues par tous les joueurs
        tutorialState: {
            active: false,
            step: 0,
            completed: false,
            isTemporarilyHidden: false,
            welcomeMessageShown: false,
        }
    };
    // Peupler l'île : survivants PNJ et premiers dangers
    gameState.npcs = initNpcs(config, map);
    gameState.enemies = initEnemies(config, map);
    console.log(`Spawned ${gameState.npcs.length} NPCs and ${gameState.enemies.length} enemies.`);
}

// --- Mise à jour quotidienne ---
export async function dailyUpdate() {
    if (!gameState) return;
    if (gameState.victory) return; // La partie est gagnée, on fige le compteur

    gameState.day++;
    console.log(`A new day has begun: Day ${gameState.day}`);

    // Annonce du nouveau jour à tous les joueurs
    Object.values(gameState.players).forEach(player => {
        player.notifications.push({ type: 'chat', message: `☀️ Jour ${gameState.day} / ${CONFIG.VICTORY_DAY} — un nouveau jour se lève.`, style: 'system_event' });
    });

    // La nature reprend ses droits : les ressources se régénèrent lentement
    regenerateResources();

    // Tous les 3 jours : les PNJ ont de nouveaux besoins (quêtes réinitialisées)
    if (gameState.day % 3 === 0) {
        let questsReset = false;
        gameState.npcs.forEach(npc => {
            if (npc.availableQuest && npc.availableQuest.isCompleted) {
                npc.availableQuest.isCompleted = false;
                questsReset = true;
            }
        });
        if (questsReset) {
            Object.values(gameState.players).forEach(player => {
                player.notifications.push({ type: 'chat', message: "📢 Les survivants ont de nouveaux besoins... Allez leur parler !", style: 'system_event' });
            });
        }
    }

    // Condition de victoire : survivre 100 jours
    if (gameState.day >= CONFIG.VICTORY_DAY) {
        gameState.victory = { type: 'survival', day: gameState.day, by: null };
        Object.values(gameState.players).forEach(player => {
            player.notifications.push({ type: 'chat', message: `🏆 VICTOIRE ! Vous avez survécu ${CONFIG.VICTORY_DAY} jours ! Les secours arrivent enfin...`, style: 'gain' });
        });
        console.log('VICTORY! Players survived to day', gameState.day);
        return;
    }

    // Apparition des ennemis
    if (gameState.day % CONFIG.ENEMY_SPAWN_CHECK_DAYS === 0) {
        if (gameState.enemies.length < CONFIG.MAX_ENEMIES) {
            const { spawnSingleEnemy } = await import('./enemy.js'); // Importation dynamique
            const newEnemy = spawnSingleEnemy(gameState.map);
            if (newEnemy) {
                gameState.enemies.push(newEnemy);
                // Notifier tous les joueurs
                Object.values(gameState.players).forEach(player => {
                    player.notifications.push({ type: 'chat', message: "Vous sentez une présence hostile non loin...", style: 'system_event' });
                });
                console.log(`A new enemy has spawned: ${newEnemy.name}`);
            }
        }
    }

    // Autres logiques quotidiennes (ex: météo) peuvent être ajoutées ici
}

/**
 * Régénère progressivement les ressources des tuiles (bois, gibier, fouilles, pierre).
 */
function regenerateResources() {
    for (const row of gameState.map) {
        for (const tile of row) {
            const def = TILE_TYPES[tile.key];
            if (!def) continue;
            if (def.woodActionsLeft !== undefined && tile.woodActionsLeft < def.woodActionsLeft) {
                tile.woodActionsLeft = Math.min(def.woodActionsLeft, tile.woodActionsLeft + 2);
            }
            if (def.huntActionsLeft !== undefined && tile.huntActionsLeft < def.huntActionsLeft) {
                tile.huntActionsLeft = Math.min(def.huntActionsLeft, tile.huntActionsLeft + 1);
            }
            if (def.searchActionsLeft !== undefined && tile.searchActionsLeft < def.searchActionsLeft) {
                tile.searchActionsLeft = Math.min(def.searchActionsLeft, tile.searchActionsLeft + 1);
            }
            if (def.harvests !== undefined && tile.harvests < def.harvests) {
                tile.harvests = Math.min(def.harvests, tile.harvests + 1);
            }
        }
    }
}

// --- PERSISTANCE DU MONDE (le serveur peut redémarrer sans perdre la partie) ---

/**
 * Sérialise l'état du monde (carte, jour, PNJ, ennemis...) pour la sauvegarde.
 */
export function serializeWorld() {
    return {
        day: gameState.day,
        time: gameState.time,
        victory: gameState.victory,
        knownRecipes: gameState.knownRecipes,
        globallyRevealedTiles: Array.from(gameState.globallyRevealedTiles || []),
        npcs: gameState.npcs,
        enemies: gameState.enemies.map(e => ({ ...e, inCombatWith: null })),
        map: gameState.map.map(row => row.map(tile => ({
            key: tile.key,
            x: tile.x,
            y: tile.y,
            backgroundKey: tile.backgroundKey,
            buildings: tile.buildings,
            groundItems: tile.groundItems,
            woodActionsLeft: tile.woodActionsLeft,
            harvests: tile.harvests,
            huntActionsLeft: tile.huntActionsLeft,
            searchActionsLeft: tile.searchActionsLeft,
            isOpened: tile.isOpened,
            hiddenItem: tile.hiddenItem,
        }))),
    };
}

/**
 * Restaure l'état du monde depuis une sauvegarde (au démarrage du serveur).
 * @returns {boolean} true si la restauration a réussi.
 */
export function restoreWorld(data) {
    try {
        if (!data || !Array.isArray(data.map) || data.map.length !== CONFIG.MAP_HEIGHT) return false;

        gameState.day = data.day || 1;
        gameState.time = data.time || 0;
        gameState.victory = data.victory || null;
        gameState.knownRecipes = data.knownRecipes || {};
        gameState.globallyRevealedTiles = new Set(data.globallyRevealedTiles || []);
        if (Array.isArray(data.npcs)) gameState.npcs = data.npcs;
        if (Array.isArray(data.enemies)) gameState.enemies = data.enemies;

        gameState.map = data.map.map(row => row.map(saved => {
            const type = TILE_TYPES[saved.key] || TILE_TYPES.PLAINS;
            return {
                ...saved,
                type: type,
                buildings: saved.buildings || [],
                groundItems: saved.groundItems || {},
            };
        }));

        console.log(`World restored: day ${gameState.day}, ${gameState.npcs.length} NPCs, ${gameState.enemies.length} enemies.`);
        return true;
    } catch (e) {
        console.error('Failed to restore world, generating a new one:', e);
        return false;
    }
}

/**
 * Ajoute un nouveau joueur à l'état du jeu avec des valeurs par défaut,
 * ou restaure sa progression sauvegardée si elle existe.
 * @param {string} playerId - L'ID unique du nouveau joueur.
 * @param {string|null} username - Le pseudo du compte (null = invité).
 * @param {object|null} savedData - Progression sauvegardée à restaurer.
 */
export function addNewPlayer(playerId, username = null, savedData = null) {
    // Crée le joueur directement ici, sans appeler une fonction externe
    const newPlayer = {
        id: playerId,
        username: username,
        name: username || `Invité_${Math.floor(Math.random() * 1000)}`,
        x: 10,
        y: 10,
        color: `hsl(${Math.random() * 360}, 100%, 70%)`,
        health: 20,
        maxHealth: 20,
        thirst: 20,
        maxThirst: 20,
        hunger: 20,
        maxHunger: 20,
        sleep: 20,
        maxSleep: 20,
        inventory: { // Inventaire de départ
            'Hache': { name: 'Hache', durability: 50, currentDurability: 50 },
            'Canne à pêche': { name: 'Canne à pêche', durability: 10, currentDurability: 10 },
            'Eau pure': 3,
            'Viande cuite': 2
        },
        maxInventory: CONFIG.PLAYER_BASE_MAX_RESOURCES,
        equipment: {
            head: null,
            body: null,
            feet: null,
            weapon: null,
            shield: null,
            bag: null,
        },
        status: [],
        visitedTiles: new Set(['10,10']), // Le joueur a visité sa case de départ
        notifications: [],
        isBusy: false,
        animationState: null,
        knownRecipes: {},
        deaths: 0,
        treasureOpened: false,
        xp: 0,
        level: 1,
    };

    // Restaurer la progression sauvegardée (comptes uniquement)
    if (savedData && typeof savedData === 'object') {
        const restorable = ['x', 'y', 'color', 'health', 'maxHealth', 'thirst', 'maxThirst',
            'hunger', 'maxHunger', 'sleep', 'maxSleep', 'inventory', 'maxInventory',
            'equipment', 'status', 'knownRecipes', 'deaths', 'treasureOpened', 'xp', 'level'];
        for (const key of restorable) {
            if (savedData[key] !== undefined) newPlayer[key] = savedData[key];
        }
        if (Array.isArray(savedData.visitedTiles)) {
            newPlayer.visitedTiles = new Set(savedData.visitedTiles);
        }
        // Sécurité : position valide sur la carte actuelle (elle est régénérée au redémarrage)
        const { MAP_WIDTH, MAP_HEIGHT } = gameState.config;
        if (newPlayer.x < 0 || newPlayer.x >= MAP_WIDTH || newPlayer.y < 0 || newPlayer.y >= MAP_HEIGHT ||
            !gameState.map[newPlayer.y]?.[newPlayer.x]?.type?.accessible) {
            newPlayer.x = 10;
            newPlayer.y = 10;
        }
        newPlayer.visitedTiles.add(`${newPlayer.x},${newPlayer.y}`);
        newPlayer.notifications.push({ type: 'chat', message: `Bon retour, ${newPlayer.name} ! Votre progression a été restaurée.`, style: 'gain' });
    } else {
        // Message d'accueil pour un nouveau survivant
        newPlayer.notifications.push({ type: 'chat', message: `🏝️ Bienvenue sur l'île, ${newPlayer.name} ! Vous êtes naufragé depuis ${gameState.day} jour(s).`, style: 'system_event' });
        newPlayer.notifications.push({ type: 'chat', message: "🎯 Votre mission : trouver la Clé du Trésor en fouillant les zones, ouvrir le Trésor Caché, puis tirer la fusée de détresse depuis une plage pour être secouru. Sinon... survivez 100 jours !", style: 'system_info' });
        newPlayer.notifications.push({ type: 'chat', message: "💡 Conseil : mangez, buvez et dormez pour rester en vie. Parlez aux survivants (💬), ils récompensent les coups de main.", style: 'system_info' });
    }

    gameState.players[playerId] = newPlayer;
    console.log(`Player ${playerId} added to the game.`);
}

/**
 * Extrait les données persistables d'un joueur pour la sauvegarde.
 * @param {object} player - Le joueur à sérialiser.
 * @returns {object} Un objet JSON-compatible.
 */
export function serializePlayer(player) {
    return {
        x: player.x,
        y: player.y,
        color: player.color,
        health: player.health,
        maxHealth: player.maxHealth,
        thirst: player.thirst,
        maxThirst: player.maxThirst,
        hunger: player.hunger,
        maxHunger: player.maxHunger,
        sleep: player.sleep,
        maxSleep: player.maxSleep,
        inventory: player.inventory,
        maxInventory: player.maxInventory,
        equipment: player.equipment,
        status: player.status,
        knownRecipes: player.knownRecipes,
        deaths: player.deaths || 0,
        treasureOpened: player.treasureOpened || false,
        xp: player.xp || 0,
        level: player.level || 1,
        visitedTiles: Array.from(player.visitedTiles || []),
    };
}

/**
 * Retire un joueur de l'état du jeu.
 * @param {string} playerId - L'ID du joueur à retirer.
 */
export function removePlayer(playerId) {
    const player = gameState.players[playerId];
    if (player && player.combatState) {
        endCombat(player, false); // Libérer l'ennemi si le joueur était en combat
    }
    delete gameState.players[playerId];
    console.log(`Player ${playerId} removed from the game.`);
}

/**
 * Génère une nouvelle carte de jeu.
 * @param {number} width - Largeur de la carte.
 * @param {number} height - Hauteur de la carte.
 * @returns {Array<Array<object>>} La carte 2D générée.
 */
function generateMap(width, height) {
    console.log("Starting controlled map generation for server...");
    const map = Array(height).fill(null).map(() => Array(width).fill(null));

    // 1. Créer une disposition de base terre/eau
    const baseLayout = Array.from({ length: height }, () => Array(width).fill('land'));
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
                baseLayout[y][x] = 'water';
            } else if (y === 1 || y === height - 2 || x === 1 || x === width - 2) {
                if (Math.random() < 0.6) baseLayout[y][x] = 'water';
            }
        }
    }

    // 2. Placer les types de tuiles de base (Plage, Forêt, Plaine)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (baseLayout[y][x] === 'water') {
                map[y][x] = { type: TILE_TYPES.WATER_LAGOON, key: 'WATER_LAGOON' };
                continue;
            }
            let isCoastal = false;
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                if (baseLayout[y + dy]?.[x + dx] === 'water') {
                    isCoastal = true;
                    break;
                }
            }
            if (isCoastal) {
                map[y][x] = { type: TILE_TYPES.PLAGE, key: 'PLAGE' };
            } else {
                const key = Math.random() < 0.6 ? 'FOREST' : 'PLAINS';
                map[y][x] = { type: TILE_TYPES[key], key };
            }
        }
    }

    const specialLocations = [];

    // 3. Placer les points d'intérêt (Trésor, Clé, Mines)
    // Logique de placement sécurisée pour éviter les blocages
    const placeSpecialTile = (tileKey) => {
        let attempts = 0;
        while (attempts < 200) {
            const x = Math.floor(Math.random() * (width - 2)) + 1;
            const y = Math.floor(Math.random() * (height - 2)) + 1;
            if (map[y][x].type.accessible && !specialLocations.some(loc => loc.x === x && loc.y === y)) {
                if (tileKey === 'hiddenKey') {
                    map[y][x].hiddenItem = 'Clé du Trésor';
                } else {
                    map[y][x] = { type: TILE_TYPES[tileKey], key: tileKey };
                }
                specialLocations.push({ x, y });
                console.log(`${tileKey} placed at (${x}, ${y})`);
                return;
            }
            attempts++;
        }
        console.warn(`Could not place ${tileKey} after 200 attempts.`);
    };

    placeSpecialTile('TREASURE_CHEST');
    placeSpecialTile('hiddenKey');
    placeSpecialTile('MINE_TERRAIN');
    placeSpecialTile('MINE_TERRAIN');

    // 4. Finaliser chaque tuile avec ses propriétés d'instance
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const tileData = map[y][x];
            const type = tileData.type;
            const backgroundOptions = type.background || [];
            const backgroundKey = backgroundOptions.length > 0 ? backgroundOptions[Math.floor(Math.random() * backgroundOptions.length)] : 'bg_plains_1';

            map[y][x] = {
                ...tileData, // Conserve la clé et le type déjà définis
                x,
                y,
                type: type, // Assure que le type complet est là
                backgroundKey,
                buildings: [],
                groundItems: {},
                woodActionsLeft: type.woodActionsLeft,
                harvests: type.harvests,
                huntActionsLeft: type.huntActionsLeft,
                searchActionsLeft: type.searchActionsLeft,
                isOpened: type.name === 'Trésor Caché' ? false : undefined,
            };
        }
    }

    console.log("Map generation finished for server.");
    return map;
}

/**
 * Démarre un combat entre UN joueur et un ennemi (chaque joueur a son propre combat).
 */
export function startCombat(player, enemy) {
    if (player.combatState) return; // Ce joueur est déjà en combat
    if (enemy.inCombatWith && gameState.players[enemy.inCombatWith]) {
        player.notifications.push({ type: 'chat', message: `${enemy.name} est déjà aux prises avec un autre survivant !`, style: 'system_warning' });
        return;
    }

    enemy.inCombatWith = player.id;
    player.combatState = {
        enemyId: enemy.id,
        enemy: {
            name: enemy.name,
            icon: enemy.icon,
            health: enemy.health,
            currentHealth: enemy.currentHealth,
            damage: enemy.damage,
        },
        turn: 'player',
        log: [`Un ${enemy.name} sauvage vous attaque !`],
    };

    player.notifications.push({ 
        type: 'chat', 
        message: `⚔️ Vous entrez en combat avec ${enemy.name} !`, 
        style: 'combat_start' 
    });
}

export function endCombat(player, playerWon) {
    if (!player || !player.combatState) return;

    const enemyId = player.combatState.enemyId;
    const enemy = gameState.enemies.find(e => e.id === enemyId);
    if (enemy) enemy.inCombatWith = null;

    if (playerWon) {
        // Supprimer l'ennemi seulement si le joueur a gagné
        gameState.enemies = gameState.enemies.filter(e => e.id !== enemyId);
    }

    player.combatState = null;
}

/**
 * Fin de partie : un survivant a alerté les secours (fusée / pistolet de détresse).
 */
export function triggerRescueVictory(player) {
    if (gameState.victory) return;
    gameState.victory = {
        type: 'rescue',
        by: player.name,
        day: gameState.day,
    };
    Object.values(gameState.players).forEach(p => {
        p.notifications.push({ type: 'chat', message: `🚁 ${player.name} a alerté les secours ! Un hélicoptère approche... VOUS ÊTES SAUVÉS !`, style: 'gain' });
    });
    console.log(`RESCUE VICTORY triggered by ${player.name} on day ${gameState.day}`);
}