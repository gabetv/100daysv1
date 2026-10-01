// js/ui/daytimer.js — Décompte de la journée en timers.
//
// Trois informations, toujours visibles sans ouvrir un panneau :
//   1. le temps restant avant le jour suivant (mm:ss) ;
//   2. le temps restant avant le prochain moment de la journée
//      (« Nuit dans 0:42 ») ;
//   3. une barre de progression où l'on lit d'un coup d'œil aube / jour /
//      crépuscule / nuit.
//
// Les sprites proviennent de la planche pixel art `sheet-timer.png`
// (générée par `npm run generate:sheets`).

import { getPhaseTimer, syncDay, DAY_PHASES } from './atmosphere.js';
import { applySpriteFrame } from './sheets.js';
import { CONFIG } from '../config.js';
import { showFloatingText } from './effects.js';

const URGENT_MS = 15000;      // Dernières secondes : le minuteur passe en alerte
const PHASE_WARNING_MS = 10000; // Annonce du changement de phase

let els = null;
let lastRenderedSecond = -1;
let lastPhaseId = null;
let lastDay = null;
let lastUrgent = null;
let announcedPhase = null;
let spriteSize = 34;
let lastSpriteKey = '';
let lastPhaseSpriteKey = '';
let ticker = null;

function cache() {
    if (els) return els;
    els = {
        root: document.getElementById('day-timer'),
        sprite: document.getElementById('day-timer-sprite'),
        countdown: document.getElementById('day-timer-countdown'),
        fill: document.getElementById('day-timer-fill'),
        cursor: document.getElementById('day-timer-cursor'),
        phaseSprite: document.getElementById('day-timer-phase-sprite'),
        phaseLabel: document.getElementById('daytime-display'),
        eta: document.getElementById('day-timer-eta'),
        dayCount: document.getElementById('day-counter-text'),
    };
    return els;
}

function formatClock(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function formatCountdown(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Les segments colorés de la barre reflètent exactement les bornes de phase. */
function buildTrackBackground() {
    const colors = {
        aube: '#e08a52',
        jour: '#6fc7e0',
        crepuscule: '#d9693f',
        nuit: '#3b4f93',
    };
    const stops = DAY_PHASES.map(phase => {
        const from = (phase.from * 100).toFixed(2);
        const to = (phase.to * 100).toFixed(2);
        return `${colors[phase.id]} ${from}% ${to}%`;
    });
    return `linear-gradient(90deg, ${stops.join(', ')})`;
}

export function initDayTimer() {
    const dom = cache();
    if (!dom.root) return;
    const track = dom.root.querySelector('.day-timer-track');
    if (track) track.style.backgroundImage = buildTrackBackground();
    // Les marqueurs de phase aident à anticiper sans lire les chiffres.
    if (track && !track.querySelector('.day-timer-tick')) {
        DAY_PHASES.slice(1).forEach(phase => {
            const tick = document.createElement('i');
            tick.className = 'day-timer-tick';
            tick.style.left = `${phase.from * 100}%`;
            tick.title = phase.short;
            track.appendChild(tick);
        });
    }
    startTicker();
    updateDayTimer(true);
}

/**
 * Le minuteur bat sur son propre rythme : la boucle de rendu s'arrête quand
 * une modale est ouverte ou l'onglet masqué, or le temps, lui, continue.
 */
function startTicker() {
    if (ticker) return;
    ticker = setInterval(() => updateDayTimer(false), 150);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) updateDayTimer(true);
    });
}

/**
 * Rafraîchit le minuteur. Appelé par la boucle de rendu : l'affichage texte
 * n'est recalculé qu'une fois par seconde pour rester économe.
 */
