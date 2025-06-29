// public/js/login.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const loginContainer = document.getElementById('login-container');
    const registerContainer = document.getElementById('register-container');

    // Fonction pour afficher une notification (simple alerte pour l'instant)
    function showNotification(message, isError = false) {
        alert(message); // Pour l'instant, une simple alerte
        // Plus tard, on pourrait implémenter une UI de notification plus sophistiquée
    }

    // Basculer entre les formulaires de connexion et d'inscription
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginContainer.style.display = 'none';
        registerContainer.style.display = 'block';
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerContainer.style.display = 'none';
        loginContainer.style.display = 'block';
    });

    // Gestion de la soumission du formulaire de connexion
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = loginForm.elements['login-username'].value;
        const password = loginForm.elements['login-password'].value;

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showNotification('Connexion réussie ! Redirection vers le jeu...');
                window.location.href = '/game.html'; // Rediriger vers la page du jeu
            } else {
                showNotification(data.message || 'Erreur de connexion.', true);
            }
        } catch (error) {
            console.error('Erreur lors de la connexion:', error);
            showNotification('Une erreur est survenue. Veuillez réessayer.', true);
        }
    });

    // Gestion de la soumission du formulaire d'inscription
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = registerForm.elements['register-username'].value;
        const password = registerForm.elements['register-password'].value;

        try {
            const response = await fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showNotification('Inscription réussie ! Vous pouvez maintenant vous connecter.');
                // Basculer vers le formulaire de connexion après une inscription réussie
                loginContainer.style.display = 'block';
                registerContainer.style.display = 'none';
                loginForm.elements['login-username'].value = username; // Pré-remplir le nom d'utilisateur
            } else {
                showNotification(data.message || "Erreur lors de l'inscription.", true);
            }
        } catch (error) {
            console.error("Erreur lors de l'inscription:", error);
            showNotification('Une erreur est survenue. Veuillez réessayer.', true);
        }
    });
});