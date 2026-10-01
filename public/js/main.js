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
let actionPending = false;
window.gameState = {};

// Le pseudo du compte connecté (défini par la page de login).
// Fallback localStorage pour les navigateurs mobiles/PWA qui perdent parfois
// la session lors de la redirection entre l'accueil et game.html.
function readStoredUsername() {
    try {
        const sessionName = sessionStorage.getItem('username');
        if (sessionName) return sessionName;
    } catch (_) {}
    try {
        const rememberedName = localStorage.getItem('lastUsername');
        if (rememberedName) {
            try { sessionStorage.setItem('username', rememberedName); } catch (_) {}
            return rememberedName;
        }
    } catch (_) {}
    return '';
}
const myUsername = readStoredUsername();
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
            const previousPlayer = gameState?.player;
            const previousPosition = previousPlayer ? { x: previousPlayer.x, y: previousPlayer.y } : null;
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
            if (previousPosition &&
                (previousPosition.x !== gameState.player.x || previousPosition.y !== gameState.player.y)) {
                const arrivedTile = gameState.map?.[gameState.player.y]?.[gameState.player.x];
                UI.showMapTransition?.({ from: previousPosition, to: gameState.player, tile: arrivedTile });
            }
            window.gameState = gameState;
            actionPending = false;
            document.body.classList.remove('action-pending');
            
            if (gameState.player.notifications) {
                gameState.player.notifications.forEach(notification => {
                    if (notification.type === 'chat') {
                        UI.addChatMessage(notification.message, notification.style);
                    } else if (notification.type === 'floatingText') {
                        UI.showFloatingText(notification.message, notification.style);
                    }
                    playNotificationSound(notification);

                    // Déclenchement d'effets visuels pixel art réactifs
                    const msg = (notification.message || '').toLowerCase();
                    const mainCanvas = DOM.charactersCanvas || DOM.mainViewCanvas;
                    const cx = mainCanvas ? mainCanvas.width / 2 : 200;
                    const cy = mainCanvas ? mainCanvas.height * 0.62 : 200;

                    if (msg.includes('bois') || msg.includes('bûcheron') || msg.includes('arbre')) {
                        UI.triggerPixelEffect('chop', cx + (Math.random() - 0.5) * 60, cy - 20, 1.2);
                    } else if (msg.includes('pierre') || msg.includes('min') || msg.includes('minerai') || msg.includes('fer')) {
                        UI.triggerPixelEffect('mine', cx + (Math.random() - 0.5) * 60, cy - 20, 1.2);
                    } else if (msg.includes('fabriqué') || msg.includes('construit') || msg.includes('établi') || msg.includes('atelier')) {
                        UI.triggerPixelEffect('craft', cx, cy - 30, 1.3);
                    } else if (msg.includes('dégât') || msg.includes('frappé') || msg.includes('attaque') || msg.includes('blessé') || notification.style === 'damage') {
                        UI.triggerPixelEffect('slash', cx + (Math.random() - 0.5) * 80, cy - 35, 1.3);
                    } else if (msg.includes('poisson') || msg.includes('pêch') || msg.includes('eau')) {
                        UI.triggerPixelEffect('splash', cx, cy + 25, 1.2);
                    } else if (msg.includes('soin') || msg.includes('santé') || msg.includes('guéri') || notification.style === 'gain') {
                        UI.triggerPixelEffect('heal', cx, cy - 35, 1.3);
                    } else if (msg.includes('niveau') || msg.includes('victoire') || msg.includes('sauvé')) {
                        UI.triggerPixelEffect('levelup', cx, cy - 45, 1.6);
                    } else if (msg.includes('trouvé') || msg.includes('trésor') || msg.includes('découvert') || msg.includes('clé')) {
                        UI.triggerPixelEffect('shine', cx, cy - 35, 1.4);
                    }
                });
                gameState.players[myPlayerId].notifications = [];
            }
            
            fullUIUpdate();
            // Le tutoriel est local à l'appareil : il ne doit pas bloquer le
            // flux réseau et ne s'affiche qu'une seule fois par session.
            if (!tutorialInitialized) {
                tutorialInitialized = true;
                setTimeout(() => UI.initTutorial(), 260);
            }
        }
    } catch (e) {
        console.error("Erreur lors du traitement du message serveur:", e);
        UI.hideLoading(); // Also hide on error
    }
}

