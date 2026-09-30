// public/js/admin.js
import { ACTIONS } from './config.js';

let adminModalEl = null;

function showAdminModal() {
    if (!adminModalEl) return;
    adminModalEl.classList.remove('hidden');
    document.getElementById('admin-open-btn')?.setAttribute('aria-expanded', 'true');
    document.getElementById('admin-close-modal-btn')?.focus();
}

function hideAdminModal() {
    if (!adminModalEl) return;
    adminModalEl.classList.add('hidden');
    document.getElementById('admin-open-btn')?.setAttribute('aria-expanded', 'false');
}

function sendAdminAction(actionId) {
    if (typeof window.handleGlobalPlayerAction !== 'function') {
        console.error('Admin: global action handler not found.');
        return;
    }

    window.handleGlobalPlayerAction(actionId, {});
    const status = document.getElementById('admin-mode-status');
    if (status && actionId !== ACTIONS.ADMIN_TOGGLE_INVINCIBILITY) {
        status.textContent = 'Action envoyée… état en cours de synchronisation';
    }
}

/** Rafraîchit l’état visible de la protection après chaque gameState WebSocket. */
export function updateAdminStatus(gameState) {
    const enabled = Boolean(gameState?.player?.adminInvincible);
    const status = document.getElementById('admin-mode-status');
    const toggleButton = document.getElementById('admin-toggle-invincibility-btn');
    const openButton = document.getElementById('admin-open-btn');

    if (status) {
        status.textContent = enabled
            ? '🛡️ Protection de test activée'
            : 'Protection de test désactivée';
        status.classList.toggle('is-active', enabled);
    }
    if (toggleButton) {
        toggleButton.textContent = enabled
            ? '⚔️ Désactiver la protection'
            : '🛡️ Activer la protection';
        toggleButton.classList.toggle('is-active', enabled);
    }
    if (openButton) {
        openButton.setAttribute('aria-label', enabled
            ? 'Ouvrir les outils de test, protection active'
            : 'Ouvrir les outils de test');
        openButton.classList.toggle('is-active', enabled);
    }
}

export function initAdminControls() {
    adminModalEl = document.getElementById('admin-modal');
    const openButton = document.getElementById('admin-open-btn');
    const closeButton = document.getElementById('admin-close-modal-btn');
    const secondaryCloseButton = document.getElementById('admin-close-modal-secondary-btn');

    if (!adminModalEl || !openButton || !closeButton) {
        console.error('Admin: modal or opening button not found in DOM.');
        return;
    }

    openButton.addEventListener('click', showAdminModal);
    closeButton.addEventListener('click', hideAdminModal);
    secondaryCloseButton?.addEventListener('click', hideAdminModal);
    adminModalEl.addEventListener('click', (event) => {
        if (event.target === adminModalEl) hideAdminModal();
    });

    const actionBindings = {
        'admin-give-all-resources-btn': ACTIONS.ADMIN_GIVE_ALL,
        'admin-restore-stats-btn': ACTIONS.ADMIN_RESTORE_STATS,
        'admin-reveal-map-btn': ACTIONS.ADMIN_REVEAL_MAP,
        'admin-teleport-camp-btn': ACTIONS.ADMIN_TELEPORT_CAMP,
        'admin-teleport-treasure-btn': ACTIONS.ADMIN_TELEPORT_TREASURE,
        'admin-open-treasure-btn': ACTIONS.ADMIN_OPEN_TREASURE,
        'admin-toggle-invincibility-btn': ACTIONS.ADMIN_TOGGLE_INVINCIBILITY,
    };

    for (const [elementId, actionId] of Object.entries(actionBindings)) {
        const button = document.getElementById(elementId);
        if (button) button.addEventListener('click', () => sendAdminAction(actionId));
    }

    // Le raccourci reste pratique sur ordinateur, mais l’accès principal est
    // désormais visible et tactile sur desktop comme sur mobile.
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'm') {
            event.preventDefault();
            if (adminModalEl.classList.contains('hidden')) showAdminModal();
            else hideAdminModal();
        } else if (event.key === 'Escape' && !adminModalEl.classList.contains('hidden')) {
            hideAdminModal();
        }
    });

    updateAdminStatus(window.gameState);
    console.log('Mode test initialisé pour tous les joueurs.');
}
