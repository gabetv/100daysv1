// js/ui/icons.js — Icônes en images générées (avec repli automatique sur les emojis)

// Objets dont l'icône est désormais une vraie image
export const ITEM_IMAGES = {
    // Ressources de base
    'Bois': 'assets/icons/wood.png',
    'Pierre': 'assets/icons/stone.png',
    'Feuilles': 'assets/icons/leaves.png',
    'Liane': 'assets/icons/liane.png',
    'Écorce': 'assets/icons/ecorce.png',
    'Résine': 'assets/icons/resine.png',
    'Os': 'assets/icons/os.png',
    'Sable': 'assets/icons/sand.png',
    'Charbon': 'assets/icons/coal.png',
    'Planche': 'assets/icons/planche.png',
    'Ficelle': 'assets/icons/ficelle.png',
    'Corde': 'assets/icons/rope.png',
    'Bloc taillé': 'assets/icons/bloctaille.png',
    'Feuille tressée': 'assets/icons/feuilletressee.png',
    'Peau de bête': 'assets/icons/hide.png',
    'Cuir': 'assets/icons/hide.png',
    'Verre': 'assets/icons/glass.png',
    'Graine d\'arbre': 'assets/icons/seedling.png',
    // Minerais et métaux
    'Minerai de fer': 'assets/icons/ironore.png',
    'Minerai d\'or': 'assets/icons/goldore.png',
    'Minerai d\'argent': 'assets/icons/silverore.png',
    'Minerai de cuivre': 'assets/icons/copperore.png',
    'Fer': 'assets/icons/iron.png',
    'Or': 'assets/icons/goldingot.png',
    'Argent': 'assets/icons/silveringot.png',
    'Cuivre': 'assets/icons/copperingot.png',
    'Souffre': 'assets/icons/sulfur.png',
    // Technique / divers
    'Composants électroniques': 'assets/icons/circuit.png',
    'Écran électronique': 'assets/icons/screen.png',
    'Batterie chargée': 'assets/icons/batteryfull.png',
    'Batterie déchargée': 'assets/icons/batteryempty.png',
    'Explosif': 'assets/icons/explosive.png',
    'Cadenas': 'assets/icons/padlock.png',
    'Cadenas cassé': 'assets/icons/padlock.png',
    'Hameçon': 'assets/icons/hook.png',
    // Eau et nourriture
    'Eau pure': 'assets/icons/waterdrop.png',
    'Eau croupie': 'assets/icons/murkywater.png',
    'Eau salée': 'assets/icons/seawater.png',
    'Sel': 'assets/icons/salt.png',
    'Sucre': 'assets/icons/sugar.png',
    'Canne à sucre': 'assets/icons/sugarcane.png',
    'Insectes': 'assets/icons/insect.png',
    'Poisson cru': 'assets/icons/fish.png',
    'Poisson cuit': 'assets/icons/cookedfish.png',
    'Viande crue': 'assets/icons/rawmeat.png',
    'Viande cuite': 'assets/icons/drumstick.png',
    'Oeuf cru': 'assets/icons/egg.png',
    'Oeuf cuit': 'assets/icons/friedegg.png',
    'Banane': 'assets/icons/banana.png',
    'Noix de coco': 'assets/icons/coconut.png',
    'Barre Énergétique': 'assets/icons/energybar.png',
    'Alcool': 'assets/icons/beer.png',
    // Soins et fioles
    'Kit de Secours': 'assets/icons/firstaid.png',
    'Médicaments': 'assets/icons/pills.png',
    'Antiseptique': 'assets/icons/antiseptic.png',
    'Bandage': 'assets/icons/bandage.png',
    'Savon': 'assets/icons/soap.png',
    'Huile de coco': 'assets/icons/coconutoil.png',
    'Venin': 'assets/icons/venom.png',
    'Fiole empoisonnée': 'assets/icons/poisonflask.png',
    'Fiole anti-poison': 'assets/icons/antidote.png',
    'Breuvage étrange': 'assets/icons/strangebrew.png',
    'Drogue': 'assets/icons/mushroom.png',
    'Porte bonheur': 'assets/icons/clover.png',
    'Filtre à eau': 'assets/icons/waterfilter.png',
    // Outils
    'Hache': 'assets/icons/axe.png',
    'Scie': 'assets/icons/saw.png',
    'Pelle en bois': 'assets/icons/woodshovel.png',
    'Pelle en fer': 'assets/icons/ironshovel.png',
    'Pioche': 'assets/icons/pickaxe.png',
    'Seau': 'assets/icons/bucket.png',
    'Kit de réparation': 'assets/icons/repairkit.png',
    'Canne à pêche': 'assets/icons/fishingrod.png',
    'Filet de pêche': 'assets/icons/fishingnet.png',
    'Briquet': 'assets/icons/lighter.png',
    'Allumettes': 'assets/icons/matches.png',
    'Loupe': 'assets/icons/magnifier.png',
    // Armes et boucliers
    'Gourdain': 'assets/icons/club.png',
    'Lance en bois': 'assets/icons/woodspear.png',
    'Épée en bois': 'assets/icons/woodsword.png',
    'Épée en fer': 'assets/icons/ironsword.png',
    'Bouclier en bois': 'assets/icons/woodshield.png',
    'Bouclier en fer': 'assets/icons/ironshield.png',
    // Équipement
    'Vêtements': 'assets/icons/tshirt.png',
    'Vêtement en cuir simple': 'assets/icons/leathertunic.png',
    'Chaussures': 'assets/icons/sneakers.png',
    'Chapeau': 'assets/icons/strawhat.png',
    'Chapeau feuillu': 'assets/icons/strawhat.png',
    'Pagne feuillu': 'assets/icons/leafskirt.png',
    'Sandalette': 'assets/icons/sandals.png',
    'Petit Sac': 'assets/icons/smallbag.png',
    'Grand Sac': 'assets/icons/bigbag.png',
    // Exploration et objectifs
    'Carte': 'assets/icons/map.png',
    'Boussole': 'assets/icons/compass.png',
    'Sifflet': 'assets/icons/whistle.png',
    'Pistolet de détresse': 'assets/icons/flaregun.png',
    'Fusée de détresse': 'assets/icons/flare.png',
    'Clé du Trésor': 'assets/icons/treasurekey.png',
    'Porte en bois': 'assets/icons/woodendoor.png',
    'Piège': 'assets/icons/trap.png',
    'Recette médicinale': 'assets/icons/scroll.png',
    'Plan d\'ingénieur': 'assets/icons/scroll.png',
    // Électronique et appareils (même image chargé/déchargé, l'état est dans le nom)
    'Radio déchargée': 'assets/icons/radio.png',
    'Radio chargée': 'assets/icons/radio.png',
    'Téléphone déchargé': 'assets/icons/phone.png',
    'Téléphone chargé': 'assets/icons/phone.png',
    'Guitare déchargé': 'assets/icons/guitar.png',
    'Guitare': 'assets/icons/guitar.png',
    'Lunette': 'assets/icons/glasses.png',
    'Panneau solaire fixe': 'assets/icons/tile_solar.png',
    'Panneau solaire portable': 'assets/icons/solarportable.png',
};

