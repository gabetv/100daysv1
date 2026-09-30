// server/enemy.js
import { ENEMY_TYPES, CONFIG } from '../public/js/config.js';
import { gameState } from './state.js'; // CHEMIN CORRIGÉ

export function initEnemies(config, map) {
    const enemies = [];
    for (let i = 0; i < config.INITIAL_ENEMIES; i++) {
        const newEnemy = spawnSingleEnemy(map);
        if (newEnemy) {
            enemies.push(newEnemy);
        }
    }
    return enemies;
}

export function spawnSingleEnemy(map) {
    // Les boss ne font pas partie du bestiaire aléatoire
    const typeKeys = Object.keys(ENEMY_TYPES).filter(k => !ENEMY_TYPES[k].isBoss);
    const typeKey = typeKeys[Math.floor(Math.random() * typeKeys.length)];
    const type = ENEMY_TYPES[typeKey];
    
    let x, y, attempts = 0;
    do {
        x = Math.floor(Math.random() * CONFIG.MAP_WIDTH);
        y = Math.floor(Math.random() * CONFIG.MAP_HEIGHT);
        attempts++;
        if (attempts > 50) return null; 
    } while (
        !map[y][x].type.accessible ||
        (gameState.players && Object.values(gameState.players).some(p => Math.hypot(x - p.x, y - p.y) < 5))
    );

    // La difficulté monte avec les jours : les bêtes deviennent plus coriaces
    const day = gameState.day || 1;
    const healthBonus = Math.floor(day / 10);   // +1 PV tous les 10 jours
    const damageBonus = Math.floor(day / 25);   // +1 dégât tous les 25 jours

    const enemy = {
        id: `enemy_${Date.now()}_${Math.random()}`,
        ...JSON.parse(JSON.stringify(type)),
        x,
        y,
        timeSinceLastMove: 0,
    };
    enemy.health += healthBonus;
    enemy.damage += damageBonus;
    enemy.currentHealth = enemy.health;
    if (healthBonus >= 3) enemy.name = `${enemy.name} alpha`; // Les vétérans ont un titre
    return enemy;
}

export function findEnemyOnTile(x, y, enemies) {
    return enemies.find(enemy => enemy.x === x && enemy.y === y);
}

/**
 * Fait apparaître le Gardien du Trésor sur la case du coffre.
 * Il ne bouge jamais : il faut le vaincre pour ouvrir le trésor.
 */
export function spawnGuardian(map) {
    let treasureTile = null;
    for (const row of map) for (const t of row) if (t.key === 'TREASURE_CHEST') treasureTile = t;
    if (!treasureTile || treasureTile.isOpened) return null;

    const type = ENEMY_TYPES.GUARDIAN;
    return {
        id: `boss_guardian_${Date.now()}`,
        ...JSON.parse(JSON.stringify(type)),
        x: treasureTile.x,
        y: treasureTile.y,
        currentHealth: type.health,
        timeSinceLastMove: 0,
    };
}

const ENEMY_MOVE_INTERVAL_MS = 4000;

/**
 * Déplace les ennemis : errance aléatoire, ou traque d'un joueur proche (aggro).
 * Si un ennemi arrive sur la case d'un joueur libre, le combat s'engage.
 */
export function updateEnemies(deltaTime, startCombatFn) {
    const { enemies, map, players } = gameState;
    if (!enemies || !map) return;

    for (const enemy of enemies) {
        if (enemy.inCombatWith) continue; // Occupé à combattre

        // Le boss ne bouge jamais : il monte la garde et attaque quiconque approche
        if (enemy.isBoss) {
            const intruder = Object.values(players).find(p => p.x === enemy.x && p.y === enemy.y && p.health > 0 && !p.combatState);
            if (intruder && startCombatFn) startCombatFn(intruder, enemy);
            continue;
        }

        enemy.timeSinceLastMove = (enemy.timeSinceLastMove || 0) + deltaTime;
        if (enemy.timeSinceLastMove < ENEMY_MOVE_INTERVAL_MS) continue;
        enemy.timeSinceLastMove = 0;

        // Chercher un joueur vivant dans le rayon d'aggro
        let target = null;
        let bestDist = Infinity;
        for (const player of Object.values(players)) {
            if (player.health <= 0 || player.combatState) continue;
            const dist = Math.abs(player.x - enemy.x) + Math.abs(player.y - enemy.y);
            if (dist <= (enemy.aggroRadius || 2) && dist < bestDist) {
                bestDist = dist;
                target = player;
            }
        }

        let nx = enemy.x, ny = enemy.y;
        if (target) {
            // Avancer d'une case vers la cible
            if (target.x > enemy.x) nx++;
            else if (target.x < enemy.x) nx--;
            else if (target.y > enemy.y) ny++;
            else if (target.y < enemy.y) ny--;
        } else {
            // Errance aléatoire
            const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0], [0, 0]];
            const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
            nx += dx; ny += dy;
        }

        if (map[ny]?.[nx]?.type?.accessible) {
            enemy.x = nx;
            enemy.y = ny;
        }

        // 🪤 Piège sur la case d'arrivée ?
        const landed = map[enemy.y]?.[enemy.x];
        if (landed?.trap) {
            const trap = landed.trap;
            delete landed.trap;
            const dmg = 6;
            enemy.currentHealth = (enemy.currentHealth ?? enemy.health) - dmg;
            const owner = players[trap.owner];
            if (enemy.currentHealth <= 0) {
                // Le piège a tué : butin déposé au sol
                landed.groundItems = landed.groundItems || {};
                for (const item in (enemy.loot || {})) {
                    landed.groundItems[item] = (landed.groundItems[item] || 0) + enemy.loot[item];
                }
                gameState.enemies = gameState.enemies.filter(e => e !== enemy);
                if (owner) {
                    owner.notifications.push({ type: 'chat', message: `🪤 Votre piège a tué ${enemy.name} en (${enemy.x}, ${enemy.y}) ! Son butin gît au sol.`, style: 'gain' });
                }
                console.log(`Trap killed ${enemy.name} at (${enemy.x}, ${enemy.y})`);
                continue;
            } else {
                if (owner) {
                    owner.notifications.push({ type: 'chat', message: `🪤 Votre piège a blessé ${enemy.name} (-${dmg} PV) en (${enemy.x}, ${enemy.y}) !`, style: 'gain' });
                }
            }
        }

        // Attaque : un joueur libre est sur la même case ?
        const victim = Object.values(players).find(p => p.x === enemy.x && p.y === enemy.y && p.health > 0 && !p.combatState);
        if (victim && startCombatFn) {
            startCombatFn(victim, enemy);
        }
    }
}