// js/ui/tutorial.js
import DOM from './dom.js';

const tutorialSteps = [
    {
        elementId: null,
        message: "Bienvenue sur l'Île des 100 Jours ! Votre objectif : survivre.<br><br>Utilisez les touches <b>ZQSD</b> ou les <b>flèches directionnelles</b> pour vous déplacer, ou cliquez sur les <b>flèches à l'écran</b>.<br><br>Cliquez sur 'Compris, je vais bouger !' puis essayez de bouger d'une case.",
        showNext: true,
        nextButtonText: "Compris, je vais bouger !",
        nextButtonAction: 'tutorial_hide_and_move',
        showSkip: false,
        highlightTarget: '#navigation-edge-panel',
    },
    {
        elementId: null,
        message: "Excellent ! Vous savez vous déplacer.<br><br>Vous pouvez maintenant passer le reste de ce tutoriel en cliquant sur <b>'Passer le Tutoriel'</b>, ou continuer avec <b>'Suivant'</b> pour découvrir l'interface.",
        showNext: true,
        nextButtonText: "Suivant",
        nextButtonAction: 'tutorial_next',
        showSkip: true,
        highlightTarget: null,
    },
    {
        elementId: 'left-panel',
        highlightTarget: '#player-stats',
        message: "À gauche, ceci est votre panneau de <b>Statut</b>. Surveillez votre Santé ❤️, Soif 💧, Faim 🍗 et Sommeil 🌙.<br>Utilisez les boutons <b>'+'</b> pour consommer des objets de soin, boisson ou nourriture rapidement si vous en possédez.",
        showNext: true,
        nextButtonText: "Suivant",
        nextButtonAction: 'tutorial_next',
        showSkip: true,
    },
    {
        elementId: 'left-panel',
        highlightTarget: '#minimap-section',
        message: "Juste en dessous, voici la <b>Mini-carte</b>. Elle se dévoilera au fur et à mesure de votre exploration.<br>Cliquez sur le bouton carré ⛶ pour l'agrandir.",
        showNext: true,
        nextButtonText: "Suivant",
        nextButtonAction: 'tutorial_next',
        showSkip: true,
    },
    {
        elementId: 'right-panel',
        highlightTarget: '#tile-info',
        message: "À droite, ce panneau affiche des informations sur la <b>case actuelle</b> : son nom, vos coordonnées (X,Y), le jour actuel et les ressources/actions restantes.",
        showNext: true,
        nextButtonText: "Suivant",
        nextButtonAction: 'tutorial_next',
        showSkip: true,
    },
    {
        elementId: 'right-panel',
        highlightTarget: '#interaction-panel',
        message: "Le panneau <b>'Actions Possibles'</b> liste ce que vous pouvez faire ici : récolter, construire, interagir...",
        showNext: true,
        nextButtonText: "Suivant",
        nextButtonAction: 'tutorial_next',
        showSkip: true,
    },
    {
        elementId: 'right-panel',
        highlightTarget: '#inventory-section',
        message: "Votre <b>Inventaire principal</b> s'affiche ici, trié par catégories. Cliquez sur un titre de catégorie pour la déplier/replier. Vous pouvez cliquer sur certains objets pour les utiliser ou les équiper.",
        showNext: true,
        nextButtonText: "Suivant",
        nextButtonAction: 'tutorial_next',
        showSkip: true,
    },
    {
        elementId: 'bottom-bar',
        highlightTarget: '#bottom-bar-chat-panel',
        message: "La <b>Barre Inférieure</b> contient :<br>Le <b>Journal / Chat</b> (entrez vos messages ou utilisez le menu rapide '+' pour des messages prédéfinis).",
        showNext: true,
        nextButtonText: "Suivant",
        nextButtonAction: 'tutorial_next',
        showSkip: true,
    },
    {
        elementId: 'bottom-bar',
        highlightTarget: '#bottom-bar-equipment-panel',
        message: "...vos <b>Équipements</b> actuellement portés (cliquez sur un slot pour déséquiper, ou sur un objet compatible dans votre inventaire pour équiper)...",
        showNext: true,
        nextButtonText: "Suivant",
        nextButtonAction: 'tutorial_next',
        showSkip: true,
    },
    {
        elementId: 'bottom-bar',
        highlightTarget: '#bottom-bar-ground-items',
        message: "...et les <b>Objets au sol</b> sur votre case (cliquez pour ramasser).<br><br>Vous pouvez <b>glisser-déposer</b> des objets entre votre inventaire, les coffres (si ouverts dans une modale), vos équipements et le sol.",
        showNext: true,
        nextButtonText: "Suivant",
        nextButtonAction: 'tutorial_next',
        showSkip: true,
    },
    {
        elementId: null,
        highlightTarget: null,
        message: "C'est tout pour le tutoriel de base ! Explorez, construisez, et surtout, survivez !<br><br><b>Bonne chance, aventurier !</b>",
        showNext: true,
        nextButtonText: "Terminer le Tutoriel",
        nextButtonAction: 'tutorial_next',
        showSkip: false,
        isFinalStep: true,
    }
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