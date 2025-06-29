// public/js/interactions.js

import { ITEM_TYPES, ACTIONS } from './config.js';
import DOM from './ui/dom.js';
import { sendAction } from './main.js';

let draggedItemData = null; // Pour stocker les infos de l'objet glissé
let contextMenuItemData = null; // Pour stocker les infos de l'objet du menu contextuel

// --- Fonctions du Menu Contextuel ---

/**
 * Affiche le menu contextuel pour un objet.
 * @param {MouseEvent} e - L'événement de clic.
 * @param {HTMLElement} itemElement - L'élément HTML de l'objet.
 */
function showContextMenu(e, itemElement) {
    e.preventDefault();

    const { itemName, itemKey, owner, slotType } = itemElement.dataset;
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
        // Positionner le menu
        menu.style.left = `${e.clientX + 5}px`;
        menu.style.top = `${e.clientY + 5}px`;
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

    gameContainer.addEventListener('click', (e) => {
        if (!e.target.closest('#item-context-menu')) {
            hideContextMenu();
        }
    });

    gameContainer.addEventListener('contextmenu', (e) => {
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
                    sendAction(button.dataset.action, {
                        itemKey: contextMenuItemData.itemKey,
                        itemName: contextMenuItemData.itemName,
                        owner: contextMenuItemData.owner,
                        slot: contextMenuItemData.slotType
                    });
                }
                hideContextMenu();
            }
        });
    }

    gameContainer.addEventListener('dragstart', (e) => {
        const itemElement = e.target.closest('.inventory-item[draggable="true"]');
        if (itemElement) handleDragStart(e, itemElement);
    });

    gameContainer.addEventListener('dragend', (e) => {
        const itemElement = e.target.closest('.inventory-item[draggable="true"]');
        if (itemElement) handleDragEnd(itemElement);
    });

    gameContainer.addEventListener('dragover', (e) => {
        const dropZone = e.target.closest('.droppable');
        if (dropZone) handleDragOver(e, dropZone);
    });

    gameContainer.addEventListener('dragleave', (e) => {
        const dropZone = e.target.closest('.droppable');
        if (dropZone) handleDragLeave(dropZone);
    });

    gameContainer.addEventListener('drop', (e) => {
        const dropZone = e.target.closest('.droppable');
        if (dropZone) handleDrop(e, dropZone);
    });

    console.log('Interaction handlers initialized.');
}