// js/ui/combat-loop.js
//
// La décision « faut-il frapper maintenant ? », isolée du DOM et du réseau
// pour pouvoir être testée telle quelle (scripts/test-combat.mjs).
//
// Le piège qu'elle résout : le serveur ne diffuse l'état que deux fois par
// seconde, alors qu'un tour se joue en moins d'une seconde. Juste après avoir
// attaqué, le client reçoit donc encore un ou deux états qui annoncent « c'est
// à vous ». Un automate naïf y répondrait par une deuxième attaque, que le
// serveur rejetterait (handleCombatAction exige turn === 'player'). Sans
// casser le jeu, cela encombre la liaison et rend le rythme imprévisible.
//
// On ne frappe donc qu'une fois par tour, et on attend d'avoir *vu* la main
// passer à l'ennemi avant de s'autoriser le coup suivant.

/**
 * @returns {{ onState: (combatState: object|null) => boolean, reset: () => void }}
 *   `onState` renvoie true quand il faut envoyer une attaque.
 */
export function createAutoAttacker() {
    let actedForTurn = false;

    return {
        onState(combatState) {
            if (!combatState) {           // combat terminé
                actedForTurn = false;
                return false;
            }
            if (combatState.turn !== 'player') {
                actedForTurn = false;     // la main est passée : on se réarme
                return false;
            }
            if (actedForTurn) return false;   // déjà frappé pour ce tour
            actedForTurn = true;
            return true;
        },
        reset() {
            actedForTurn = false;
        },
    };
}
