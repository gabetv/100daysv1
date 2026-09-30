// api/register.js — inscription (Vercel Serverless Function + Neon)
import { sql, hasDatabase, ensureSchema } from './_lib/neon.js';
import { hashPassword, validateCredentials, readJsonBody } from './_lib/auth.js';

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
        const error = validateCredentials(username, password);
        if (error) return res.status(400).json({ success: false, message: error });

        await ensureSchema();

        const existing = await sql`SELECT id FROM users WHERE username = ${username}`;
        if (existing.length) {
            return res.status(409).json({ success: false, message: 'Ce pseudo est déjà pris.' });
        }

        const rows = await sql`
            INSERT INTO users (username, password, created_at)
            VALUES (${username}, ${hashPassword(password)}, ${Date.now()})
            ON CONFLICT (username) DO NOTHING
            RETURNING id`;

        if (!rows.length) {
            return res.status(409).json({ success: false, message: 'Ce pseudo est déjà pris.' });
        }

        return res.status(200).json({ success: true, userId: rows[0].id, username });
    } catch (err) {
        console.error('Register error:', err);
        return res.status(500).json({ success: false, message: 'Erreur serveur. Réessayez.' });
    }
}
