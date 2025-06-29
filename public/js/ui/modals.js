// js/ui/modals.js
import { ITEM_TYPES, COMBAT_CONFIG, TILE_TYPES } from '../config.js';
import DOM from './dom.js';
import * as Draw from './draw.js';
import { sendAction } from '../main.js';

let quantityConfirmCallback = null;
let currentWorkshopRecipes = [];
let lockConfirmCallback = null;
let isSettingNewCode = false;

function populateInventoryList(inventory, listElement, owner, searchTerm = '') {
    if (!listElement) return;
    listElement.innerHTML = '';

    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
    const groupedItems = {};

    for (const key in inventory) {
        const item = inventory[key];
        const isInstance = typeof item === 'object' && item.name;
        const itemName = isInstance ? item.name : key;

        if (lowerCaseSearchTerm && !itemName.toLowerCase().includes(lowerCaseSearchTerm)) {
            continue;
        }
        if (!groupedItems[itemName]) groupedItems[itemName] = [];
        groupedItems[itemName].push({ key, value: item });
    }

    if (Object.keys(groupedItems).length === 0) {
        listElement.innerHTML = `<li class="inventory-empty">${searchTerm.trim() !== '' ? '(Aucun résultat)' : '(Vide)'}</li>`;
        return;
    }
    
    Object.keys(groupedItems).sort().forEach(itemName => {
        itemsToRender = groupedItems[itemName];
        const firstItem = itemsToRender[0].value;
        const count = typeof firstItem === 'number' ? firstItem : 1;
        const itemDef = ITEM_TYPES[itemName] || { icon: '❓' };
        
        const li = document.createElement('li');
        li.className = 'inventory-item';
        li.draggable = true;
        li.dataset.itemName = itemName;
        li.dataset.itemKey = itemsToRender[0].key;
        li.dataset.itemCount = count;
        li.dataset.owner = owner;
        
        let displayName = itemName;
        if(typeof firstItem === 'object' && firstItem.hasOwnProperty('currentDurability')) {
            displayName += ` (${firstItem.currentDurability}/${firstItem.durability})`;
        }
        li.innerHTML = `<span class="inventory-icon">${itemDef.icon}</span><span class="inventory-name">${displayName}</span><span class="inventory-count">${count}</span>`;
        listElement.appendChild(li);
    });
}

export function showInventoryModal(gameState) {
    if (!gameState || !gameState.player || !gameState.map) return;
    const { player, map } = gameState;
    const tile = map[player.y]?.[player.x];
    if (!tile) return;    

    let buildingWithInventory = tile.buildings?.find(b => TILE_TYPES[b.key]?.inventory || TILE_TYPES[b.key]?.maxInventory);
    
    if (!buildingWithInventory) return;

    let buildingDef = TILE_TYPES[buildingWithInventory.key];
    if (!buildingWithInventory.inventory) buildingWithInventory.inventory = {}; 
    let currentTileInventory = buildingWithInventory.inventory;
    let currentTileMaxInventory = buildingDef.maxInventory || Infinity;
    
    const { modalPlayerInventoryEl, modalSharedInventoryEl, modalPlayerCapacityEl, inventoryModal, modalSharedCapacityEl } = DOM;
    
    populateInventoryList(player.inventory, modalPlayerInventoryEl, 'player-inventory');
    populateInventoryList(currentTileInventory, modalSharedInventoryEl, 'shared');

    if(modalPlayerCapacityEl) modalPlayerCapacityEl.textContent = `${Object.keys(player.inventory).length} / ${player.maxInventory}`;
    if (modalSharedCapacityEl) modalSharedCapacityEl.textContent = `${Object.keys(currentTileInventory).length} / ${currentTileMaxInventory === Infinity ? "∞" : currentTileMaxInventory}`;

    const searchInput = document.getElementById('shared-inventory-search');
    if (searchInput) {
        searchInput.value = '';
        searchInput.oninput = () => populateInventoryList(currentTileInventory, modalSharedInventoryEl, 'shared', searchInput.value);
    }
    
    if(inventoryModal) inventoryModal.classList.remove('hidden');
}

