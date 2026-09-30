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
};

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
    const src = ITEM_IMAGES[itemName];
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
    const src = ITEM_IMAGES[itemName];
    if (!src) return null;
    let img = imageCache[itemName];
    if (!img) {
        img = new Image();
        img.src = src;
        imageCache[itemName] = img;
    }
    return (img.complete && img.naturalWidth) ? img : null;
}

export default { ITEM_IMAGES, ENEMY_IMAGES, STAT_IMAGES, PLAYER_PORTRAIT, itemIconHTML, getItemImage };
