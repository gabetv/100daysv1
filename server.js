// server.js
import express from 'express';
import http from 'http';
import sqlite3 from 'sqlite3';
import crypto from 'crypto';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

// Importations du code serveur
import { initializeGameState, addNewPlayer, removePlayer, gameState, dailyUpdate, serializePlayer, startCombat } from './server/state.js';
import { handlePlayerAction } from './server/interactions.js';
import { getAvailableActions, updatePlayerState } from './server/player.js'; // Import the new function
import { updateNpcs } from './server/npc.js';
import { updateEnemies } from './server/enemy.js';
import { CONFIG } from './server/config.js';

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

const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error('Error opening database', err.message);
    else {
        console.log('Connected to the SQLite database.');
        db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT)');
        db.run('CREATE TABLE IF NOT EXISTS saves (username TEXT PRIMARY KEY, data TEXT, updated_at INTEGER)');
    }
});

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

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Champs manquants' });
    }
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) return res.status(500).json({ success: false, message: 'Server error' });
        if (!row || !verifyPassword(password, row.password)) {
            return res.status(401).json({ success: false, message: 'Identifiants invalides' });
        }
        // Migration transparente des anciens mots de passe en clair vers scrypt
        if (!row.password.startsWith('scrypt:')) {
            db.run('UPDATE users SET password = ? WHERE id = ?', [hashPassword(password), row.id]);
        }
        res.json({ success: true, username });
    });
});

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password || username.length < 3 || username.length > 20 || password.length < 4) {
        return res.status(400).json({ success: false, message: 'Pseudo: 3-20 caractères, mot de passe: 4 minimum.' });
    }
    if (!/^[a-zA-Z0-9_\-À-ÿ]+$/.test(username)) {
        return res.status(400).json({ success: false, message: 'Le pseudo contient des caractères non autorisés.' });
    }
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashPassword(password)], function(err) {
        if (err) res.status(400).json({ success: false, message: 'Ce pseudo est déjà pris.' });
        else res.json({ success: true, userId: this.lastID });
    });
});

// --- SAUVEGARDE / CHARGEMENT DE LA PROGRESSION ---
function savePlayerProgress(player) {
    if (!player || !player.username) return;
    try {
        const data = JSON.stringify(serializePlayer(player));
        db.run('INSERT INTO saves (username, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
            [player.username, data, Date.now()]);
    } catch (e) {
        console.error(`Failed to save progress for ${player.username}:`, e);
    }
}

function loadPlayerProgress(username) {
    return new Promise((resolve) => {
        db.get('SELECT data FROM saves WHERE username = ?', [username], (err, row) => {
            if (err || !row) return resolve(null);
            try { resolve(JSON.parse(row.data)); } catch { resolve(null); }
        });
    });
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

// Sauvegarde automatique de tous les joueurs connectés (toutes les 60s)
setInterval(() => {
    for (const playerId in gameState.players) {
        savePlayerProgress(gameState.players[playerId]);
    }
}, 60000);

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

    // Add available actions to each player object
    for (const playerId in gameState.players) {
        const player = gameState.players[playerId];
        player.availableActions = getAvailableActions(player);
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
