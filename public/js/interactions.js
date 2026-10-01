// public/js/interactions.js

import { ITEM_TYPES, ACTIONS } from './config.js';
import DOM from './ui/dom.js';
import { sendAction } from './main.js';
import { runQuickAction, dispatchPlayerAction } from './ui/item-actions.js';

let draggedItemData = null; // Pour stocker les infos de l'objet glissé
let contextMenuItemData = null; // Pour stocker les infos de l'objet du menu contextuel

// Les modales (coffre, équipement…) vivent hors de #game-container : les
// écouteurs sont posés sur document pour couvrir à la fois les panneaux et
// les fenêtres modales. Auparavant, glisser un objet dans le coffre ou faire
// un clic droit dans la fiche Équipement ne faisait rien du tout.
const INTERACTION_ROOT = document;

// --- Fonctions du Menu Contextuel ---

/**
 * Affiche le menu contextuel pour un objet.
 * @param {MouseEvent} e - L'événement de clic.
 * @param {HTMLElement} itemElement - L'élément HTML de l'objet.
 */
function showContextMenu(e, itemElement) {
    if (e.preventDefault) e.preventDefault();

    const { itemName, itemKey, slotType } = itemElement.dataset;
    const owner = itemElement.dataset.owner || '';
    const itemDef = ITEM_TYPES[itemName] || {};
    const menu = document.getElementById('item-context-menu');
    const actionsContainer = document.getElementById('context-menu-actions');
    const titleEl = document.getElementById('context-menu-title');

    if (!menu || !actionsContainer || !titleEl) return;

    // Stocker les données de l'objet pour les actions du menu
    contextMenuItemData = { itemName, itemKey, owner, slotType };

    actionsContainer.innerHTML = ''; // Vider les actions précédentes
    titleEl.textContent = itemName;

    let hasAction = false;

    // Action "Utiliser" ou "Consommer"
    if (itemDef.type === 'consumable' || itemDef.type === 'usable' || itemDef.teachesRecipe) {
        const actionText = (itemDef.type === 'consumable' || itemDef.teachesRecipe) ? 'Consommer/Utiliser' : 'Utiliser';
        const button = document.createElement('button');
        button.textContent = actionText;
        button.dataset.action = ACTIONS.CONSUME_ITEM_CONTEXT;
        actionsContainer.appendChild(button);
        hasAction = true;
    }

    // Action "Équiper"
    if (itemDef.slot && owner.includes('inventory')) {
        const button = document.createElement('button');
        button.textContent = 'Équiper';
        button.dataset.action = ACTIONS.EQUIP_ITEM_CONTEXT;
        actionsContainer.appendChild(button);
        hasAction = true;
    }

    // Action "Déséquiper"
    if (owner === 'equipment') {
        const button = document.createElement('button');
        button.textContent = 'Déséquiper';
        button.dataset.action = ACTIONS.UNEQUIP_ITEM_CONTEXT;
        actionsContainer.appendChild(button);
        hasAction = true;
    }

    // Action "Jeter"
    if (owner.includes('inventory')) {
        const button = document.createElement('button');
        button.textContent = 'Jeter au sol';
        button.dataset.action = ACTIONS.DROP_ITEM_CONTEXT;
        actionsContainer.appendChild(button);
        hasAction = true;
    }

    // Action "Ramasser"
    if (owner === 'ground') {
        const button = document.createElement('button');
        button.textContent = 'Ramasser';
        button.dataset.action = ACTIONS.PICKUP_ITEM_CONTEXT;
        actionsContainer.appendChild(button);
        hasAction = true;
    }


    if (hasAction) {
        // Positionner le menu, sans sortir de l'écran
        const margin = 8;
        const menuWidth = 210;
        const menuHeight = 240;
        const left = Math.min(e.clientX + 5, window.innerWidth - menuWidth - margin);
        const top = Math.min(e.clientY + 5, window.innerHeight - menuHeight - margin);
        menu.style.left = `${Math.max(margin, left)}px`;
        menu.style.top = `${Math.max(margin, top)}px`;
        menu.classList.remove('hidden');
    } else {
        hideContextMenu();
    }
}

/**
 * Cache le menu contextuel.
 */
function hideContextMenu() {
    const menu = document.getElementById('item-context-menu');
    if (menu) menu.classList.add('hidden');
    contextMenuItemData = null;
}

// --- Fonctions du Glisser-Déposer (Drag & Drop) ---

