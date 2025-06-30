// server/state.js

import { TILE_TYPES, CONFIG, ITEM_TYPES } from '../public/js/config.js';

export let gameState = {};

/**
 * Initialise ou réinitialise l'état complet du jeu.
 * @param {object} config - L'objet de configuration du jeu.
 */
export function initializeGameState(config) {
    console.log("Initializing game state...");
    gameState = {
        map: generateMap(config.MAP_WIDTH, config.MAP_HEIGHT),
        players: {},
        npcs: [],
        enemies: [],
        globallyRevealedTiles: new Set(),
        day: 1,
        time: 0,
        config: config,
        combatState: null,
        knownRecipes: {}, // Recettes connues par tous les joueurs
        tutorialState: {
            active: false,
            step: 0,
            completed: false,
            isTemporarilyHidden: false,
            welcomeMessageShown: false,
        }
    };
    // Initialiser quelques PNJ et ennemis si nécessaire
}

// --- Mise à jour quotidienne ---
export async function dailyUpdate() {
    if (!gameState) return;

    gameState.day++;
    console.log(`A new day has begun: Day ${gameState.day}`);

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
 * Ajoute un nouveau joueur à l'état du jeu avec des valeurs par défaut.
 * @param {string} playerId - L'ID unique du nouveau joueur.
 */
export function addNewPlayer(playerId) {
    // Crée le joueur directement ici, sans appeler une fonction externe
    const newPlayer = {
        id: playerId,
        name: `Joueur_${Math.floor(Math.random() * 1000)}`,
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
            'Eau pure': 2,
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
    };

    gameState.players[playerId] = newPlayer;
    console.log(`Player ${playerId} added to the game.`);
}

/**
 * Retire un joueur de l'état du jeu.
 * @param {string} playerId - L'ID du joueur à retirer.
 */
export function removePlayer(playerId) {
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

export function startCombat(player, enemy) {
    if (gameState.combatState) return; // Un combat est déjà en cours

    player.isBusy = true;
    gameState.combatState = {
        playerId: player.id,
        enemyId: enemy.id,
        log: [`Un ${enemy.name} sauvage apparaît !`],
        isPlayerTurn: true,
    };

    player.notifications.push({ 
        type: 'chat', 
        message: `Vous entrez en combat avec ${enemy.name} !`, 
        style: 'combat_start' 
    });
}

export function endCombat(playerWon) {
    if (!gameState.combatState) return;

    const player = gameState.players[gameState.combatState.playerId];
    if (player) {
        player.isBusy = false;
    }

    if (playerWon) {
        // Supprimer l'ennemi seulement si le joueur a gagné
        gameState.enemies = gameState.enemies.filter(e => e.id !== gameState.combatState.enemyId);
    }

    gameState.combatState = null;
}