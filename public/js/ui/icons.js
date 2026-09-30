// js/ui/icons.js — Icônes en images générées (avec repli automatique sur les emojis)

// Objets dont l'icône est désormais une vraie image
export const ITEM_IMAGES = {
    'Eau pure': 'assets/icons/waterdrop.png',
    'Viande cuite': 'assets/icons/drumstick.png',
    'Bois': 'assets/icons/wood.png',
    'Pierre': 'assets/icons/stone.png',
    'Fer': 'assets/icons/iron.png',
    'Hache': 'assets/icons/axe.png',
    'Canne à pêche': 'assets/icons/fishingrod.png',
    'Peau de bête': 'assets/icons/hide.png',
    'Cuir': 'assets/icons/hide.png',
    'Carte': 'assets/icons/map.png',
    'Poisson cru': 'assets/icons/fish.png',
    'Viande crue': 'assets/icons/rawmeat.png',
    'Banane': 'assets/icons/banana.png',
    'Noix de coco': 'assets/icons/coconut.png',
    'Feuilles': 'assets/icons/leaves.png',
    'Corde': 'assets/icons/rope.png',
    'Sable': 'assets/icons/sand.png',
    'Charbon': 'assets/icons/coal.png',
    'Kit de Secours': 'assets/icons/firstaid.png',
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

export default { ITEM_IMAGES, ENEMY_IMAGES, STAT_IMAGES, PLAYER_PORTRAIT, itemIconHTML, getItemImage, resolveItemImage };