export function sendAction(actionId, data) {
    const isChat = actionId === ACTIONS.SEND_CHAT_MESSAGE;
    if (!isChat && actionPending) return;
    if (ws && ws.readyState === WebSocket.OPEN) {
        if (!isChat) {
            actionPending = true;
            document.body.classList.add('action-pending');
        }
        if (actionId === ACTIONS.MOVE && UI.playerMovedForTutorial) {
            UI.playerMovedForTutorial();
        }
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

// Redémarre une partie depuis l'écran de victoire sans devoir vider la sauvegarde
// ou fermer l'onglet. Le serveur recrée le monde pour tous les joueurs connectés.
window.restartGame = function restartGame() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        window.location.href = '/';
        return;
    }
    const button = document.getElementById('victory-menu-btn');
    if (button) {
        button.disabled = true;
        button.textContent = 'Nouvelle partie…';
    }
    ws.send(JSON.stringify({ id: 'restart_game' }));
};
let tutorialInitialized = false;

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
    Admin.updateAdminStatus(gameState);

    // Garder la modale d'équipement à jour si elle est ouverte
    const equipmentModal = document.getElementById('equipment-modal');
    if (equipmentModal && !equipmentModal.classList.contains('hidden')) {
        UI.updateEquipmentModal(gameState);
    }

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
    if (!gameState.victory && victoryShown) {
        victoryShown = false;
        document.getElementById('victory-overlay')?.classList.add('hidden');
    }
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
        if (title) title.innerHTML = '<img class="icon-img victory-trophy" src="assets/icons/trophy.png" alt="🏆" draggable="false"> VICTOIRE !';
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
    // Tutoriel court et actionnable : il guide sans transformer la première
    // partie en manuel de l'interface.
    const tutorialNextButton = document.getElementById('tutorial-next-btn');
    const tutorialSkipButton = document.getElementById('tutorial-skip-btn');
    tutorialNextButton?.addEventListener('click', () => {
        const action = tutorialNextButton.dataset.action;
        if (action === 'tutorial_hide_and_move') {
            if (window.gameState?.tutorialState) {
                window.gameState.tutorialState.isTemporarilyHidden = true;
            }
            UI.highlightElement?.(null, true);
            document.getElementById('tutorial-overlay')?.classList.add('hidden');
            return;
        }
        if (action === 'tutorial_open_actions') {
            if (UI.isMobileLayout?.()) {
                UI.openMobileTab?.('actions');
            } else {
                document.getElementById('screen-interaction-button')?.click();
            }
        }
        UI.advanceTutorial?.();
    });
    tutorialSkipButton?.addEventListener('click', () => UI.skipTutorial?.());

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
        // Refléter la préférence sonore mémorisée
        soundToggle.textContent = isAudioEnabled() ? '🔊' : '🔇';
        soundToggle.title = isAudioEnabled() ? 'Couper le son' : 'Activer le son';
        soundToggle.addEventListener('click', () => {
            initAudio();
            const on = toggleAudio();
            soundToggle.textContent = on ? '🔊' : '🔇';
            soundToggle.title = on ? 'Couper le son' : 'Activer le son';
        });
    }

    // --- Clavier : déplacements (flèches / ZQSD / WASD) et Échap pour fermer ---
    const KEY_DIRECTIONS = {
        arrowup: 'north', arrowdown: 'south', arrowleft: 'west', arrowright: 'east',
        w: 'north', z: 'north', s: 'south', a: 'west', q: 'west', d: 'east',
    };
    document.addEventListener('keydown', (e) => {
        // Ne pas interférer avec la saisie de texte
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) {
            if (e.key === 'Escape') e.target.blur();
            return;
        }
        if (e.key === 'Escape') {
            if (UI.closeTopModal && UI.closeTopModal()) e.preventDefault();
            return;
        }
        const dir = KEY_DIRECTIONS[e.key.toLowerCase()];
        if (!dir || e.ctrlKey || e.metaKey || e.altKey) return;
        // Pas de déplacement si une modale est ouverte ou si le joueur est occupé
        const modalOpen = ['inventory-modal', 'equipment-modal', 'customize-modal', 'build-modal', 'workshop-modal',
            'chest-modal', 'combat-modal', 'large-map-modal', 'quantity-modal', 'lock-modal', 'admin-modal', 'victory-overlay']
            .some(id => { const el = document.getElementById(id); return el && !el.classList.contains('hidden'); });
        if (modalOpen) return;
        const p = window.gameState && window.gameState.player;
        if (p && (p.isBusy || p.animationState)) return;
        e.preventDefault();
        sendAction(ACTIONS.MOVE, { direction: dir });
    });

    // --- Chat rapide (+) : afficher/masquer le menu et envoyer les phrases toutes prêtes ---
    const quickChatBtn = document.getElementById('quick-chat-button');
    const quickChatMenu = document.getElementById('quick-chat-menu');
    if (quickChatBtn && quickChatMenu) {
        quickChatBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            quickChatMenu.classList.toggle('visible');
        });
        quickChatMenu.addEventListener('click', (e) => {
            const item = e.target.closest('.quick-chat-item');
            if (!item) return;
            sendAction(ACTIONS.SEND_CHAT_MESSAGE, { message: item.textContent.trim() });
            quickChatMenu.classList.remove('visible');
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#chat-input-area')) quickChatMenu.classList.remove('visible');
        });
    }

    // --- Agrandir / réduire le chat ---
    const toggleChatBtn = document.getElementById('toggle-chat-size-btn');
    const chatPanel = document.getElementById('bottom-bar-chat-panel');
    if (toggleChatBtn && chatPanel) {
        toggleChatBtn.addEventListener('click', () => {
            const expanded = chatPanel.classList.toggle('chat-expanded');
            toggleChatBtn.textContent = expanded ? '⌄' : '⌃';
            const msgs = document.getElementById('chat-messages');
            if (msgs) msgs.scrollTop = msgs.scrollHeight;
        });
    }

    // --- Ouvrir la fiche Équipement en grand ---
    const openEquipment = () => {
        if (!window.gameState || !window.gameState.player) return;
        // Sur mobile, la feuille doit se refermer : la modale prend tout l'écran.
        if (UI.isMobileLayout && UI.isMobileLayout() && UI.closeMobileSheets) UI.closeMobileSheets();
        UI.showEquipmentModal(window.gameState);
    };
    // Le double-clic n'est pas fiable au doigt : un bouton explicite le remplace.
    document.getElementById('open-equipment-modal-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openEquipment();
    });
    const equipmentPanel = document.getElementById('bottom-bar-equipment-panel');
    if (equipmentPanel) {
        equipmentPanel.addEventListener('dblclick', openEquipment);
        const preview = equipmentPanel.querySelector('.player-character-placeholder-small');
        if (preview) {
            preview.style.cursor = 'pointer';
            preview.title = "Ouvrir l'équipement";
            preview.addEventListener('click', () => {
                if (window.gameState && window.gameState.player) UI.showEquipmentModal(window.gameState);
            });
        }
    }

    // Interaction directe depuis la scène : ouvre toujours le menu d'actions sans
    // demander de viser un petit bouton dans le panneau latéral.
    const screenInteractionButton = document.getElementById('screen-interaction-button');
    if (screenInteractionButton) {
        screenInteractionButton.addEventListener('click', (e) => {
            e.stopPropagation();
            // Les quatre raccourcis sont désormais toujours visibles sur la
            // scène : ce bouton ouvre la liste complète des actions.
            if (UI.isMobileLayout && UI.isMobileLayout()) {
                UI.openMobileTab('actions');
                return;
            }
            // En mode Focus les panneaux sont masqués : on les ramène avant
            // d'ouvrir la liste, sinon le clic semblerait sans effet.
            UI.ensurePanelsVisible?.();
            const rightPanel = document.getElementById('right-panel');
            document.querySelector('#right-panel-tabs .tab-button[data-tab="actions-tab"]')?.click();
            if (rightPanel) {
                rightPanel.classList.remove('interaction-focus');
                void rightPanel.offsetWidth;
                rightPanel.classList.add('interaction-focus');
            }
        });
    }

    // Les quatre raccourcis visibles sur la scène déclenchent la même action
    // que le bouton correspondant dans le panneau Actions. Cela évite les
    // raccourcis décoratifs qui ne faisaient rien.
    const quickActionKeywords = {
        build: ['constru', 'bâtir', 'build'],
        harvest: ['récol', 'harvest', 'extraire'],
        search: ['fouill', 'chercher', 'recherch', 'search'],
        interact: ['interag', 'ouvrir', 'parler', 'utilis', 'interact'],
    };
    window.QUICK_ACTION_KEYWORDS = quickActionKeywords;
    document.querySelectorAll('.central-action-button').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const state = window.gameState;
            const actions = state?.player?.availableActions || [];
            const keywords = quickActionKeywords[button.dataset.action] || [];
            const action = actions.find(item => keywords.some(keyword =>
                String(item.name || '').toLowerCase().includes(keyword)));
            const panelButton = action && document.getElementById(`action-btn-${action.id}`);
            if (panelButton && !panelButton.disabled) {
                panelButton.click();
            } else {
                // Si le raccourci n'est pas disponible ici, ouvrir la liste
                // complète pour conserver une explication à l'utilisateur.
                document.getElementById('screen-interaction-button')?.click();
            }
        });
    });

    // Replier/déplier la liste des quêtes dans son onglet
    const objectivesTitle = document.getElementById('objectives-hud-title');
    if (objectivesTitle) {
        objectivesTitle.addEventListener('click', (e) => {
            e.stopPropagation();
            const hud = document.getElementById('objectives-hud');
            const arrow = document.getElementById('objectives-toggle');
            if (hud) {
                hud.classList.toggle('collapsed');
                const isCollapsed = hud.classList.contains('collapsed');
                if (arrow) arrow.textContent = isCollapsed ? '▸' : '▾';
                sfx('click');
            }
        });
    }

    // Le compteur de l'onglet Quêtes ouvre directement la liste.
    document.getElementById('quests-tab-count')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelector('#right-panel-tabs .tab-button[data-tab="quests-tab"]')?.click();
    });

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
            // La coquille doit être calculée avant la première mesure du canvas :
            // c'est elle qui décide du nombre de colonnes et de la hauteur du dock.
            UI.initViewport();
            UI.loadUISheets().then(() => {
                UI.hydrateHudIcons();
                UI.initDayTimer();
            });
            UI.initHotspots();
            UI.resizeGameView();
            window.addEventListener('resize', UI.resizeGameView);
            setupEventListeners();
            UI.startRenderLoop();
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
    if(UI.setupWorkshopModalListeners) UI.setupWorkshopModalListeners();
    if(UI.setupMiscModalListeners) UI.setupMiscModalListeners();
    if(UI.setupCustomizationListeners) UI.setupCustomizationListeners();
}

document.addEventListener('DOMContentLoaded', init);
