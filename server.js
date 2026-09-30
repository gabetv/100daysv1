// server.js
import express from 'express';
import http from 'http';
import crypto from 'crypto';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

// Importations du code serveur
import { initializeGameState, addNewPlayer, removePlayer, gameState, dailyUpdate, serializePlayer, startCombat, serializeWorld, restoreWorld } from './server/state.js';
import { handlePlayerAction } from './server/interactions.js';
import { getAvailableActions, updatePlayerState, getObjectives } from './server/player.js'; // Import the new function
import { updateNpcs } from './server/npc.js';
import { updateEnemies } from './server/enemy.js';
import { CONFIG } from './server/config.js';
import { initDb, getUserByUsername, updateUserPassword, createUser, loadSave, saveProgress, loadWorld, saveWorldData, closeDb } from './server/db.js';

// Configuration des chemins
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialisation du jeu
initializeGameState(CONFIG);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// --- CONFIGURATION EXPRESS ROBUSTE ---
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(express.json());

await initDb();

// Restaurer le monde sauvegardé (jour, carte, constructions, PNJ...)
try {
    const worldData = await loadWorld();
    if (worldData && restoreWorld(worldData)) {
        console.log('Monde restauré depuis la sauvegarde.');
    }
} catch (e) {
    console.error('World restore failed:', e);
}

function saveWorld() {
    try {
        saveWorldData(serializeWorld());
    } catch (e) {
        console.error('Failed to save world:', e);
    }
}

// --- SÉCURITÉ DES MOTS DE PASSE (scrypt, sans dépendance externe) ---
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, stored) {
    if (typeof stored !== 'string') return false;
    if (stored.startsWith('scrypt:')) {
        const [, salt, hash] = stored.split(':');
        const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
        try {
            return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
        } catch { return false; }
    }
    // Ancien format (mot de passe en clair) — accepté une dernière fois puis migré
    return stored === password;
}

// Le client demande l'URL du serveur de jeu ; en mode "tout-en-un" c'est cet hôte.
app.get('/api/config', (req, res) => {
    res.json({ wsUrl: process.env.GAME_WS_URL || '', hasDatabase: true });
});

