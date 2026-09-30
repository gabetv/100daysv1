# Déploiement — Île des 100 Jours

## Pourquoi la connexion ne marchait pas sur Vercel

Vercel ne déployait que le dossier `public` en **statique** : aucun processus Node ne tourne.
Les appels `POST /login` et `POST /register` tombaient donc sur du 404/HTML, et le jeu
(WebSocket permanent + SQLite sur disque) ne pouvait de toute façon pas s'exécuter sur Vercel
(fonctions serverless sans état, système de fichiers éphémère).

La solution retenue est **hybride** :

| Partie | Hébergeur | Détail |
| --- | --- | --- |
| Site + inscription/connexion | **Vercel** | `public/` en statique + fonctions `api/login`, `api/register`, `api/config`, `api/health` |
| Comptes & sauvegardes | **Neon** (Postgres) | tables `users`, `saves`, `world` |
| Jeu temps réel (WebSocket) | **Render / Railway / Fly** | `server.js`, connecté à la même base Neon |

## 1. Neon

Aucune migration manuelle : les tables sont créées automatiquement au premier appel
(`ensureSchema()` côté API, `initDb()` côté serveur de jeu).

Récupérez la chaîne de connexion **pooled** de Neon :
`postgresql://...@ep-xxxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require`

## 2. Vercel

Variables d'environnement du projet (Settings → Environment Variables) :

- `DATABASE_URL` = chaîne de connexion Neon **(obligatoire)**
- `GAME_WS_URL` = URL WebSocket du serveur de jeu, ex. `wss://iles-100-jours.onrender.com`
  (laisser vide tant que le serveur de jeu n'est pas déployé)

Le fichier `vercel.json` sert `public/` en statique et garde `/login` et `/register`
en redirection vers `/api/login` et `/api/register` (compatibilité).

Vérification après déploiement :

```bash
curl https://100daysv1.vercel.app/api/health
# -> {"ok":true,"api":true,"database":true,"users":0}
```

Si `ok:false`, `DATABASE_URL` est absent ou invalide sur Vercel.

## 3. Serveur de jeu (Render, exemple)

1. New → Web Service → ce dépôt.
2. Runtime Node 22, Build `npm install`, Start `npm start`.
3. Variable d'environnement `DATABASE_URL` = **la même** chaîne Neon.
4. Une fois l'URL obtenue, remettez-la sur Vercel dans `GAME_WS_URL` sous la forme `wss://...`.

Le fichier `render.yaml` fait déjà tout ça (Blueprint).

Le client lit `/api/config` au chargement de `game.html` : si `GAME_WS_URL` est défini,
il s'y connecte, sinon il se connecte à l'hôte courant (pratique en local).

## 4. En local

```bash
npm install
npm start          # http://localhost:3000, base SQLite locale (node:sqlite)
# ou avec Neon :
DATABASE_URL="postgresql://..." npm start
```

Le serveur local expose aussi `/login`, `/register`, `/api/login`, `/api/register` et
`/api/config`, donc tout fonctionne sans Vercel.

## Notes

- Les mots de passe sont hachés en `scrypt` (sel aléatoire) ; les anciens mots de passe en
  clair sont migrés automatiquement à la première connexion réussie.
- SQLite n'est utilisé qu'en local, via le module intégré `node:sqlite` (plus de compilation
  native `sqlite3`).
