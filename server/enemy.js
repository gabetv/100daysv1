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
    const typeKeys = Object.keys(ENEMY_TYPES);
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

    return {
        id: `enemy_${Date.now()}_${Math.random()}`,
        ...JSON.parse(JSON.stringify(type)),
        x,
        y,
        currentHealth: type.health,
        timeSinceLastMove: 0,
    };
}

export function findEnemyOnTile(x, y, enemies) {
    return enemies.find(enemy => enemy.x === x && enemy.y === y);
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

        // Attaque : un joueur libre est sur la même case ?
        const victim = Object.values(players).find(p => p.x === enemy.x && p.y === enemy.y && p.health > 0 && !p.combatState);
        if (victim && startCombatFn) {
            startCombatFn(victim, enemy);
        }
    }
}