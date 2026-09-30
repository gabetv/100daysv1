// js/ui/tutorial.js
import DOM from './dom.js';

const tutorialSteps = [
    {
        message: "Bienvenue sur l'Île des 100 Jours ! Votre objectif est simple : <b>rester en vie et trouver votre voie de sortie</b>.<br><br>Utilisez <b>ZQSD</b>, les flèches ou le swipe mobile. Cliquez sur le bouton ci-dessous, puis déplacez-vous d'une case.",
        showNext: true,
        nextButtonText: "Compris, je vais bouger !",
        nextButtonAction: 'tutorial_hide_and_move',
        showSkip: false,
        highlightTarget: '#navigation-edge-panel',
    },
    {
        message: "Parfait. Observez maintenant le cartouche <b>VOUS ÊTES ICI</b>, puis ouvrez les actions de la case. Une fouille est souvent le meilleur premier choix : elle peut révéler une ressource, une recette ou un secret.",
        showNext: true,
        nextButtonText: "Voir les actions",
        nextButtonAction: 'tutorial_open_actions',
        showSkip: true,
        highlightTarget: '#tile-info-hud',
    },
    {
        message: "La survie est votre tempo : surveillez <b>santé, soif, faim et sommeil</b>. Les actions consomment de l'énergie ; mangez et buvez avant de partir trop loin.",
        showNext: true,
        nextButtonText: "J'ai compris",
        nextButtonAction: 'tutorial_next',
        showSkip: true,
        highlightTarget: '#player-stats',
    },
    {
        message: "Votre sac contient les outils et ressources nécessaires. Faites un clic droit, ou un appui long sur mobile, pour <b>utiliser, équiper, jeter ou déplacer</b> un objet.",
        showNext: true,
        nextButtonText: "Ouvrir le sac",
        nextButtonAction: 'tutorial_next',
        showSkip: true,
        highlightTarget: '#inventory-tab',
    },
    {
        message: "Deux chemins mènent à la victoire : <b>ouvrir le trésor puis appeler les secours</b>, ou tenir jusqu'au jour 100. Explorez, améliorez le camp et entraidez-vous. Bonne survie !",
        showNext: true,
        nextButtonText: "Commencer l'aventure",
        nextButtonAction: 'tutorial_next',
        showSkip: false,
        highlightTarget: '#objectives-hud',
        isFinalStep: true,
    },
];

function highlightElement(elementId, remove = false) {
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
        el.classList.remove('tutorial-highlight');
        el.style.zIndex = '';
    });
    if (!remove && elementId) {
        const element = document.getElementById(elementId) || document.querySelector(elementId);
        if (element) {
            element.classList.add('tutorial-highlight');
            element.style.zIndex = '10002';
            element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }
    }
}

export function showTutorialStep(stepIndex) {
    console.log("[TUTORIAL] showTutorialStep, index:", stepIndex, "Active:", window.gameState.tutorialState.active);
    if (!DOM.tutorialOverlay || !DOM.tutorialMessage || !DOM.tutorialNextButton || !DOM.tutorialSkipButton) {
        console.error("[TUTORIAL] Éléments DOM du tutoriel manquants !");
        window.gameState.tutorialState.active = false;
        return;
    }

    if (!window.gameState.tutorialState.active || stepIndex >= tutorialSteps.length) {
        console.log("[TUTORIAL] Complétion ou index hors limites.");
        completeTutorial();
        return;
    }

    const step = tutorialSteps[stepIndex];
    DOM.tutorialMessage.innerHTML = step.message;

    if (step.highlightTarget) {
        // Sur mobile, ouvrir la feuille concernée avant de la mettre en valeur :
        // une étape de tutoriel ne doit jamais pointer vers un panneau invisible.
        if (window.UI?.isMobileLayout?.() && window.UI?.openMobileTab) {
            const mobileTabs = {
                '#player-stats': 'status',
                '#minimap-section': 'map',
                '#actions-tab': 'actions',
                '#inventory-tab': 'inventory',
                '#objectives-hud': 'actions',
                '#bottom-bar-chat-panel': 'chat',
                '#bottom-bar-equipment-panel': 'map',
                '#bottom-bar-ground-items': 'status',
            };
            const tab = mobileTabs[step.highlightTarget];
            if (tab) window.UI.openMobileTab(tab);
        }
        highlightElement(step.highlightTarget);
    } else {
        highlightElement(null, true);
    }

    if (step.showNext) {
        DOM.tutorialNextButton.textContent = step.nextButtonText || "Suivant";
        DOM.tutorialNextButton.dataset.action = step.nextButtonAction || 'tutorial_next';
        DOM.tutorialNextButton.style.display = 'inline-block';
    } else {
        DOM.tutorialNextButton.style.display = 'none';
    }

    DOM.tutorialSkipButton.style.display = step.showSkip ? 'inline-block' : 'none';

    DOM.tutorialOverlay.classList.remove('hidden');
    window.gameState.tutorialState.step = stepIndex;
}