export function hideInventoryModal() {
    if(DOM.inventoryModal) DOM.inventoryModal.classList.add('hidden');
}

export function showEquipmentModal(gameState) {
    if (!DOM.equipmentModal) return;
    updateEquipmentModal(gameState);
    DOM.equipmentModal.classList.remove('hidden');
}
export function hideEquipmentModal() {
    if(DOM.equipmentModal) DOM.equipmentModal.classList.add('hidden');
}
export function updateEquipmentModal(gameState) {
    if (!gameState || !gameState.player) return;
    const { player } = gameState;
    const { equipmentPlayerInventoryEl, equipmentPlayerCapacityEl, playerStatAttackEl, playerStatDefenseEl, equipmentSlotsEl } = DOM;

    if (equipmentPlayerInventoryEl) populateInventoryList(player.inventory, equipmentPlayerInventoryEl, 'player-inventory'); 
    if (equipmentPlayerCapacityEl) equipmentPlayerCapacityEl.textContent = `${Object.keys(player.inventory).length} / ${player.maxInventory}`;
    
    if (equipmentSlotsEl) {
        equipmentSlotsEl.querySelectorAll('.equipment-slot').forEach(slotEl => {
            const slotType = slotEl.dataset.slotType;
            const equippedItem = player.equipment[slotType];
            slotEl.innerHTML = '';
            if (equippedItem) {
                const itemDef = ITEM_TYPES[equippedItem.name] || { icon: '❓' };
                let displayName = equippedItem.name;
                if (equippedItem.hasOwnProperty('currentDurability')) displayName += ` (${equippedItem.currentDurability}/${equippedItem.durability})`;
                
                const itemDiv = document.createElement('div');
                itemDiv.className = 'inventory-item';
                itemDiv.draggable = true;
                itemDiv.dataset.itemName = equippedItem.name;
                itemDiv.dataset.itemKey = `${equippedItem.name}_equipped`;
                itemDiv.dataset.owner = 'equipment';
                itemDiv.dataset.slotType = slotType;
                itemDiv.innerHTML = `<span class="inventory-icon">${itemDef.icon}</span><span class="inventory-name">${displayName}</span>`;
                slotEl.appendChild(itemDiv);
            }
        });
    }

    if (playerStatAttackEl) {
        playerStatAttackEl.textContent = (player.equipment.weapon?.stats?.damage || COMBAT_CONFIG.PLAYER_UNARMED_DAMAGE);
    }
    if (playerStatDefenseEl) {
        playerStatDefenseEl.textContent = (player.equipment.body?.stats?.defense || 0) +
                        (player.equipment.head?.stats?.defense || 0) +
                        (player.equipment.feet?.stats?.defense || 0) +
                        (player.equipment.shield?.stats?.defense || 0);
    }
}

export function showCombatModal(combatState) {
    if (!combatState || !DOM.combatModal) return;
    updateCombatUI(combatState);
    DOM.combatModal.classList.remove('hidden');
}
export function hideCombatModal() {
    if(DOM.combatModal) DOM.combatModal.classList.add('hidden');
}
export function updateCombatUI(combatState) {
    if (!combatState || !DOM.combatModal) return;
    const { combatEnemyName, combatEnemyHealthBar, combatEnemyHealthText, combatPlayerHealthBar, combatPlayerHealthText, combatLogEl, combatActionsEl } = DOM;
    
    if (!window.gameState || !window.gameState.player) return;
    const player = window.gameState.player;
    const { enemy, turn, log } = combatState;

    if(combatEnemyName) combatEnemyName.textContent = enemy.name;
    if(combatEnemyHealthBar) combatEnemyHealthBar.style.width = `${(enemy.currentHealth / enemy.health) * 100}%`;
    if(combatEnemyHealthText) combatEnemyHealthText.textContent = `${enemy.currentHealth} / ${enemy.health}`;
    if(combatPlayerHealthBar) combatPlayerHealthBar.style.width = `${(player.health / player.maxHealth) * 100}%`;
    if(combatPlayerHealthText) combatPlayerHealthText.textContent = `${player.health} / ${player.maxHealth}`;
    if(combatLogEl) combatLogEl.innerHTML = log.map(msg => `<p>${msg}</p>`).join('');
    
    if (combatActionsEl) {
        const isPlayerTurn = turn === player.id;
        combatActionsEl.innerHTML = `<button id="combat-attack-btn" ${!isPlayerTurn ? 'disabled' : ''}>⚔️ Attaquer</button><button id="combat-flee-btn" ${!isPlayerTurn ? 'disabled' : ''}>🏃‍♂️ Fuir</button>`;
        if (isPlayerTurn) {
            document.getElementById('combat-attack-btn')?.addEventListener('click', () => sendAction('combat_action', { move: 'attack' }));
            document.getElementById('combat-flee-btn')?.addEventListener('click', () => sendAction('combat_action', { move: 'flee' }));
        }
    }
}

