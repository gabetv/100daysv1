// js/ui/navigation.js — Pavé directionnel : état réel de chaque direction.
//
// Le serveur refuse un déplacement dans exactement deux cas (`movePlayer()`
// dans server/player.js) :
//   • la case visée sort de la carte ;
//   • la case visée n'est pas `accessible` (le lagon, par exemple).
//
// Ce module rejoue **les mêmes deux règles** côté client pour griser la flèche
// correspondante. Il ne décide rien de nouveau : si le client se trompait, le
// serveur resterait l'arbitre. L'intérêt est ailleurs — on voit où l'on peut
// aller avant de cliquer, et un clic sur une direction fermée donne une
// réponse immédiate au lieu d'un aller-retour réseau pour « Chemin bloqué ».

// Aucune dépendance de module : `evaluateDirection()` est une fonction pure,
// testable hors navigateur (voir scripts/test-navigation.mjs). Le retour
// visuel passe par `window.UI`, présent seulement dans la page.

/** Même table que `movePlayer()` côté serveur, dans l'ordre de la planche. */
export const DIRECTIONS = [
    { id: 'north', dx: 0, dy: -1, label: 'Nord', glyph: '↑', column: 0 },
    { id: 'ne', dx: 1, dy: -1, label: 'Nord-Est', glyph: '↗', column: 1 },
    { id: 'east', dx: 1, dy: 0, label: 'Est', glyph: '→', column: 2 },
    { id: 'se', dx: 1, dy: 1, label: 'Sud-Est', glyph: '↘', column: 3 },
    { id: 'south', dx: 0, dy: 1, label: 'Sud', glyph: '↓', column: 4 },
    { id: 'sw', dx: -1, dy: 1, label: 'Sud-Ouest', glyph: '↙', column: 5 },
    { id: 'west', dx: -1, dy: 0, label: 'Ouest', glyph: '←', column: 6 },
    { id: 'nw', dx: -1, dy: -1, label: 'Nord-Ouest', glyph: '↖', column: 7 },
];

const BY_ID = Object.fromEntries(DIRECTIONS.map((d) => [d.id, d]));

function hasRevealed(collection, key) {
    if (!collection) return false;
    if (collection instanceof Set) return collection.has(key);
    if (Array.isArray(collection)) return collection.includes(key);
    return false;
}

/**
 * Évalue une direction pour l'état de jeu courant.
 * @returns {{ok: boolean, reason: string, detail: string, x: number, y: number, tile: object|null}}
 */
export function evaluateDirection(gameState, directionId) {
    const dir = BY_ID[directionId];
    const player = gameState?.player;
    const map = gameState?.map;
    if (!dir || !player || !map) {
        return { ok: false, reason: 'unknown', detail: 'Position inconnue', x: 0, y: 0, tile: null };
    }

    const x = player.x + dir.dx;
    const y = player.y + dir.dy;
    const height = map.length;
    const width = map[0]?.length || 0;

    if (x < 0 || y < 0 || x >= width || y >= height) {
        return { ok: false, reason: 'edge', detail: "Bord de l'île", x, y, tile: null };
    }

    const tile = map[y]?.[x] || null;
    if (!tile || !tile.type) {
        return { ok: false, reason: 'edge', detail: "Bord de l'île", x, y, tile: null };
    }
    if (!tile.type.accessible) {
        // Le nom n'est révélé que si la case est déjà connue : griser la flèche
        // ne doit pas servir de carte au trésor.
        const key = `${x},${y}`;
        const known = tile.type.name === 'Lagon'
            || hasRevealed(player.visitedTiles, key)
            || hasRevealed(gameState.globallyRevealedTiles, key);
        return {
            ok: false,
            reason: 'blocked',
            detail: known ? `${tile.type.name} — infranchissable` : 'Chemin bloqué',
            x, y, tile,
        };
    }

    const key = `${x},${y}`;
    const known = hasRevealed(player.visitedTiles, key) || hasRevealed(gameState.globallyRevealedTiles, key);
    return { ok: true, reason: 'free', detail: known ? tile.type.name : 'Zone inexplorée', x, y, tile };
}

/** Raccourci utilisé par le clavier et le balayage tactile. */
export function canMove(gameState, directionId) {
    return evaluateDirection(gameState, directionId).ok;
}

/**
 * Met à jour les huit touches : état visuel, infobulle et accessibilité.
 * Appelé à chaque `gameState` reçu.
 */
export function updateNavigation(gameState) {
    const player = gameState?.player;
    // Un combat en cours interdit le déplacement côté serveur (movePlayer le
    // refuse) : les touches doivent le montrer, sinon le joueur croit pouvoir
    // s'échapper à pied alors que seule la fuite le permet.
    const inCombat = !!player?.combatState;
    const busy = !!(player?.isBusy || player?.animationState || inCombat);
    let freeCount = 0;

    for (const dir of DIRECTIONS) {
        const button = document.getElementById(`nav-${dir.id}`);
        if (!button) continue;

        const result = evaluateDirection(gameState, dir.id);
        if (result.ok) freeCount += 1;

        const state = busy ? 'busy' : (result.ok ? 'free' : 'blocked');
        button.dataset.navState = state;
        button.dataset.navColumn = String(dir.column);
        // `aria-disabled` plutôt que `disabled` : la touche garde son infobulle
        // et reste annoncée par les lecteurs d'écran, ce qui est justement
        // l'information utile ici (« pourquoi je ne peux pas aller là ? »).
        button.setAttribute('aria-disabled', state === 'free' ? 'false' : 'true');
        button.classList.toggle('is-blocked', state === 'blocked');
        button.classList.toggle('is-busy', state === 'busy');

        const suffix = inCombat ? 'Combat en cours — fuyez pour partir' : (busy ? 'Action en cours…' : result.detail);
        button.title = `${dir.label} — ${suffix}`;
        button.setAttribute('aria-label', result.ok
            ? `Aller vers le ${dir.label} (${result.detail})`
            : `${dir.label} indisponible : ${suffix}`);
    }

    document.body.classList.toggle('nav-all-blocked', !busy && freeCount === 0);
}

/**
 * Branche les huit touches. Une direction fermée ne part pas sur le réseau :
 * elle répond tout de suite par une secousse et un texte flottant.
 */
export function initNavigation({ onMove } = {}) {
    for (const dir of DIRECTIONS) {
        const button = document.getElementById(`nav-${dir.id}`);
        if (!button) continue;
        button.dataset.navColumn = String(dir.column);
        button.dataset.navState = 'free';

        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const state = button.dataset.navState;
            if (state === 'busy') return;
            if (state === 'blocked') {
                rejectMove(button, window.gameState, dir.id);
                return;
            }
            onMove?.(dir.id);
        });
    }
}

/** Retour immédiat quand la direction est fermée. */
export function rejectMove(button, gameState, directionId) {
    const result = evaluateDirection(gameState, directionId);
    if (button) {
        button.classList.remove('nav-reject');
        void button.offsetWidth;          // relance l'animation
        button.classList.add('nav-reject');
        setTimeout(() => button.classList.remove('nav-reject'), 420);
    }
    globalThis.UI?.showFloatingText?.(result.detail || 'Chemin bloqué', 'info');
}

/** Utilisé par le clavier : trouve le bouton d'une direction. */
export function navButton(directionId) {
    return document.getElementById(`nav-${directionId}`);
}
