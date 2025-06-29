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