export function showQuantityModal(itemName, maxAmount, callback) {
    if (!DOM.quantityModal) return;
    const { quantityModalTitle, quantitySlider, quantityInput } = DOM;
    if(quantityModalTitle) quantityModalTitle.textContent = `Choisir la quantité pour ${itemName}`;
    
    const adjustedMax = Math.max(1, maxAmount);
    if(quantitySlider) { quantitySlider.max = adjustedMax; quantitySlider.value = 1; }
    if(quantityInput) { quantityInput.max = adjustedMax; quantityInput.value = 1; }
    quantityConfirmCallback = callback;
    DOM.quantityModal.classList.remove('hidden');
}
export function hideQuantityModal() {
    if(DOM.quantityModal) DOM.quantityModal.classList.add('hidden');
    quantityConfirmCallback = null;
}
export function setupQuantityModalListeners() {
    const { quantitySlider, quantityInput, quantityConfirmBtn, quantityCancelBtn, quantityMaxBtn, quantityShortcuts } = DOM;
    if(!quantitySlider || !quantityInput || !quantityConfirmBtn || !quantityCancelBtn) return;
    quantitySlider.addEventListener('input', () => { if(quantityInput) quantityInput.value = quantitySlider.value; });
    quantityInput.addEventListener('input', () => {
        let val = parseInt(quantityInput.value, 10);
        const max = parseInt(quantityInput.max, 10);
        if (isNaN(val) || val < 1) val = 1;
        else if (val > max) val = max;
        quantityInput.value = val;
        if(quantitySlider) quantitySlider.value = val;
    });
    quantityConfirmBtn.addEventListener('click', () => { 
        if (quantityConfirmCallback) quantityConfirmCallback(parseInt(quantityInput.value, 10));
        hideQuantityModal(); 
    });
    quantityCancelBtn.addEventListener('click', hideQuantityModal);
    quantityMaxBtn?.addEventListener('click', () => { if(quantityInput) quantityInput.value = quantityInput.max; if(quantitySlider) quantitySlider.value = quantitySlider.max; });
    quantityShortcuts?.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.dataset.amount) {
            const amount = Math.min(parseInt(e.target.dataset.amount, 10), parseInt(quantityInput.max, 10));
            if(quantityInput) quantityInput.value = amount;
            if(quantitySlider) quantitySlider.value = amount;
        }
    });
}

export function showLargeMap(gameState) {
    if (!DOM.largeMapModal) return;
    DOM.largeMapModal.classList.remove('hidden');
    if (gameState && gameState.config) {
        Draw.drawLargeMap(gameState, gameState.config);
        Draw.populateLargeMapLegend();
    }
}
export function hideLargeMap() {
    if(DOM.largeMapModal) DOM.largeMapModal.classList.add('hidden');
}