// Tuiles et bâtiments (grande carte, légende, modale de construction, scène)
export const TILE_IMAGES = {
    'Lagon': 'assets/icons/tile_lagoon.png',
    'Plage': 'assets/icons/tile_beach.png',
    'Forêt': 'assets/icons/tile_forest.png',
    'Friche': 'assets/icons/tile_wasteland.png',
    'Plaine': 'assets/icons/tile_plains.png',
    'Mine (Terrain)': 'assets/icons/tile_mineterrain.png',
    'Trésor Caché': 'assets/icons/tile_treasure.png',
    'Feu de Camp': 'assets/icons/tile_campfire.png',
    'Abri Individuel': 'assets/icons/tile_tent.png',
    'Abri Collectif': 'assets/icons/tile_cabin.png',
    'Mine (Bâtiment)': 'assets/icons/tile_mine.png',
    'Atelier': 'assets/icons/tile_atelier.png',
    'Établi': 'assets/icons/tile_etabli.png',
    'Petit Puit': 'assets/icons/tile_well.png',
    'Puit Profond': 'assets/icons/tile_deepwell.png',
    'Bibliothèque': 'assets/icons/tile_library.png',
    'Forteresse': 'assets/icons/tile_fortress.png',
    'Laboratoire': 'assets/icons/tile_lab.png',
    'Forge': 'assets/icons/tile_forge.png',
    'Bananeraie': 'assets/icons/tile_banana.png',
    'Sucrerie': 'assets/icons/tile_sugar.png',
    'Cocoteraie': 'assets/icons/tile_coconut.png',
    'Poulailler': 'assets/icons/tile_chicken.png',
    'Enclos à Cochons': 'assets/icons/tile_pig.png',
    'Observatoire': 'assets/icons/tile_observatory.png',
    'Panneau solaire': 'assets/icons/tile_solar.png',
};

