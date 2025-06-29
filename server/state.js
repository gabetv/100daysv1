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
    const map = [];
    // Logique de génération de carte simple pour l'exemple
    for (let y = 0; y < height; y++) {
        map[y] = [];
        for (let x = 0; x < width; x++) {
            let tileTypeKey = 'PLAINS';
            const random = Math.random();
            if (random < 0.3) tileTypeKey = 'FOREST';
            else if (random < 0.4) tileTypeKey = 'PLAGE';
            else if (random < 0.45) tileTypeKey = 'MINE_TERRAIN';
            
            if (x === 0 || y === 0 || x === width -1 || y === height - 1) {
                tileTypeKey = 'WATER_LAGOON';
            }

            const tileType = TILE_TYPES[tileTypeKey];
            map[y][x] = {
                ...tileType, // Copie toutes les propriétés de TILE_TYPES
                key: tileTypeKey, // Ajoute la clé (ex: 'FOREST')
                x,
                y,
                type: tileType,
                backgroundKey: tileType.background[Math.floor(Math.random() * tileType.background.length)],
                buildings: [],
                groundItems: {},
                // Réinitialiser les propriétés spécifiques à l'instance si nécessaire
                woodActionsLeft: tileType.woodActionsLeft,
                harvests: tileType.harvests,
                huntActionsLeft: tileType.huntActionsLeft,
                searchActionsLeft: tileType.searchActionsLeft,
            };
        }
    }
    return map;
}