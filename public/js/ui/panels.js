import { ITEM_TYPES, TILE_TYPES, ACTIONS } from '../config.js';
import DOM from './dom.js';
import { sendAction } from '../main.js';

// Fonction utilitaire côté client pour calculer le total des ressources.
// Elle remplace l'import depuis le fichier serveur `player.js` qui était incorrect.
function getTotalResources(inventory) {
    if (!inventory) return 0;
    return Object.values(inventory).reduce((sum, quantity) => {
        // Gère à la fois les objets empilés (nombre) et les instances uniques (objet)
        const count = typeof quantity === 'number' ? quantity : 1;
        return sum + count;
    }, 0);
}

function updateSquaresBar(containerElement, value, maxValue, type) {
    if (!containerElement) return;
    containerElement.innerHTML = ''; // Clear existing squares
    const numFilledSquares = Math.round((value / maxValue) * 10);
    for (let i = 0; i < 10; i++) {
        const square = document.createElement('div');
        square.classList.add('stat-square');
        if (i < numFilledSquares) {
            square.classList.add(`filled-${type}`);
        }
        containerElement.appendChild(square);
    }
}

export function updateStatsPanel(player) {
    if (!player) return;
    const { healthSquaresContainerEl, thirstSquaresContainerEl, hungerSquaresContainerEl, sleepSquaresContainerEl, healthStatusEl } = DOM;

    updateSquaresBar(healthSquaresContainerEl, player.health, player.maxHealth, 'health');
    updateSquaresBar(thirstSquaresContainerEl, player.thirst, player.maxThirst, 'thirst');
    updateSquaresBar(hungerSquaresContainerEl, player.hunger, player.maxHunger, 'hunger');
    updateSquaresBar(sleepSquaresContainerEl, player.sleep, player.maxSleep, 'sleep');

    if (healthStatusEl) {
        const statusNames = Object.keys(player.status);
        healthStatusEl.textContent = statusNames.length > 0 ? statusNames.join(', ') : 'normale';
    }

    if (healthSquaresContainerEl) healthSquaresContainerEl.parentElement.classList.toggle('pulsing', player.health <= (player.maxHealth * 0.3));
    if (thirstSquaresContainerEl) thirstSquaresContainerEl.parentElement.classList.toggle('pulsing', player.thirst <= (player.maxThirst * 0.2));
    if (hungerSquaresContainerEl) hungerSquaresContainerEl.parentElement.classList.toggle('pulsing', player.hunger <= (player.maxHunger * 0.2));
    if (sleepSquaresContainerEl) sleepSquaresContainerEl.parentElement.classList.toggle('pulsing', player.sleep <= (player.maxSleep * 0.2));

    document.getElementById('survival-vignette')?.classList.toggle('active', player.health <= (player.maxHealth * 0.3));
}

export function updateQuickSlots(player) { /* Not implemented */ }