// Icônes d'objectifs (emoji serveur -> image)
export const OBJECTIVE_IMAGES = {
    '🔑': 'assets/icons/treasurekey.png',
    '💎': 'assets/icons/tile_treasure.png',
    '🎆': 'assets/icons/flare.png',
    '🏆': 'assets/icons/trophy.png',
};

/**
 * Résout le chemin d'image d'un objet, avec des règles par famille
 * (ex. tous les « Parchemin Atelier ... » partagent la même image).
 */
export function resolveItemImage(itemName) {
    if (!itemName) return null;
    const direct = ITEM_IMAGES[itemName];
    if (direct) return direct;
    if (itemName.startsWith('Parchemin')) return 'assets/icons/scroll.png';
    if (itemName.includes('Torche')) return 'assets/icons/torch.png'; // « Torche », « Torche (Briquet) », « 5 Torches (Loupe) »...
    return null;
}

// Créatures (portrait de combat + sprite dans la scène)
export const ENEMY_IMAGES = {
    'Loup Agressif': 'assets/icons/wolf.png',
    'Serpent Venimeux': 'assets/icons/snake.png',
    'Rat Furtif': 'assets/icons/rat.png',
    'Gardien du Trésor': 'assets/icons/guardian.png',
};

// Icônes de statistiques (panneau Statut)
export const STAT_IMAGES = {
    health: 'assets/icons/heart.png',
    thirst: 'assets/icons/waterdrop.png',
    hunger: 'assets/icons/drumstick.png',
    sleep: 'assets/icons/moon.png',
};

export const PLAYER_PORTRAIT = 'assets/icons/survivor.png';

/**
 * Retourne le HTML de l'icône d'un objet : image si disponible, sinon emoji.
 * @param {string} itemName Nom de base de l'objet.
 * @param {string} fallbackEmoji Emoji de repli (généralement itemDef.icon).
 * @param {string} cls Classe CSS du conteneur.
 */
export function itemIconHTML(itemName, fallbackEmoji = '❓', cls = 'inventory-icon') {
    const src = resolveItemImage(itemName);
    if (src) {
        return `<span class="${cls}"><img class="icon-img" src="${src}" alt="" draggable="false"></span>`;
    }
    return `<span class="${cls}">${fallbackEmoji}</span>`;
}

// --- Cache d'images pour le dessin sur canvas (arme en main, etc.) ---
const imageCache = {};

/**
 * Retourne l'élément Image chargé pour un objet, ou null si indisponible
 * (pas d'image associée, ou chargement pas encore terminé).
 */
export function getItemImage(itemName) {
    const src = resolveItemImage(itemName);
    if (!src) return null;
    let img = imageCache[itemName];
    if (!img) {
        img = new Image();
        img.src = src;
        imageCache[itemName] = img;
    }
    return (img.complete && img.naturalWidth) ? img : null;
}

// --- Tuiles : préchargement immédiat (la grande carte dessine dès l'ouverture) ---
const tileImageCache = {};
if (typeof Image !== 'undefined') {
    for (const [name, src] of Object.entries(TILE_IMAGES)) {
        const img = new Image();
        img.src = src;
        tileImageCache[name] = img;
    }
}

/**
 * Retourne l'élément Image chargé pour une tuile/un bâtiment, ou null.
 * @param {string} tileName Nom de la tuile (ex: 'Forêt', 'Forge').
 */
export function getTileImage(tileName) {
    const img = tileImageCache[tileName];
    return (img && img.complete && img.naturalWidth) ? img : null;
}

/**
 * Retourne le HTML de l'icône d'une tuile : image si disponible, sinon emoji.
 */
export function tileIconHTML(tileName, fallbackEmoji = '❓', cls = 'tile-icon') {
    const src = TILE_IMAGES[tileName];
    if (src) {
        return `<span class="${cls}"><img class="icon-img" src="${src}" alt="" draggable="false"></span>`;
    }
    return `<span class="${cls}">${fallbackEmoji}</span>`;
}

export default { ITEM_IMAGES, ENEMY_IMAGES, STAT_IMAGES, TILE_IMAGES, OBJECTIVE_IMAGES, PLAYER_PORTRAIT, itemIconHTML, getItemImage, resolveItemImage, getTileImage, tileIconHTML };
