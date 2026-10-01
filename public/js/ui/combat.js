// js/ui/combat.js
//
// Le combat se joue dans la scène, plus dans une fenêtre modale.
//
// Pourquoi : la popup recouvrait le décor, coupait le joueur de l'île et
// réclamait un clic par tour pour une décision qui était toujours la même —
// « Attaquer ». Ici l'échange se résout seul, à un rythme lisible, et la seule
// vraie décision reste affichée en permanence : fuir, ou continuer.
//
// Le serveur garde l'arbitrage complet. Ce module ne fait qu'appuyer sur
// « Attaquer » à la place du joueur quand c'est son tour : aucune règle de
// combat n'est rejouée ici, et on ne peut donc pas diverger du serveur.

import { sendAction } from '../main.js';
import { triggerCharacterAnim } from './character-anim.js';
import { ENEMY_IMAGES } from './icons.js';
import { sfx } from '../audio.js';
import { COMBAT_CONFIG } from '../config.js';
import { createAutoAttacker } from './combat-loop.js';

/** Respiration entre deux coups : assez pour lire le journal, assez court
 *  pour que l'échange ne traîne pas. Le serveur impose déjà ~1 s avant la
 *  riposte, donc un tour complet dure environ 1,7 s. */
const AUTO_ATTACK_DELAY = 700;

let autoTimer = null;
const autoAttacker = createAutoAttacker();
let lastLogHead = null;
let lastEnemyHealth = null;
let lastPlayerHealth = null;
let fleePending = false;

const el = (id) => document.getElementById(id);

function clearAutoAttack() {
    if (autoTimer) {
        clearTimeout(autoTimer);
        autoTimer = null;
    }
}

/**
 * Programme le coup suivant si c'est au joueur de jouer.
 *
 * Appelé à chaque état reçu (deux fois par seconde) : le garde sur `autoTimer`
 * empêche d'empiler plusieurs attaques pour un même tour, ce qui enverrait des
 * actions que le serveur rejetterait et ferait clignoter l'interface.
 */
function scheduleAutoAttack(combatState) {
    if (fleePending) return;
    // `autoAttacker` garantit un seul coup par tour malgré les états répétés
    // que le serveur envoie entre deux ripostes (voir combat-loop.js).
    if (!autoAttacker.onState(combatState)) return;
    if (autoTimer) return;
    autoTimer = setTimeout(() => {
        autoTimer = null;
        // L'état a pu changer pendant l'attente : combat fini, fuite réussie,
        // ou tour déjà passé à l'ennemi.
        const current = globalThis.gameState?.player?.combatState;
        if (!current || current.turn !== 'player' || fleePending) return;
        sfx('attack');
        // Le coup se lit aussi sur le survivant : lunge vers la créature.
        const me = globalThis.gameState?.player;
        if (me) triggerCharacterAnim(me, 'attack', { force: true });
        sendAction('combat_action', { type: 'attack' });
    }, AUTO_ATTACK_DELAY);
}

function setBar(bar, current, max) {
    if (!bar) return;
    const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
    bar.style.width = `${pct}%`;
    bar.classList.toggle('low', pct <= 35);
    bar.classList.toggle('critical', pct <= 15);
}

function flash(id) {
    const node = el(id);
    if (!node) return;
    node.classList.remove('hit');
    void node.offsetWidth;  // relance l'animation
    node.classList.add('hit');
}

/** Première image d'un combat : on repart d'un historique propre. */
export function startSceneCombat(combatState) {
    lastLogHead = null;
    lastEnemyHealth = null;
    lastPlayerHealth = null;
    fleePending = false;
    clearAutoAttack();
    autoAttacker.reset();
    const odds = el('scene-combat-flee-odds');
    if (odds) odds.textContent = `${Math.round((COMBAT_CONFIG.FLEE_CHANCE ?? 0.5) * 100)}%`;
    sfx('combat');
    updateSceneCombat(combatState);
}

