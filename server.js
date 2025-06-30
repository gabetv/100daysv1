// server.js
import express from 'express';
import http from 'http';
import sqlite3 from 'sqlite3';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

// Importations du code serveur
import { initializeGameState, addNewPlayer, removePlayer, gameState, dailyUpdate } from './server/state.js';
import { handlePlayerAction } from './server/interactions.js';
import { getAvailableActions, updatePlayerState } from './server/player.js'; // Import the new function
import { updateNpcs } from './server/npc.js';
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
    }
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, row) => {
        if (err) res.status(500).json({ success: false, message: 'Server error' });
        else if (row) res.json({ success: true });
        else res.status(401).json({ success: false, message: 'Invalid credentials' });
    });
});

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], function(err) {
        if (err) res.status(400).json({ success: false, message: 'Username already taken' });
        else res.json({ success: true, userId: this.lastID });
    });
});

// --- WEBSOCKETS (MODIFIÉ) ---
wss.on('connection', (ws) => {
    const playerId = `player_${Date.now()}`;
    ws.playerId = playerId; // Associer l'ID à la connexion WebSocket
    console.log(`Client connected: ${playerId}`);
    addNewPlayer(playerId);
    ws.send(JSON.stringify({ type: 'playerId', payload: playerId }));

    ws.on('message', (message) => {
        try {
            const action = JSON.parse(message);
            // On utilise maintenant notre handler externe
            handlePlayerAction(action.id, action.data, playerId);
        } catch (e) {
            console.error("Failed to parse message or handle action:", e);
        }
    });

    ws.on('close', () => {
        console.log(`Client disconnected: ${playerId}`);
        removePlayer(playerId);
    });
});

// --- BOUCLE DE JEU (MODIFIÉ) ---
let lastUpdateTime = Date.now();
function gameLoop() {
    const now = Date.now();
    const deltaTime = now - lastUpdateTime;
    lastUpdateTime = now;
    updateNpcs(deltaTime);

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

    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(stateToSend);
            
            // Effacer les notifications pour ce joueur APRÈS les avoir envoyées
            if (client.playerId && gameState.players[client.playerId]) {
                const player = gameState.players[client.playerId];
                if (player.notifications && player.notifications.length > 0) {
                    player.notifications = [];
                }
            }
        }
    });
}
setInterval(gameLoop, 500); // Réduit à 2 fois par seconde

// Boucle de mise à jour quotidienne
const DAY_DURATION_MS = 5 * 60 * 1000; // 5 minutes
setInterval(() => {
    dailyUpdate().catch(err => console.error("Error in daily update:", err));
}, DAY_DURATION_MS);

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