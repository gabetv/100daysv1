// server/combat.js
import { gameState, endCombat } from './state.js';
import { ITEM_TYPES, COMBAT_CONFIG } from '../public/js/config.js';

function getPlayer() {
    if (!gameState.combatState) return null;
    return gameState.players[gameState.combatState.playerId];
}

function getEnemy() {
    if (!gameState.combatState) return null;
    return gameState.enemies.find(e => e.id === gameState.combatState.enemyId);
}

export function handleCombatAction(action) {
    if (!gameState.combatState || !gameState.combatState.isPlayerTurn) return;

    gameState.combatState.isPlayerTurn = false;

    if (action === 'attack') {
        playerAttack();
    } else if (action === 'flee') {
        playerFlee();
        // Si la fuite réussit, le combat se termine immédiatement.
        if (!gameState.combatState) return;
    }

    // Si l'ennemi est toujours en vie après l'action du joueur
    const enemy = getEnemy();
    if (enemy && enemy.currentHealth > 0) {
        // L'ennemi attaque après un court délai
        setTimeout(() => {
            enemyAttack();
            if (gameState.combatState) {
                gameState.combatState.isPlayerTurn = true;
            }
        }, 1000);
    }
}

function playerAttack() {
    const player = getPlayer();
    const enemy = getEnemy();
    if (!player || !enemy) return;

    const weapon = player.equipment.weapon ? ITEM_TYPES[player.equipment.weapon.name] : null;
    const damage = weapon?.stats?.damage || COMBAT_CONFIG.PLAYER_UNARMED_DAMAGE;

    enemy.currentHealth = Math.max(0, enemy.currentHealth - damage);
    const message = `Vous infligez ${damage} dégâts à ${enemy.name}.`;
    gameState.combatState.log.unshift(message);
    player.notifications.push({ type: 'chat', message, style: 'combat' });

    if (enemy.currentHealth <= 0) {
        player.notifications.push({ type: 'chat', message: `Vous avez vaincu ${enemy.name} !`, style: 'gain' });
        
        // Logique de butin (loot)
        if (enemy.loot) {
            Object.keys(enemy.loot).forEach(itemName => {
                const quantity = enemy.loot[itemName];
                // La logique pour ajouter à l'inventaire devrait être dans player.js, mais on simplifie ici
                player.inventory[itemName] = (player.inventory[itemName] || 0) + quantity;
                player.notifications.push({ type: 'floatingText', message: `+${quantity} ${itemName}`, style: 'gain' });
            });
        }
        
        endCombat(true); // Le joueur a gagné
    }
}

function enemyAttack() {
    const player = getPlayer();
    const enemy = getEnemy();
    if (!player || !enemy || player.health <= 0) return;

    const defense = (player.equipment.body?.stats?.defense || 0) +
                    (player.equipment.head?.stats?.defense || 0) +
                    (player.equipment.feet?.stats?.defense || 0) +
                    (player.equipment.shield?.stats?.defense || 0);
    
    const damageTaken = Math.max(0, enemy.damage - defense);
    player.health = Math.max(0, player.health - damageTaken);

    const message = `${enemy.name} vous inflige ${damageTaken} dégâts.`;
    gameState.combatState.log.unshift(message);
    player.notifications.push({ type: 'chat', message, style: 'damage' });

    if (player.health <= 0) {
        player.notifications.push({ type: 'chat', message: "Vous avez été vaincu...", style: 'damage' });
        endCombat(false); // Le joueur a perdu
    }
}

function playerFlee() {
    const player = getPlayer();
    if (!player) return;

    if (Math.random() < COMBAT_CONFIG.FLEE_CHANCE) {
        const message = "Vous avez réussi à fuir !";
        gameState.combatState.log.unshift(message);
        player.notifications.push({ type: 'chat', message, style: 'system_info' });
        endCombat(false); // Le joueur n'a pas gagné, mais a mis fin au combat
    } else {
        const message = "Votre tentative de fuite a échoué !";
        gameState.combatState.log.unshift(message);
        player.notifications.push({ type: 'chat', message, style: 'combat' });
    }
}
