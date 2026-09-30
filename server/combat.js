// server/combat.js
import { gameState, endCombat } from './state.js';
import { ITEM_TYPES, COMBAT_CONFIG } from '../public/js/config.js';

function getEnemyFor(player) {
    if (!player || !player.combatState) return null;
    return gameState.enemies.find(e => e.id === player.combatState.enemyId);
}

/** Synchronise l'aperçu de l'ennemi envoyé au client. */
function syncEnemySnapshot(player, enemy) {
    if (player.combatState && enemy) {
        player.combatState.enemy.currentHealth = enemy.currentHealth;
    }
}

export function handleCombatAction(playerId, action) {
    const player = gameState.players[playerId];
    if (!player || !player.combatState || player.combatState.turn !== 'player') return;

    player.combatState.turn = 'enemy';

    if (action === 'attack') {
        playerAttack(player);
    } else if (action === 'flee') {
        playerFlee(player);
    }

    // Si le combat continue et que l'ennemi est en vie, il riposte après un court délai
    if (!player.combatState) return;
    const enemy = getEnemyFor(player);
    if (enemy && enemy.currentHealth > 0) {
        setTimeout(() => {
            // Le joueur peut avoir été déconnecté ou le combat terminé entre-temps
            if (!gameState.players[playerId] || !player.combatState) return;
            enemyAttack(player);
            if (player.combatState) {
                player.combatState.turn = 'player';
            }
        }, 1000);
    }
}

function playerAttack(player) {
    const enemy = getEnemyFor(player);
    if (!enemy) { endCombat(player, false); return; }

    const weapon = player.equipment.weapon ? ITEM_TYPES[player.equipment.weapon.name] : null;
    const damage = weapon?.stats?.damage || COMBAT_CONFIG.PLAYER_UNARMED_DAMAGE;

    enemy.currentHealth = Math.max(0, enemy.currentHealth - damage);
    syncEnemySnapshot(player, enemy);
    const message = `Vous infligez ${damage} dégâts à ${enemy.name}.`;
    player.combatState.log.unshift(message);

    if (enemy.currentHealth <= 0) {
        player.notifications.push({ type: 'chat', message: `🎉 Vous avez vaincu ${enemy.name} !`, style: 'gain' });

        // Butin (loot)
        if (enemy.loot) {
            Object.keys(enemy.loot).forEach(itemName => {
                const quantity = enemy.loot[itemName];
                player.inventory[itemName] = (player.inventory[itemName] || 0) + quantity;
                player.notifications.push({ type: 'floatingText', message: `+${quantity} ${itemName}`, style: 'gain' });
            });
        }

        endCombat(player, true); // Le joueur a gagné
    }
}

function enemyAttack(player) {
    const enemy = getEnemyFor(player);
    if (!enemy || player.health <= 0) { endCombat(player, false); return; }

    const defense = (player.equipment.body?.stats?.defense || 0) +
                    (player.equipment.head?.stats?.defense || 0) +
                    (player.equipment.feet?.stats?.defense || 0) +
                    (player.equipment.shield?.stats?.defense || 0);

    const damageTaken = Math.max(0, enemy.damage - defense);
    player.health = Math.max(0, player.health - damageTaken);

    const message = `${enemy.name} vous inflige ${damageTaken} dégâts.`;
    player.combatState.log.unshift(message);

    if (player.health <= 0) {
        player.notifications.push({ type: 'chat', message: "Vous avez été vaincu...", style: 'damage' });
        endCombat(player, false); // Le joueur a perdu (respawn géré par updatePlayerState)
    }
}

function playerFlee(player) {
    if (Math.random() < COMBAT_CONFIG.FLEE_CHANCE) {
        player.notifications.push({ type: 'chat', message: "Vous avez réussi à fuir !", style: 'system_info' });
        endCombat(player, false); // Fuite réussie : fin du combat
    } else {
        player.combatState.log.unshift("Votre tentative de fuite a échoué !");
    }
}
