// public/js/main.js
import * as UI from './ui.js';
import * as Admin from './admin.js';
import { ACTIONS, SPRITESHEET_PATHS } from './config.js';
import DOM from './ui/dom.js';
import { initInteractions } from './interactions.js';
import { initAudio, sfx, toggleAudio, isEnabled as isAudioEnabled } from './audio.js';

let gameState = null;
let myPlayerId = null;
let ws;
let wasKicked = false;
window.gameState = {};

// Le pseudo du compte connecté (défini par la page de login)
const myUsername = sessionStorage.getItem('username');
if (!myUsername) {
    // Pas connecté : retour à l'écran de connexion
    window.location.href = '/';
}

// URL du serveur de jeu (WebSocket). Sur Vercel, le site est statique : le serveur
// temps réel est hébergé ailleurs et son URL est fournie par /api/config (GAME_WS_URL).
let gameServerUrl = null;

async function resolveGameServerUrl() {
    if (gameServerUrl) return gameServerUrl;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const sameHost = `${protocol}://${window.location.host}`;
    try {
        const res = await fetch('/api/config', { cache: 'no-store' });
        if (res.ok) {
            const { wsUrl } = await res.json();
            if (wsUrl) {
                gameServerUrl = wsUrl.replace(/^http/, 'ws').replace(/\/$/, '');
                return gameServerUrl;
            }
        }
    } catch (e) {
        console.warn('Impossible de lire /api/config, connexion à l\'hôte courant.', e);
    }
    gameServerUrl = sameHost;
    return gameServerUrl;
}

