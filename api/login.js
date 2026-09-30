// api/login.js — connexion (Vercel Serverless Function + Neon)
import { sql, hasDatabase, ensureSchema } from './_lib/neon.js';
import { verifyPassword, hashPassword, readJsonBody } from './_lib/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, message: 'Méthode non autorisée.' });
    }
    if (!hasDatabase) {
        return res.status(500).json({ success: false, message: 'Base de données non configurée (DATABASE_URL manquant).' });
    }

    try {
        const { username, password } = await readJsonBody(req);
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Champs manquants.' });
        }

        await ensureSchema();
        const rows = await sql`SELECT id, username, password FROM users WHERE username = ${username}`;
        const user = rows[0];

        if (!user || !verifyPassword(password, user.password)) {
            return res.status(401).json({ success: false, message: 'Identifiants invalides.' });
        }

        // Migration transparente des anciens mots de passe en clair vers scrypt
        if (!user.password.startsWith('scrypt:')) {
            const migrated = hashPassword(password);
            await sql`UPDATE users SET password = ${migrated} WHERE id = ${user.id}`;
        }

        return res.status(200).json({ success: true, username: user.username });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ success: false, message: 'Erreur serveur. Réessayez.' });
    }
}
