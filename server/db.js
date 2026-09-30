// server/db.js — couche d'accès aux données du serveur de jeu.
// Utilise Postgres (Neon) si DATABASE_URL est défini, sinon SQLite en local.

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const usingPostgres = Boolean(connectionString);

let pool = null;     // Postgres
let sqliteDb = null; // SQLite
let sqliteKind = null; // 'node' (node:sqlite) | 'legacy' (paquet sqlite3)

/** Initialise la connexion et crée les tables si besoin. */
export async function initDb() {
    if (usingPostgres) {
        const { default: pg } = await import('pg');
        pool = new pg.Pool({
            connectionString,
            ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? false : { rejectUnauthorized: false },
            max: 5,
        });
        await pool.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, created_at BIGINT)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS saves (
            username TEXT PRIMARY KEY, data TEXT, updated_at BIGINT)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS world (
            id INTEGER PRIMARY KEY, data TEXT, updated_at BIGINT)`);
        console.log('Connecté à Postgres (Neon).');
        return;
    }

    // Local : SQLite. On privilégie le module intégré `node:sqlite` (Node >= 22),
    // sinon le paquet `sqlite3` s'il est installé.
    try {
        const { DatabaseSync } = await import('node:sqlite');
        sqliteDb = new DatabaseSync('./database.sqlite');
        sqliteKind = 'node';
    } catch {
        const { default: sqlite3 } = await import('sqlite3');
        sqliteDb = await new Promise((resolve, reject) => {
            const db = new sqlite3.Database('./database.sqlite', (err) => (err ? reject(err) : resolve(db)));
        });
        sqliteKind = 'legacy';
    }

    await run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, created_at INTEGER)');
    await run('CREATE TABLE IF NOT EXISTS saves (username TEXT PRIMARY KEY, data TEXT, updated_at INTEGER)');
    await run('CREATE TABLE IF NOT EXISTS world (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT, updated_at INTEGER)');
    console.log('Connecté à la base SQLite locale (database.sqlite).');
}

// --- Helpers bas niveau ---------------------------------------------------

/** `?` (SQLite) -> `$1, $2...` (Postgres) */
function toPgParams(sql) {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
}

async function run(sql, params = []) {
    if (usingPostgres) return pool.query(toPgParams(sql), params);
    if (sqliteKind === 'node') {
        const res = sqliteDb.prepare(sql).run(...params);
        return { lastID: Number(res.lastInsertRowid), changes: Number(res.changes) };
    }
    return new Promise((resolve, reject) => {
        sqliteDb.run(sql, params, function (err) { err ? reject(err) : resolve(this); });
    });
}

async function get(sql, params = []) {
    if (usingPostgres) {
        const { rows } = await pool.query(toPgParams(sql), params);
        return rows[0] || null;
    }
    if (sqliteKind === 'node') {
        return sqliteDb.prepare(sql).get(...params) || null;
    }
    return new Promise((resolve, reject) => {
        sqliteDb.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
    });
}

// --- API métier -----------------------------------------------------------

export function getUserByUsername(username) {
    return get('SELECT id, username, password FROM users WHERE username = ?', [username]);
}

export function updateUserPassword(id, password) {
    return run('UPDATE users SET password = ? WHERE id = ?', [password, id]);
}

export async function createUser(username, passwordHash) {
    if (usingPostgres) {
        const { rows } = await pool.query(
            'INSERT INTO users (username, password, created_at) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING RETURNING id',
            [username, passwordHash, Date.now()]
        );
        return rows.length ? rows[0].id : null;
    }
    try {
        const res = await run('INSERT INTO users (username, password, created_at) VALUES (?, ?, ?)', [username, passwordHash, Date.now()]);
        return res.lastID;
    } catch { return null; }
}

export async function loadSave(username) {
    const row = await get('SELECT data FROM saves WHERE username = ?', [username]);
    if (!row) return null;
    try { return JSON.parse(row.data); } catch { return null; }
}

export function saveProgress(username, data) {
    return run(
        'INSERT INTO saves (username, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
        [username, JSON.stringify(data), Date.now()]
    );
}

export async function loadWorld() {
    const row = await get('SELECT data FROM world WHERE id = 1', []);
    if (!row) return null;
    try { return JSON.parse(row.data); } catch { return null; }
}

export function saveWorldData(data) {
    return run(
        'INSERT INTO world (id, data, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
        [JSON.stringify(data), Date.now()]
    );
}

export async function closeDb() {
    if (pool) await pool.end().catch(() => {});
    if (sqliteDb) {
        if (sqliteKind === 'node') sqliteDb.close();
        else await new Promise((r) => sqliteDb.close(() => r()));
    }
}
