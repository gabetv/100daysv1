import { ITEM_TYPES, TILE_TYPES, ACTIONS, CONFIG } from '../config.js';
import { notifyChatMessage } from './mobile.js';
import DOM from './dom.js';
import { sendAction } from '../main.js';
import { showChestModal, showLockModal, hideLockModal } from './modals.js';
import { itemIconHTML, tileIconHTML } from './icons.js';

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
        // player.status peut être un objet {Nom: {duration}} ou un tableau (anciennes sauvegardes)
        const statusNames = Array.isArray(player.status) ? player.status : Object.keys(player.status || {});
        healthStatusEl.textContent = statusNames.length > 0 ? statusNames.join(', ') : 'normale';
        healthStatusEl.classList.toggle('status-bad', statusNames.length > 0);
    }

    if (healthSquaresContainerEl) healthSquaresContainerEl.parentElement.classList.toggle('pulsing', player.health <= (player.maxHealth * 0.3));
    if (thirstSquaresContainerEl) thirstSquaresContainerEl.parentElement.classList.toggle('pulsing', player.thirst <= (player.maxThirst * 0.2));
    if (hungerSquaresContainerEl) hungerSquaresContainerEl.parentElement.classList.toggle('pulsing', player.hunger <= (player.maxHunger * 0.2));
    if (sleepSquaresContainerEl) sleepSquaresContainerEl.parentElement.classList.toggle('pulsing', player.sleep <= (player.maxSleep * 0.2));

    document.getElementById('survival-vignette')?.classList.toggle('active', player.health <= (player.maxHealth * 0.3));
}

export function updateQuickSlots(player) { /* Not implemented */ }

// --- Recherche + repli des catégories de l'inventaire ---
let inventorySearchTerm = '';
const collapsedCategories = new Set();
let inventoryControlsReady = false;

function initInventoryControls() {
    if (inventoryControlsReady) return;
    inventoryControlsReady = true;

    if (DOM.inventorySearchEl) {
        DOM.inventorySearchEl.addEventListener('input', () => {
            inventorySearchTerm = DOM.inventorySearchEl.value.toLowerCase().trim();
            if (window.gameState && window.gameState.player) updateInventory(window.gameState.player);
        });
    }
    // Plier / déplier une catégorie en cliquant sur son en-tête
    if (DOM.inventoryCategoriesEl) {
        DOM.inventoryCategoriesEl.addEventListener('click', (e) => {
            const header = e.target.closest('.category-header');
            if (!header) return;
            const key = header.dataset.categoryKey;
            if (!key) return;
            if (collapsedCategories.has(key)) collapsedCategories.delete(key);
            else collapsedCategories.add(key);
            if (window.gameState && window.gameState.player) updateInventory(window.gameState.player);
        });
    }
}

export function updateInventory(player) {
    if (!player || !player.inventory || !DOM.inventoryCategoriesEl || !DOM.inventoryCapacityEl) return;
    initInventoryControls();

    DOM.inventoryCategoriesEl.innerHTML = '';
    const total = getTotalResources(player.inventory);
    DOM.inventoryCapacityEl.textContent = `(${total} / ${player.maxInventory})`;

    const categories = { ressources: {}, outilsEtArmes: {}, nourritureEtSoins: {}, equipements: {}, divers: {} };

    for (const itemKey in player.inventory) {
        const itemValue = player.inventory[itemKey];
        const isInstance = typeof itemValue === 'object' && itemValue.name;
        const baseItemName = isInstance ? itemValue.name : itemKey;
        if (inventorySearchTerm && !baseItemName.toLowerCase().includes(inventorySearchTerm)) continue;
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
            const isCollapsed = collapsedCategories.has(cat.key) && !inventorySearchTerm;
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'inventory-category';
            const header = document.createElement('div');
            header.className = `category-header ${isCollapsed ? '' : 'open'}`;
            header.dataset.categoryKey = cat.key;
            header.innerHTML = `<span>${cat.name}</span><span class="category-toggle">${isCollapsed ? '▶' : '▼'}</span>`;
            const content = document.createElement('ul');
            content.className = `category-content ${isCollapsed ? '' : 'visible'}`;
            if (isCollapsed) content.style.display = 'none';
            
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
                    li.innerHTML = `${itemIconHTML(baseItemName, itemDef.icon)}<span class="inventory-name">${displayName}</span><span class="inventory-count">${count}</span>`;
                    content.appendChild(li);
                });
            });
            categoryDiv.appendChild(header);
            categoryDiv.appendChild(content);
            DOM.inventoryCategoriesEl.appendChild(categoryDiv);
        }
    });

    if (!hasItems) {
        DOM.inventoryCategoriesEl.innerHTML = `<li class="inventory-empty">${inventorySearchTerm ? '(Aucun résultat)' : '(Vide)'}</li>`;
    }
}

