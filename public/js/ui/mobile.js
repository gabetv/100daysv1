// js/ui/mobile.js — Refonte de l'expérience mobile (onglets, gestes, ergonomie)

import { isMobileActive } from './layout-mode.js';

const TAB_TARGETS = {
    scene: [],
    actions: ['right-panel'],
    inventory: ['right-panel'],
    quests: ['right-panel'],
    equipment: ['bottom-bar-equipment-panel'],
    status: ['left-panel'],
    chat: ['bottom-bar-chat-panel'],
    map: ['minimap-section'],
};

// Onglet interne du panneau de droite associé à chaque onglet mobile.
const RIGHT_PANEL_TABS = {
    actions: 'actions-tab',
    inventory: 'inventory-tab',
    quests: 'quests-tab',
};

let currentTab = 'scene';
let initialized = false;

export function isMobileLayout() {
    // La coquille mobile s'active aussi quand le joueur la force sur PC
    // (réglage Auto / Mobile / PC du HUD).
    return isMobileActive();
}

function vibrate(ms = 8) {
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (_) {} }
}

function allSheets() {
    return ['left-panel', 'right-panel', 'bottom-bar-chat-panel', 'minimap-section', 'bottom-bar-equipment-panel']
        .map(id => document.getElementById(id))
        .filter(Boolean);
}

export function openTab(tab, { toggle = false } = {}) {
    if (!TAB_TARGETS[tab]) tab = 'scene';
    if (toggle && tab === currentTab && tab !== 'scene') tab = 'scene';

    currentTab = tab;
    allSheets().forEach(el => el.classList.remove('sheet-active'));

    const ids = TAB_TARGETS[tab];
    ids.forEach(id => document.getElementById(id)?.classList.add('sheet-active'));
    document.body.classList.toggle('sheet-open', ids.length > 0);

    // Onglet interne du panneau de droite (Actions / Inventaire / Quêtes)
    const target = RIGHT_PANEL_TABS[tab];
    if (target) {
        document.querySelectorAll('#right-panel-tabs .tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === target);
        });
        document.querySelectorAll('#right-panel .tab-content').forEach(sec => {
            sec.classList.toggle('active-tab', sec.id === target);
        });
    }

    document.querySelectorAll('.mobile-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mtab === currentTab);
    });

    // La carte doit être redessinée quand sa feuille devient visible
    if (tab === 'map' && window.UI && window.gameState && window.UI.drawMinimap) {
        requestAnimationFrame(() => {
            try { window.UI.drawMinimap(window.gameState, window.gameState.config); } catch (_) {}
        });
    }
    if (tab === 'chat') {
        const msgs = document.getElementById('chat-messages');
        if (msgs) requestAnimationFrame(() => { msgs.scrollTop = msgs.scrollHeight; });
        markChatRead();
    }
}

export function closeSheets() { openTab('scene'); }

// --- Badge de messages non lus sur l'onglet Chat ---
let unread = 0;
function chatTabBtn() { return document.querySelector('.mobile-tab[data-mtab="chat"]'); }

export function notifyChatMessage() {
    if (!isMobileLayout() || currentTab === 'chat') return;
    unread++;
    const btn = chatTabBtn();
    if (!btn) return;
    let badge = btn.querySelector('.mt-badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'mt-badge';
        btn.appendChild(badge);
    }
    badge.textContent = unread > 99 ? '99+' : String(unread);
}

function markChatRead() {
    unread = 0;
    chatTabBtn()?.querySelector('.mt-badge')?.remove();
}

// --- Gestes de déplacement (swipe) sur la scène ---
function showSwipeHint(text) {
    const container = document.getElementById('main-view-container');
    if (!container) return;
    let hint = document.getElementById('swipe-hint');
    if (!hint) {
        hint = document.createElement('div');
        hint.id = 'swipe-hint';
        container.appendChild(hint);
    }
    hint.textContent = text;
    hint.classList.add('show');
    clearTimeout(hint._t);
    hint._t = setTimeout(() => hint.classList.remove('show'), 700);
}

