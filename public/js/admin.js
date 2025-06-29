// js/admin.js
import * as UI from './ui.js';

let adminModalEl = null;
let adminTriggerEl = null;
let clickCount = 0;
let clickTimer = null;
const REQUIRED_CLICKS = 5;

function showAdminModal() {
    if (adminModalEl) adminModalEl.classList.remove('hidden');
}

function hideAdminModal() {
    if (adminModalEl) adminModalEl.classList.add('hidden');
}

function handleGiveAllResources() {
    if (window.handleGlobalPlayerAction) {
        window.handleGlobalPlayerAction('admin_give_all_resources', {});
        UI.addChatMessage("Admin: Demande de ressources envoyée au serveur.", "system_info");
    } else {
        console.error("Admin action handler not found.");
    }
    hideAdminModal();
}

function adminTriggerClickHandler() {
    clickCount++;
    if (clickTimer) clearTimeout(clickTimer);

    if (clickCount >= REQUIRED_CLICKS) {
        clickCount = 0;
        showAdminModal();
    } else {
        clickTimer = setTimeout(() => {
            clickCount = 0;
        }, 700);
    }
}

export function initAdminControls() {
    console.log("admin.js: initAdminControls() a été appelée.");
    adminModalEl = document.getElementById('admin-modal');
    const giveAllBtn = document.getElementById('admin-give-all-resources-btn');
    const closeAdminBtn = document.getElementById('admin-close-modal-btn');

    if (!adminModalEl || !giveAllBtn || !closeAdminBtn) {
        console.error("Admin: Modal elements not found in DOM.");
        return;
    }
    
    giveAllBtn.addEventListener('click', handleGiveAllResources);
    closeAdminBtn.addEventListener('click', hideAdminModal);

    adminTriggerEl = document.createElement('div');
    adminTriggerEl.id = 'admin-trigger-dot';
    adminTriggerEl.style.cssText = `
        position: fixed;
        bottom: 3px;
        left: 3px;
        width: 8px;
        height: 8px;
        background-color: rgba(128,0,0,0.4);
        z-index: 10000;
        cursor: pointer;
        border-radius: 50%;
        opacity: 0.3;
        transition: opacity 0.3s, background-color 0.3s;
    `;
    adminTriggerEl.title = `Admin Panel (${REQUIRED_CLICKS} clicks)`;
    adminTriggerEl.addEventListener('mouseenter', () => {
        adminTriggerEl.style.opacity = '0.8';
        adminTriggerEl.style.backgroundColor = 'rgba(255,0,0,0.6)';
    });
    adminTriggerEl.addEventListener('mouseleave', () => {
        adminTriggerEl.style.opacity = '0.3';
        adminTriggerEl.style.backgroundColor = 'rgba(128,0,0,0.4)';
    });

    document.body.appendChild(adminTriggerEl);
    adminTriggerEl.addEventListener('click', adminTriggerClickHandler);

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'm') {
            e.preventDefault();
            if (adminModalEl.classList.contains('hidden')) {
                showAdminModal();
            } else {
                hideAdminModal();
            }
        } else if (e.key === 'Escape' && adminModalEl && !adminModalEl.classList.contains('hidden')) {
            hideAdminModal();
        }
    });

    console.log(`Admin controls initialized. Click the bottom-left dot ${REQUIRED_CLICKS} times, or press Ctrl+Alt+M.`);
}