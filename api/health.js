// api/health.js — diagnostic rapide : l'API et la base répondent-elles ?
import { sql, hasDatabase, ensureSchema } from './_lib/neon.js';

export default async function handler(req, res) {
    if (!hasDatabase) {
        return res.status(500).json({ ok: false, api: true, database: false, message: 'DATABASE_URL manquant sur Vercel.' });
    }
    try {
        await ensureSchema();
        const rows = await sql`SELECT COUNT(*)::int AS count FROM users`;
        return res.status(200).json({ ok: true, api: true, database: true, users: rows[0].count });
    } catch (err) {
        console.error('Health error:', err);
        return res.status(500).json({ ok: false, api: true, database: false, message: String(err.message || err) });
    }
}
