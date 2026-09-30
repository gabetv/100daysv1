// server/combat.js
import { gameState, endCombat } from './state.js';
import { ITEM_TYPES, COMBAT_CONFIG } from '../public/js/config.js';
import { addXp } from './player.js';

const CRIT_CHANCE = 0.15;      // 15% de chance de coup critique (x2 dégâts)
const DODGE_CHANCE = 0.12;     // 12% de chance d'esquiver l'attaque ennemie
const WEAPON_WEAR_CHANCE = 0.25; // Usure de l'arme : 25% de chance par attaque

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
    } else if (action === 'defend') {
        player.combatState.defending = true;
        player.combatState.log.unshift('🛡️ Vous vous mettez en garde, prêt à encaisser le prochain coup.');
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

    const weaponInstance = player.equipment.weapon;
    const weapon = weaponInstance ? ITEM_TYPES[weaponInstance.name] : null;
    let damage = weapon?.stats?.damage || COMBAT_CONFIG.PLAYER_UNARMED_DAMAGE;

    // Coup critique !
    const isCrit = Math.random() < CRIT_CHANCE;
    if (isCrit) damage *= 2;

    enemy.currentHealth = Math.max(0, enemy.currentHealth - damage);
    syncEnemySnapshot(player, enemy);
    player.combatState.log.unshift(isCrit
        ? `💥 COUP CRITIQUE ! Vous infligez ${damage} dégâts à ${enemy.name} !`
        : `⚔️ Vous infligez ${damage} dégâts à ${enemy.name}.`);

    // Usure de l'arme au combat
    if (weaponInstance && weaponInstance.currentDurability !== undefined && Math.random() < WEAPON_WEAR_CHANCE) {
        weaponInstance.currentDurability--;
        if (weaponInstance.currentDurability <= 0) {
            player.equipment.weapon = null;
            player.combatState.log.unshift(`💔 Votre ${weaponInstance.name} se brise en plein combat !`);
            player.notifications.push({ type: 'chat', message: `${weaponInstance.name} s'est cassé(e) !`, style: 'damage' });
        }
    }

    if (enemy.currentHealth <= 0) {
        const xpGain = (enemy.health || 5) + (enemy.damage || 1);
        player.notifications.push({ type: 'chat', message: `🎉 Vous avez vaincu ${enemy.name} ! (+${xpGain} XP)`, style: 'gain' });

        // Butin (loot)
        if (enemy.loot) {
            Object.keys(enemy.loot).forEach(itemName => {
                const quantity = enemy.loot[itemName];
                player.inventory[itemName] = (player.inventory[itemName] || 0) + quantity;
                player.notifications.push({ type: 'floatingText', message: `+${quantity} ${itemName}`, style: 'gain' });
            });
        }

        addXp(player, xpGain);
        endCombat(player, true); // Le joueur a gagné
    }
}

function enemyAttack(player) {
    const enemy = getEnemyFor(player);
    if (!enemy || player.health <= 0) { endCombat(player, false); return; }

    // Filet de sécurité : même un ancien combat restauré ne peut infliger
    // de dégâts dans le sanctuaire du coffre.
    const tile = gameState.map?.[player.y]?.[player.x];
    if (tile?.key === 'TREASURE_CHEST') {
        player.combatState.log.unshift('🛡️ Le sanctuaire du coffre neutralise l\'attaque ennemie.');
        endCombat(player, false);
        return;
    }

    // Esquive !
    if (Math.random() < DODGE_CHANCE) {
        player.combatState.log.unshift(`💨 Vous esquivez l'attaque de ${enemy.name} !`);
        return;
    }

    const defense = (player.equipment.body?.stats?.defense || 0) +
                    (player.equipment.head?.stats?.defense || 0) +
                    (player.equipment.feet?.stats?.defense || 0) +
                    (player.equipment.shield?.stats?.defense || 0);

    let damageTaken = Math.max(0, enemy.damage - defense);

    // Garde levée : dégâts divisés par deux
    if (player.combatState.defending) {
        damageTaken = Math.floor(damageTaken / 2);
        player.combatState.defending = false;
        player.combatState.log.unshift(`🛡️ Vous bloquez ! ${enemy.name} ne vous inflige que ${damageTaken} dégâts.`);
    } else {
        player.combatState.log.unshift(`🩸 ${enemy.name} vous inflige ${damageTaken} dégâts.`);
    }

    player.health = Math.max(0, player.health - damageTaken);

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
        player.combatState.log.unshift("🏃 Votre tentative de fuite a échoué !");
    }
}