function handleDragStart(e, itemElement) {
    draggedItemData = { ...itemElement.dataset };
    e.dataTransfer.setData('text/plain', JSON.stringify(draggedItemData));
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => itemElement.classList.add('dragging'), 0);
}

function handleDragEnd(itemElement) {
    itemElement.classList.remove('dragging');
    draggedItemData = null;
}

function handleDragOver(e, dropZone) {
    if (!draggedItemData) return;
    if (draggedItemData.owner !== dropZone.dataset.owner || dropZone.dataset.owner === 'equipment') {
         e.preventDefault();
         dropZone.classList.add('drag-over');
    }
}

function handleDragLeave(dropZone) {
    dropZone.classList.remove('drag-over');
}

function handleDrop(e, dropZone) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (!draggedItemData) return;

    const source = draggedItemData;
    const target = { ...dropZone.dataset };

    if (source.owner === target.owner && source.slotType === target.slotType) return;

    const quantity = parseInt(source.itemCount, 10);

    // Gérer le drop multiple avec la touche Ctrl/Cmd
    if (quantity > 1 && (e.ctrlKey || e.metaKey)) {
        window.UI.showQuantityModal(source.itemName, quantity, (amount) => {
            sendDropAction(source, target, amount);
        });
    } else {
        sendDropAction(source, target, quantity);
    }
}

function sendDropAction(source, target, quantity) {
    sendAction(ACTIONS.MOVE_ITEM, {
        itemKey: source.itemKey,
        itemName: source.itemName,
        quantity: quantity,
        source: {
            owner: source.owner,
            slot: source.slotType || null,
        },
        target: {
            owner: target.owner,
            slot: target.slotType || null,
        }
    });
}

// --- Initialisation des Écouteurs d'Événements ---