export function updateInventory(player) {
    if (!player || !player.inventory || !DOM.inventoryCategoriesEl || !DOM.inventoryCapacityEl) return;

    DOM.inventoryCategoriesEl.innerHTML = '';
    const total = getTotalResources(player.inventory);
    DOM.inventoryCapacityEl.textContent = `(${total} / ${player.maxInventory})`;

    const categories = { ressources: {}, outilsEtArmes: {}, nourritureEtSoins: {}, equipements: {}, divers: {} };

    for (const itemKey in player.inventory) {
        const itemValue = player.inventory[itemKey];
        const isInstance = typeof itemValue === 'object' && itemValue.name;
        const baseItemName = isInstance ? itemValue.name : itemKey;
        const baseItemDef = ITEM_TYPES[baseItemName] || { type: 'resource', icon: '❓' };
        
        let type = 'divers';
        if (baseItemDef.type === 'resource' || baseItemDef.type === 'component') type = 'ressources';
        else if (baseItemDef.type === 'tool' || baseItemDef.type === 'weapon') type = 'outilsEtArmes';
        else if (baseItemDef.type === 'consumable' || baseItemDef.teachesRecipe) type = 'nourritureEtSoins';
        else if (baseItemDef.slot) type = 'equipements';
        
        if (!categories[type][baseItemName]) categories[type][baseItemName] = [];
        categories[type][baseItemName].push({ key: itemKey, value: itemValue });
    }

    const categoryOrder = [
        { key: 'ressources', name: 'Ressources' }, { key: 'outilsEtArmes', name: 'Outils et Armes' },
        { key: 'nourritureEtSoins', name: 'Nourriture et Soins' }, { key: 'equipements', name: 'Équipements' },
        { key: 'divers', name: 'Divers' },
    ];
    
    let hasItems = false;
    categoryOrder.forEach(cat => {
        const itemsInCategory = categories[cat.key];
        if (Object.keys(itemsInCategory).length > 0) {
            hasItems = true;
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'inventory-category';
            const header = document.createElement('div');
            header.className = 'category-header open';
            header.innerHTML = `<span>${cat.name}</span><span class="category-toggle">▶</span>`;
            const content = document.createElement('ul');
            content.className = 'category-content visible';
            
            Object.keys(itemsInCategory).sort().forEach(baseItemName => {
                itemsInCategory[baseItemName].forEach(itemData => {
                    const { key, value } = itemData;
                    const count = typeof value === 'number' ? value : 1;
                    const itemDef = ITEM_TYPES[baseItemName] || { icon: '❓', rarity: 'common' };
                    const li = document.createElement('li');
                    li.className = `inventory-item rarity-${itemDef.rarity || 'common'} clickable`;
                    li.dataset.itemKey = key;
                    li.dataset.itemName = baseItemName;
                    li.dataset.itemCount = count;
                    li.draggable = true;
                    li.dataset.owner = 'player-inventory';
                    
                    let displayName = baseItemName;
                    if (typeof value === 'object' && value.hasOwnProperty('currentDurability')) {
                        displayName += ` (${value.currentDurability}/${value.durability})`;
                    }
                    li.innerHTML = `<span class="inventory-icon">${itemDef.icon}</span><span class="inventory-name">${displayName}</span><span class="inventory-count">${count}</span>`;
                    content.appendChild(li);
                });
            });
            categoryDiv.appendChild(header);
            categoryDiv.appendChild(content);
            DOM.inventoryCategoriesEl.appendChild(categoryDiv);
        }
    });

    if (!hasItems) DOM.inventoryCategoriesEl.innerHTML = '<li class="inventory-empty">(Vide)</li>';
}

export function updateDayCounter(day) {
    if (DOM.dayDisplay) DOM.dayDisplay.textContent = `Jour: ${day}`;
}

export function updateTileInfoPanel(tile) {
    if (!tile || !DOM.tileNameEl || !DOM.tileHarvestsInfoEl) return;
    
    DOM.tileNameEl.textContent = tile.type.name;

    let infoText = tile.type.description || "";
    if(tile.buildings && tile.buildings.length > 0){
        const building = tile.buildings[0];
        const buildingDef = TILE_TYPES[building.key];
        infoText = `${buildingDef.name} - ${buildingDef.description}`;
        if(building.hasOwnProperty('durability')) {
            infoText += ` (Durabilité: ${building.durability}/${building.maxDurability})`
        }
    }
    DOM.tileHarvestsInfoEl.textContent = infoText;

    const biomeDisplay = document.getElementById('biome-display');
    if(biomeDisplay) biomeDisplay.textContent = `Biome: ${tile.type.name}`;
}

export function initializeTabs() {
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active-tab'));
            button.classList.add('active');
            const tabId = button.dataset.tab;
            document.getElementById(tabId)?.classList.add('active-tab');
        });
    });
}