export function showBuildModal(gameState) {
    if (!DOM.buildModal || !DOM.buildModalGridEl) return;
    populateBuildModal(gameState);
    DOM.buildModal.classList.remove('hidden');
}
export function hideBuildModal() {
    if (DOM.buildModal) DOM.buildModal.classList.add('hidden');
}
export function setupBuildModalListeners() {
    DOM.closeBuildModalBtn?.addEventListener('click', hideBuildModal);
}
export function populateBuildModal(gameState) {
    if (!DOM.buildModalGridEl || !gameState || !gameState.player || !gameState.map || !gameState.knownRecipes) return;
    const { player, map, knownRecipes, config } = gameState;
    const tile = map[player.y][player.x];
    DOM.buildModalGridEl.innerHTML = '';
    
    const constructibleBuildings = Object.keys(TILE_TYPES).filter(key => {
        const bt = TILE_TYPES[key];
        return bt.isBuilding && bt.cost;
    });

    if (constructibleBuildings.length === 0) {
        DOM.buildModalGridEl.innerHTML = '<p class="inventory-empty">Aucune construction disponible.</p>';
        return;
    }

    constructibleBuildings.sort().forEach(bKey => {
        const buildingType = TILE_TYPES[bKey];
        const costs = { ...buildingType.cost };
        const toolReqArray = costs.toolRequired;
        delete costs.toolRequired;

        const hasEnoughResources = Object.keys(costs).every(item => (player.inventory[item] || 0) >= costs[item]);
        const canBuildHere = tile.type.buildable || (['MINE', 'CAMPFIRE', 'PETIT_PUIT'].includes(bKey));
        let hasRequiredTool = !toolReqArray || toolReqArray.some(toolName => player.equipment.weapon?.name === toolName);
        let isDisabledByStatus = player.status.includes('Drogué');
        const canBuild = hasEnoughResources && hasRequiredTool && tile.buildings.length < config.MAX_BUILDINGS_PER_TILE && canBuildHere && !isDisabledByStatus;

        const card = document.createElement('div');
        card.className = 'build-item-card';

        const header = document.createElement('div');
        header.className = 'build-item-header';
        header.innerHTML = `<span class="build-item-icon">${buildingType.icon || '🏛️'}</span><span class="build-item-name">${buildingType.name}</span>`;

        const description = document.createElement('p');
        description.className = 'build-item-description';
        description.textContent = buildingType.description || "Aucune description.";

        const costsDiv = document.createElement('div');
        costsDiv.className = 'build-item-costs';
        costsDiv.innerHTML = '<h4>Coûts :</h4>';
        const costsList = document.createElement('ul');
        for (const item in costs) {
            const li = document.createElement('li');
            const playerAmount = player.inventory[item] || 0;
            li.textContent = `${costs[item]} ${item}`;
            if (playerAmount < costs[item]) li.style.color = '#ff6b6b';
            costsList.appendChild(li);
        }
        costsDiv.appendChild(costsList);

        const toolsDiv = document.createElement('div');
        toolsDiv.className = 'build-item-tools';
        toolsDiv.innerHTML = '<h4>Outils requis :</h4>';
        const toolsList = document.createElement('ul');
        if (toolReqArray?.length > 0) {
            toolsList.innerHTML = toolReqArray.map(toolName => `<li>${toolName}</li>`).join('');
        } else {
            toolsList.innerHTML = '<li>Aucun</li>';
        }
        toolsDiv.appendChild(toolsList);

        const actionDiv = document.createElement('div');
        actionDiv.className = 'build-item-action';
        const buildButton = document.createElement('button');
        buildButton.textContent = "Construire";
        buildButton.disabled = !canBuild || player.isBusy;
        
        buildButton.onclick = () => {
            sendAction('build_structure', { structureKey: bKey });
            hideBuildModal();
        };
        actionDiv.appendChild(buildButton);

        card.append(header, description, costsDiv, toolsDiv, actionDiv);
        DOM.buildModalGridEl.appendChild(card);
    });
}