export function initInteractions() {
    const gameContainer = document.getElementById('game-container');
    if (!gameContainer) return;

    // Chat listener
    if (DOM.chatInputEl) {
        DOM.chatInputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && DOM.chatInputEl.value.trim() !== '') {
                e.preventDefault();
                sendAction(ACTIONS.SEND_CHAT_MESSAGE, { message: DOM.chatInputEl.value });
                DOM.chatInputEl.value = '';
            }
        });
    }

    INTERACTION_ROOT.addEventListener('click', (e) => {
        // 1. Boutons d'action rapide (✚ équiper, ⬇ poser au sol…) : un clic,
        //    une action, sans ouvrir le menu contextuel.
        const quickBtn = e.target.closest('[data-quick-action]');
        if (quickBtn) {
            e.preventDefault();
            e.stopPropagation();
            hideContextMenu();
            runQuickAction(quickBtn, e);
            return;
        }

        // 2. Clic simple sur une ligne d'objet : ouvrir le menu contextuel
        //    (Équiper, Utiliser, Jeter…). Le clic droit et l'appui long
        //    restent disponibles, mais ne sont plus obligatoires.
        const itemElement = e.target.closest('.inventory-item.clickable');
        if (itemElement) {
            showContextMenu(e, itemElement);
            return;
        }

        if (!e.target.closest('#item-context-menu')) {
            hideContextMenu();
        }
    });

    INTERACTION_ROOT.addEventListener('contextmenu', (e) => {
        const itemElement = e.target.closest('.inventory-item.clickable');
        if (itemElement) {
            showContextMenu(e, itemElement);
        } else {
            hideContextMenu(); // Cacher si on fait un clic droit dans le vide
        }
    });

    const contextMenu = document.getElementById('item-context-menu');
    if (contextMenu) {
        contextMenu.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (button && button.dataset.action) {
                if (contextMenuItemData) {
                    // Ramassage : la clé d'entrée au sol prime sur le nom
                    // (les outils posés gardent leur clé et leur durabilité).
                    const payload = {
                        itemKey: contextMenuItemData.itemKey,
                        itemName: contextMenuItemData.itemName,
                        owner: contextMenuItemData.owner,
                        slot: contextMenuItemData.slotType
                    };
                    if (contextMenuItemData.owner === 'ground') {
                        payload.itemKey = contextMenuItemData.itemKey || contextMenuItemData.itemName;
                    }
                    dispatchPlayerAction(button.dataset.action, payload);
                }
                hideContextMenu();
            }
        });
    }

    // --- Appui long (mobile) = menu contextuel ---
    let longPressTimer = null;
    let longPressStart = null;

    const cancelLongPress = () => {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        longPressStart = null;
    };

    INTERACTION_ROOT.addEventListener('touchstart', (e) => {
        const itemElement = e.target.closest('.inventory-item.clickable');
        if (!itemElement || e.touches.length !== 1) return;
        const touch = e.touches[0];
        longPressStart = { x: touch.clientX, y: touch.clientY };
        longPressTimer = setTimeout(() => {
            longPressTimer = null;
            if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }
            showContextMenu({
                preventDefault: () => {},
                clientX: Math.min(longPressStart.x, window.innerWidth - 210),
                clientY: Math.min(longPressStart.y, window.innerHeight - 220),
            }, itemElement);
        }, 420);
    }, { passive: true });

    INTERACTION_ROOT.addEventListener('touchmove', (e) => {
        if (!longPressStart || !e.touches[0]) return;
        const dx = e.touches[0].clientX - longPressStart.x;
        const dy = e.touches[0].clientY - longPressStart.y;
        if (Math.hypot(dx, dy) > 12) cancelLongPress();
    }, { passive: true });

    INTERACTION_ROOT.addEventListener('touchend', cancelLongPress, { passive: true });
    INTERACTION_ROOT.addEventListener('touchcancel', cancelLongPress, { passive: true });

    INTERACTION_ROOT.addEventListener('dragstart', (e) => {
        const itemElement = e.target.closest('.inventory-item[draggable="true"]');
        if (itemElement) handleDragStart(e, itemElement);
    });

    INTERACTION_ROOT.addEventListener('dragend', (e) => {
        const itemElement = e.target.closest('.inventory-item[draggable="true"]');
        if (itemElement) handleDragEnd(itemElement);
    });

    INTERACTION_ROOT.addEventListener('dragover', (e) => {
        const dropZone = e.target.closest('.droppable');
        if (dropZone) handleDragOver(e, dropZone);
    });

    INTERACTION_ROOT.addEventListener('dragleave', (e) => {
        const dropZone = e.target.closest('.droppable');
        if (dropZone) handleDragLeave(dropZone);
    });

    INTERACTION_ROOT.addEventListener('drop', (e) => {
        const dropZone = e.target.closest('.droppable');
        if (dropZone) handleDrop(e, dropZone);
    });

    console.log('Interaction handlers initialized.');

    function findAndConsume(stat) {
        const player = window.gameState ? window.gameState.player : null;
        if (!player || !player.inventory) return;

        let bestItem = null;
        let bestValue = -Infinity;

        for (const itemKey in player.inventory) {
            const value = player.inventory[itemKey];
            // Les objets uniques sont stockés sous forme d'instances { name: ... }
            const baseName = (typeof value === 'object' && value && value.name) ? value.name : itemKey;
            const item = ITEM_TYPES[baseName];
            if (item && item.effects && item.effects[stat] > 0 && item.effects[stat] > bestValue) {
                bestValue = item.effects[stat];
                bestItem = itemKey;
            }
        }

        if (bestItem) {
            sendAction(ACTIONS.CONSUME_ITEM_CONTEXT, { itemKey: bestItem });
        } else {
            const statLabels = { health: 'santé', thirst: 'soif', hunger: 'faim' };
            window.UI.addChatMessage(`Vous n'avez rien pour restaurer votre ${statLabels[stat] || stat}.`, 'system_warning');
        }
    }

    // Consume buttons
    if (DOM.consumeHealthBtn) {
        DOM.consumeHealthBtn.addEventListener('click', () => findAndConsume('health'));
    }
    if (DOM.consumeThirstBtn) {
        DOM.consumeThirstBtn.addEventListener('click', () => findAndConsume('thirst'));
    }
    if (DOM.consumeHungerBtn) {
        DOM.consumeHungerBtn.addEventListener('click', () => findAndConsume('hunger'));
    }

    // Tout ramasser : vide la case courante de ses objets au sol en un clic.
    const pickupAllBtn = document.getElementById('pickup-all-btn');
    if (pickupAllBtn) {
        pickupAllBtn.addEventListener('click', () => {
            dispatchPlayerAction(ACTIONS.PICKUP_ALL_ITEMS, {});
        });
    }

    // Enlarge map button
    if (DOM.enlargeMapBtn) {
        DOM.enlargeMapBtn.addEventListener('click', () => {
            if (window.gameState) {
                window.UI.showLargeMap(window.gameState);
            }
        });
    }

    // Close large map button
    if (DOM.closeLargeMapBtn) {
        DOM.closeLargeMapBtn.addEventListener('click', () => {
            window.UI.hideLargeMap();
        });
    }
}
