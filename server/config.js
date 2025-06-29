const CONFIG = {
    MAP_WIDTH: 20, MAP_HEIGHT: 20, TILE_SIZE: 192, MINIMAP_DOT_SIZE: 8,
    NUM_NPCS: 4,
    NPC_BASE_HEALTH: 8,
    NPC_BASE_DAMAGE: 1,
    NPC_AGGRO_RADIUS: 3,
    INITIAL_ENEMIES: 0, MAX_ENEMIES: 6, ENEMY_SPAWN_CHECK_DAYS: 3,
    DAY_DURATION_MS: 120000, STAT_DECAY_INTERVAL_MS: 180000,
    NPC_ACTION_INTERVAL_MS: 3000, CHAT_MESSAGE_INTERVAL_MS: 25000,
    PLAYER_BASE_MAX_RESOURCES: 50,
    MAX_BUILDINGS_PER_TILE: 1,
    FOG_OF_WAR_REVEAL_THRESHOLD: 5,
    VICTORY_DAY: 200,
};

const ENEMY_TYPES = {
    WOLF: { name: 'Loup Agressif', icon: '🐺', health: 10, damage: 2, color: '#dc2626', aggroRadius: 4, loot: { 'Peau de bête': 1, 'Os': 2, 'Viande crue': 1 } },
    SNAKE: { name: 'Serpent Venimeux', icon: '🐍', health: 6, damage: 3, color: '#16a34a', aggroRadius: 3, loot: { 'Viande crue': 1, 'Venin': 1 } },
    RAT: { name: 'Rat Furtif', icon: '🐀', health: 1, damage: 1, color: '#6b7280', aggroRadius: 1, loot: {'Cadenas cassé': 1} }
};

const TILE_TYPES = {
    WATER_LAGOON: { name: 'Lagon', accessible: false, color: '#48cae4', background: ['bg_sand_1'], icon: '🌊', description: "Une étendue d'eau salée infranchissable." },
    PLAGE: {
        name: 'Plage', accessible: true, buildable: false, color: '#f4d35e', background: ['bg_sand_2'], icon: '🏖️',
        description: "Du sable fin à perte de vue.",
        actionsAvailable: { search_zone: 10, harvest_sand: 10, fish: 5, harvest_salt_water: 10 }
    },
    FOREST: { name: 'Forêt', resource: { type: 'Bois', yield: 1 }, accessible: true, buildable: false, color: '#2d6a4f', background: ['bg_forest_1'], icon: '🌲', description: "Une forêt dense.", woodActionsLeft: 10, huntActionsLeft: 10, searchActionsLeft: 15 },
    WASTELAND: { name: 'Friche', accessible: true, buildable: true, color: '#9c6644', background: ['bg_wasteland_1'], icon: '🍂', regeneration: { cost: { 'Eau pure': 5, 'Graine d\'arbre': 10 }, target: 'FOREST' }, description: "Une terre aride et désolée." },
    PLAINS: { name: 'Plaine', accessible: true, color: '#80b918', background: ['bg_plains_1'], icon: '🌳', buildable: true, description: "Une vaste étendue herbeuse.", huntActionsLeft: 5, searchActionsLeft: 10 },
    MINE_TERRAIN: { name: 'Mine (Terrain)', accessible: true, buildable: false, color: '#8d99ae', background: ['bg_stone_1'], resource: { type: 'Pierre', yield: 1 }, harvests: 10, icon: '⛰️', description: "Un affleurement rocheux riche en minerais.", action: { id: 'search_ore_tile', name: 'Chercher du Minerai (Terrain)', results: [ { item: 'Minerai d\'or', chance: 0.001 }, {item: 'Minerai de cuivre', chance: 0.10}, { item: 'Minerai d\'argent', chance: 0.01 }, { item: 'Souffre', chance: 0.05 }, { item: 'Minerai de fer', chance: 0.20 }, { item: 'Charbon', chance: 0.50 } ]} },
    TREASURE_CHEST: {
        name: 'Trésor Caché', accessible: true, color: '#DAA520', icon: '💎',
        background: ['bg_treasure_chest'],
        requiresKey: 'Clé du Trésor',
        description: "Un coffre mystérieux."
    },
};

module.exports = { CONFIG, ENEMY_TYPES, TILE_TYPES };