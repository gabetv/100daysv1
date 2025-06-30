//js/config.js

export const ACTIONS = {
    // Action de déplacement
    MOVE: 'move',

    // Player Actions (existantes)
    INITIATE_COMBAT: 'initiate_combat',
    CONSUME_EAU_SALEE: 'consume_eau_salee', 
    HARVEST_SALT_WATER: 'harvest_salt_water',
    HARVEST_SAND: 'harvest_sand',
    HARVEST_STONE: 'harvest',
    HARVEST_WOOD_HACHE: 'harvest_wood_hache',
    HARVEST_WOOD_SCIE: 'harvest_wood_scie',
    HARVEST_WOOD_MAINS: 'harvest_wood_mains',
    FISH: 'fish',
    NET_FISH: 'net_fish',
    HUNT: 'hunt',
    BUILD_STRUCTURE: 'build_structure',
    REGENERATE_FOREST: 'regenerate_forest',
    PLANT_TREE: 'plant_tree',
    SLEEP: 'sleep',
    SLEEP_BY_CAMPFIRE: 'sleep_by_campfire',
    COOK: 'cook',
    SEARCH_ZONE: 'search_zone',
    TAKE_HIDDEN_ITEM: 'take_hidden_item',
    OPEN_TREASURE: 'open_treasure',
    USE_BUILDING_ACTION: 'use_building_action',
    CRAFT_ITEM_WORKSHOP: 'craft_item_workshop',
    DISMANTLE_BUILDING: 'dismantle_building',
    OPEN_ALL_PARCHEMINS: 'open_all_parchemins',
    FIRE_DISTRESS_GUN: 'fire_distress_gun',
    FIRE_DISTRESS_FLARE: 'fire_distress_flare',
    PLACE_SOLAR_PANEL_FIXED: 'place_solar_panel_fixed',
    CHARGE_BATTERY_PORTABLE_SOLAR: 'charge_battery_portable_solar',
    PLACE_TRAP: 'place_trap',
    ATTRACT_NPC_ATTENTION: 'attract_npc_attention',
    FIND_MINE_COMPASS: 'find_mine_compass',
    REPAIR_BUILDING: 'repair_building',
    SET_LOCK: 'set_lock',
    REMOVE_LOCK: 'remove_lock',
    OPEN_LARGE_MAP: 'open_large_map',
    TALK_TO_NPC: 'talk_to_npc',
    OPEN_BUILDING_INVENTORY: 'open_building_inventory',

    // Building specific actions (existantes)
    SEARCH_ORE_TILE: 'search_ore_tile',
    PLAY_ELECTRIC_GUITAR: 'play_electric_guitar',
    USE_ATELIER: 'use_atelier',
    USE_ETABLI: 'use_etabli',
    USE_FORGE: 'use_forge',
    OBSERVE_WEATHER: 'observe_weather',
    GENERATE_PLAN: 'generate_plan',

    // Tutorial Actions (existantes)
    TUTORIAL_HIDE_AND_MOVE: 'tutorial_hide_and_move',
    TUTORIAL_NEXT: 'tutorial_next',
    TUTORIAL_SKIP: 'tutorial_skip',

    // NOUVELLES ACTIONS POUR LE MENU CONTEXTUEL ET DRAG & DROP
    MOVE_ITEM: 'move_item',
    CONSUME_ITEM_CONTEXT: 'consume_item_context',
    EQUIP_ITEM_CONTEXT: 'equip_item_context',
    UNEQUIP_ITEM_CONTEXT: 'unequip_item_context',
    DROP_ITEM_CONTEXT: 'drop_item_context',
    PICKUP_ITEM_CONTEXT: 'pickup_item_context',
    OPEN_BUILD_MODAL: 'open_build_modal',
    SEND_CHAT_MESSAGE: 'send_chat_message',
};

