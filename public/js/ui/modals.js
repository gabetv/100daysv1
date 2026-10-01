// js/ui/modals.js
import { ITEM_TYPES, COMBAT_CONFIG, TILE_TYPES, ACTIONS, CHARACTER_APPEARANCE, DEFAULT_CHARACTER_APPEARANCE } from '../config.js';
import DOM from './dom.js';
import * as Draw from './draw.js';
import { sendAction } from '../main.js';
import { sfx } from '../audio.js';
import { itemIconHTML, tileIconHTML, ENEMY_IMAGES } from './icons.js';
import { getWorkshopRecipes, maxCraftableAmount, countInInventory } from '../recipes.js';
import { itemActionsHTML, slotUnequipButtonHTML, dispatchPlayerAction } from './item-actions.js';

/** Vérifie un statut quel que soit son format (objet {Nom:{...}} ou tableau). */
function hasStatus(player, statusName) {
    if (!player || !player.status) return false;
    if (Array.isArray(player.status)) return player.status.includes(statusName);
    return !!player.status[statusName];
}

const SLOT_LABELS = { head: 'Tête', weapon: 'Arme/Outil', shield: 'Bouclier', body: 'Habits', feet: 'Chaussures', bag: 'Sac' };

let quantityConfirmCallback = null;
let currentWorkshopRecipes = [];
let lockConfirmCallback = null;
let isSettingNewCode = false;

/**
 * Construit une liste d'objets : une ligne par entrée d'inventaire.
 *
 * Les exemplaires uniques d'un même objet (deux Haches…) ne sont plus
 * fusionnés sur une seule ligne : chacun garde sa clé, sa durabilité et
 * ses boutons d'action rapide (✚ équiper, ⬇ poser au sol…).
 */