app.post(['/login', '/api/login'], async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Champs manquants' });
    }
    try {
        const user = await getUserByUsername(username);
        if (!user || !verifyPassword(password, user.password)) {
            return res.status(401).json({ success: false, message: 'Identifiants invalides' });
        }
        // Migration transparente des anciens mots de passe en clair vers scrypt
        if (!user.password.startsWith('scrypt:')) {
            await updateUserPassword(user.id, hashPassword(password));
        }
        res.json({ success: true, username: user.username });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post(['/register', '/api/register'], async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password || username.length < 3 || username.length > 20 || password.length < 4) {
        return res.status(400).json({ success: false, message: 'Pseudo: 3-20 caractères, mot de passe: 4 minimum.' });
    }
    if (!/^[a-zA-Z0-9_\-À-ÿ]+$/.test(username)) {
        return res.status(400).json({ success: false, message: 'Le pseudo contient des caractères non autorisés.' });
    }
    try {
        const id = await createUser(username, hashPassword(password));
        if (!id) return res.status(409).json({ success: false, message: 'Ce pseudo est déjà pris.' });
        res.json({ success: true, userId: id, username });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// --- SAUVEGARDE / CHARGEMENT DE LA PROGRESSION ---
function savePlayerProgress(player) {
    if (!player || !player.username) return;
    try {
        const result = saveProgress(player.username, serializePlayer(player));
        if (result && typeof result.catch === 'function') {
            result.catch(e => console.error(`Failed to save progress for ${player.username}:`, e));
        }
    } catch (e) {
        console.error(`Failed to save progress for ${player.username}:`, e);
    }
}

async function loadPlayerProgress(username) {
    try { return await loadSave(username); } catch { return null; }
}

// --- WEBSOCKETS (MODIFIÉ) ---
const onlineUsernames = new Map(); // username -> ws (une seule session par compte)

wss.on('connection', (ws) => {
    const playerId = `player_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    ws.playerId = playerId; // Associer l'ID à la connexion WebSocket
    console.log(`Client connected: ${playerId}`);
    ws.send(JSON.stringify({ type: 'playerId', payload: playerId }));

    ws.on('message', async (message) => {
        try {
            const action = JSON.parse(message);

            // Première action attendue : 'join' avec le pseudo du compte
            if (action.id === 'join') {
                if (gameState.players[playerId]) return; // Déjà rejoint
                const username = (action.data && typeof action.data.username === 'string')
                    ? action.data.username.slice(0, 20) : null;

                if (username) {
                    // Une seule session par compte : on déconnecte l'ancienne
                    const existing = onlineUsernames.get(username);
                    if (existing && existing !== ws && existing.readyState === 1) {
                        existing.send(JSON.stringify({ type: 'kicked', payload: 'Connecté depuis un autre onglet.' }));
                        existing.close();
                    }
                    onlineUsernames.set(username, ws);
                    ws.username = username;
                    const saved = await loadPlayerProgress(username);
                    addNewPlayer(playerId, username, saved);
                    console.log(`${username} joined as ${playerId}${saved ? ' (progression restaurée)' : ' (nouvelle partie)'}`);
                } else {
                    addNewPlayer(playerId); // Invité
                }
                return;
            }

            // Une partie gagnée doit pouvoir être rejouée sans rester bloquée sur
            // le monde sauvegardé avec victory=true. Le redémarrage est volontaire
            // et recrée le monde partagé, puis reconnecte le joueur demandeur.
            if (action.id === 'restart_game') {
                initializeGameState(CONFIG);
                addNewPlayer(playerId, ws.username || null);
                saveWorld();
                const stateToSend = JSON.stringify({ type: 'gameState', payload: gameState }, (key, value) => value instanceof Set ? Array.from(value) : value);
                broadcastToClients(stateToSend);
                return;
            }

            // Filet de sécurité : client qui n'a pas envoyé 'join' (ancienne version)
            if (!gameState.players[playerId]) addNewPlayer(playerId);

            // On utilise maintenant notre handler externe
            handlePlayerAction(action.id, action.data, playerId, broadcastToClients);
        } catch (e) {
            console.error("Failed to parse message or handle action:", e);
        }
    });

    ws.on('close', () => {
        console.log(`Client disconnected: ${playerId}`);
        const player = gameState.players[playerId];
        if (player) savePlayerProgress(player); // Sauvegarde de la progression
        if (ws.username && onlineUsernames.get(ws.username) === ws) {
            onlineUsernames.delete(ws.username);
        }
        removePlayer(playerId);
    });
});

// Sauvegarde automatique : joueurs connectés + monde (toutes les 60s)
setInterval(() => {
    for (const playerId in gameState.players) {
        savePlayerProgress(gameState.players[playerId]);
    }
    saveWorld();
}, 60000);

// Sauvegarde propre à l'arrêt du serveur
['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, () => {
    console.log('Arrêt du serveur : sauvegarde en cours...');
    for (const playerId in gameState.players) {
        savePlayerProgress(gameState.players[playerId]);
    }
    saveWorld();
    setTimeout(() => process.exit(0), 300);
}));

function broadcastToClients(message) {
    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(message);
        }
    });
}

// --- BOUCLE DE JEU (MODIFIÉ) ---
let lastUpdateTime = Date.now();
function gameLoop() {
    const now = Date.now();
    const deltaTime = now - lastUpdateTime;
    lastUpdateTime = now;
    updateNpcs(deltaTime);
    updateEnemies(deltaTime, startCombat);

    // Mettre à jour l'état de chaque joueur (faim, soif, etc.)
    for (const playerId in gameState.players) {
        const player = gameState.players[playerId];
        updatePlayerState(player, deltaTime);
    }

    // Add available actions and objectives to each player object
    for (const playerId in gameState.players) {
        const player = gameState.players[playerId];
        player.availableActions = getAvailableActions(player);
        player.objectives = getObjectives(player);
    }

    const stateToSend = JSON.stringify({ type: 'gameState', payload: gameState }, (key, value) => value instanceof Set ? Array.from(value) : value);

    broadcastToClients(stateToSend);

    // Effacer les notifications pour chaque joueur APRÈS les avoir envoyées
    for (const playerId in gameState.players) {
        const player = gameState.players[playerId];
        if (player.notifications && player.notifications.length > 0) {
            player.notifications = [];
        }
    }
}
setInterval(gameLoop, 500); // Réduit à 2 fois par seconde

// Boucle de mise à jour quotidienne (durée unifiée depuis la config)
setInterval(() => {
    dailyUpdate().catch(err => console.error("Error in daily update:", err));
}, CONFIG.DAY_DURATION_MS);

// --- DÉMARRAGE DU SERVEUR ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on http://localhost:${PORT}`);
});
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Erreur : Le port ${PORT} est déjà utilisé.`);
        process.exit(1);
    } else {
        console.error('Erreur du serveur:', err);
    }
});