export const CONFIG = {
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

export const COMBAT_CONFIG = {
    PLAYER_UNARMED_DAMAGE: 1,
    FLEE_CHANCE: 0.5,
};

export const ACTION_DURATIONS = {
    HARVEST: 500, CRAFT: 200, SLEEP: 1000, MOVE_TRANSITION: 200,
    DIG: 1000,
    SEARCH: 500,
    OPEN_TREASURE: 1000,
    BUILD: 1000,
    USE_BUILDING_ACTION: 1000,
    PLANT_TREE: 1000,
    USE_MAP: 500,
    DISMANTLE: 2000,
    SLEEP_BY_FIRE: 1000,
    COOK: 800,
    BOIL_WATER: 600,
    PUMP_WATER: 700,
    GENERATE_PLAN: 5 * 3600 * (CONFIG.DAY_DURATION_MS / (24*3600*1000)), // Simule 5 heures
    OBSERVE_WEATHER: 1000,
    FIRE_DISTRESS_GUN: 1500,
    FIRE_DISTRESS_FLARE: 1000,
    PLACE_SOLAR_PANEL: 2000,
    CHARGE_PORTABLE_SOLAR: 3000,
    PLACE_TRAP: 800,
    ATTRACT_NPC: 500,
    FIND_MINE_COMPASS: 1200,
    SET_LOCK: 500,
    PLAY_GUITAR: 1500,
    TUTORIAL_ACTION: 100, // Durée générique pour les actions du tutoriel
};
// ... Le reste du fichier reste identique ...
// ... (ENEMY_TYPES, ORE_TYPES, ALL_SEARCHABLE_ITEMS, etc.)
export const ENEMY_TYPES = {
    WOLF: { name: 'Loup Agressif', icon: '🐺', health: 10, damage: 2, color: '#dc2626', aggroRadius: 4, loot: { 'Peau de bête': 1, 'Os': 2, 'Viande crue': 1 } },
    SNAKE: { name: 'Serpent Venimeux', icon: '🐍', health: 6, damage: 3, color: '#16a34a', aggroRadius: 3, loot: { 'Viande crue': 1, 'Venin': 1 } },
    RAT: { name: 'Rat Furtif', icon: '🐀', health: 1, damage: 1, color: '#6b7280', aggroRadius: 1, loot: {'Cadenas cassé': 1} }
};

export const ORE_TYPES = ['Charbon', 'Cuivre', 'Fer', 'Argent', 'Or', 'Souffre'];

export const ALL_SEARCHABLE_ITEMS = [
    'Feuilles', 'Liane', 'Pierre', 'Sable', 'Insectes', 'Écorce',
    'Os', 'Résine', 'Poisson cru', 'Viande crue', 'Oeuf cru',
    'Banane', 'Noix de coco', 'Sel', 'Cuir',
    'Bandage', 'Charbon', 'Sucre',
    'Composants électroniques', 'Batterie déchargée', 'Médicaments', 'Antiseptique', 'Allumettes', 'Briquet', 'Loupe',
    'Clé du Trésor', 'Graine d\'arbre', 'Carte',
    'Minerai de cuivre',
];

export const SEARCH_ZONE_CONFIG = {
    FOREST: {
        combatChance: 0.0,
        noLootChance: 0.15,
        lootTiers: { common: 0.60, uncommon: 0.25, rare: 0.10, veryRare: 0.08, offTable: 0.01 },
        enemyType: 'RAT',
        specificLoot: {
            common: ['Feuilles', 'Liane', 'Écorce', 'Insectes', 'Parchemin Atelier Bois_PelleBois', 'Parchemin Atelier Bois_Gourdain', 'Parchemin Atelier BoisFer_Hache', 'Parchemin Atelier Bois_Etabli', 'Parchemin Atelier PeauBete_Cuir', 'Parchemin Atelier Ecorce_Bois_1', 'Minerai de cuivre'],
            uncommon: ['Os', 'Résine', 'Viande crue', 'Banane', 'Oeuf cru', 'Parchemin Atelier BoisFer_Scie', 'Parchemin Atelier Bois_EpeeBois', 'Parchemin Atelier BoisHamecon_CannePeche', 'Graine d\'arbre', 'Parchemin Atelier CuirCorde_PetitSac', 'Minerai de cuivre'],
            rare: ['Bandage', 'Allumettes', 'Parchemin Atelier Bois_LanceBois', 'Parchemin Atelier Planches_Seau', 'Parchemin Atelier Ecorce_Bois_4', 'Minerai de cuivre'],
            veryRare: ['Médicaments', 'Plan d\'ingénieur', 'Recette médicinale', 'Parchemin Atelier CuirFicelle_VetementCuirSimple', 'Parchemin Atelier Ecorce_Bois_2', 'Parchemin Atelier LoupeArgent_Lunette', 'Briquet', 'Parchemin Atelier PlanFer_Cadenas'],
            offTable: ['Parchemin Atelier Cuir_Sandalette', 'Parchemin Atelier Ecorce_Bois_8', 'Parchemin Atelier CuirCorde_GrandSac', 'Loupe']
        }
    },
    PLAGE: {
        combatChance: 0.0,
        noLootChance: 0.25,
        lootTiers: { common: 0.50, uncommon: 0.30, rare: 0.15, veryRare: 0.08, offTable: 0.01 },
        enemyType: 'RAT',
        specificLoot: {
            common: ['Sable', 'Pierre', 'Insectes', 'Sel', 'Minerai de cuivre'],
            uncommon: ['Poisson cru', 'Noix de coco', 'Liane', 'Oeuf cru', 'Carte', 'Minerai de cuivre'],
            rare: ['Composants électroniques', 'Parchemin Atelier Lianes_Ficelle'],
            veryRare: ['Batterie déchargée', 'Plan d\'ingénieur', 'Recette médicinale'],
            offTable: ['Parchemin Atelier VerreElec_Ecran']
        }
    },
    PLAINS: {
        combatChance: 0.0,
        noLootChance: 0.30,
        lootTiers: { common: 0.60, uncommon: 0.25, rare: 0.10, veryRare: 0.08, offTable: 0.01 },
        enemyType: 'RAT',
        specificLoot: {
            common: ['Feuilles', 'Pierre', 'Insectes', 'Oeuf cru', 'Minerai de cuivre'],
            uncommon: ['Os', 'Banane', 'Viande crue', 'Parchemin Atelier BoisFer_PelleFer', 'Parchemin Atelier BoisFer_EpeeFer', 'Minerai de cuivre'],
            rare: ['Bandage', 'Parchemin Atelier BoisBriquet_Torche', 'Parchemin Atelier BoisAllumette_Torche', 'Parchemin Atelier BoisLoupe_Torches'],
            veryRare: ['Plan d\'ingénieur', 'Recette médicinale'] ,
            offTable: ['Parchemin Atelier ElecEcran_BatterieDechargee']
        }
    },
    MINE: { // Search action for Mine building
        combatChance: 0.0,
        noLootChance: 0.10,
        lootTiers: { common: 0.40, uncommon: 0.30, rare: 0.20, veryRare: 0.08, offTable: 0.02 },
        enemyType: 'SNAKE',
        specificLoot: {
            common: ['Pierre', 'Os', 'Charbon', 'Minerai de cuivre'],
            uncommon: ['Résine', 'Parchemin Atelier Ficelles_Corde', 'Parchemin Atelier Pierre_BlocTaille', 'Minerai de cuivre'],
            rare: ['Composants électroniques', 'Batterie déchargée', 'Antiseptique', 'Parchemin Atelier Feuilles_FeuilleTressee', 'Parchemin Atelier FeuilleTressee_Chapeau'],
            veryRare: ['Clé du Trésor', 'Plan d\'ingénieur', 'Recette médicinale', 'Parchemin Atelier FeuilleTressee_Pagne', 'Parchemin Atelier Sables_Verre'],
            offTable: ['Parchemin Atelier FerOr_PistoletDetresse']
        }
    },
    WASTELAND: {
        combatChance: 0.0,
        noLootChance: 0.30,
        lootTiers: { common: 0.70, uncommon: 0.20, rare: 0.05, veryRare: 0.01, offTable: 0.04 },
        enemyType: 'RAT',
        specificLoot: {
            common: ['Pierre', 'Insectes', 'Minerai de cuivre'],
            uncommon: ['Os', 'Sable', 'Minerai de cuivre'],
            rare: ['Parchemin Atelier Verre_Loupe', 'Carte'],
            veryRare: [],
            offTable: ['Parchemin Atelier PlanPlanche_PorteBois', 'Parchemin Atelier PlanOr_Boussole', 'Parchemin Atelier PlanArgent_Sifflet', 'Parchemin Atelier PlanOr_PorteBonheur',
                       'Parchemin Atelier PlanFer_KitReparation', 'Parchemin Atelier PlanCorde_FiletPeche', 'Parchemin Atelier ElecEcran_PanneauSolaireFixe',
                       'Parchemin Atelier ElecEcran_PanneauSolairePortable', 'Parchemin Atelier ElecEcran_TelephoneDecharge', 'Parchemin Atelier ElecEcran_RadioDechargee', 'Parchemin Atelier PlanCharbon_FiltreEau']
        }
    }
};


export const ITEM_TYPES = {
    // === RESSOURCES ===
    'Bois': { type: 'resource', icon: '🌳' }, 'Pierre': { type: 'resource', icon: '🪨🪨' },
    'Feuilles': { type: 'resource', icon: '🍃' }, 'Liane': { type: 'resource', icon: '🌿' },
    'Écorce': { type: 'resource', icon: '🟫' }, 'Résine': { type: 'resource', icon: '💧' },
    'Sable': { type: 'resource', icon: '⏳' }, 'Peau de bête': { type: 'resource', icon: 'ቆዳ' },
    'Cadenas': { type: 'resource', icon: '🔒' }, 'Cadenas cassé': { type: 'resource', icon: '🔓💥' },
    'Os': { type: 'resource', icon: '🦴' },
    'Sel': { type: 'consumable', icon: '🧂', effects: { hunger: 2, thirst: -2 } },
    'Composants électroniques': {type: 'resource', icon: '⚙️'},
    'Charbon': {type: 'resource', icon: '⚫'},
    'Planche': { type: 'resource', icon: '🟧' },
    'Ficelle': { type: 'resource', icon: '〰️' },
    'Corde': { type: 'resource', icon: '🪢' },
    'Bloc taillé': { type: 'resource', icon: '🧱' },
    'Feuille tressée': { type: 'resource', icon: '📜' },
    'Verre': { type: 'resource', icon: '🍸' },
    'Minerai de fer': { type: 'resource', icon: '🔩' },
    'Minerai d\'or': { type: 'resource', icon: '💰' },
    'Minerai d\'argent': { type: 'resource', icon: '🥈' },
    'Minerai de cuivre': { type: 'resource', icon: '🥉' },
    'Souffre': { type: 'resource', icon: '💨' },
    'Fer': { type: 'resource', icon: '쇠' },
    'Or': { type: 'resource', icon: '🥇' },
    'Argent': { type: 'resource', icon: '💍' },
    'Cuivre': { type: 'resource', icon: '🥉🔩' },
    'Explosif': { type: 'resource', icon: '💥' },
    'Huile de coco': { type: 'consumable', icon: '🥥🧴', effects: { health: 1 } },
    'Savon': { type: 'consumable', icon: '🧼', effects: { health: 3 } },
    'Eau croupie': { type: 'consumable', icon: '🚱', effects: { thirst: 2, custom: 'eauCroupieEffect' } },
    'Hameçon': { type: 'resource', icon: '🪝' },
    'Plan d\'ingénieur': { type: 'resource', icon: '📐', rarity: 'veryRare' },
    'Recette médicinale': { type: 'resource', icon: '℞', rarity: 'veryRare' },
    'Graine d\'arbre': { type: 'resource', icon: '🌱' },
    'Cuir': { type: 'resource', icon: '🟫皮革' },
    'Batterie chargée': { type: 'consumable', icon: '🔋⚡', effects: { custom: 'chargeDevice'} },
    'Écran électronique': { type: 'resource', icon: '🖥️' },

    // === CONSOMMABLES ===
    'Eau pure': { type: 'consumable', icon: '💧', effects: { thirst: 10 } },
    'Eau salée': { type: 'consumable', icon: '🌊💧', effects: { thirst: 3, health: -1, custom: 'eauSaleeEffect' } },
    'Insectes': { type: 'consumable', icon: '🦗', effects: { hunger: 1 } },
    'Viande crue': { type: 'consumable', icon: '🥩', effects: { hunger: 1, status: [{ name: 'Malade', chance: 0.3 }] } },
    'Viande cuite': { type: 'consumable', icon: '🍖', effects: { hunger: 3 } },
    'Poisson cru': { type: 'consumable', icon: '🐟', effects: { hunger: 3, status: [{ name: 'Malade', chance: 0.8}] } },
    'Poisson cuit': { type: 'consumable', icon: '🐠🔥', effects: { hunger: 2 } },
    'Oeuf cru': { type: 'consumable', icon: '🥚', effects: { hunger: 2, status: [{ name: 'Malade', chance: 0.6 }] } },
    'Oeuf cuit': { type: 'consumable', icon: '🍳', effects: { hunger: 3 } },
    'Banane': { type: 'consumable', icon: '🍌', effects: { hunger: 2, thirst: 1 } },
    'Noix de coco': { type: 'consumable', icon: '🥥', effects: { thirst: 3 } },
    'Canne à sucre': { type: 'consumable', icon: '🎋', effects: { hunger: 3, thirst: -1 } },
    'Sucre': { type: 'consumable', icon: '🍬', effects: { hunger: 4, thirst: -1 } },
    'Barre Énergétique': { type: 'consumable', icon: '🍫', effects: { hunger: 6, sleep: 4 } },
    'Médicaments': { type: 'consumable', icon: '💊', effects: { ifStatus: ['Malade', 'Drogué'], status: 'normale', health: 4 } },
    'Antiseptique': { type: 'consumable', icon: '🧴', effects: { ifStatus: ['Blessé', 'Malade'], status: 'normale', health: 3 } },
    'Bandage': { type: 'consumable', icon: '🩹', effects: { health: 2 } },
    'Kit de Secours': { type: 'consumable', icon: '✚', effects: { ifStatus: ['Malade'], status: 'normale', health: 3 } },
    'Batterie déchargée': {type: 'resource', icon: '🔋❌'},
    'Venin': { type: 'consumable', icon: '🧪', effects: { status: [{ name: 'Empoisonné', chance: 1.0 }] } },
    'Fiole empoisonnée': { type: 'consumable', icon: '☠️', effects: { health: -1000 } },
    'Fiole anti-poison': { type: 'consumable', icon: '🧪✨', effects: { ifStatus: 'Empoisonné', status: 'normale', health: 10 } },
    'Drogue': { type: 'consumable', icon: '😵‍💫', effects: { sleep: 5, hunger: 5, custom: 'drogueEffect' } },
    'Porte bonheur': { type: 'consumable', icon: '🍀', effects: { custom: 'porteBonheur' } },
    'Carte': {type: 'usable', icon: '🗺️', uses: 30, action: 'open_large_map' },
    'Alcool': { type: 'consumable', icon: '🍺', effects: { thirst: 10, health: -2, status: [{ name: 'Alcoolisé', chance: 1.0 }] } },
    'Breuvage étrange': { type: 'consumable', icon: '🧪❓', effects: { custom: 'breuvageEtrangeEffect' } },

    // Parchemins
    'Parchemin Atelier Bois_PelleBois': { type: 'consumable', icon: '📜', teachesRecipe: 'Pelle en bois', rarity: 'common', description: "Transformer 10 bois = 1 pelle en bois", unique: true },
    'Parchemin Atelier Bois_Gourdain': { type: 'consumable', icon: '📜', teachesRecipe: 'Gourdain', rarity: 'common', description: "Transformer 15 bois = 1 gourdain", unique: true },
    'Parchemin Atelier BoisFer_Hache': { type: 'consumable', icon: '📜', teachesRecipe: 'Hache', rarity: 'common', description: "Transformer 10 bois et 5 fer = 1 hache", unique: true },
    'Parchemin Atelier BoisFer_Scie': { type: 'consumable', icon: '📜', teachesRecipe: 'Scie', rarity: 'common', description: "Transformer 10 bois et 10 fer = 1 scie", unique: true },
    'Parchemin Atelier Bois_EpeeBois': { type: 'consumable', icon: '📜', teachesRecipe: 'Épée en bois', rarity: 'common', description: "Transformer 20 bois = 1 épée en bois", unique: true },
    'Parchemin Atelier BoisHamecon_CannePeche': { type: 'consumable', icon: '📜', teachesRecipe: 'Canne à pêche', rarity: 'common', description: "Transformer 25 bois + 1 hameçon = 1 canne à pêche", unique: true },
    'Parchemin Atelier Bois_LanceBois': { type: 'consumable', icon: '📜', teachesRecipe: 'Lance en bois', rarity: 'common', description: "Transformer 25 bois = 1 lance en bois", unique: true },
    'Parchemin Atelier Planches_Seau': { type: 'consumable', icon: '📜', teachesRecipe: 'Seau', rarity: 'common', description: "Transformer 5 planches = 1 seau", unique: true },
    'Parchemin Atelier Bois_Etabli': { type: 'consumable', icon: '📜', teachesRecipe: 'Établi', rarity: 'common', description: "Construire un établi simple pour l'artisanat de base.", isBuildingRecipe: true, unique: true },
    'Parchemin Atelier BoisFer_PelleFer': { type: 'consumable', icon: '📜', teachesRecipe: 'Pelle en fer', rarity: 'uncommon', description: "Transformer 10 bois et 5 fer = 1 pelle en fer", unique: true },
    'Parchemin Atelier BoisFer_EpeeFer': { type: 'consumable', icon: '📜', teachesRecipe: 'Épée en fer', rarity: 'uncommon', description: "Transformer 15 bois et 5 fer = 1 épée en fer", unique: true },
    'Parchemin Atelier BoisBriquet_Torche': { type: 'consumable', icon: '📜', teachesRecipe: 'Torche (Briquet)', rarity: 'uncommon', description: "Transformer 15 bois et 1 briquet = 1 torche", unique: true },
    'Parchemin Atelier BoisAllumette_Torche': { type: 'consumable', icon: '📜', teachesRecipe: 'Torche (Allumette)', rarity: 'uncommon', description: "Transformer 15 bois et 1 allumette = 1 torche", unique: true },
    'Parchemin Atelier BoisLoupe_Torches': { type: 'consumable', icon: '📜', teachesRecipe: '5 Torches (Loupe)', rarity: 'uncommon', description: "Transformer 15 bois et 1 loupe = 5 torche", unique: true },
    'Parchemin Atelier Lianes_Ficelle': { type: 'consumable', icon: '📜', teachesRecipe: 'Ficelle', rarity: 'rare', description: "Transformer 10 lianes = 1 ficelle", unique: true },
    'Parchemin Atelier Ficelles_Corde': { type: 'consumable', icon: '📜', teachesRecipe: 'Corde', rarity: 'rare', description: "Transformer 10 ficelles = 1 Corde", unique: true },
    'Parchemin Atelier Pierre_BlocTaille': { type: 'consumable', icon: '📜', teachesRecipe: 'Bloc taillé', rarity: 'rare', description: "Transformer 10 pierre = 1 bloc taillé", unique: true },
    'Parchemin Atelier Feuilles_FeuilleTressee': { type: 'consumable', icon: '📜', teachesRecipe: 'Feuille tressée', rarity: 'rare', description: "Transformer 10 feuilles = 1 feuille tressé", unique: true },
    'Parchemin Atelier FeuilleTressee_Chapeau': { type: 'consumable', icon: '📜', teachesRecipe: 'Chapeau feuillu', rarity: 'rare', description: "Transformer 10 feuille tressé = 1 Chapeau feuillu", unique: true },
    'Parchemin Atelier FeuilleTressee_Pagne': { type: 'consumable', icon: '📜', teachesRecipe: 'Pagne feuillu', rarity: 'rare', description: "Transformer 20 feuille tressé = 1 pagne feuillu", unique: true },
    'Parchemin Atelier Cuir_Sandalette': { type: 'consumable', icon: '📜', teachesRecipe: 'Sandalette', rarity: 'rare', description: "Transformer 10 Peau de bête = 1 paire de sandalette", unique: true },
    'Parchemin Atelier Sables_Verre': { type: 'consumable', icon: '📜', teachesRecipe: 'Verre', rarity: 'rare', description: "Transformer 10 sables = 1 verre", unique: true },
    'Parchemin Atelier Verre_Loupe': { type: 'consumable', icon: '📜', teachesRecipe: 'Loupe', rarity: 'rare', description: "Transformer 10 verre = 1 loupe", unique: true },
    'Parchemin Atelier PlanPlanche_PorteBois': { type: 'consumable', icon: '📜', teachesRecipe: 'Porte en bois', rarity: 'veryRare', description: "Transformer 1 Plan d'ingénieur + 10 planche = 1 Porte en bois", unique: true },
    'Parchemin Atelier PlanOr_Boussole': { type: 'consumable', icon: '📜', teachesRecipe: 'Boussole', rarity: 'veryRare', description: "Transformer 1 Plan d'ingénieur + 1 or = 1 boussole", unique: true },
    'Parchemin Atelier PlanArgent_Sifflet': { type: 'consumable', icon: '📜', teachesRecipe: 'Sifflet', rarity: 'veryRare', description: "Transformer 1 Plan d'ingénieur + 1 argent = 1 sifflet", unique: true },
    'Parchemin Atelier PlanOr_PorteBonheur': { type: 'consumable', icon: '📜', teachesRecipe: 'Porte bonheur', rarity: 'veryRare', description: "Transformer 1 Plan d'ingénieur + 1 or = Porte bonheur", unique: true },
    'Parchemin Atelier PlanFer_KitReparation': { type: 'consumable', icon: '📜', teachesRecipe: 'Kit de réparation', rarity: 'veryRare', description: "Transformer 1 Plan d'ingénieur + 30 fer = 1 kit de réparation", unique: true },
    'Parchemin Atelier PlanCorde_FiletPeche': { type: 'consumable', icon: '📜', teachesRecipe: 'Filet de pêche', rarity: 'veryRare', description: "Transformer 1 Plan d'ingénieur + 10 corde = 1 Filet de pêche", unique: true },
    'Parchemin Atelier VerreElec_Ecran': { type: 'consumable', icon: '📜', teachesRecipe: 'Écran électronique', rarity: 'veryRare', description: "Transformer 10 verre et 10 composant électronique = 1 écran electronique", unique: true },
    'Parchemin Atelier ElecEcran_BatterieDechargee': { type: 'consumable', icon: '📜', teachesRecipe: 'Batterie déchargée', rarity: 'offtable', description: "Transformer 20 composants electronique et 1 écran éléctronique = 1 batterie déchargé", unique: true },
    'Parchemin Atelier FerOr_PistoletDetresse': { type: 'consumable', icon: '📜', teachesRecipe: 'Pistolet de détresse', unique: true, description: "Transformer 45 fer 5 or = pistolet de détresse" },
    'Parchemin Atelier ElecEcran_PanneauSolaireFixe': { type: 'consumable', icon: '📜', teachesRecipe: 'Panneau solaire fixe', rarity: 'offtable', description: "Transformer 40 composants electronique et 1 écran éléctronique = 1 panneau solaire fixe", unique: true },
    'Parchemin Atelier ElecEcran_PanneauSolairePortable': { type: 'consumable', icon: '📜', teachesRecipe: 'Panneau solaire portable', rarity: 'offtable', description: "Transformer 20 composants electronique et 1 écran éléctronique = 1 panneau solaire portable", unique: true },
    'Parchemin Atelier ElecEcran_TelephoneDecharge': { type: 'consumable', icon: '📜', teachesRecipe: 'Téléphone déchargé', rarity: 'offtable', description: "Transformer 5 composants electronique et 1 écran éléctronique = 1 téléphone déchargé", unique: true },
    'Parchemin Atelier ElecEcran_RadioDechargee': { type: 'consumable', icon: '📜', teachesRecipe: 'Radio déchargée', rarity: 'offtable', description: "Transformer 15 composants electronique et 5 écran éléctronique = 1 radio déchargé", unique: true },
    'Parchemin Atelier PlanCharbon_FiltreEau': { type: 'consumable', icon: '📜', teachesRecipe: 'Filtre à eau', unique: true, description: "Transformer 1 plan d'ingénieur et 50 charbon = 1 filtre à eau" },
    'Parchemin Atelier PeauBete_Cuir': { type: 'consumable', icon: '📜', teachesRecipe: 'Cuir', rarity: 'common', description: "Transformer 5 Peau de bête = 1 Cuir", unique: true },
    'Parchemin Atelier CuirFicelle_VetementCuirSimple': { type: 'consumable', icon: '📜', teachesRecipe: 'Vêtement en cuir simple', rarity: 'veryRare', description: "Transformer 5 Cuir + 5 Ficelle = 1 Vêtement en cuir simple", unique: true },
    'Parchemin Atelier CuirCorde_PetitSac': { type: 'consumable', icon: '📜', teachesRecipe: 'Petit Sac', rarity: 'uncommon', description: "Transformer 10 Cuir + 3 Corde = 1 Petit Sac", unique: true },
    'Parchemin Atelier CuirCorde_GrandSac': { type: 'consumable', icon: '📜', teachesRecipe: 'Grand Sac', rarity: 'offtable', description: "Transformer 40 Cuir + 10 Corde = 1 Grand Sac", unique: true },
    'Parchemin Atelier Ecorce_Bois_1': { type: 'consumable', icon: '📜', teachesRecipe: 'Bois (10 Ecorce)', rarity: 'common', description: "Transformer 10 Écorce = 1 Bois", unique: true },
    'Parchemin Atelier Ecorce_Bois_2': { type: 'consumable', icon: '📜', teachesRecipe: '2 Bois (15 Ecorce)', rarity: 'veryRare', description: "Transformer 15 Écorce = 2 Bois", unique: true },
    'Parchemin Atelier Ecorce_Bois_4': { type: 'consumable', icon: '📜', teachesRecipe: '4 Bois (20 Ecorce)', rarity: 'rare', description: "Transformer 20 Écorce = 4 Bois", unique: true },
    'Parchemin Atelier Ecorce_Bois_8': { type: 'consumable', icon: '📜', teachesRecipe: '8 Bois (30 Ecorce)', rarity: 'offtable', description: "Transformer 30 Écorce = 8 Bois", unique: true },
    'Parchemin Atelier PlanFer_Cadenas': { type: 'consumable', icon: '📜', teachesRecipe: 'Cadenas', rarity: 'veryRare', description: "Transformer 1 Plan d'ingénieur + 10 Fer = 1 Cadenas", unique: true },
    'Parchemin Atelier LoupeArgent_Lunette': { type: 'consumable', icon: '📜', teachesRecipe: 'Lunette', rarity: 'veryRare', description: "Transformer 2 Loupe + 2 Argent = 1 Lunette", unique: true },

    // === OUTILS & ARMES ===
    'Hache': { type: 'tool', slot: 'weapon', icon: '🪓', breakChance: 0.1, power: 5, action: 'harvest_wood', stats: { damage: 3 }, rarity: 'common' },
    'Scie': { type: 'tool', slot: 'weapon', icon: '🪚', breakChance: 0.07, power: 10, action: 'harvest_wood', stats: { damage: 2 }, rarity: 'uncommon' },
    'Pelle en bois': { type: 'tool', slot: 'weapon', icon: '⛏️', breakChance: 0.2, power: 1, action: 'dig', stats: { damage: 1 }, rarity: 'common' },
    'Pelle en fer': { type: 'tool', slot: 'weapon', icon: '쇠⛏️', breakChance: 0.1, power: 3, action: 'dig', stats: { damage: 2 }, rarity: 'uncommon' },
    'Canne à pêche': { type: 'tool', slot: 'weapon', icon: '🎣', breakChance: 0.15, power: 1, action: 'fish', stats: { damage: 1 }, rarity: 'common' },
    'Filtre à eau': { type: 'tool', icon: '⚗️', uses: 10, action: 'purify_water', rarity: 'uncommon' },
    'Pioche': { type: 'tool', slot: 'weapon', icon: '⛏️', breakChance: 0.1, power: 2, action: 'mine_ore', stats: { damage: 2 }, rarity: 'uncommon' },
    'Gourdain': { type: 'weapon', slot: 'weapon', icon: '🏏', breakChance: 0.2, stats: { damage: 2 }, rarity: 'common' },
    'Lance en bois': { type: 'weapon', slot: 'weapon', icon: '🍢', breakChance: 0.15, stats: { damage: 4 }, rarity: 'common' },
    'Épée en bois': { type: 'weapon', slot: 'weapon', icon: '🗡️', breakChance: 0.25, stats: { damage: 3 }, pvpEffects: [{ name: 'Blessé', chance: 0.5 }, { name: 'Mort', chance: 0.05 }], rarity: 'common' },
    'Épée en fer': { type: 'weapon', slot: 'weapon', icon: '⚔️', breakChance: 0.1, stats: { damage: 6 }, pvpEffects: [{ name: 'Blessé', chance: 0.5 }, { name: 'Mort', chance: 0.05 }], rarity: 'uncommon' },
    'Bouclier en bois': {type: 'shield', slot: 'shield', icon: '🛡️', breakChance: 0.15, stats: {defense: 2}, rarity: 'common'},
    'Bouclier en fer': {type: 'shield', slot: 'shield', icon: '🛡️⚔️', breakChance: 0.08, stats: {defense: 4}, rarity: 'uncommon'},
    'Kit de réparation': { type: 'tool', icon: '🛠️', uses: 1, action: 'repair_building', rarity: 'rare' },
    'Filet de pêche': { type: 'tool', slot: 'weapon', icon: '🥅', uses: 15, action: 'net_fish', stats: {damage: 1}, rarity: 'uncommon' }, // Can be equipped to be used
    'Torche': { type: 'usable', slot: 'weapon', icon: '🔦', uses: 10, isFireStarter: true, stats: { damage: 1 }, rarity: 'common' },
    'Briquet': { type: 'tool', slot: 'weapon', icon: '🔥', uses: 5, isFireStarter: true, stats: { damage: 1 }, rarity: 'uncommon' },
    'Allumettes': { type: 'tool', slot: 'weapon', icon: ' ম্যাচ', uses: 1, isFireStarter: true, stats: { damage: 1 }, rarity: 'common' },
    'Seau': { type: 'tool', slot: 'weapon', icon: '🪣', breakChance: 0.1, stats: { damage: 1 }, action: 'harvest_sand', rarity: 'common' }, // Can also be a weapon
    'Radio déchargée': { type: 'tool', slot: 'weapon', icon: '📻❌', breakChance: 0.05, action: null, stats: { damage: 0 }, rarity: 'rare' },
    'Téléphone déchargé': { type: 'tool', slot: 'weapon', icon: '📱❌', breakChance: 0.05, action: null, stats: { damage: 0 }, rarity: 'rare' },
    'Radio chargée': { type: 'tool', slot: 'weapon', icon: '📻⚡', uses: 3, action: 'listen_radio_if_charged', stats: { damage: 0 }, rarity: 'rare' },
    'Guitare déchargé': { type: 'tool', slot: 'weapon', icon: '🎸❌', breakChance: 0.05, stats: { damage: 1 }, rarity: 'rare' },
    'Guitare': { type: 'tool', slot: 'weapon', icon: '🎸⚡', uses: 1, action: 'play_electric_guitar', stats: { damage: 1 }, rarity: 'rare' },
    'Téléphone chargé': { type: 'tool', slot: 'weapon', icon: '📱⚡', uses: 5, action: 'attempt_call_if_charged', stats: { damage: 0 }, rarity: 'rare' },

    // === ÉQUIPEMENT ===
    'Vêtements': { type: 'body', slot: 'body', icon: '👕', stats: { maxHealth: 2 } },
    'Vêtement en cuir simple': {type: 'body', slot: 'body', icon: '🧥', stats: { defense: 1 }, durability: 20 },
    'Chaussures': { type: 'feet', slot: 'feet', icon: '👟', stats: { maxSleep: 2 } },
    'Chapeau': { type: 'head', slot: 'head', icon: '👒', stats: { maxThirst: 2 } },
    'Chapeau feuillu': { type: 'head', slot: 'head', icon: '🌿👒', stats: { maxThirst: 1, defense: 1 }, durability: 10 },
    'Pagne feuillu': { type: 'body', slot: 'body', icon: '🌿👗', stats: { defense: 2 }, durability: 15 },
    'Sandalette': { type: 'feet', slot: 'feet', icon: '👣', stats: { maxSleep: 1 }, durability: 10 },
    'Petit Sac': { type: 'bag', slot: 'bag', icon: '🎒', stats: { maxInventory: 30 } },
    'Grand Sac': { type: 'bag', slot: 'bag', icon: '🛍️', stats: { maxInventory: 100 } },
    'Loupe': { type: 'tool', slot: 'weapon', icon: '🔍', uses: 3, isFireStarter: true, stats: { damage: 1 } },
    'Lunette': { type: 'head', slot: 'head', icon: '👓', stats: { maxHealth: 1 }, durability: 15 },

    // === DIVERS (utilisables non-consommables directs) ===
    'Boussole': {type: 'usable', slot: 'weapon', icon: '🧭', uses: 10, action: 'find_mine_compass', stats: {damage: 0}}, // Can be equipped
    'Sifflet': { type: 'usable', slot: 'weapon', icon: '😗', uses: 5, action: 'attract_npc_attention', stats: {damage: 0} }, // Can be equipped
    'Pistolet de détresse': { type: 'usable', slot: 'weapon', icon: '🔫', uses: 2, action: 'fire_distress_gun', stats: {damage: 1} },
    'Fusée de détresse': { type: 'usable', icon: '🧨', uses: 1, action: 'fire_distress_flare' },
    'Clé du Trésor': { type: 'key', icon: '🔑', unique: true },
    'Porte en bois': { type: 'component', icon: '🚪' },
    'Panneau solaire fixe': { type: 'usable', icon: '☀️', uses: 1, action: 'place_solar_panel_fixed' },
    'Panneau solaire portable': { type: 'usable', slot: 'weapon', icon: '🌞', uses: 5, action: 'charge_battery_portable_solar', stats: {damage:0} },
    'Piège': { type: 'usable', icon: '🪤', uses: 1, action: 'place_trap' },
};


export const TREASURE_COMBAT_KIT = {
    'Épée en fer': 1,
    'Bouclier en fer': 1,
    'Kit de Secours': 3,
    'Barre Énergétique': 5
};

export const SPRITESHEET_PATHS = {
    bg_forest_1: 'assets/bg_forest_1.png', bg_forest_2: 'assets/bg_forest_2.png', bg_forest_3: 'assets/bg_forest_3.png', bg_forest_4: 'assets/bg_forest_4.png',
    bg_plains_1: 'assets/bg_plains_1.png', bg_plains_2: 'assets/bg_plains_2.png', bg_plains_3: 'assets/bg_plains_3.png', bg_plains_4: 'assets/bg_plains_4.png',
    bg_sand_1: 'assets/bg_sand_1.png', bg_sand_2: 'assets/bg_sand_2.png', bg_sand_3: 'assets/bg_sand_3.png', bg_sand_4: 'assets/bg_sand_4.png',
    bg_wasteland_1: 'assets/bg_wasteland_1.png', bg_wasteland_2: 'assets/bg_wasteland_2.png', bg_wasteland_3: 'assets/bg_wasteland_3.png', bg_wasteland_4: 'assets/bg_wasteland_4.png',
    bg_stone_1: 'assets/bg_stone_1.png',
    bg_stone_2: 'assets/bg_stone_2.png',
    bg_shelter_individual: 'assets/bg_shelter_individual.png',
    bg_shelter_collective: 'assets/bg_shelter_collective.png',
    bg_campfire: 'assets/bg_campfire.png',
    bg_mine: 'assets/bg_mine.png',
    bg_treasure_chest: 'assets/bg_treasure_chest.png',
};

export const TILE_TYPES = {
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

    CAMPFIRE: { name: 'Feu de Camp', accessible: true, color: '#e76f51', background: ['bg_campfire'], icon: '🔥', isBuilding: true, durability: 20,
                 cost: { 'Bois': 5, 'Pierre': 2, 'toolRequired': ['Briquet', 'Allumettes', 'Loupe']},
                 description: "Permet de cuisiner, faire bouillir de l'eau et de se réchauffer.",
                 actions: [
                     { id: 'cook_fish_campfire', name: 'Cuisiner Poisson', costItem: 'Poisson cru', costWood: 1, result: { 'Poisson cuit': 1 } },
                     { id: 'cook_meat_campfire', name: 'Cuisiner Viande', costItem: 'Viande crue', costWood: 1, result: { 'Viande cuite': 1 } },
                     { id: 'cook_egg_campfire', name: 'Cuisiner Oeuf', costItem: 'Oeuf cru', costWood: 1, result: { 'Oeuf cuit': 1 } },
                     { id: 'boil_stagnant_water_campfire', name: 'Bouillir Eau Croupie', costItem: 'Eau croupie', costWood: 1, result: { 'Eau pure': 1 } },
                     { id: 'boil_salt_water_campfire', name: 'Bouillir Eau Salée', costItem: 'Eau salée', costWood: 1, result: { 'Sel': 1 } },
                     { id: 'sleep_by_campfire', name: 'Dormir près du feu (1h)'}
                 ]
                },
    SHELTER_INDIVIDUAL: {
        name: 'Abri Individuel', accessible: true, color: '#fefae0', icon: '⛺',
        background: ['bg_shelter_individual'],
        sleepEffect: { sleep: 8, health: 3 },
        inventory: {}, maxInventory: 50, // Défaut, l'instance aura son propre inventaire/lock
        durability: 20,
        isBuilding: true,
        cost: { 'Bois': 20 },
        description: "Un petit abri pour une personne."
    },
    SHELTER_COLLECTIVE: {
        name: 'Abri Collectif', accessible: true, color: '#ffffff', icon: '🏠',
        background: ['bg_shelter_collective'],
        inventory: {}, maxInventory: 500, // Défaut
        durability: 100,
        sleepEffect: { sleep: 8, health: 5 }, isBuilding: true,
        cost: { 'Bois': 60, 'Pierre': 15 },
        description: "Un grand abri pour plusieurs survivants."
    },
    MINE: { // Bâtiment
        name: 'Mine (Bâtiment)', accessible: true, color: '#5e503f', background: ['bg_mine'], icon: '⛏️🏭',
        isBuilding: true, durability: 20,
        cost: { 'Bois': 20, 'toolRequired': ['Pelle en fer', 'Pelle en bois', 'Pioche'] },
        action: { id: 'search_ore_building', name: 'Chercher du Minerai (Bât.)', results: [
            { item: 'Minerai d\'or', chance: 0.002 }, {item: 'Minerai de cuivre', chance: 0.15}, { item: 'Minerai d\'argent', chance: 0.02 },
            { item: 'Souffre', chance: 0.08 }, { item: 'Minerai de fer', chance: 0.25 },
            { item: 'Charbon', chance: 0.60 },
        ]},
        description: "Permet d'extraire des minerais précieux de manière plus efficace."
    },
    TREASURE_CHEST: {
        name: 'Trésor Caché', accessible: true, color: '#DAA520', icon: '💎',
        background: ['bg_treasure_chest'],
        requiresKey: 'Clé du Trésor',
        description: "Un coffre mystérieux."
    },

    ATELIER: { name: 'Atelier', accessible: true, color: '#a0522d', background: ['bg_plains_2'], icon: '🛠️', isBuilding: true, durability: 200, cost: { 'Bois': 30, 'Pierre': 15 }, action: { id: 'use_atelier', name: 'Utiliser Atelier' }, description: "Permet de fabriquer des outils et objets avancés." },
    PETIT_PUIT: { name: 'Petit Puit', accessible: true, color: '#add8e6', background: ['bg_plains_3'], icon: '💧', isBuilding: true, durability: 5,
        cost: { 'Pierre': 20, 'Bois': 20, 'toolRequired': ['Pelle en bois', 'Pelle en fer'] },
        action: { id: 'draw_water_shallow_well', name: 'Puiser Eau (croupie)', result: { 'Eau croupie': 2 } },
        description: "Source d'eau croupie basique."
    },
    PUIT_PROFOND: { name: 'Puit Profond', accessible: true, color: '#87ceeb', background: ['bg_plains_4'], icon: '💦', isBuilding: true, durability: 20, cost: { 'Bloc taillé': 20, 'Seau': 1, 'toolRequired': ['Pelle en fer'] }, action: { id: 'draw_water_deep_well', name: 'Puiser Eau (croupie)', result: { 'Eau croupie': 4 } }, description: "Source d'eau croupie plus fiable." },
    BIBLIOTHEQUE: { name: 'Bibliothèque', accessible: true, color: '#deb887', background: ['bg_plains_1'], icon: '📚', isBuilding: true, durability: 100, cost: { 'Bloc taillé': 40, 'Porte en bois': 2 }, action: { id: 'generate_plan', name: 'Rechercher Plan (5h)', result: { 'Plan d\'ingénieur': 1 }, intervalHours: 5 }, description: "Permet de rechercher des plans d'ingénieur." },
    FORTERESSE: { name: 'Forteresse', accessible: true, color: '#696969', background: ['bg_shelter_collective'], icon: '🏰', isBuilding: true, durability: 500, cost: { 'Bloc taillé': 96, 'Porte en bois': 4, 'toolRequired': ['Pelle en fer'] }, sleepEffect: { sleep: 16, health: 10 }, inventory: {}, maxInventory: 1000, description: "Un bastion de survie." },
    LABORATOIRE: { name: 'Laboratoire', accessible: true, color: '#e0ffff', background: ['bg_plains_2'], icon: '🔬', isBuilding: true, durability: 200, cost: { 'Bloc taillé': 65, 'Kit de Secours': 5, 'toolRequired': ['Loupe'] },
                   actions: [
                        { id: 'use_laboratoire_antiseptic', name: 'Fabriquer Antiseptique', costItems: {'Kit de Secours': 2, 'Recette médicinale': 1}, result: {'Antiseptique': 1}},
                        { id: 'use_laboratoire_fiole_antipoison', name: 'Fabriquer Fiole Anti-Poison', costItems: {'Médicaments': 2, 'Venin': 1, 'Recette médicinale': 1}, result: {'Fiole anti-poison': 1}},
                        { id: 'use_laboratoire_drogue', name: 'Fabriquer Drogue', costItems: {'Feuilles': 10, 'Résine': 5, 'Recette médicinale': 1}, result: {'Drogue': 1}},
                        { id: 'use_laboratoire_breuvage_etrange', name: 'Fabriquer Breuvage Étrange', costItems: {'Recette médicinale': 3, 'Plan d\'ingénieur': 3}, result: {'Breuvage étrange': 1}},
                   ],
                   description: "Permet de créer des composés chimiques." },
    FORGE: { name: 'Forge', accessible: true, color: '#d2691e', background: ['bg_plains_3'], icon: '🔥🏭', isBuilding: true, durability: 200, cost: { 'Pierre': 50, 'Charbon': 20, 'toolRequired': ['Pelle en fer'] }, action: { id: 'use_forge', name: 'Utiliser Forge' }, description: "Permet de travailler les métaux. (Ouvre l'atelier avec des recettes spécifiques)." },
    BANANERAIE: { name: 'Bananeraie', accessible: true, color: '#ffffe0', background: ['bg_plains_4'], icon: '🍌🌳', isBuilding: true, durability: 80, cost: { 'Planche': 50, 'Eau pure': 20 }, actions: [ { id: 'water_plantation', name: 'Arroser plantation', costItem: 'Eau pure', costAmount: 1 }, { id: 'harvest_bananeraie', name: 'Récolter Bananes', result: { 'Banane': 3 } } ], maxHarvestsPerCycle: 10, description: "Cultive des bananes." },
    SUCRERIE: { name: 'Sucrerie', accessible: true, color: '#fafad2', background: ['bg_plains_1'], icon: '🍬🏭', isBuilding: true, durability: 80, cost: { 'Planche': 50, 'Eau pure': 20 }, actions: [ { id: 'water_plantation', name: 'Arroser plantation', costItem: 'Eau pure', costAmount: 1 }, { id: 'harvest_sucrerie', name: 'Récolter Cannes', result: { 'Canne à sucre': 3 } } ], maxHarvestsPerCycle: 10, description: "Cultive de la canne à sucre." },
    COCOTERAIE: { name: 'Cocoteraie', accessible: true, color: '#fff8dc', background: ['bg_plains_2'], icon: '🥥🌴', isBuilding: true, durability: 80, cost: { 'Planche': 50, 'Eau pure': 20 }, actions: [ { id: 'water_plantation', name: 'Arroser plantation', costItem: 'Eau pure', costAmount: 1 }, { id: 'harvest_cocoteraie', name: 'Récolter Noix de Coco', result: { 'Noix de coco': 3 } } ], maxHarvestsPerCycle: 10, description: "Cultive des noix de coco." },
    POULAILLER: { name: 'Poulailler', accessible: true, color: '#fffacd', background: ['bg_plains_3'], icon: '🐔🏡', isBuilding: true, durability: 80, cost: { 'Planche': 50, 'Eau pure': 20 }, actions: [ { id: 'abreuver_animaux', name: 'Abreuver les animaux', costItem: 'Eau pure', costAmount: 1 }, { id: 'harvest_poulailler', name: 'Récolter Oeufs', result: { 'Oeuf cru': 3 } } ], maxHarvestsPerCycle: 10, description: "Élève des poules." },
    ENCLOS_COCHONS: { name: 'Enclos à Cochons', accessible: true, color: '#ffebcd', background: ['bg_plains_4'], icon: '🐖🏞️', isBuilding: true, durability: 80, cost: { 'Planche': 50, 'Eau pure': 20 }, actions: [ { id: 'abreuver_animaux', name: 'Abreuver les animaux', costItem: 'Eau pure', costAmount: 1 }, { id: 'harvest_enclos_cochons', name: 'Récolter Viande', result: { 'Viande crue': 3 } } ], maxHarvestsPerCycle: 10, description: "Élève des cochons." },
    OBSERVATOIRE: { name: 'Observatoire', accessible: true, color: '#f5f5dc', background: ['bg_plains_1'], icon: '🔭', isBuilding: true, durability: 20, cost: { 'Planche': 50, 'Porte en bois': 1, 'toolRequired': ['Pelle en fer'] }, action: { id: 'observe_weather', name: 'Observer (Prochaine catastrophe)' }, description: "Permet d'observer le ciel." },
    ETABLI: { name: 'Établi', accessible: true, color: '#D2B48C', background: ['bg_plains_2'], icon: '🪚', isBuilding: true, durability: 50, cost: { 'Bois': 25 }, action: {id: 'use_etabli', name: 'Utiliser Établi'}, description: "Un plan de travail simple pour l'artisanat." },
};

// S'assurer que tous les parchemins sont dans ALL_SEARCHABLE_ITEMS
for (const itemName in ITEM_TYPES) {
    if (itemName.startsWith('Parchemin Atelier') && !ALL_SEARCHABLE_ITEMS.includes(itemName)) {
        ALL_SEARCHABLE_ITEMS.push(itemName);
    }
}
// Assurer que certains items uniques ou importants sont bien dans la liste si ce n'est pas déjà le cas
const essentialSearchableItems = ['Briquet', 'Loupe', 'Cuir', 'Alcool', 'Plan d\'ingénieur', 'Recette médicinale', 'Clé du Trésor'];
essentialSearchableItems.forEach(item => {
    if (!ALL_SEARCHABLE_ITEMS.includes(item)) {
        ALL_SEARCHABLE_ITEMS.push(item);
    }
});