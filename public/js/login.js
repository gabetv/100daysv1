// public/js/login.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const loginContainer = document.getElementById('login-container');
    const registerContainer = document.getElementById('register-container');
    const feedbackEl = document.getElementById('auth-feedback');

    if (!loginForm || !registerForm || !showRegisterLink || !showLoginLink || !loginContainer || !registerContainer) {
        console.error('Formulaire de connexion incomplet : impossible d\'initialiser l\'écran d\'accueil.');
        return;
    }

    function setFeedback(message, isError = false) {
        if (!feedbackEl) {
            alert(message);
            return;
        }
        feedbackEl.textContent = message || '';
        feedbackEl.classList.toggle('visible', Boolean(message));
        feedbackEl.classList.toggle('error', Boolean(isError));
    }

    function setFormPending(form, pending, pendingText = 'Connexion…') {
        const submit = form.querySelector('button[type="submit"]');
        if (submit) {
            submit.disabled = pending;
            submit.dataset.originalText ||= submit.textContent;
            submit.textContent = pending ? pendingText : submit.dataset.originalText;
        }
        form.querySelectorAll('input').forEach(input => { input.disabled = pending; });
    }

    function rememberUsername(username) {
        // Certains navigateurs mobiles/PWA sont plus stricts avec sessionStorage.
        // On écrit donc aussi un secours local ; game.html lit les deux.
        try { sessionStorage.setItem('username', username); } catch (_) {}
        try { localStorage.setItem('lastUsername', username); } catch (_) {}
    }

    function showRegister() {
        setFeedback('');
        loginContainer.style.display = 'none';
        registerContainer.style.display = 'block';
        requestAnimationFrame(() => document.getElementById('register-username')?.focus({ preventScroll: true }));
    }

    function showLogin(prefillUsername = '') {
        setFeedback('');
        registerContainer.style.display = 'none';
        loginContainer.style.display = 'block';
        if (prefillUsername) loginForm.elements['login-username'].value = prefillUsername;
        requestAnimationFrame(() => document.getElementById('login-username')?.focus({ preventScroll: true }));
    }

    // Basculer entre les formulaires de connexion et d'inscription
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        showRegister();
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        showLogin();
    });

    // Préremplir le dernier pseudo connu, pratique sur mobile.
    try {
        const lastUsername = localStorage.getItem('lastUsername');
        if (lastUsername && !loginForm.elements['login-username'].value) {
            loginForm.elements['login-username'].value = lastUsername;
        }
    } catch (_) {}

    // Gestion de la soumission du formulaire de connexion
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = loginForm.elements['login-username'].value.trim();
        const password = loginForm.elements['login-password'].value;
        if (!username || !password) {
            setFeedback('Entre ton pseudo et ton mot de passe.', true);
            return;
        }

        setFormPending(loginForm, true);
        setFeedback('Connexion au camp…');
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
                credentials: 'same-origin',
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok && data.success) {
                rememberUsername(data.username || username); // Lier le compte à la session de jeu
                window.location.assign('/game.html'); // Rediriger vers la page du jeu
            } else {
                setFeedback(data.message || 'Erreur de connexion.', true);
            }
        } catch (error) {
            console.error('Erreur lors de la connexion:', error);
            setFeedback('Connexion impossible. Vérifie le réseau puis réessaie.', true);
        } finally {
            setFormPending(loginForm, false);
        }
    });

    // Gestion de la soumission du formulaire d'inscription
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = registerForm.elements['register-username'].value.trim();
        const password = registerForm.elements['register-password'].value;
        if (username.length < 3 || username.length > 20 || password.length < 4) {
            setFeedback('Pseudo : 3 à 20 caractères. Mot de passe : 4 caractères minimum.', true);
            return;
        }

        setFormPending(registerForm, true, 'Création…');
        setFeedback('Création du survivant…');
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
                credentials: 'same-origin',
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok && data.success) {
                showLogin(data.username || username);
                setFeedback('Inscription réussie ! Connecte-toi pour rejoindre le camp.');
            } else {
                setFeedback(data.message || "Erreur lors de l'inscription.", true);
            }
        } catch (error) {
            console.error("Erreur lors de l'inscription:", error);
            setFeedback('Inscription impossible. Vérifie le réseau puis réessaie.', true);
        } finally {
            setFormPending(registerForm, false);
        }
    });
});