function initSwipe(onMove) {
    const zone = document.getElementById('main-view-container');
    if (!zone) return;
    let startX = 0, startY = 0, startT = 0, tracking = false;

    zone.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) { tracking = false; return; }
        if (e.target.closest('button, .mobile-tab, #central-actions-panel, #objectives-hud')) { tracking = false; return; }
        tracking = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startT = Date.now();
    }, { passive: true });

    zone.addEventListener('touchend', (e) => {
        if (!tracking) return;
        tracking = false;
        const t = e.changedTouches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        const dist = Math.hypot(dx, dy);
        if (dist < 55 || Date.now() - startT > 800) return;

        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        let direction = null;
        // Le geste indique la direction du déplacement, comme la croix
        // directionnelle (un balayage vers la droite = Est). L'ancien mapping
        // inversait plusieurs axes et faisait partir le survivant à l'opposé.
        if (angle >= -22.5 && angle < 22.5) direction = 'east';
        else if (angle >= 22.5 && angle < 67.5) direction = 'se';
        else if (angle >= 67.5 && angle < 112.5) direction = 'south';
        else if (angle >= 112.5 && angle < 157.5) direction = 'sw';
        else if (angle >= 157.5 || angle < -157.5) direction = 'west';
        else if (angle >= -157.5 && angle < -112.5) direction = 'nw';
        else if (angle >= -112.5 && angle < -67.5) direction = 'north';
        else direction = 'ne';

        const labels = { north: '↑ Nord', south: '↓ Sud', east: '→ Est', west: '← Ouest', ne: '↗ N-E', nw: '↖ N-O', se: '↘ S-E', sw: '↙ S-O' };
        showSwipeHint(labels[direction] || '');
        vibrate(10);
        onMove(direction);
    }, { passive: true });
}

// --- Fermeture des feuilles par balayage vers le bas ---
function initSheetDrag() {
    allSheets().forEach(sheet => {
        let startY = 0, dragging = false, atTop = true;
        sheet.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) {
                dragging = false;
                return;
            }
            startY = e.touches[0].clientY;
            atTop = sheet.scrollTop <= 0;
            dragging = true;
        }, { passive: true });
        sheet.addEventListener('touchmove', (e) => {
            if (!dragging || !atTop) return;
            const dy = e.touches[0].clientY - startY;
            if (dy > 0) sheet.style.transform = `translateY(${Math.min(dy, 400)}px)`;
        }, { passive: true });
        sheet.addEventListener('touchend', (e) => {
            if (!dragging) return;
            dragging = false;
            const dy = e.changedTouches[0].clientY - startY;
            sheet.style.transform = '';
            if (atTop && dy > 110) { vibrate(8); closeSheets(); }
        }, { passive: true });
    });
}

export function initMobileUI({ onMove } = {}) {
    if (initialized) return;
    initialized = true;

    document.querySelectorAll('.mobile-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            vibrate(6);
            openTab(btn.dataset.mtab, { toggle: true });
        });
    });

    document.getElementById('mobile-sheet-backdrop')?.addEventListener('click', closeSheets);

    // Les jauges compactes servent aussi de raccourci vers la fiche complète.
    document.getElementById('mobile-vitals')?.addEventListener('click', (event) => {
        if (!event.target.closest('.mobile-vital')) return;
        vibrate(6);
        openTab('status');
    });

    // Les onglets internes du panneau de droite synchronisent la barre du bas
    document.querySelectorAll('#right-panel-tabs .tab-button').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!isMobileLayout()) return;
            const match = Object.entries(RIGHT_PANEL_TABS).find(([, id]) => id === btn.dataset.tab);
            currentTab = match ? match[0] : 'actions';
            document.querySelectorAll('.mobile-tab').forEach(b => b.classList.toggle('active', b.dataset.mtab === currentTab));
        });
    });

    // Ouvrir la grande carte depuis l'onglet Carte
    document.getElementById('enlarge-map-btn')?.addEventListener('click', () => {
        if (isMobileLayout()) closeSheets();
    });

    if (typeof onMove === 'function') initSwipe(onMove);
    initSheetDrag();

    // Cacher les diagonales sur les très petits écrans
    const applyCompact = () => {
        document.body.classList.toggle('compact-dpad', Math.min(window.innerWidth, window.innerHeight) < 380);
    };
    applyCompact();

    window.addEventListener('orientationchange', () => setTimeout(() => {
        allSheets().forEach(sheet => { sheet.style.transform = ''; });
        applyCompact();
        window.dispatchEvent(new Event('resize'));
    }, 250));
    window.addEventListener('resize', () => {
        applyCompact();
        if (!isMobileLayout()) {
            document.body.classList.remove('sheet-open');
            allSheets().forEach(el => el.classList.remove('sheet-active'));
        }
    });

    // Empêcher le zoom par double tap sur les commandes
    document.addEventListener('dblclick', (e) => {
        if (e.target.closest('#main-view-container, #mobile-tabbar')) e.preventDefault();
    }, { passive: false });

    openTab('scene');
    console.log('Mobile UI initialized.');
}

export default { initMobileUI, openTab, closeSheets, isMobileLayout, notifyChatMessage };