export function updateSceneCombat(combatState) {
    const panel = el('scene-combat');
    if (!panel) return;
    const player = globalThis.gameState?.player;
    const enemy = combatState?.enemy;
    if (!combatState || !enemy || !player) return;

    panel.classList.remove('hidden');
    document.body.classList.add('in-combat');

    // Portrait : la même image que celle utilisée ailleurs dans l'interface.
    const portrait = el('scene-combat-portrait');
    if (portrait) {
        const baseName = String(enemy.name || '').replace(/\s+alpha$/i, '');
        const src = ENEMY_IMAGES[enemy.name] || ENEMY_IMAGES[baseName];
        if (src) {
            if (!portrait.querySelector(`img[src="${src}"]`)) {
                portrait.innerHTML = `<img src="${src}" alt="">`;
            }
        } else if (portrait.textContent !== (enemy.icon || '👹')) {
            portrait.textContent = enemy.icon || '👹';
        }
    }

    const name = el('scene-combat-enemy');
    if (name) name.textContent = enemy.name;

    // Secousse quand une vitalité vient de baisser : le coup se voit même
    // sans lire le journal.
    if (lastEnemyHealth !== null && enemy.currentHealth < lastEnemyHealth) flash('scene-combat-portrait');
    if (lastPlayerHealth !== null && player.health < lastPlayerHealth) panel.classList.add('player-hit');
    else panel.classList.remove('player-hit');
    lastEnemyHealth = enemy.currentHealth;
    lastPlayerHealth = player.health;

    setBar(el('scene-combat-enemy-bar'), enemy.currentHealth, enemy.health);
    setBar(el('scene-combat-player-bar'), player.health, player.maxHealth);
    const eHp = el('scene-combat-enemy-hp');
    if (eHp) eHp.textContent = `${Math.max(0, Math.ceil(enemy.currentHealth))} / ${enemy.health}`;
    const pHp = el('scene-combat-player-hp');
    if (pHp) pHp.textContent = `${Math.max(0, Math.ceil(player.health))} / ${player.maxHealth}`;

    // Une seule ligne de journal : la dernière. L'historique complet continue
    // d'arriver dans le chat, le bandeau ne sert qu'à suivre l'échange.
    const head = (combatState.log || [])[0] || '';
    const logEl = el('scene-combat-log');
    if (logEl && head !== lastLogHead) {
        lastLogHead = head;
        logEl.textContent = head;
        logEl.classList.remove('is-new');
        void logEl.offsetWidth;
        logEl.classList.add('is-new');
        logEl.classList.toggle('crit', head.includes('CRITIQUE'));
        logEl.classList.toggle('damage', head.includes('vous inflige'));
        if (head.includes('CRITIQUE')) sfx('crit');
    }

    panel.classList.toggle('enemy-turn', combatState.turn !== 'player');
    // Une fuite demandée pendant le tour adverse passe avant tout : si on
    // programmait l'attaque d'abord, le clic du joueur serait avalé.
    if (!flushPendingFlee(combatState)) scheduleAutoAttack(combatState);
}

export function hideSceneCombat() {
    clearAutoAttack();
    autoAttacker.reset();
    fleePending = false;
    lastLogHead = null;
    lastEnemyHealth = null;
    lastPlayerHealth = null;
    el('scene-combat')?.classList.add('hidden');
    document.body.classList.remove('in-combat');
}

export function initSceneCombat() {
    const flee = el('scene-combat-flee');
    if (!flee || flee.dataset.bound) return;
    flee.dataset.bound = '1';
    flee.addEventListener('click', () => {
        if (fleePending) return;
        const combatState = globalThis.gameState?.player?.combatState;
        if (!combatState) return;
        // La fuite doit passer avant le coup automatique déjà programmé, sinon
        // le joueur verrait son clic ignoré pendant que le combat continue.
        clearAutoAttack();
        autoAttacker.reset();
        if (combatState.turn !== 'player') {
            // Ce n'est pas notre tour : on retient l'intention, elle partira
            // dès que la main revient (voir `fleePending` plus bas).
            fleePending = true;
            el('scene-combat')?.classList.add('fleeing');
            return;
        }
        sendAction('combat_action', { type: 'flee' });
    });
}

/**
 * Laisse partir une fuite demandée pendant le tour adverse, dès que la main
 * revient. Renvoie `true` si une fuite vient d'être envoyée, pour que
 * l'appelant n'enchaîne pas avec une attaque automatique.
 */
export function flushPendingFlee(combatState) {
    if (!fleePending || !combatState || combatState.turn !== 'player') return false;
    fleePending = false;
    el('scene-combat')?.classList.remove('fleeing');
    sendAction('combat_action', { type: 'flee' });
    return true;
}