export function showWorkshopModal(gameState) {
    if (!DOM.workshopModal || !DOM.workshopRecipesContainerEl) return;
    populateWorkshopModal(gameState);
    DOM.workshopModal.classList.remove('hidden');
}
export function hideWorkshopModal() {
    if (DOM.workshopModal) DOM.workshopModal.classList.add('hidden');
}
export function populateWorkshopModal(gameState) {
    if (!DOM.workshopRecipesContainerEl || !gameState || !gameState.player || !gameState.knownRecipes) return;
    
    currentWorkshopRecipes = [];
    for (const itemName in ITEM_TYPES) {
        const itemDef = ITEM_TYPES[itemName];
        if (itemDef.teachesRecipe && gameState.knownRecipes[itemDef.teachesRecipe] && !itemDef.isBuildingRecipe) {
            const costs = {};
            let yieldAmount = 1;
            const description = itemDef.description || "";
            const match = description.match(/Transformer\s+(.+?)\s*=\s*(?:(\d+)\s+)?(.+)/i);

            if (match) {
                const ingredientsString = match[1];
                if (match[2]) yieldAmount = parseInt(match[2], 10) || 1;
                ingredientsString.split(/\s+(?:et|\+)\s+/i).forEach(part => {
                    const partMatch = part.trim().match(/(\d+)\s+(.+)/);
                    if (partMatch) costs[partMatch[2].trim()] = parseInt(partMatch[1], 10);
                });
            } else { continue; }

            if (Object.keys(costs).length > 0) {
                 currentWorkshopRecipes.push({
                    name: itemDef.teachesRecipe,
                    icon: ITEM_TYPES[itemDef.teachesRecipe]?.icon || '🛠️',
                    costs: costs,
                    yield: yieldAmount,
                    category: (ITEM_TYPES[itemDef.teachesRecipe]?.type || 'other'),
                    sourceParchemin: itemName
                });
            }
        }
    }
    currentWorkshopRecipes.sort((a,b) => a.name.localeCompare(b.name));
    renderWorkshopRecipes(gameState.player, gameState.map[gameState.player.y][gameState.player.x]);
}
function renderWorkshopRecipes(player, tile) {
    if (!DOM.workshopRecipesContainerEl) return;
    DOM.workshopRecipesContainerEl.innerHTML = '';

    const searchTerm = DOM.workshopSearchInputEl?.value.toLowerCase() || '';
    const categoryFilter = DOM.workshopCategoryFilterEl?.value || 'all';

    const filteredRecipes = currentWorkshopRecipes.filter(recipe => 
        recipe.name.toLowerCase().includes(searchTerm) && (categoryFilter === 'all' || recipe.category === categoryFilter)
    );

    if (filteredRecipes.length === 0) {
        DOM.workshopRecipesContainerEl.innerHTML = '<p class="inventory-empty">Aucune recette ne correspond.</p>';
        return;
    }

    filteredRecipes.forEach(recipe => {
        const card = document.createElement('div');
        card.className = 'workshop-recipe-card';
        card.dataset.recipeName = recipe.name;

        const header = `<div class="workshop-recipe-header"><span class="workshop-recipe-icon">${recipe.icon}</span><span class="workshop-recipe-name">${recipe.name}</span></div>`;
        const yieldEl = `<div class="workshop-recipe-yield">Produit: <strong>${recipe.yield}</strong></div>`;
        
        let costsHtml = '<div class="workshop-recipe-costs"><h5>Coûts (par unité):</h5><ul>';
        for (const itemName in recipe.costs) {
            const itemIcon = ITEM_TYPES[itemName]?.icon || '';
            costsHtml += `<li data-item-name="${itemName}"><span class="cost-name"><span class="item-icon">${itemIcon}</span>${itemName}</span><span class="cost-amount"></span></li>`;
        }
        costsHtml += '</ul></div>';
        
        const quantityInput = `<div class="quantity-input-wrapper"><label>Quantité:</label><input type="number" min="1" value="1" data-recipe-name="${recipe.name}"></div>`;
        const actionButton = `<div class="workshop-recipe-action"><button>Transformer</button></div>`;
        
        card.innerHTML = header + yieldEl + costsHtml + quantityInput + actionButton;
        DOM.workshopRecipesContainerEl.appendChild(card);
        
        card.querySelector('input[type="number"]').addEventListener('input', (e) => handleWorkshopQuantityChange(e, player, recipe, tile));
        card.querySelector('button').addEventListener('click', () => {
            const qty = parseInt(card.querySelector('input').value, 10);
            sendAction('craft_item_workshop', { recipeName: recipe.name, costs: recipe.costs, quantity: qty });
        });
        
        handleWorkshopQuantityChange({ target: card.querySelector('input[type="number"]') }, player, recipe, tile);
    });
}
function handleWorkshopQuantityChange(event, player, recipe, tile) {
    const inputElement = event.target;
    const quantityToCraft = parseInt(inputElement.value, 10);
    const recipeCard = inputElement.closest('.workshop-recipe-card');
    const transformButton = recipeCard.querySelector('button');

    if (isNaN(quantityToCraft) || quantityToCraft <= 0) {
        if (transformButton) transformButton.disabled = true;
        return;
    }

    let canCraft = true;
    recipeCard.querySelectorAll('.workshop-recipe-costs li').forEach(li => {
        const itemName = li.dataset.itemName;
        const costAmountEl = li.querySelector('.cost-amount');
        const required = recipe.costs[itemName] * quantityToCraft;
        const available = player.inventory[itemName] || 0;
        
        costAmountEl.textContent = `${available} / ${required}`;
        if (available < required) {
            costAmountEl.classList.add('insufficient');
            canCraft = false;
        } else {
            costAmountEl.classList.remove('insufficient');
        }
    });
    if (transformButton) transformButton.disabled = !canCraft || player.isBusy;
}
export function setupWorkshopModalListeners(gameState) {
    const update = () => renderWorkshopRecipes(gameState.player, gameState.map[gameState.player.y][gameState.player.x]);
    DOM.closeWorkshopModalBtn?.addEventListener('click', hideWorkshopModal);
    DOM.workshopSearchInputEl?.addEventListener('input', update);
    DOM.workshopCategoryFilterEl?.addEventListener('change', update);
}

