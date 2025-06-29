// js/ui/dom.js

const DOM = {
    mainViewCanvas: document.getElementById('main-view-canvas'),
    mainViewCtx: document.getElementById('main-view-canvas')?.getContext('2d'),
    mainViewContainer: document.getElementById('main-view-container'),
    loadingOverlay: document.getElementById('loading-overlay'),
    charactersCanvas: document.getElementById('characters-canvas'),
    charactersCtx: document.getElementById('characters-canvas')?.getContext('2d'),
    minimapCanvas: document.getElementById('minimap-canvas'),
    minimapCtx: document.getElementById('minimap-canvas')?.getContext('2d'),
    largeMapCanvas: document.getElementById('large-map-canvas'),
    largeMapCtx: document.getElementById('large-map-canvas')?.getContext('2d'),
    leftPanel: document.getElementById('left-panel'),
    rightPanel: document.getElementById('right-panel'),
    bottomBar: document.getElementById('bottom-bar'),
    healthSquaresContainerEl: document.getElementById('health-squares-container'),
    thirstSquaresContainerEl: document.getElementById('thirst-squares-container'),
    hungerSquaresContainerEl: document.getElementById('hunger-squares-container'),
    sleepSquaresContainerEl: document.getElementById('sleep-squares-container'),
    healthStatusEl: document.getElementById('health-status'),
    consumeHealthBtn: document.getElementById('consume-health-btn'),
    consumeThirstBtn: document.getElementById('consume-thirst-btn'),
    consumeHungerBtn: document.getElementById('consume-hunger-btn'),
    inventoryCategoriesEl: document.getElementById('inventory-categories'),
    inventoryCapacityEl: document.getElementById('inventory-capacity-display'),
    tileNameEl: document.querySelector('#tile-info-hud h3'),
    tileHarvestsInfoEl: document.getElementById('tile-details-hud'),
    bottomBarChatPanelEl: document.getElementById('bottom-bar-chat-panel'),
    chatMessagesEl: document.getElementById('chat-messages'),
    quickChatButton: document.getElementById('quick-chat-button'),
    bottomBarEquipmentPanelEl: document.getElementById('bottom-bar-equipment-panel'),
    bottomBarEquipmentSlotsEl: document.getElementById('bottom-bar-equipment-slots'),
    bottomBarGroundItemsEl: document.getElementById('bottom-bar-ground-items'),
    enlargeMapBtn: document.getElementById('enlarge-map-btn'),
    dayDisplay: document.getElementById('day-display'),
    largeMapModal: document.getElementById('large-map-modal'),
    largeMapLegendEl: document.getElementById('large-map-legend'),
    closeLargeMapBtn: document.getElementById('close-large-map-btn'),
    inventoryModal: document.getElementById('inventory-modal'),
    modalPlayerInventoryEl: document.getElementById('modal-player-inventory'),
    modalSharedInventoryEl: document.getElementById('modal-shared-inventory'),
    modalPlayerCapacityEl: document.getElementById('modal-player-capacity'),
    modalSharedCapacityEl: document.getElementById('modal-shared-capacity'),
    equipmentModal: document.getElementById('equipment-modal'),
    equipmentPlayerInventoryEl: document.getElementById('equipment-player-inventory'),
    equipmentPlayerCapacityEl: document.getElementById('equipment-player-capacity'),
    playerStatAttackEl: document.getElementById('player-stat-attack'),
    playerStatDefenseEl: document.getElementById('player-stat-defense'),
    equipmentSlotsEl: document.getElementById('equipment-slots'),
    combatModal: document.getElementById('combat-modal'),
    combatEnemyName: document.getElementById('combat-enemy-name'),
    combatEnemyHealthBar: document.getElementById('combat-enemy-health-bar'),
    combatEnemyHealthText: document.getElementById('combat-enemy-health-text'),
    combatPlayerHealthBar: document.getElementById('combat-player-health-bar'),
    combatPlayerHealthText: document.getElementById('combat-player-health-text'),
    combatLogEl: document.getElementById('combat-log'),
    combatActionsEl: document.getElementById('combat-actions'),
    quantityModal: document.getElementById('quantity-modal'),
    quantityModalTitle: document.getElementById('quantity-modal-title'),
    quantitySlider: document.getElementById('quantity-slider'),
    quantityInput: document.getElementById('quantity-input'),
    quantityConfirmBtn: document.getElementById('quantity-confirm-btn'),
    quantityCancelBtn: document.getElementById('quantity-cancel-btn'),
    quantityMaxBtn: document.getElementById('quantity-max-btn'),
    quantityShortcuts: document.getElementById('quantity-shortcuts'),
    buildModal: document.getElementById('build-modal'),
    buildModalGridEl: document.getElementById('build-modal-grid'),
    workshopModal: document.getElementById('workshop-modal'),
    workshopRecipesContainerEl: document.getElementById('workshop-recipes-container'),
    workshopSearchInputEl: document.getElementById('workshop-search-input'),
    workshopCategoryFilterEl: document.getElementById('workshop-category-filter'),
    closeWorkshopModalBtn: document.getElementById('close-workshop-modal-btn'),
    lockModal: document.getElementById('lock-modal'),
    lockModalTitle: document.getElementById('lock-modal-title'),
    lockUnlockButton: document.getElementById('lock-unlock-btn'),
    lockCancelButton: document.getElementById('lock-cancel-btn'),
    lockCodeInput1: document.getElementById('lock-code-input-1'),
    lockCodeInput2: document.getElementById('lock-code-input-2'),
    lockCodeInput3: document.getElementById('lock-code-input-3'),
    tutorialOverlay: document.getElementById('tutorial-overlay'),
    tutorialMessage: document.getElementById('tutorial-message'),
    tutorialNextButton: document.getElementById('tutorial-next-btn'),
    tutorialSkipButton: document.getElementById('tutorial-skip-btn'),
};

export default DOM;

// Fonctions utilitaires pour manipuler le DOM
export function showElement(element) {
    if (element) element.classList.remove('hidden');
}

export function hideElement(element) {
    if (element) element.classList.add('hidden');
}

export function toggleElement(element) {
    if (element) element.classList.toggle('hidden');
}

export function updateTextContent(element, text) {
    if (element) element.textContent = text;
}

export function setElementDisabled(element, disabled) {
    if (element) element.disabled = disabled;
}

export function showLoading() {
    if (DOM.loadingOverlay) DOM.loadingOverlay.classList.remove('hidden');
    if (DOM.mainViewContainer) DOM.mainViewContainer.classList.add('loading-active');
}

export function hideLoading() {
    if (DOM.loadingOverlay) DOM.loadingOverlay.classList.add('hidden');
    if (DOM.mainViewContainer) DOM.mainViewContainer.classList.remove('loading-active');
}