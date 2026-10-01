// js/ui.js
import DOM, * as DOMModule from './ui/dom.js'; 
import * as PanelsModule from './ui/panels.js';
import * as DrawModule from './ui/draw.js';
import * as EffectsModule from './ui/effects.js';
import * as ModalsModule from './ui/modals.js';
import * as TutorialModule from './ui/tutorial.js';
import * as MobileModule from './ui/mobile.js';
import * as RenderModule from './ui/render.js';
import * as SheetsModule from './ui/sheets.js';
import * as DayTimerModule from './ui/daytimer.js';
import * as ViewportModule from './ui/viewport.js';
import * as HotspotsModule from './ui/hotspots.js';
import * as NavigationModule from './ui/navigation.js';
import * as CombatModule from './ui/combat.js';
import { OBJECTIVE_IMAGES } from './ui/icons.js';

// --- Ré-exporter explicitement les fonctions ---

// Depuis ./ui/draw.js
export const loadAssets = DrawModule.loadAssets;
export const drawMainBackground = DrawModule.drawMainBackground;
export const drawSceneCharacters = DrawModule.drawSceneCharacters;
export const drawMinimap = DrawModule.drawMinimap;
export const drawLargeMap = DrawModule.drawLargeMap;
export const populateLargeMapLegend = DrawModule.populateLargeMapLegend;
export const triggerPixelEffect = DrawModule.triggerPixelEffect;

// Depuis ./ui/dom.js
export const showLoading = DOMModule.showLoading;
export const hideLoading = DOMModule.hideLoading;

// Depuis ./ui/effects.js
export const showFloatingText = EffectsModule.showFloatingText;
export const triggerActionFlash = EffectsModule.triggerActionFlash;
export const triggerShake = EffectsModule.triggerShake;
export const triggerScreenShake = EffectsModule.triggerScreenShake;
export const showMapTransition = EffectsModule.showMapTransition;
export const resizeGameView = EffectsModule.resizeGameView;

// Depuis ./ui/modals.js
export const showInventoryModal = ModalsModule.showInventoryModal;
export const hideInventoryModal = ModalsModule.hideInventoryModal;
export const showEquipmentModal = ModalsModule.showEquipmentModal;
export const hideEquipmentModal = ModalsModule.hideEquipmentModal;
export const updateEquipmentModal = ModalsModule.updateEquipmentModal;
export const showCustomizationModal = ModalsModule.showCustomizationModal;
export const hideCustomizationModal = ModalsModule.hideCustomizationModal;
export const setupCustomizationListeners = ModalsModule.setupCustomizationListeners;
export const showQuantityModal = ModalsModule.showQuantityModal;
export const hideQuantityModal = ModalsModule.hideQuantityModal;
export const setupQuantityModalListeners = ModalsModule.setupQuantityModalListeners;
export const showLargeMap = ModalsModule.showLargeMap;
export const hideLargeMap = ModalsModule.hideLargeMap;
export const showBuildModal = ModalsModule.showBuildModal;
export const hideBuildModal = ModalsModule.hideBuildModal;
export const populateBuildModal = ModalsModule.populateBuildModal;
export const isBuildModalOpen = ModalsModule.isBuildModalOpen;
export const showWorkshopModal = ModalsModule.showWorkshopModal;
export const hideWorkshopModal = ModalsModule.hideWorkshopModal;
export const populateWorkshopModal = ModalsModule.populateWorkshopModal;
export const setupWorkshopModalListeners = ModalsModule.setupWorkshopModalListeners;
export const refreshWorkshopAvailability = ModalsModule.refreshWorkshopAvailability;
export const isWorkshopModalOpen = ModalsModule.isWorkshopModalOpen;
export const showLockModal = ModalsModule.showLockModal;
export const hideLockModal = ModalsModule.hideLockModal;
export const setupLockModalListeners = ModalsModule.setupLockModalListeners;
export const setupBuildModalListeners = ModalsModule.setupBuildModalListeners;
export const setupChestModalListeners = ModalsModule.setupChestModalListeners;
export const setupMiscModalListeners = ModalsModule.setupMiscModalListeners;
export const closeTopModal = ModalsModule.closeTopModal;
export const hideChestModal = ModalsModule.hideChestModal;
export const showChestModal = ModalsModule.showChestModal;
export const refreshChestModal = ModalsModule.refreshChestModal;
export const isChestModalOpen = ModalsModule.isChestModalOpen;


