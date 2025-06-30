// public/js/main.js
import * as UI from './ui.js';
import * as Admin from './admin.js';
import { ACTIONS, SPRITESHEET_PATHS } from './config.js';
import DOM from './ui/dom.js';
import { initInteractions } from './interactions.js';

let gameState = null;
let myPlayerId = null;
let ws;
window.gameState = {};

function connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${protocol}://${window.location.host}`);
    ws.onopen = () => console.log('Connected to server.');
    ws.onclose = () => {
        console.log('Disconnected. Retrying in 3 seconds...');
        UI.addChatMessage("Déconnecté du serveur. Tentative de reconnexion...", "system_error");
        setTimeout(connect, 3000);
    };
    ws.onerror = (err) => console.error('WebSocket Error:', err);
    ws.onmessage = handleServerMessage;
}

function handleServerMessage(event) {
    UI.hideLoading(); // Hide loading on any message from server
    try {
        const data = JSON.parse(event.data);
        if (data.type === 'playerId') {
            myPlayerId = data.payload;
            console.log("Player ID received:", myPlayerId);
            return;
        }
        if (data.type === 'chat') {
            UI.addChatMessage(data.payload.message, 'player', data.payload.sender);
            return;
        }
        if (data.type === 'gameState') {
            console.log('Received gameState from server:', data.payload); // DEBUG
            gameState = data.payload;

            // Convertir les tableaux de tuiles visitées en Sets
            if (gameState.players) {
                for (const playerId in gameState.players) {
                    if (gameState.players[playerId].visitedTiles && Array.isArray(gameState.players[playerId].visitedTiles)) {
                        gameState.players[playerId].visitedTiles = new Set(gameState.players[playerId].visitedTiles);
                    }
                }
            }
            if (gameState.globallyRevealedTiles && Array.isArray(gameState.globallyRevealedTiles)) {
                gameState.globallyRevealedTiles = new Set(gameState.globallyRevealedTiles);
            }

            if (myPlayerId && gameState.players[myPlayerId]) {
                gameState.player = gameState.players[myPlayerId];
            } else {
                return;
            }
            window.gameState = gameState;
            
            if (gameState.player.notifications) {
                gameState.player.notifications.forEach(notification => {
                    if (notification.type === 'chat') {
                        UI.addChatMessage(notification.message, notification.style);
                    } else if (notification.type === 'floatingText') {
                        UI.showFloatingText(notification.message, notification.style);
                    }
                });
                gameState.players[myPlayerId].notifications = [];
            }
            
            fullUIUpdate();
        }
    } catch (e) {
        console.error("Erreur lors du traitement du message serveur:", e);
        UI.hideLoading(); // Also hide on error
    }
}

export function sendAction(actionId, data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        UI.showLoading();
        ws.send(JSON.stringify({ id: actionId, data }));
    } else {
        console.error("WebSocket not open. Action not sent:", actionId);
    }
}

window.handleGlobalPlayerAction = sendAction;

function fullUIUpdate() {
    if (!gameState || !gameState.player) return;
    UI.updateAllUI(gameState);
    UI.renderScene(gameState);
}
window.fullUIUpdate = fullUIUpdate;

function setupEventListeners() {
    document.querySelectorAll('.nav-button-overlay').forEach(button => {
        button.addEventListener('click', (e) => {
            const direction = e.target.id.replace('nav-', '');
            sendAction(ACTIONS.MOVE, { direction });
        });
    });
    
    initInteractions();
}

function init() {
    console.log("Initializing game client...");
    UI.loadAssets(SPRITESHEET_PATHS).then(() => {
        console.log('Assets loaded.');

        window.UI = UI; 
        if(UI.setupQuantityModalListeners) UI.setupQuantityModalListeners();
        if(UI.setupLockModalListeners) UI.setupLockModalListeners();
        if(UI.setupBuildModalListeners) UI.setupBuildModalListeners();

        try {
            UI.initializeTabs();
            Admin.initAdminControls();
            UI.resizeGameView();
            window.addEventListener('resize', UI.resizeGameView);
            setupEventListeners();
            connect();
        } catch (e) {
            console.error('Error during initialization:', e);
            UI.addChatMessage('Erreur critique lors de l\'initialisation: ' + e.message, 'system_error');
        }
    }).catch(err => {
        console.error("Failed to load assets:", err);
        UI.addChatMessage("Échec du chargement des ressources: " + err.message, "system_error");
    });
}

document.addEventListener('DOMContentLoaded', init);