export function updateDayTimer(force = false) {
    const dom = cache();
    if (!dom.root) return;

    const timer = getPhaseTimer();
    const remaining = timer.dayRemainingMs;
    const second = Math.ceil(remaining / 1000);
    const urgent = remaining <= URGENT_MS;

    // --- Sprite principal : sablier, puis réveil dans les dernières secondes
    const frame = urgent
        ? Math.floor(Date.now() / 120) % 8
        : Math.min(7, Math.floor(timer.progress * 8));
    const spriteKey = `${urgent ? 'urgent' : 'hourglass'}:${frame}:${spriteSize}`;
    if (spriteKey !== lastSpriteKey) {
        lastSpriteKey = spriteKey;
        applySpriteFrame(dom.sprite, 'timer', urgent ? 'urgent' : 'hourglass', frame, spriteSize);
    }

    // --- Sprite de phase : deux images par moment de la journée
    const phaseFrame = timer.phase.sheetFrame + (Math.floor(Date.now() / 520) % 2);
    const phaseKey = `${phaseFrame}:${spriteSize}`;
    if (phaseKey !== lastPhaseSpriteKey) {
        lastPhaseSpriteKey = phaseKey;
        applySpriteFrame(dom.phaseSprite, 'timer', 'phase', phaseFrame, Math.round(spriteSize * 0.72));
    }

    // --- Barre de progression
    if (dom.fill) dom.fill.style.width = `${(timer.progress * 100).toFixed(2)}%`;
    if (dom.cursor) dom.cursor.style.left = `${(timer.progress * 100).toFixed(2)}%`;

    if (!force && second === lastRenderedSecond && timer.phase.id === lastPhaseId && urgent === lastUrgent) return;
    lastRenderedSecond = second;
    lastUrgent = urgent;

    if (dom.countdown) dom.countdown.textContent = formatCountdown(remaining);
    if (dom.eta) {
        const soon = timer.remainingMs <= PHASE_WARNING_MS;
        dom.eta.textContent = `${timer.next.short} dans ${formatClock(timer.remainingMs)}`;
        dom.eta.classList.toggle('is-soon', soon);
    }

    dom.root.classList.toggle('is-urgent', urgent);
    if (timer.phase.id !== lastPhaseId) {
        DAY_PHASES.forEach(phase => dom.root.classList.toggle(`phase-${phase.id}`, phase.id === timer.phase.id));
        lastPhaseId = timer.phase.id;
    }
    dom.root.setAttribute('aria-label',
        `${timer.phase.short}. Jour suivant dans ${formatCountdown(remaining)}. ${timer.next.short} dans ${formatClock(timer.remainingMs)}.`);
}

/**
 * Signale les bascules importantes : nouveau jour et tombée de la nuit.
 * Appelé quand un nouvel état serveur arrive.
 */
export function syncDayTimer(gameState) {
    const dom = cache();
    if (!dom.root || !gameState) return;

    // L'horloge serveur fait foi : on la resynchronise à chaque état reçu,
    // même si la boucle de rendu est en pause.
    syncDay(gameState.day, gameState);

    const day = gameState.day;
    if (day !== lastDay) {
        lastDay = day;
        announcedPhase = null;
        dom.root.classList.remove('day-pulse');
        void dom.root.offsetWidth;
        dom.root.classList.add('day-pulse');
        if (dom.dayCount) dom.dayCount.textContent = `Jour ${day} / ${CONFIG.VICTORY_DAY}`;
    }

    const timer = getPhaseTimer();
    if (announcedPhase !== timer.phase.id) {
        const first = announcedPhase === null;
        announcedPhase = timer.phase.id;
        if (!first && (timer.phase.id === 'crepuscule' || timer.phase.id === 'nuit')) {
            try {
                showFloatingText(timer.phase.id === 'nuit' ? '🌙 La nuit est tombée' : '🌇 Le soleil se couche', 'info');
            } catch (_) { /* l'ambiance ne doit jamais bloquer le jeu */ }
        }
    }
    updateDayTimer(true);
}

/** Taille des sprites : le HUD mobile est plus compact. */
export function setDayTimerScale(size) {
    const next = Math.max(20, Math.round(size));
    if (next === spriteSize) return;
    spriteSize = next;
    updateDayTimer(true);
}

export default { initDayTimer, updateDayTimer, syncDayTimer, setDayTimerScale };