// Depuis ./ui/panels.js
export const addChatMessage = PanelsModule.addChatMessage;
export const updateAllButtonsState = PanelsModule.updateAllButtonsState;
export const updateQuickSlots = PanelsModule.updateQuickSlots;
export const updateStatsPanel = PanelsModule.updateStatsPanel;
export const updateInventory = PanelsModule.updateInventory;
export const updateDayCounter = PanelsModule.updateDayCounter;
export const updateTileInfoPanel = PanelsModule.updateTileInfoPanel;
export const updateGroundItemsPanel = PanelsModule.updateGroundItemsPanel;
export const updateBottomBarEquipmentPanel = PanelsModule.updateBottomBarEquipmentPanel;
export const updateActionsPanel = PanelsModule.updateActionsPanel;
export const initializeTabs = PanelsModule.initializeTabs;
export const openActionList = PanelsModule.openActionList;

// Depuis ./ui/tutorial.js
export const initTutorial = TutorialModule.initTutorial;
export const showTutorialStep = TutorialModule.showTutorialStep;
export const advanceTutorial = TutorialModule.advanceTutorial;
export const skipTutorial = TutorialModule.skipTutorial;
export const completeTutorial = TutorialModule.completeTutorial;
export const playerMovedForTutorial = TutorialModule.playerMovedForTutorial;
export const highlightElement = TutorialModule.highlightElement;

// Depuis ./ui/mobile.js
export const initMobileUI = MobileModule.initMobileUI;
export const openMobileTab = MobileModule.openTab;
export const closeMobileSheets = MobileModule.closeSheets;
export const isMobileLayout = MobileModule.isMobileLayout;
export const notifyChatMessage = MobileModule.notifyChatMessage;

// Depuis ./ui/render.js
export const startRenderLoop = RenderModule.startRenderLoop;
export const stopRenderLoop = RenderModule.stopRenderLoop; 

// Depuis ./ui/sheets.js — planches pixel art d'interface
export const loadUISheets = SheetsModule.loadUISheets;
export const hydrateHudIcons = SheetsModule.hydrateHudIcons;
export const applyHudIcon = SheetsModule.applyHudIcon;
export const applySpriteFrame = SheetsModule.applySpriteFrame;

// Depuis ./ui/daytimer.js — décompte de la journée
export const initDayTimer = DayTimerModule.initDayTimer;
export const updateDayTimer = DayTimerModule.updateDayTimer;
export const syncDayTimer = DayTimerModule.syncDayTimer;
export const setDayTimerScale = DayTimerModule.setDayTimerScale;

// Depuis ./ui/viewport.js — adaptation à la résolution
export const initViewport = ViewportModule.initViewport;
export const applyViewport = ViewportModule.applyViewport;
export const toggleFocusMode = ViewportModule.toggleFocus;
export const ensurePanelsVisible = ViewportModule.ensurePanelsVisible;

// Depuis ./ui/hotspots.js — interactions à l'écran
export const initHotspots = HotspotsModule.initHotspots;
export const getHotspots = HotspotsModule.getHotspots;

// Depuis ./ui/navigation.js — pavé directionnel
export const initNavigation = NavigationModule.initNavigation;
export const startSceneCombat = CombatModule.startSceneCombat;
export const updateSceneCombat = CombatModule.updateSceneCombat;
export const hideSceneCombat = CombatModule.hideSceneCombat;
export const initSceneCombat = CombatModule.initSceneCombat;
export const updateNavigation = NavigationModule.updateNavigation;
export const canMove = NavigationModule.canMove;
export const evaluateDirection = NavigationModule.evaluateDirection;
export const rejectMove = NavigationModule.rejectMove;
export const navButton = NavigationModule.navButton;

/**
 * Met à jour tous les éléments statiques de l'interface utilisateur.
 * @param {object} gameState L'état actuel du jeu.
 */