export function updateDayCounter(day) {
    if (DOM.dayDisplay) DOM.dayDisplay.textContent = `Jour ${day} / ${CONFIG.VICTORY_DAY}`;
}

export function updateTileInfoPanel(tile) {
    if (!tile || !DOM.tileNameEl || !DOM.tileHarvestsInfoEl) return;

    DOM.tileNameEl.innerHTML = `${tileIconHTML(tile.type.name, tile.type.icon || '', 'tile-name-icon')} ${tile.type.name}`;

    let infoText = tile.type.description || "Une zone encore inexplorée.";
    if (tile.buildings && tile.buildings.length > 0) {
        const building = tile.buildings[0];
        const buildingDef = TILE_TYPES[building.key];
        if (buildingDef) {
            infoText = `${buildingDef.name} — ${buildingDef.description || tile.type.description || ''}`;
            if (Object.prototype.hasOwnProperty.call(building, 'durability')) {
                infoText += ` (${building.durability}/${building.maxDurability} solidité)`;
            }
        }
    }
    DOM.tileHarvestsInfoEl.textContent = infoText;

    const biomeDisplay = document.getElementById('biome-display');
    if (biomeDisplay) biomeDisplay.textContent = `Biome : ${tile.type.name}`;
    const positionDisplay = document.getElementById('position-display');
    if (positionDisplay) positionDisplay.textContent = `(${tile.x}, ${tile.y})`;
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
    if (author) {
        // textContent (et non innerHTML) pour empêcher toute injection HTML via le pseudo
        const strongAuthor = document.createElement('strong');
        strongAuthor.textContent = `${author}: `;
        msgDiv.appendChild(strongAuthor);
    }
    const spanMessage = document.createElement('span');
    spanMessage.textContent = message;
    msgDiv.appendChild(spanMessage);
    chatMessagesEl.appendChild(msgDiv);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    // Badge "non lu" sur l'onglet Chat en mode mobile
    try { notifyChatMessage(); } catch (_) {}
}

export function updateAllButtonsState(gameState) {
    if (!gameState || !gameState.player) return;
    const isPlayerBusy = gameState.player.isBusy || !!gameState.player.animationState;
    // Ne désactiver que les boutons d'action du jeu : les commandes d'interface
    // (fermer une modale, onglets, son, chat...) doivent toujours rester utilisables.
    const selectors = [
        '.nav-button-overlay',
        '#actions-tab-content button',
        '.consume-btn',
        '#central-actions-panel button',
    ].join(', ');
    document.querySelectorAll(selectors).forEach(b => { b.disabled = isPlayerBusy; });
    document.body.classList.toggle('player-busy', isPlayerBusy);
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
            li.innerHTML = `${itemIconHTML(itemKey, itemDef.icon)}<span class="inventory-name">${itemKey}</span><span class="inventory-count">${count}</span>`;
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
            slotEl.innerHTML = `<div class="inventory-item" draggable="true" data-item-name="${equippedItem.name}" data-owner="equipment" data-slot-type="${slotType}" title="${equippedItem.name}">${itemIconHTML(equippedItem.name, itemDef.icon)}</div>`;
        }
        slotsContainer.appendChild(slotEl);
    });
}

function actionGroup(action) {
    const id = String(action?.id || '').toLowerCase();
    const name = String(action?.name || '').toLowerCase();
    if (id.includes('combat') || id.includes('attack') || name.includes('attaquer')) return ['Danger', '⚔️'];
    if (id.includes('build') || id.includes('repair') || id.includes('dismantle') || id.includes('plant') || id.includes('regenerate')) return ['Aménager', '🛠️'];
    if (id.includes('craft') || id.includes('workshop') || id.includes('etabli') || id.includes('forge') || name.includes('parchemin')) return ['Fabriquer', '🔧'];
    if (id.includes('open_building') || id.includes('lock') || id.includes('chest') || id.includes('treasure')) return ['Découvrir', '✨'];
    return ['Survie & exploration', '🌿'];
}

function actionIsRecommended(action, player, tile) {
    const id = String(action?.id || '');
    if (player.health <= player.maxHealth * 0.3 && [ACTIONS.SLEEP, ACTIONS.SLEEP_BY_CAMPFIRE].includes(id)) return true;
    if (id === ACTIONS.FIRE_DISTRESS_FLARE || id === ACTIONS.FIRE_DISTRESS_GUN) return true;
    if (id === ACTIONS.OPEN_TREASURE) return true;
    if (id === ACTIONS.INITIATE_COMBAT && tile?.type?.name === 'Trésor Caché') return true;
    return false;
}

