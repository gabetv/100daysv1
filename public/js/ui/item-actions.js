// js/ui/item-actions.js — Actions rapides sur les objets du sac
//
// Chaque ligne d'inventaire (panneau Sac, modale Équipement, coffre, objets
// au sol) porte désormais de petits boutons : un clic et l'action part, sans
// passer par le menu contextuel ni par le glisser-déposer.
//   ✚  équiper / utiliser / prendre / ramasser  (l'action principale)
//   📥 déposer dans le coffre ouvert
//   ⬇  poser au sol
//
// Les boutons sont rendus comme du HTML simple par les fonctions de rendu des
// listes ; un unique écouteur délégué (posé dans interactions.js) lit
// data-quick-action et envoie l'action serveur correspondante.

import { ITEM_TYPES, ACTIONS } from '../config.js';
import { sendAction } from '../main.js';

/**
 * Envoi d'une action : on passe par le point d'entrée publié par main.js
 * (identique à sendAction), ce qui garde ce module découplé et testable
 * hors navigateur. Tous les nouveaux boutons du sac l'utilisent.
 */
export function dispatchPlayerAction(actionId, data) {
    if (typeof window !== 'undefined' && typeof window.handleGlobalPlayerAction === 'function') {
        window.handleGlobalPlayerAction(actionId, data);
    } else {
        sendAction(actionId, data);
    }
}

/** Un objet peut-il être équipé sur un emplacement (tête, arme, habits…) ? */
export function isEquippableItem(itemName) {
    return !!ITEM_TYPES[itemName]?.slot;
}

/** L'objet a-t-il une utilisation directe depuis le sac (nourriture, soin, parchemin…) ? */
export function isUsableItem(itemName) {
    const def = ITEM_TYPES[itemName];
    // Même règle que le menu contextuel (interactions.js).
    return !!(def && (def.type === 'consumable' || def.type === 'usable' || def.teachesRecipe));
}

const ACTION_GLYPHS = {
    equip: { glyph: '✚', label: 'Équiper', cls: 'qa-equip' },
    use: { glyph: '🍽', label: 'Consommer / Utiliser', cls: 'qa-use' },
    take: { glyph: '✚', label: 'Prendre dans le sac (Maj+clic : un seul)', cls: 'qa-take' },
    pickup: { glyph: '✚', label: 'Ramasser (Maj+clic : un seul)', cls: 'qa-take' },
    store: { glyph: '📥', label: 'Déposer dans le coffre (Maj+clic : un seul)', cls: 'qa-store' },
    drop: { glyph: '⬇', label: 'Poser au sol (Maj+clic : un seul)', cls: 'qa-drop' },
};

function actionButton(action, itemName) {
    const { glyph, label, cls } = ACTION_GLYPHS[action];
    const safeName = escapeAttr(itemName);
    return `<button type="button" class="quick-action-btn ${cls}" data-quick-action="${action}" title="${label} — ${safeName}" aria-label="${label} ${safeName}">${glyph}</button>`;
}

/**
 * HTML des boutons d'action pour une ligne d'inventaire.
 *
 * @param {object} params
 * @param {string} params.owner   Propriétaire de la liste ('player-inventory',
 *                                'building-inventory', 'shared', 'ground').
 * @param {string} params.itemName Nom affiché de l'objet.
 * @param {string} [params.context] Endroit où vit la liste : 'equipment'
 *                                (modale Équipement), 'storage' (coffre) ou
 *                                'panel' (panneau Sac). Détermine l'action
 *                                principale du bouton ✚.
 * @param {boolean} [params.withDrop] Afficher le bouton « poser au sol ».
 */
export function itemActionsHTML({ owner, itemName, context = 'panel', withDrop = true }) {
    const buttons = [];
    const equippable = isEquippableItem(itemName);
    const usable = isUsableItem(itemName);

    if (owner === 'ground') {
        buttons.push(actionButton('pickup', itemName));
    } else if (owner === 'building-inventory' || owner === 'shared') {
        buttons.push(actionButton('take', itemName));
    } else if (owner === 'player-inventory') {
        if (context === 'storage') {
            // Devant un coffre, l'action principale est le dépôt.
            buttons.push(actionButton('store', itemName));
        } else if (equippable) {
            buttons.push(actionButton('equip', itemName));
        } else if (usable) {
            buttons.push(actionButton('use', itemName));
        }
        if (withDrop) buttons.push(actionButton('drop', itemName));
    }

    if (buttons.length === 0) return '';
    return `<span class="item-actions">${buttons.join('')}</span>`;
}

function escapeAttr(value) {
    return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Exécute l'action demandée par un bouton [data-quick-action].
 *
 * Clic simple = toute la pile ; Maj+clic (ou Ctrl/Cmd) = un seul exemplaire.
 * Les objets uniques (outils, armes) sont toujours déplacés à l'unité.
 */
export function runQuickAction(button, event) {
    const row = button.closest('.inventory-item');
    const ds = row ? row.dataset : button.dataset;
    const action = button.dataset.quickAction;
    const itemKey = ds.itemKey || button.dataset.itemKey || '';
    const itemName = ds.itemName || button.dataset.itemName || '';
    const owner = ds.owner || '';
    const slot = ds.slotType || button.dataset.slotType || null;
    const count = Math.max(1, parseInt(ds.itemCount, 10) || 1);
    const single = !!(event && (event.shiftKey || event.ctrlKey || event.metaKey));
    const quantity = single ? 1 : count;

    if (navigator.vibrate) { try { navigator.vibrate(8); } catch (_) {} }

    switch (action) {
        case 'equip':
            dispatchPlayerAction(ACTIONS.EQUIP_ITEM_CONTEXT, { itemKey, itemName, owner });
            break;
        case 'use':
            dispatchPlayerAction(ACTIONS.CONSUME_ITEM_CONTEXT, { itemKey, itemName, owner });
            break;
        case 'drop':
            dispatchPlayerAction(ACTIONS.DROP_ITEM_CONTEXT, { itemKey, itemName, owner, quantity });
            break;
        case 'pickup':
            // Les objets au sol sont identifiés par leur clé (les outils posés
            // gardent leur clé d'origine pour conserver leur durabilité).
            dispatchPlayerAction(ACTIONS.PICKUP_ITEM_CONTEXT, { itemKey: itemKey || itemName, itemName, quantity });
            break;
        case 'store':
            dispatchPlayerAction(ACTIONS.MOVE_ITEM, {
                itemKey, itemName, quantity,
                source: { owner: 'player-inventory', slot: null },
                target: { owner: 'building-inventory', slot: null },
            });
            break;
        case 'take':
            dispatchPlayerAction(ACTIONS.MOVE_ITEM, {
                itemKey, itemName, quantity,
                source: { owner: owner || 'building-inventory', slot: null },
                target: { owner: 'player-inventory', slot: null },
            });
            break;
        case 'unequip':
            dispatchPlayerAction(ACTIONS.UNEQUIP_ITEM_CONTEXT, { slot });
            break;
        default:
            break;
    }
}

/** Bouton « déséquiper » posé sur un emplacement occupé de la fiche Équipement. */
export function slotUnequipButtonHTML(slotType) {
    return `<button type="button" class="slot-unequip-btn" data-quick-action="unequip" data-slot-type="${slotType}" title="Déséquiper (remettre dans le sac)" aria-label="Déséquiper">×</button>`;
}
