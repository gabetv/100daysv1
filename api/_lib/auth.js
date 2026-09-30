// api/_lib/auth.js — hachage de mots de passe (scrypt, sans dépendance externe)
import crypto from 'crypto';

export function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
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

export function validateCredentials(username, password) {
    if (!username || !password) return 'Champs manquants.';
    if (username.length < 3 || username.length > 20) return 'Pseudo : 3 à 20 caractères.';
    if (password.length < 4) return 'Mot de passe : 4 caractères minimum.';
    if (!/^[a-zA-Z0-9_\-À-ÿ]+$/.test(username)) return 'Le pseudo contient des caractères non autorisés.';
    return null;
}

// Petit helper : lire le corps JSON quelle que soit la façon dont l'hôte le fournit
export async function readJsonBody(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') {
        try { return JSON.parse(req.body); } catch { return {}; }
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (!chunks.length) return {};
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}
