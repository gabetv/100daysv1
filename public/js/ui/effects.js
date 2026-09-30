// js/ui/effects.js

export function showFloatingText(text, type) {
    const mainView = document.getElementById('main-view-container');
    if (!mainView) return; // S'assurer que mainView existe
    const textEl = document.createElement('div');
    textEl.textContent = text;
    textEl.className = `floating-text ${type}`; // ex: type = 'gain', 'cost', 'info'
    const rect = mainView.getBoundingClientRect();
    textEl.style.left = `${rect.left + rect.width / 2}px`;
    textEl.style.top = `${rect.top + rect.height / 3}px`; // Positionner par rapport à mainView
    document.body.appendChild(textEl);
    setTimeout(() => {
        textEl.remove();
    }, 2000); // Durée d'affichage du texte
}

export function triggerActionFlash(type) {
    const flashEl = document.getElementById('action-flash');
    if (!flashEl) return;
    flashEl.className = ''; // Réinitialiser les classes
    void flashEl.offsetWidth; // Forcer un reflow pour que l'animation redémarre
    flashEl.classList.add(type === 'gain' ? 'flash-gain' : 'flash-cost');
}

export function triggerScreenShake() {
    const mainView = document.getElementById('main-view-container');
    if (!mainView) return;
    mainView.classList.add('action-failed-shake');
    setTimeout(() => {
        mainView.classList.remove('action-failed-shake');
    }, 500);
}

export function triggerShake(element) {
    if (!element) return;
    element.classList.add('action-failed-shake');
    setTimeout(() => {
        element.classList.remove('action-failed-shake');
    }, 500); // Durée de l'animation de secousse
}

export function resizeGameView() {
    const wrapper = document.getElementById('main-view-wrapper');
    const container = document.getElementById('main-view-container');
    if (!wrapper || !container) {
        console.error("[effects.js] resizeGameView: Wrapper or container not found.");
        return;
    }

    const mainViewCanvas = document.getElementById('main-view-canvas');
    const charactersCanvas = document.getElementById('characters-canvas');
    const isMobile = window.matchMedia('(max-width: 900px), (pointer: coarse) and (max-width: 1100px)').matches;

    let newWidth, newHeight;

    if (isMobile) {
        // Mobile : la scène remplit tout l'espace disponible (pas de bandes noires),
        // le fond est recadré en "cover" par drawMainBackground.
        container.style.width = '';
        container.style.height = '';
        const rect = wrapper.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        newWidth = Math.max(10, Math.round(rect.width * dpr));
        newHeight = Math.max(10, Math.round(rect.height * dpr));

        [mainViewCanvas, charactersCanvas].forEach(c => {
            if (!c) return;
            c.style.width = '100%';
            c.style.height = '100%';
        });
    } else {
        const aspectRatio = 1408 / 768;
        const wrapperWidth = wrapper.clientWidth - 10;
        const wrapperHeight = wrapper.clientHeight - 10;

        newWidth = wrapperWidth;
        newHeight = wrapperWidth / aspectRatio;
        if (newHeight > wrapperHeight) {
            newHeight = wrapperHeight;
            newWidth = wrapperHeight * aspectRatio;
        }
        newWidth = Math.max(10, newWidth);
        newHeight = Math.max(10, newHeight);

        container.style.width = `${newWidth}px`;
        container.style.height = `${newHeight}px`;
        [mainViewCanvas, charactersCanvas].forEach(c => {
            if (!c) return;
            c.style.width = '';
            c.style.height = '';
        });
    }

    if (mainViewCanvas) { mainViewCanvas.width = newWidth; mainViewCanvas.height = newHeight; }
    if (charactersCanvas) { charactersCanvas.width = newWidth; charactersCanvas.height = newHeight; }

    if (window.gameState && window.gameState.player && window.UI) {
        try {
            window.UI.drawMainBackground(window.gameState);
            window.UI.drawSceneCharacters(window.gameState);
        } catch (_) {}
    }
}