export function updateAllUI(gameState) {
    if (!gameState || !gameState.player) return;

    const { player, map, day } = gameState;
    if (!map || !map[player.y] || !map[player.y][player.x]) return;
    
    const currentTile = map[player.y][player.x];

    PanelsModule.updateStatsPanel(player);
    PanelsModule.updateInventory(player);
    PanelsModule.updateDayCounter(day);
    PanelsModule.updateTileInfoPanel(currentTile);
    PanelsModule.updateGroundItemsPanel(currentTile);
    PanelsModule.updateBottomBarEquipmentPanel(player);
    PanelsModule.updateActionsPanel(gameState);
    PanelsModule.updateAllButtonsState(gameState); // S'assurer que les boutons sont cliquables
    // Pavé directionnel : grise les directions fermées (bord de carte, lagon…).
    NavigationModule.updateNavigation(gameState);
    // Décompte de la journée : resynchronisé sur l'horloge serveur.
    DayTimerModule.syncDayTimer(gameState);

    if (gameState.config) {
       DrawModule.drawMinimap(gameState, gameState.config);
    }

    // Mise à jour de l'affichage HUD en haut à gauche
    const positionDisplayNav = document.getElementById('position-display-nav');
    const positionDisplay = document.getElementById('position-display');
    const timeDisplay = document.getElementById('time-display');
    const onlineCount = Object.keys(gameState.players || {}).length;

    if (positionDisplayNav) positionDisplayNav.textContent = `Position: (${player.x}, ${player.y})`;
    if (positionDisplay) positionDisplay.textContent = `Position: (${player.x}, ${player.y})`;
    if (timeDisplay) timeDisplay.textContent = `● ${onlineCount} survivant${onlineCount > 1 ? 's' : ''} en ligne`;

    // Niveau & expérience
    const levelDisplay = document.getElementById('level-display');
    const xpBar = document.getElementById('xp-bar');
    const level = player.level || 1;
    const xp = Math.floor(player.xp || 0);
    const xpNeeded = level * 25;
    if (levelDisplay) levelDisplay.textContent = `Niv. ${level} · ${xp}/${xpNeeded} XP`;
    if (xpBar) xpBar.style.width = `${Math.min(100, (xp / xpNeeded) * 100)}%`;

    // Panneau d'objectifs
    updateObjectivesPanel(player);

    // L'atelier reste synchronisé : après chaque fabrication, le nouvel état
    // serveur met à jour les stocks affichés dans chaque recette.
    ModalsModule.refreshWorkshopAvailability(gameState);
    if (ModalsModule.isBuildModalOpen && ModalsModule.isBuildModalOpen()) {
        ModalsModule.populateBuildModal(gameState);
    }
    // Le coffre aussi : chaque dépôt ou retrait se voit immédiatement,
    // sans fermer puis rouvrir la fenêtre.
    if (ModalsModule.isChestModalOpen && ModalsModule.isChestModalOpen()) {
        ModalsModule.refreshChestModal(gameState);
    }
}

function updateObjectivesPanel(player) {
    const list = document.getElementById('objectives-list');
    const hud = document.getElementById('objectives-hud');
    if (!list || !player.objectives) return;

    list.innerHTML = '';
    let doneCount = 0;
    const total = player.objectives.length;

    player.objectives.forEach(obj => {
        if (obj.done) doneCount++;
        const li = document.createElement('li');
        if (obj.done) li.classList.add('done');
        const check = document.createElement('span');
        const iconSrc = !obj.done && OBJECTIVE_IMAGES[obj.icon];
        if (iconSrc) {
            check.innerHTML = `<img class="icon-img" src="${iconSrc}" alt="" draggable="false">`;
        } else {
            check.textContent = obj.done ? '✅' : obj.icon;
        }
        const text = document.createElement('span');
        text.textContent = obj.text;
        li.appendChild(check);
        li.appendChild(text);
        list.appendChild(li);
    });

    // Compteur visible sur l'onglet : on sait s'il reste des quêtes sans
    // devoir ouvrir le panneau.
    const tabCount = document.getElementById('quests-tab-count');
    if (tabCount) {
        tabCount.textContent = `${doneCount}/${total}`;
        tabCount.classList.toggle('is-complete', total > 0 && doneCount >= total);
    }
    const questsTabButton = document.querySelector('#right-panel-tabs .tab-button[data-tab="quests-tab"]');
    if (questsTabButton) {
        questsTabButton.classList.toggle('has-pending', total > doneCount);
    }

    const title = document.getElementById('objectives-hud-title');
    if (title && hud) {
        const isCollapsed = hud.classList.contains('collapsed');
        // Ne pas remplacer innerHTML ici : le titre porte le listener de
        // repli/dépliage installé au démarrage. Remplacer ses enfants rendait
        // le bouton muet après le premier état serveur.
        const titleLabel = title.querySelector('span:first-child');
        const toggle = document.getElementById('objectives-toggle');
        if (titleLabel) {
            titleLabel.innerHTML = `<img class="objective-title-icon" src="/assets/icons/scroll.png" alt=""> Quêtes (${doneCount}/${total})`;
        }
        if (toggle) toggle.textContent = isCollapsed ? '▸' : '▾';
    }
}

/**
 * Redessine toute la scène principale du jeu (arrière-plan et personnages).
 * @param {object} gameState
 */
export function renderScene(gameState) {
    if (!gameState) return;
    DrawModule.drawMainBackground(gameState);
    DrawModule.drawSceneCharacters(gameState);
}