export function updateActionsPanel(gameState) {
    const actionsContainer = document.getElementById('actions-tab-content');
    if (!actionsContainer) return;

    const { player } = gameState;
    const actions = player?.availableActions || [];
    const tile = gameState.map?.[player?.y]?.[player?.x];
    const screenButton = document.getElementById('screen-interaction-button');
    const screenLabel = document.getElementById('screen-action-label');
    const screenCount = document.getElementById('screen-action-count');
    if (screenCount) screenCount.textContent = String(actions.length);
    if (screenLabel) screenLabel.textContent = actions.length ? 'Actions ici' : 'Observer';
    if (screenButton) {
        screenButton.classList.toggle('has-actions', actions.length > 0);
        screenButton.setAttribute('aria-label', actions.length
            ? `Afficher les ${actions.length} actions disponibles ici`
            : 'Observer le lieu');
    }

    actionsContainer.innerHTML = '';
    const summary = document.createElement('div');
    summary.className = 'actions-summary';
    const summaryLabel = document.createElement('span');
    summaryLabel.className = 'actions-summary-label';
    summaryLabel.textContent = actions.length ? `${actions.length} choix possibles` : 'AUCUNE ACTION IMMÉDIATE';
    const summaryText = document.createElement('p');
    summaryText.textContent = actions.length
        ? 'Choisissez une action, puis adaptez votre plan aux ressources et aux dangers de cette case.'
        : 'Déplacez-vous vers une nouvelle case ou revenez après un événement.';
    summary.append(summaryLabel, summaryText);
    actionsContainer.appendChild(summary);

    if (!player || actions.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'inventory-empty';
        empty.textContent = 'Le calme ne durera pas éternellement…';
        actionsContainer.appendChild(empty);
        return;
    }

    const groupOrder = { 'Danger': 0, 'Survie & exploration': 1, 'Découvrir': 2, 'Fabriquer': 3, 'Aménager': 4 };
    const orderedActions = [...actions].sort((a, b) => {
        const [groupA] = actionGroup(a);
        const [groupB] = actionGroup(b);
        return (groupOrder[groupA] ?? 99) - (groupOrder[groupB] ?? 99);
    });

    let currentGroup = '';
    orderedActions.forEach(action => {
        const [group, icon] = actionGroup(action);
        if (group !== currentGroup) {
            currentGroup = group;
            const groupLabel = document.createElement('div');
            groupLabel.className = 'action-group-label';
            const groupIcon = document.createElement('span');
            groupIcon.textContent = icon;
            const groupName = document.createElement('span');
            groupName.textContent = group;
            groupLabel.append(groupIcon, groupName);
            actionsContainer.appendChild(groupLabel);
        }

        const recommended = actionIsRecommended(action, player, tile);
        const button = document.createElement('button');
        button.id = `action-btn-${action.id}`;
        button.className = `action-button${recommended ? ' recommended' : ''}`;
        button.textContent = action.name;
        if (recommended) {
            const recommendation = document.createElement('small');
            recommendation.className = 'action-recommendation';
            recommendation.textContent = 'Conseillé maintenant';
            button.appendChild(recommendation);
        }
        button.addEventListener('click', () => {
            if (action.id === ACTIONS.OPEN_BUILD_MODAL) {
                window.UI.showBuildModal(gameState);
            } else if (action.id === ACTIONS.OPEN_BUILDING_INVENTORY) {
                // Coffre verrouillé par un cadenas ? Demander le code (sauf au propriétaire)
                const currentTile = gameState.map?.[player.y]?.[player.x];
                const lockedChest = currentTile?.buildings?.find(b => b.lockCode);
                if (lockedChest && lockedChest.ownerId !== player.id) {
                    showLockModal((code) => {
                        if (String(code) === String(lockedChest.lockCode)) {
                            hideLockModal();
                            showChestModal(gameState);
                        } else if (window.UI) {
                            window.UI.addChatMessage('🔒 Mauvais code ! Le cadenas résiste.', 'system_error');
                        }
                    }, false);
                } else {
                    showChestModal(gameState);
                }
            } else if (action.id === ACTIONS.SET_LOCK) {
                showLockModal((code) => {
                    hideLockModal();
                    sendAction(ACTIONS.SET_LOCK, { code: String(code) });
                }, true);
            } else if (action.id === ACTIONS.USE_ETABLI || action.id === ACTIONS.USE_ATELIER || action.id === ACTIONS.USE_FORGE) {
                window.UI.showWorkshopModal(gameState);
            } else {
                sendAction(action.id, {});
            }
        });
        actionsContainer.appendChild(button);
    });
}