export function addChatMessage(message, type, author) {
    const chatMessagesEl = DOM.chatMessagesEl;
    if (!chatMessagesEl) return;
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('chat-message', type || 'system');
    msgDiv.innerHTML = author ? `<strong>${author}: </strong>` : '';
    const spanMessage = document.createElement('span');
    spanMessage.textContent = message;
    msgDiv.appendChild(spanMessage);
    chatMessagesEl.appendChild(msgDiv);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

export function updateAllButtonsState(gameState) {
    if (!gameState || !gameState.player) return;
    const isPlayerBusy = gameState.player.isBusy || !!gameState.player.animationState;
    document.querySelectorAll('button').forEach(b => {
        if (!b.closest('#admin-modal')) { // Don't disable admin buttons
            b.disabled = isPlayerBusy;
        }
    });
}

export function updateGroundItemsPanel(tile) {
    if (!DOM.bottomBarGroundItemsEl || !tile) return;
    const list = DOM.bottomBarGroundItemsEl.querySelector('.ground-items-list');
    if (!list) return;
    list.innerHTML = '';
    const groundItems = tile.groundItems || {};
    if (Object.keys(groundItems).length === 0) {
        list.innerHTML = '<li class="inventory-empty">(Rien au sol)</li>';
    } else {
        for (const itemKey in groundItems) {
            const count = groundItems[itemKey];
            const itemDef = ITEM_TYPES[itemKey] || { icon: '❓' };
            const li = document.createElement('li');
            li.className = 'inventory-item clickable';
            li.dataset.itemName = itemKey;
            li.dataset.itemCount = count;
            li.dataset.owner = 'ground';
            li.draggable = true;
            li.innerHTML = `<span class="inventory-icon">${itemDef.icon}</span><span class="inventory-name">${itemKey}</span><span class="inventory-count">${count}</span>`;
            list.appendChild(li);
        }
    }
}

export function updateBottomBarEquipmentPanel(player) {
    if (!DOM.bottomBarEquipmentSlotsEl || !player) return;
    const slotsContainer = DOM.bottomBarEquipmentSlotsEl;
    slotsContainer.innerHTML = '';
    const slotTypes = ['head', 'weapon', 'shield', 'body', 'feet', 'bag'];
    slotTypes.forEach(slotType => {
        const slotEl = document.createElement('div');
        slotEl.className = 'equipment-slot-small droppable';
        slotEl.dataset.slotType = slotType;
        slotEl.dataset.owner = 'equipment';
        const equippedItem = player.equipment[slotType];
        if (equippedItem) {
            const itemDef = ITEM_TYPES[equippedItem.name] || { icon: '❓' };
            slotEl.innerHTML = `<div class="inventory-item" draggable="true" data-item-name="${equippedItem.name}" data-owner="equipment" data-slot-type="${slotType}"><span class="inventory-icon">${itemDef.icon}</span></div>`;
        }
        slotsContainer.appendChild(slotEl);
    });
}

export function updateActionsPanel(gameState) {
    const actionsContainer = document.getElementById('actions-tab-content');
    if (!actionsContainer) return;

    actionsContainer.innerHTML = ''; // Clear old buttons
    const { player } = gameState;

    if (!player || !player.availableActions || player.availableActions.length === 0) {
        actionsContainer.innerHTML = '<p class="inventory-empty">(Aucune action ici)</p>';
        return;
    }

    player.availableActions.forEach(action => {
        const button = document.createElement('button');
        button.id = `action-btn-${action.id}`;
        button.textContent = action.name;
        button.addEventListener('click', () => {
            if (action.id === ACTIONS.OPEN_BUILD_MODAL) {
                window.UI.showBuildModal(gameState);
            } else if (action.id === ACTIONS.USE_ETABLI || action.id === ACTIONS.USE_ATELIER || action.id === ACTIONS.USE_FORGE) {
                window.UI.showWorkshopModal(gameState);
            } else {
                sendAction(action.id, {});
            }
        });
        actionsContainer.appendChild(button);
    });
}