export function showLockModal(callback, isSetting) {
    if (!DOM.lockModal) return;
    isSettingNewCode = isSetting;
    lockConfirmCallback = callback;
    DOM.lockModalTitle.textContent = isSetting ? "Définir le code" : "Entrer le code";
    DOM.lockUnlockButton.textContent = isSetting ? "Définir" : "Déverrouiller";
    [DOM.lockCodeInput1, DOM.lockCodeInput2, DOM.lockCodeInput3].forEach(i => i.value = '');
    DOM.lockModal.classList.remove('hidden');
    DOM.lockCodeInput1.focus();
}
export function hideLockModal() {
    if (DOM.lockModal) DOM.lockModal.classList.add('hidden');
    lockConfirmCallback = null;
}
export function setupLockModalListeners() {
    const { lockModal, lockCodeInput1, lockCodeInput2, lockCodeInput3, lockUnlockButton, lockCancelButton } = DOM;
    if (!lockModal) return;

    const inputs = [lockCodeInput1, lockCodeInput2, lockCodeInput3];
    inputs.forEach((input, idx) => {
        input.addEventListener('input', () => {
            if (input.value.length >= 1 && idx < inputs.length - 1) inputs[idx+1].focus();
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && input.value.length === 0 && idx > 0) inputs[idx-1].focus();
        });
    });

    lockUnlockButton.addEventListener('click', () => {
        const code = inputs.map(i => i.value).join('');
        if (code.length === 3 && /^\d{3}$/.test(code)) {
            if (lockConfirmCallback) lockConfirmCallback(code);
        } else {
            if (window.UI) window.UI.addChatMessage("Le code doit être de 3 chiffres.", "system_error");
        }
    });
    lockCancelButton.addEventListener('click', hideLockModal);
}