function populateInventoryList(inventory, listElement, owner, searchTerm = '', options = {}) {
    if (!listElement) return;
    const context = options.context || 'storage';
    // La liste peut scroller elle-même (modale Équipement) ou via son
    // conteneur (modale Coffre) : on restaure la position de lecture.
    const scroller = listElement.closest('.inventory-list-wrapper') || listElement;
    const previousScroll = scroller.scrollTop;

    listElement.innerHTML = '';

    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
    const rows = [];

    for (const key in inventory) {
        const item = inventory[key];
        const isInstance = typeof item === 'object' && item.name;
        const itemName = isInstance ? item.name : key;
        if (lowerCaseSearchTerm && !itemName.toLowerCase().includes(lowerCaseSearchTerm)) continue;
        rows.push({ key, item, itemName, isInstance });
    }

    if (rows.length === 0) {
        listElement.innerHTML = `<li class="inventory-empty">${searchTerm.trim() !== '' ? '(Aucun résultat)' : '(Vide)'}</li>`;
        return;
    }

    rows.sort((a, b) => a.itemName.localeCompare(b.itemName, 'fr')).forEach(({ key, item, itemName, isInstance }) => {
        const count = typeof item === 'number' ? item : 1;
        const itemDef = ITEM_TYPES[itemName] || { icon: '❓' };

        const li = document.createElement('li');
        li.className = `inventory-item clickable has-actions rarity-${itemDef.rarity || 'common'}`;
        li.draggable = true;
        li.dataset.itemName = itemName;
        li.dataset.itemKey = key;
        li.dataset.itemCount = count;
        li.dataset.owner = owner;

        let displayName = itemName;
        if (isInstance && typeof item.currentDurability === 'number') {
            displayName += ` (${item.currentDurability}/${item.durability})`;
        }
        const slotChip = (context === 'equipment' && itemDef.slot)
            ? `<span class="slot-chip">${SLOT_LABELS[itemDef.slot] || itemDef.slot}</span>`
            : '';

        li.innerHTML = `${itemIconHTML(itemName, itemDef.icon)}`
            + `<span class="inventory-name">${displayName}</span>${slotChip}`
            + `<span class="inventory-count">${count}</span>`
            + itemActionsHTML({ owner, itemName, context });
        listElement.appendChild(li);
    });

    scroller.scrollTop = previousScroll;
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

export function showChestModal(gameState) {
    if (!DOM.chestModal) return;
    // Dévoiler la modale AVANT de la remplir : refreshChestModal ignore
    // volontairement les appels quand la fenêtre est cachée.
    DOM.chestModal.classList.remove('hidden');
    refreshChestModal(gameState);
}

/**
 * Recharge le contenu de la modale Coffre. Appelée à chaque état serveur
 * tant qu'elle est ouverte : après un dépôt ou un retrait, les deux listes
 * reflètent immédiatement la réalité — plus besoin de fermer puis rouvrir.
 */
export function refreshChestModal(gameState) {
    if (!DOM.chestModal || DOM.chestModal.classList.contains('hidden')) return;
    if (!gameState || !gameState.player || !gameState.map) return;
    const { player, map } = gameState;
    const tile = map[player.y]?.[player.x];
    if (!tile) { hideChestModal(); return; }

    let buildingWithInventory = tile.buildings?.find(b => TILE_TYPES[b.key]?.inventory || TILE_TYPES[b.key]?.maxInventory);
    if (!buildingWithInventory) { hideChestModal(); return; }

    let buildingDef = TILE_TYPES[buildingWithInventory.key];
    if (!buildingWithInventory.inventory) buildingWithInventory.inventory = {};
    let currentBuildingInventory = buildingWithInventory.inventory;
    let currentBuildingMaxInventory = buildingDef.maxInventory || Infinity;

    const { chestPlayerInventoryEl, chestBuildingInventoryEl, chestPlayerCapacityEl, chestBuildingCapacityEl, chestTakeAllBtn } = DOM;

    populateInventoryList(player.inventory, chestPlayerInventoryEl, 'player-inventory', '', { context: 'storage' });
    populateInventoryList(currentBuildingInventory, chestBuildingInventoryEl, 'building-inventory');

    if (chestPlayerCapacityEl) chestPlayerCapacityEl.textContent = `${Object.keys(player.inventory).length} / ${player.maxInventory}`;
    if (chestBuildingCapacityEl) chestBuildingCapacityEl.textContent = `${Object.keys(currentBuildingInventory).length} / ${currentBuildingMaxInventory === Infinity ? "∞" : currentBuildingMaxInventory}`;
    if (chestTakeAllBtn) chestTakeAllBtn.disabled = Object.keys(currentBuildingInventory).length === 0;
}

export function isChestModalOpen() {
    return !!DOM.chestModal && !DOM.chestModal.classList.contains('hidden');
}

export function hideChestModal() {
    if (DOM.chestModal) DOM.chestModal.classList.add('hidden');
}

export function setupChestModalListeners() {
    DOM.closeChestModalBtn?.addEventListener('click', hideChestModal);
    // « Tout prendre » : vide le coffre dans le sac en une seule action.
    DOM.chestTakeAllBtn?.addEventListener('click', () => {
        dispatchPlayerAction(ACTIONS.TAKE_ALL_ITEMS, {});
    });
}

/** Boutons de fermeture des modales d'inventaire et d'équipement. */
export function setupMiscModalListeners() {
    DOM.closeInventoryModalBtn?.addEventListener('click', hideInventoryModal);
    DOM.closeEquipmentModalBtn?.addEventListener('click', hideEquipmentModal);

    // Filtre du sac dans la modale Équipement : équipables seuls (défaut,
    // pour équiper d'un clic) ou tout le sac. Le choix reste mémorisé
    // pendant la partie.
    DOM.equipmentFilterEquippableBtn?.addEventListener('click', () => setEquipmentListFilter('equippable'));
    DOM.equipmentFilterAllBtn?.addEventListener('click', () => setEquipmentListFilter('all'));
}

/** Ferme la modale visible la plus prioritaire (touche Échap). Renvoie true si une modale a été fermée. */
export function closeTopModal() {
    const closers = [
        ['quantity-modal', hideQuantityModal],
        ['lock-modal', hideLockModal],
        ['build-modal', hideBuildModal],
        ['workshop-modal', hideWorkshopModal],
        ['chest-modal', hideChestModal],
        ['inventory-modal', hideInventoryModal],
        ['customize-modal', hideCustomizationModal],
        ['equipment-modal', hideEquipmentModal],
        ['large-map-modal', hideLargeMap],
    ];
    for (const [id, closeFn] of closers) {
        const el = document.getElementById(id);
        if (el && !el.classList.contains('hidden')) { closeFn(); return true; }
    }
    // Pas de modale ouverte : le menu contextuel des objets se ferme aussi
    // avec Échap.
    const contextMenu = document.getElementById('item-context-menu');
    if (contextMenu && !contextMenu.classList.contains('hidden')) {
        contextMenu.classList.add('hidden');
        return true;
    }
    return false;
}

export function showEquipmentModal(gameState) {
    if (!DOM.equipmentModal) return;
    updateEquipmentModal(gameState);
    DOM.equipmentModal.classList.remove('hidden');
}
export function hideEquipmentModal() {
    if(DOM.equipmentModal) DOM.equipmentModal.classList.add('hidden');
}

// Filtre du sac dans la fiche Équipement : 'equippable' (défaut) ou 'all'.
let equipmentListFilter = 'equippable';

function setEquipmentListFilter(value) {
    if (equipmentListFilter === value) return;
    equipmentListFilter = value;
    if (window.gameState?.player) updateEquipmentModal(window.gameState);
}

/** Les entrées d'inventaire portant un emplacement (tête, arme, habits…). */
function equippableEntriesOnly(inventory) {
    const result = {};
    for (const key in inventory) {
        const value = inventory[key];
        const baseName = (typeof value === 'object' && value && value.name) ? value.name : key;
        if (ITEM_TYPES[baseName]?.slot) result[key] = value;
    }
    return result;
}

export function updateEquipmentModal(gameState) {
    if (!gameState || !gameState.player) return;
    const { player } = gameState;
    const { equipmentPlayerInventoryEl, equipmentPlayerCapacityEl, playerStatAttackEl, playerStatDefenseEl, equipmentSlotsEl,
        equipmentFilterEquippableBtn, equipmentFilterAllBtn, equipmentFilterHintEl } = DOM;

    // Reflet du filtre choisi sur les deux boutons et l'explication.
    equipmentFilterEquippableBtn?.classList.toggle('active', equipmentListFilter !== 'all');
    equipmentFilterAllBtn?.classList.toggle('active', equipmentListFilter === 'all');
    equipmentFilterEquippableBtn?.setAttribute('aria-pressed', String(equipmentListFilter !== 'all'));
    equipmentFilterAllBtn?.setAttribute('aria-pressed', String(equipmentListFilter === 'all'));
    if (equipmentFilterHintEl) {
        equipmentFilterHintEl.textContent = equipmentListFilter === 'all'
            ? 'Tout le sac : ✚ équipe ou utilise, ⬇ pose au sol.'
            : 'Seuls les objets équipables sont listés : ✚ les équipe en un clic.';
    }

    if (equipmentPlayerInventoryEl) {
        const showAll = equipmentListFilter === 'all';
        const inventory = showAll ? player.inventory : equippableEntriesOnly(player.inventory);
        populateInventoryList(inventory, equipmentPlayerInventoryEl, 'player-inventory', '', { context: 'equipment' });

        const equippableCount = Object.keys(equippableEntriesOnly(player.inventory)).length;
        if (equipmentPlayerCapacityEl) {
            equipmentPlayerCapacityEl.textContent = showAll
                ? `${Object.keys(player.inventory).length} / ${player.maxInventory}`
                : `${equippableCount} équipable${equippableCount > 1 ? 's' : ''} · ${Object.keys(player.inventory).length} / ${player.maxInventory}`;
        }
    }

    if (equipmentSlotsEl) {
        equipmentSlotsEl.querySelectorAll('.equipment-slot').forEach(slotEl => {
            const slotType = slotEl.dataset.slotType;
            const equippedItem = player.equipment[slotType];
            slotEl.innerHTML = '';
            if (equippedItem) {
                const itemDef = ITEM_TYPES[equippedItem.name] || { icon: '❓' };
                let displayName = equippedItem.name;
                if (typeof equippedItem.currentDurability === 'number') displayName += ` (${equippedItem.currentDurability}/${equippedItem.durability})`;
                
                const itemDiv = document.createElement('div');
                // 'clickable' : un clic simple ouvre le menu contextuel
                // (Déséquiper, Jeter…), comme pour les objets du sac.
                itemDiv.className = 'inventory-item clickable';
                itemDiv.draggable = true;
                itemDiv.dataset.itemName = equippedItem.name;
                itemDiv.dataset.itemKey = `${equippedItem.name}_equipped`;
                itemDiv.dataset.owner = 'equipment';
                itemDiv.dataset.slotType = slotType;
                itemDiv.innerHTML = `${itemIconHTML(equippedItem.name, itemDef.icon)}<span class="inventory-name">${displayName}</span>`;
                slotEl.appendChild(itemDiv);
                // Bouton « déséquiper » direct, sans menu contextuel.
                slotEl.insertAdjacentHTML('beforeend', slotUnequipButtonHTML(slotType));
            }
        });
    }

    if (playerStatAttackEl) {
        const weaponDef = ITEM_TYPES[player.equipment.weapon?.name] || {};
        playerStatAttackEl.textContent = (weaponDef.stats?.damage || COMBAT_CONFIG.PLAYER_UNARMED_DAMAGE);
    }
    if (playerStatDefenseEl) {
        const stat = (slot) => (ITEM_TYPES[player.equipment[slot]?.name]?.stats?.defense || 0);
        playerStatDefenseEl.textContent = stat('body') + stat('head') + stat('feet') + stat('shield');
    }
}

/* -------------------------------------------------------------------------
 * Atelier de personnalisation
 * ------------------------------------------------------------------------- */
let customizationDraft = null;
let customizationControlsBuilt = false;

const CUSTOMIZATION_SECTIONS = [
    ['skin', 'Teint', 'Choisis la lumière de ton visage.'],
    ['hair', 'Couleur des cheveux', 'Un repère à reconnaître de loin.'],
    ['hairStyle', 'Coiffure', 'La silhouette compte autant que le courage.'],
    ['outfit', 'Tunique', 'Une couleur pour ta traversée.'],
    ['accessory', 'Détail signature', 'Petit, mais impossible à oublier.'],
];

function safeAppearance(appearance = {}) {
    const result = {};
    CUSTOMIZATION_SECTIONS.forEach(([category]) => {
        const candidate = appearance[category];
        result[category] = CHARACTER_APPEARANCE[category]?.[candidate]
            ? candidate
            : DEFAULT_CHARACTER_APPEARANCE[category];
    });
    return result;
}

function lookSummary(appearance) {
    const outfit = CHARACTER_APPEARANCE.outfit[appearance.outfit]?.label || 'Lagon';
    const hair = CHARACTER_APPEARANCE.hairStyle[appearance.hairStyle]?.label || 'Court';
    const accessory = CHARACTER_APPEARANCE.accessory[appearance.accessory]?.label || 'Aucun';
    return `${outfit} · ${hair}${accessory !== 'Aucun' ? ` · ${accessory}` : ''}`;
}

function buildCustomizationControls() {
    if (customizationControlsBuilt || !DOM.customizationControlsEl) return;
    customizationControlsBuilt = true;
    DOM.customizationControlsEl.innerHTML = '';

    CUSTOMIZATION_SECTIONS.forEach(([category, title, description]) => {
        const section = document.createElement('section');
        section.className = 'customize-option-group';
        const heading = document.createElement('div');
        heading.className = 'customize-option-heading';
        heading.innerHTML = `<div><h3>${title}</h3><p>${description}</p></div>`;
        const options = document.createElement('div');
        options.className = `customize-option-grid option-grid-${category}`;

        Object.entries(CHARACTER_APPEARANCE[category]).forEach(([id, definition]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'appearance-choice';
            button.dataset.category = category;
            button.dataset.value = id;
            button.setAttribute('aria-pressed', 'false');
            const swatchColor = definition.color || 'transparent';
            button.style.setProperty('--appearance-swatch', swatchColor);
            const icon = definition.icon || '';
            button.innerHTML = `<span class="appearance-swatch${definition.color ? '' : ' symbol'}">${icon}</span><span>${definition.label}</span>`;
            button.addEventListener('click', () => {
                if (!customizationDraft) return;
                customizationDraft[category] = id;
                refreshCustomizationUI();
            });
            options.appendChild(button);
        });
        section.append(heading, options);
        DOM.customizationControlsEl.appendChild(section);
    });
}

function refreshCustomizationUI() {
    if (!customizationDraft) return;
    const player = window.gameState?.player || {};
    document.querySelectorAll('.appearance-choice').forEach(button => {
        const active = button.dataset.value === customizationDraft[button.dataset.category];
        button.classList.toggle('selected', active);
        button.setAttribute('aria-pressed', String(active));
    });
    if (DOM.customizeSummaryEl) DOM.customizeSummaryEl.textContent = lookSummary(customizationDraft);
    Draw.drawCharacterPreview(DOM.customizationPreviewCanvas, player, customizationDraft);
}

export function showCustomizationModal(gameState = window.gameState) {
    const player = gameState?.player;
    if (!player || !DOM.customizeModal) return;
    customizationDraft = safeAppearance(player.appearance);
    buildCustomizationControls();
    refreshCustomizationUI();
    DOM.customizeModal.classList.remove('hidden');
}

export function hideCustomizationModal() {
    DOM.customizeModal?.classList.add('hidden');
}

export function setupCustomizationListeners() {
    const open = () => showCustomizationModal(window.gameState);
    DOM.customizeCharacterBtn?.addEventListener('click', open);
    DOM.equipmentCustomizeButton?.addEventListener('click', open);
    DOM.closeCustomizeModalBtn?.addEventListener('click', hideCustomizationModal);
    DOM.customizeRandomBtn?.addEventListener('click', () => {
        customizationDraft = customizationDraft || safeAppearance();
        CUSTOMIZATION_SECTIONS.forEach(([category]) => {
            const options = Object.keys(CHARACTER_APPEARANCE[category]);
            customizationDraft[category] = options[Math.floor(Math.random() * options.length)];
        });
        refreshCustomizationUI();
    });
    DOM.customizeSaveBtn?.addEventListener('click', () => {
        if (!customizationDraft) return;
        sendAction(ACTIONS.CUSTOMIZE_CHARACTER, { appearance: safeAppearance(customizationDraft) });
        hideCustomizationModal();
    });
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
export function isBuildModalOpen() {
    return !!DOM.buildModal && !DOM.buildModal.classList.contains('hidden');
}
export function setupBuildModalListeners() {
    DOM.closeBuildModalBtn?.addEventListener('click', hideBuildModal);
}
export function populateBuildModal(gameState) {
    if (!DOM.buildModalGridEl || !gameState || !gameState.player || !gameState.map || !gameState.knownRecipes) return;
    const { player, map, knownRecipes, config } = gameState;
    const tile = map[player.y][player.x];
    // On conserve la position de lecture : la liste est reconstruite à chaque
    // état serveur pour refléter les ressources réellement disponibles.
    const previousScroll = DOM.buildModalGridEl.scrollTop;
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
        let isDisabledByStatus = hasStatus(player, 'Drogué');
        const canBuild = hasEnoughResources && hasRequiredTool && tile.buildings.length < config.MAX_BUILDINGS_PER_TILE && canBuildHere && !isDisabledByStatus;

        const card = document.createElement('div');
        card.className = 'build-item-card';

        const header = document.createElement('div');
        header.className = 'build-item-header';
        header.innerHTML = `${tileIconHTML(buildingType.name, buildingType.icon || '🏛️', 'build-item-icon')}<span class="build-item-name">${buildingType.name}</span>`;

        const description = document.createElement('p');
        description.className = 'build-item-description';
        description.textContent = buildingType.description || "Aucune description.";

        const costsDiv = document.createElement('div');
        costsDiv.className = 'build-item-costs';
        costsDiv.innerHTML = '<h4>Coûts :</h4>';
        const costsList = document.createElement('ul');
        for (const item in costs) {
            const li = document.createElement('li');
            const playerAmount = countInInventory(player.inventory, item);
            // Afficher ce que l'on possède évite d'ouvrir le sac pour vérifier.
            li.innerHTML = `<span>${item}</span><span class="build-cost-amount">${playerAmount} / ${costs[item]}</span>`;
            if (playerAmount < costs[item]) li.classList.add('is-missing');
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

    DOM.buildModalGridEl.scrollTop = previousScroll;
}

export function showWorkshopModal(gameState) {
    if (!DOM.workshopModal || !DOM.workshopRecipesContainerEl) return;
    populateWorkshopModal(gameState);
    DOM.workshopModal.classList.remove('hidden');
}
export function hideWorkshopModal() {
    if (DOM.workshopModal) DOM.workshopModal.classList.add('hidden');
}
export function isWorkshopModalOpen() {
    return !!DOM.workshopModal && !DOM.workshopModal.classList.contains('hidden');
}

export function populateWorkshopModal(gameState) {
    if (!DOM.workshopRecipesContainerEl || !gameState || !gameState.player || !gameState.knownRecipes) return;
    // Les coûts sont résolus vers les vraies clés d'inventaire (voir recipes.js),
    // sinon l'atelier comparait "bois" (texte du parchemin) à "Bois" (sac).
    currentWorkshopRecipes = getWorkshopRecipes(gameState.knownRecipes);
    renderWorkshopRecipes(gameState.player);
}

function renderWorkshopRecipes(player) {
    if (!DOM.workshopRecipesContainerEl) return;
    const container = DOM.workshopRecipesContainerEl;
    container.innerHTML = '';

    const searchTerm = DOM.workshopSearchInputEl?.value.toLowerCase() || '';
    const categoryFilter = DOM.workshopCategoryFilterEl?.value || 'all';

    const filteredRecipes = currentWorkshopRecipes.filter(recipe =>
        recipe.name.toLowerCase().includes(searchTerm) && (categoryFilter === 'all' || recipe.category === categoryFilter)
    );

    if (filteredRecipes.length === 0) {
        container.innerHTML = currentWorkshopRecipes.length === 0
            ? '<p class="inventory-empty">Aucune recette connue. Ouvrez des parchemins pour en apprendre.</p>'
            : '<p class="inventory-empty">Aucune recette ne correspond.</p>';
        return;
    }

    filteredRecipes.forEach(recipe => {
        const card = document.createElement('div');
        card.className = 'workshop-recipe-card';
        card.dataset.recipeName = recipe.name;

        const producedLabel = recipe.yield > 1
            ? `${recipe.yield} × ${recipe.output}`
            : recipe.output;

        const header = `<div class="workshop-recipe-header">${itemIconHTML(recipe.output, recipe.icon, 'workshop-recipe-icon')}<span class="workshop-recipe-name">${recipe.name}</span></div>`;
        const yieldEl = `<div class="workshop-recipe-yield">Produit : <strong>${producedLabel}</strong></div>`;

        let costsHtml = '<div class="workshop-recipe-costs"><h5>Ressources nécessaires</h5><ul>';
        for (const itemName in recipe.costs) {
            const itemIcon = ITEM_TYPES[itemName]?.icon || '';
            costsHtml += `<li data-item-name="${itemName}"><span class="cost-name">${itemIconHTML(itemName, itemIcon, 'item-icon')}${itemName}</span><span class="cost-amount"></span></li>`;
        }
        costsHtml += '</ul></div>';

        const quantityInput = `<div class="quantity-input-wrapper">`
            + `<label>Quantité</label>`
            + `<span class="quantity-field"><input type="number" min="1" value="1" data-recipe-name="${recipe.name}">`
            + `<button type="button" class="workshop-max-btn" title="Fabriquer le maximum possible">Max</button></span>`
            + `</div>`;
        const stockLine = `<div class="workshop-recipe-stock"></div>`;
        const actionButton = `<div class="workshop-recipe-action"><button type="button">Transformer</button></div>`;

        card.innerHTML = header + yieldEl + costsHtml + quantityInput + stockLine + actionButton;
        container.appendChild(card);

        const input = card.querySelector('input[type="number"]');
        const maxBtn = card.querySelector('.workshop-max-btn');

        input.addEventListener('input', () => refreshWorkshopCard(card, recipe, currentPlayer()));
        maxBtn.addEventListener('click', () => {
            const max = maxCraftableAmount(currentPlayer()?.inventory, recipe.costs);
            input.value = String(Math.max(1, max));
            refreshWorkshopCard(card, recipe, currentPlayer());
        });
        card.querySelector('.workshop-recipe-action button').addEventListener('click', () => {
            const p = currentPlayer();
            const max = maxCraftableAmount(p?.inventory, recipe.costs);
            const qty = Math.min(Math.max(1, parseInt(input.value, 10) || 1), Math.max(1, max));
            if (max < 1) return;
            // Le serveur recalcule lui-même les coûts à partir du nom de recette.
            sendAction('craft_item_workshop', { recipeName: recipe.name, quantity: qty });
            // Retour immédiat : on n'attend pas l'état serveur pour montrer que
            // les ressources ont été consommées.
            card.classList.add('is-crafting');
            setTimeout(() => card.classList.remove('is-crafting'), 450);
        });

        refreshWorkshopCard(card, recipe, player);
    });
}

function currentPlayer() {
    return window.gameState?.player || null;
}

/** Met à jour une carte : stocks, maximum fabricable et état du bouton. */
function refreshWorkshopCard(card, recipe, player) {
    if (!card || !recipe) return;
    const input = card.querySelector('input[type="number"]');
    const button = card.querySelector('.workshop-recipe-action button');
    const stockLine = card.querySelector('.workshop-recipe-stock');
    const inventory = player?.inventory || {};

    const max = maxCraftableAmount(inventory, recipe.costs);
    if (input) input.max = String(Math.max(1, max));

    let quantity = parseInt(input?.value, 10);
    if (!Number.isFinite(quantity) || quantity <= 0) quantity = 1;

    let canCraft = max >= 1 && quantity <= max;

    card.querySelectorAll('.workshop-recipe-costs li').forEach(li => {
        const itemName = li.dataset.itemName;
        const costAmountEl = li.querySelector('.cost-amount');
        const required = (recipe.costs[itemName] || 0) * quantity;
        const available = countInInventory(inventory, itemName);

        costAmountEl.textContent = `${available} / ${required}`;
        const missing = available < required;
        costAmountEl.classList.toggle('insufficient', missing);
        li.classList.toggle('is-missing', missing);
        if (missing) canCraft = false;
    });

    if (stockLine) {
        const owned = countInInventory(inventory, recipe.output);
        stockLine.innerHTML = max > 0
            ? `<span class="workshop-stock-ok">Fabricable : ${max}×</span><span class="workshop-stock-owned">Dans le sac : ${owned}</span>`
            : `<span class="workshop-stock-ko">Ressources insuffisantes</span><span class="workshop-stock-owned">Dans le sac : ${owned}</span>`;
    }

    card.classList.toggle('is-unavailable', max < 1);
    if (button) {
        button.disabled = !canCraft || !!player?.isBusy;
        button.textContent = quantity > 1 ? `Transformer ×${quantity}` : 'Transformer';
    }
}

/**
 * Rafraîchit les quantités affichées sans reconstruire les cartes : appelé à
 * chaque état serveur, donc après chaque clic sur « Transformer ».
 */
export function refreshWorkshopAvailability(gameState) {
    if (!isWorkshopModalOpen() || !DOM.workshopRecipesContainerEl) return;
    const player = gameState?.player || currentPlayer();
    if (!player) return;
    DOM.workshopRecipesContainerEl.querySelectorAll('.workshop-recipe-card').forEach(card => {
        const recipe = currentWorkshopRecipes.find(r => r.name === card.dataset.recipeName);
        if (recipe) refreshWorkshopCard(card, recipe, player);
    });
}

export function setupWorkshopModalListeners() {
    // Utilise l'état de jeu courant au moment de l'événement (et non celui de l'initialisation)
    const update = () => {
        const gs = window.gameState;
        if (!gs || !gs.player) return;
        renderWorkshopRecipes(gs.player);
    };
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