export function advanceTutorial() {
    if (!window.gameState.tutorialState.active) return;
    const currentStep = window.gameState.tutorialState.step;
    if (tutorialSteps[currentStep] && tutorialSteps[currentStep].isFinalStep) {
        completeTutorial();
        return;
    }

    const nextStep = currentStep + 1;
    if (nextStep < tutorialSteps.length) {
        showTutorialStep(nextStep);
    } else {
        completeTutorial();
    }
}

export function skipTutorial() {
    if (!window.gameState.tutorialState.active) return;
    console.log("[TUTORIAL] Skipping tutorial.");
    highlightElement(null, true);
    DOM.tutorialOverlay.classList.add('hidden');
    window.gameState.tutorialState.active = false;
    window.gameState.tutorialState.completed = true;
    window.gameState.tutorialState.isTemporarilyHidden = false; // Assurer que c'est réinitialisé
    localStorage.setItem('tutorialCompleted', 'true');
    if (window.fullUIUpdate) window.fullUIUpdate();
}

export function completeTutorial() {
    if (!window.gameState.tutorialState.active && !window.gameState.tutorialState.completed && localStorage.getItem('tutorialCompleted') !== 'true') {
      console.warn("[TUTORIAL] Attempt to complete tutorial that is not active or already marked completed.");
    }
    console.log("[TUTORIAL] Completing tutorial.");
    highlightElement(null, true);
    DOM.tutorialOverlay.classList.add('hidden');
    window.gameState.tutorialState.active = false;
    window.gameState.tutorialState.completed = true;
    window.gameState.tutorialState.isTemporarilyHidden = false; // Assurer que c'est réinitialisé
    localStorage.setItem('tutorialCompleted', 'true');
    if (window.fullUIUpdate) window.fullUIUpdate();

    if (window.UI && window.UI.addChatMessage && !window.gameState.tutorialState.welcomeMessageShown) {
        setTimeout(() => {
             window.UI.addChatMessage("Bienvenue aventurier, trouve vite d'autres aventuriers pour s'organiser ensemble!", "system_event", "Ancien");
             window.gameState.tutorialState.welcomeMessageShown = true;
        }, 500);
    }
}

export function initTutorial() {
    if (!DOM.tutorialOverlay) {
        console.warn("[TUTORIAL] initTutorial called before DOM elements are ready. Retrying in 100ms.");
        setTimeout(initTutorial, 100);
        return;
    }
    if (localStorage.getItem('tutorialCompleted') === 'true') {
        window.gameState.tutorialState.active = false;
        window.gameState.tutorialState.completed = true;
        DOM.tutorialOverlay.classList.add('hidden');
        console.log("[TUTORIAL] Tutorial already completed (localStorage).");
        // Afficher le message de bienvenue si le tutoriel est déjà fait
        if (window.UI && window.UI.addChatMessage) {
            setTimeout(() => {
                 window.UI.addChatMessage("Bienvenue aventurier, trouve vite d'autres aventuriers pour s'organiser ensemble!", "system_event", "Ancien");
            }, 500);
        }
        return;
    }
    // Lancer le tutoriel pour les nouveaux joueurs
    window.gameState.tutorialState.active = true;
    window.gameState.tutorialState.completed = false;
    window.gameState.tutorialState.isTemporarilyHidden = false;
    window.gameState.tutorialState.welcomeMessageShown = false;
    window.gameState.tutorialState.step = 0;
    showTutorialStep(0);
    console.log("[TUTORIAL] Tutorial initialized, step 0 shown.");
}

export function playerMovedForTutorial() {
    const { tutorialState } = window.gameState;
    if (tutorialState.active && tutorialState.step === 0 && tutorialState.isTemporarilyHidden) {
        console.log("[TUTORIAL] Player moved after temporary hide, advancing from step 0.");
        tutorialState.isTemporarilyHidden = false;
        if(DOM.tutorialOverlay) DOM.tutorialOverlay.classList.remove('hidden'); // Réafficher avant d'avancer
        advanceTutorial();
    }
}