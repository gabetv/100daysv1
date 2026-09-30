// api/config.js — configuration publique envoyée au client (URL du serveur de jeu)
export default function handler(req, res) {
    // GAME_WS_URL : URL du serveur WebSocket du jeu, ex. wss://iles-100-jours.onrender.com
    // Vide => le client se connecte à l'hôte courant (utile en local avec `npm start`).
    const wsUrl = process.env.GAME_WS_URL || '';
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(200).json({ wsUrl, hasDatabase: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL) });
}
