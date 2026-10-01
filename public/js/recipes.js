// js/recipes.js — Analyse partagée (client + serveur) des recettes d'atelier.
//
// Les parchemins décrivent leur recette en texte libre ("Transformer 20 bois =
// 1 épée en bois"). Les noms employés dans ces phrases ne correspondent pas aux
// clés exactes de ITEM_TYPES ("bois" vs "Bois", "composants electronique" vs
// "Composants électroniques"...). Sans normalisation, l'atelier cherchait des
// objets inexistants dans le sac : il affichait "0 / 20 Bois" alors que le
// joueur en portait 74, et le serveur refusait la fabrication.
//
// Ce module résout chaque ingrédient vers sa vraie clé d'inventaire et expose
// une liste de recettes exploitable par l'interface comme par le serveur.

import { ITEM_TYPES } from './config.js';

/** Minuscules, sans accents ni ponctuation parasite. */
function normalize(text) {
    return String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[’‘`]/g, "'")
        .toLowerCase()
        .replace(/[.,;:!?]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Clé « souple » : singulier/pluriel et accords féminins sont ramenés à une
 * même racine ("feuille tressé" ≡ "Feuille tressée", "composants electronique"
 * ≡ "Composants électroniques").
 */
function looseKey(text) {
    return normalize(text)
        .split(' ')
        .map(word => {
            let w = word;
            while (w.length > 3 && /[es]$/.test(w)) w = w.slice(0, -1);
            return w;
        })
        .join(' ');
}

// --- Index des objets réels ----------------------------------------------
const exactIndex = new Map();
const looseIndex = new Map();
for (const key of Object.keys(ITEM_TYPES)) {
    const n = normalize(key);
    if (!exactIndex.has(n)) exactIndex.set(n, key);
    const l = looseKey(key);
    if (!looseIndex.has(l)) looseIndex.set(l, key);
}

// Quelques formulations ne peuvent pas être devinées automatiquement.
const MANUAL_ALIASES = {
    'minerai de fer brut': 'Minerai de fer',
    'peau de bete': 'Peau de bête',
    'plan': "Plan d'ingénieur",
    "plan d'ingenieur": "Plan d'ingénieur",
    'ecran electronique': 'Écran électronique',
    'composant electronique': 'Composants électroniques',
    'oeuf': 'Oeuf cru',
    'eau': 'Eau pure',
};

/**
 * Convertit un nom écrit « à la main » en clé réelle de ITEM_TYPES.
 * @returns {string|null}
 */
export function resolveItemName(rawName) {
    const n = normalize(rawName);
    if (!n) return null;
    if (ITEM_TYPES[rawName]) return rawName;
    if (MANUAL_ALIASES[n]) return MANUAL_ALIASES[n];
    if (exactIndex.has(n)) return exactIndex.get(n);

    const l = looseKey(n);
    if (MANUAL_ALIASES[l]) return MANUAL_ALIASES[l];
    if (looseIndex.has(l)) return looseIndex.get(l);

    // Dernier recours : un nom composé dont seule la fin diffère
    // ("paire de sandalette" -> "Sandalette").
    const words = l.split(' ');
    for (let start = 1; start < words.length; start++) {
        const candidate = words.slice(start).join(' ');
        if (looseIndex.has(candidate)) return looseIndex.get(candidate);
    }
    return null;
}

/** "1 épée en bois" / "5 torche" -> { name, amount } */
function parseProduct(text) {
    const raw = String(text || '').trim().replace(/[.!]+$/, '');
    const match = raw.match(/^(\d+)\s+(.*)$/);
    if (match) return { name: match[2].trim(), amount: parseInt(match[1], 10) || 1 };
    return { name: raw, amount: 1 };
}

/**
 * Extrait les coûts d'une phrase d'ingrédients.
 * Gère "10 bois et 5 fer", "1 Plan d'ingénieur + 10 planche" et même
 * "45 fer 5 or" (séparateur oublié dans certaines descriptions).
 */
function parseCosts(ingredientsText) {
    const costs = {};
    const unresolved = [];
    const pattern = /(\d+)\s*([^\d]+)/g;
    let match;
    while ((match = pattern.exec(String(ingredientsText || ''))) !== null) {
        const amount = parseInt(match[1], 10);
        // On retire les connecteurs collés au nom ("bois et ", "Cuir + ").
        const label = match[2]
            .replace(/\s*(?:\+|,|&|\bet\b|\bou\b)\s*$/i, '')
            .replace(/^\s*(?:\+|,|&|\bet\b)\s*/i, '')
            .trim();
        if (!amount || !label) continue;
        const resolved = resolveItemName(label);
        if (!resolved) { unresolved.push(label); continue; }
        costs[resolved] = (costs[resolved] || 0) + amount;
    }
    return { costs, unresolved };
}

/**
 * Analyse la description d'un parchemin.
 * @returns {null|{display:string, output:string, yield:number, costs:Object}}
 */
export function parseRecipeFromParchment(parchmentName) {
    const def = ITEM_TYPES[parchmentName];
    if (!def || !def.teachesRecipe || def.isBuildingRecipe) return null;

    const description = def.description || '';
    const match = description.match(/Transformer\s+(.+?)\s*=\s*(.+)$/i);
    if (!match) return null;

    const { costs } = parseCosts(match[1]);
    if (Object.keys(costs).length === 0) return null;

    const product = parseProduct(match[2]);
    const display = def.teachesRecipe;

    // Certains libellés de recette sont décoratifs ("5 Torches (Loupe)",
    // "2 Bois (15 Ecorce)") : l'objet réellement produit doit être retrouvé.
    const cleanedDisplay = display.replace(/\([^)]*\)/g, ' ').trim();
    const displayProduct = parseProduct(cleanedDisplay);

    const output = resolveItemName(displayProduct.name) || resolveItemName(product.name);
    if (!output) return null;

    // La quantité vient en priorité du libellé de la recette ("5 Torches"),
    // sinon de la description ("= 5 torche").
    const amount = displayProduct.amount > 1 ? displayProduct.amount : product.amount;

    return { display, output, yield: Math.max(1, amount), costs };
}

/**
 * Toutes les recettes d'atelier connues.
 * @param {Object} knownRecipes map { "Épée en bois": true, ... }
 */
export function getWorkshopRecipes(knownRecipes = {}) {
    const recipes = [];
    for (const parchmentName of Object.keys(ITEM_TYPES)) {
        const def = ITEM_TYPES[parchmentName];
        if (!def.teachesRecipe || def.isBuildingRecipe) continue;
        if (!knownRecipes[def.teachesRecipe]) continue;

        const parsed = parseRecipeFromParchment(parchmentName);
        if (!parsed) continue;

        recipes.push({
            name: parsed.display,
            output: parsed.output,
            icon: ITEM_TYPES[parsed.output]?.icon || ITEM_TYPES[parsed.display]?.icon || '🛠️',
            costs: parsed.costs,
            yield: parsed.yield,
            category: ITEM_TYPES[parsed.output]?.type || 'other',
            sourceParchemin: parchmentName,
        });
    }
    recipes.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return recipes;
}

/** Retrouve une recette par son libellé, quelles que soient les connaissances. */
export function findRecipeByName(recipeName) {
    for (const parchmentName of Object.keys(ITEM_TYPES)) {
        const def = ITEM_TYPES[parchmentName];
        if (def.teachesRecipe !== recipeName) continue;
        const parsed = parseRecipeFromParchment(parchmentName);
        if (parsed) return parsed;
    }
    return null;
}

/** Combien d'exemplaires le joueur peut-il fabriquer avec son sac actuel ? */
export function maxCraftableAmount(inventory, costs) {
    const entries = Object.entries(costs || {});
    if (entries.length === 0) return 0;
    let max = Infinity;
    for (const [itemName, amount] of entries) {
        if (!amount) continue;
        const stock = countInInventory(inventory, itemName);
        max = Math.min(max, Math.floor(stock / amount));
    }
    return Number.isFinite(max) ? Math.max(0, max) : 0;
}

/**
 * Nombre d'exemplaires d'un objet dans un inventaire.
 * Les objets « uniques » (outils, armes, équipements) y sont rangés sous une
 * clé générée du type "Loupe_1712...": il faut donc aussi les reconnaître par
 * leur nom, sinon une Loupe en sac compte pour zéro.
 */
export function countInInventory(inventory, itemName) {
    if (!inventory) return 0;
    let total = 0;
    for (const [key, value] of Object.entries(inventory)) {
        if (typeof value === 'number') {
            if (key === itemName) total += value;
        } else if (value && typeof value === 'object' && value.name === itemName) {
            total += 1;
        }
    }
    return total;
}

/**
 * Clés d'inventaire à consommer pour retirer `quantity` exemplaires.
 * @returns {null|Array<{key:string, amount:number}>} null si le stock manque.
 */
export function pickInventoryKeys(inventory, itemName, quantity) {
    if (!inventory || quantity <= 0) return [];
    const picks = [];
    let remaining = quantity;

    const stack = inventory[itemName];
    if (typeof stack === 'number' && stack > 0) {
        const take = Math.min(stack, remaining);
        picks.push({ key: itemName, amount: take });
        remaining -= take;
    }
    if (remaining > 0) {
        for (const [key, value] of Object.entries(inventory)) {
            if (remaining <= 0) break;
            if (key === itemName) continue;
            if (value && typeof value === 'object' && value.name === itemName) {
                picks.push({ key, amount: 1 });
                remaining -= 1;
            }
        }
    }
    return remaining > 0 ? null : picks;
}

export default {
    resolveItemName,
    parseRecipeFromParchment,
    getWorkshopRecipes,
    findRecipeByName,
    maxCraftableAmount,
    countInInventory,
    pickInventoryKeys,
};
