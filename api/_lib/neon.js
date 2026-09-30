// api/_lib/neon.js — accès Neon (Postgres) depuis les fonctions serverless Vercel
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
    console.error('DATABASE_URL manquant : ajoutez la chaîne de connexion Neon dans les variables d\'environnement.');
}

export const sql = connectionString ? neon(connectionString) : null;
export const hasDatabase = Boolean(sql);

let schemaReady = null;

/** Crée les tables si besoin (idempotent, exécuté une seule fois par instance). */
export function ensureSchema() {
    if (!sql) return Promise.reject(new Error('DATABASE_URL non configuré'));
    if (!schemaReady) {
        schemaReady = (async () => {
            await sql`CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at BIGINT
            )`;
            await sql`CREATE TABLE IF NOT EXISTS saves (
                username TEXT PRIMARY KEY,
                data TEXT,
                updated_at BIGINT
            )`;
            await sql`CREATE TABLE IF NOT EXISTS world (
                id INTEGER PRIMARY KEY,
                data TEXT,
                updated_at BIGINT
            )`;
        })().catch((err) => { schemaReady = null; throw err; });
    }
    return schemaReady;
}