async function connect() {
    const url = await resolveGameServerUrl();
    ws = new WebSocket(url);
    ws.onopen = () => {
        console.log('Connected to server.');
        // Rejoindre la partie avec le pseudo du compte (charge la sauvegarde côté serveur)
        ws.send(JSON.stringify({ id: 'join', data: { username: myUsername } }));
    };
    ws.onclose = () => {
        if (wasKicked) return; // Pas de reconnexion automatique si on a été déconnecté volontairement
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
        if (data.type === 'kicked') {
            wasKicked = true;
            UI.addChatMessage(data.payload || 'Vous avez été déconnecté.', 'system_error');
            alert(data.payload || 'Vous avez été déconnecté.');
            window.location.href = '/';
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
                    playNotificationSound(notification);
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

let combatModalVisible = false;
let victoryShown = false;
let lastKnownHealth = null;

// Traduit les notifications du serveur en effets sonores
function playNotificationSound(notification) {
    const msg = notification.message || '';
    if (msg.includes('NIVEAU')) return sfx('levelup');
    if (msg.includes('succombé')) return sfx('death');
    if (msg.includes('ÉVÉNEMENT')) return sfx('event');
    if (notification.style === 'gain') return sfx('gain');
    if (notification.style === 'damage') return sfx('hit');
}

function fullUIUpdate() {
    if (!gameState || !gameState.player) return;
    UI.updateAllUI(gameState);
    UI.renderScene(gameState);

    // Secousse d'écran quand on encaisse des dégâts
    if (lastKnownHealth !== null && gameState.player.health < lastKnownHealth - 0.5) {
        if (UI.triggerScreenShake) UI.triggerScreenShake();
    }
    lastKnownHealth = gameState.player.health;

    // --- Combat : afficher/mettre à jour/fermer la modale ---
    const combatState = gameState.player.combatState;
    if (combatState) {
        if (!combatModalVisible) {
            UI.showCombatModal(combatState);
            combatModalVisible = true;
            sfx('combat');
        } else {
            UI.updateCombatUI(combatState);
        }
    } else if (combatModalVisible) {
        UI.hideCombatModal();
        combatModalVisible = false;
    }

    // --- Bandeau d'événement du jour ---
    const eventDisplay = document.getElementById('event-display');
    if (eventDisplay) {
        const ev = gameState.lastEvent;
        if (ev && ev.day === gameState.day) {
            eventDisplay.textContent = `${ev.icon} ${ev.name}`;
            eventDisplay.title = ev.description || '';
            eventDisplay.style.display = '';
        } else {
            eventDisplay.style.display = 'none';
        }
    }

    // --- Fin de partie : écran de victoire ---
    if (gameState.victory && !victoryShown) {
        victoryShown = true;
        sfx('victory');
        showVictoryScreen(gameState.victory, gameState.player);
    }
}
window.fullUIUpdate = fullUIUpdate;

function showVictoryScreen(victory, player) {
    const overlay = document.getElementById('victory-overlay');
    if (!overlay) return;

    const title = document.getElementById('victory-title');
    const message = document.getElementById('victory-message');
    const stats = document.getElementById('victory-stats');

    if (victory.type === 'rescue') {
        if (title) title.textContent = '🚁 SAUVÉS !';
        if (message) message.textContent = `${victory.by} a tiré un signal de détresse depuis la plage. Un hélicoptère vous ramène à la civilisation !`;
    } else {
        if (title) title.textContent = '🏆 VICTOIRE !';
        if (message) message.textContent = `Vous avez survécu ${victory.day} jours sur l'île. Les secours vous ont enfin repérés !`;
    }
    if (stats) {
        stats.innerHTML = '';
        const lines = [
            `⛺ Jours survécus : ${victory.day}`,
            `💀 Nombre de morts : ${player.deaths || 0}`,
            `🎒 Objets dans le sac : ${Object.keys(player.inventory || {}).length}`,
            `🗺️ Cases explorées : ${player.visitedTiles ? (player.visitedTiles.size || player.visitedTiles.length || 0) : 0}`,
        ];
        lines.forEach(l => {
            const p = document.createElement('p');
            p.textContent = l;
            stats.appendChild(p);
        });
    }
    overlay.classList.remove('hidden');
}

function setupEventListeners() {
    document.querySelectorAll('.nav-button-overlay').forEach(button => {
        button.addEventListener('click', (e) => {
            const direction = (e.currentTarget.id || e.target.id).replace('nav-', '');
            sendAction(ACTIONS.MOVE, { direction });
        });
    });

    // --- Interface mobile : onglets, feuilles coulissantes, déplacement au doigt ---
    UI.initMobileUI({
        onMove: (direction) => {
            const p = window.gameState && window.gameState.player;
            if (p && (p.isBusy || p.animationState)) return;
            sendAction(ACTIONS.MOVE, { direction });
        }
    });
    
    // --- Audio : démarrage au premier geste + clics + bouton mute ---
    document.addEventListener('pointerdown', () => initAudio(), { once: true });
    document.addEventListener('keydown', () => initAudio(), { once: true });
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        if (btn.id === 'combat-attack-btn') sfx('attack');
        else if (btn.id !== 'sound-toggle') sfx('click');
    });
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', () => {
            initAudio();
            const on = toggleAudio();
            soundToggle.textContent = on ? '🔊' : '🔇';
            soundToggle.title = on ? 'Couper le son' : 'Activer le son';
        });
    }

    // Replier/déplier le panneau d'objectifs
    const objectivesTitle = document.getElementById('objectives-hud-title');
    if (objectivesTitle) {
        objectivesTitle.addEventListener('click', () => {
            const hud = document.getElementById('objectives-hud');
            const arrow = document.getElementById('objectives-toggle');
            if (hud) {
                hud.classList.toggle('collapsed');
                if (arrow) arrow.textContent = hud.classList.contains('collapsed') ? '▸' : '▾';
            }
        });
    }

    initInteractions();
}

function init() {
    console.log("Initializing game client...");
    UI.loadAssets(SPRITESHEET_PATHS).then(() => {
        console.log('Assets loaded.');
        setupUIListeners();

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

function setupUIListeners() {
    window.UI = UI; 
    if(UI.setupQuantityModalListeners) UI.setupQuantityModalListeners();
    if(UI.setupLockModalListeners) UI.setupLockModalListeners();
    if(UI.setupBuildModalListeners) UI.setupBuildModalListeners();
    if(UI.setupChestModalListeners) UI.setupChestModalListeners();
}

document.addEventListener('DOMContentLoaded', init);
