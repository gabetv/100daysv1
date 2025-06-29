// js/ui/effects.js

class Particle {
    constructor(x, y, color, size, speedX, speedY, life) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = size;
        this.speedX = speedX;
        this.speedY = speedY;
        this.life = life; // in seconds
        this.initialLife = life;
    }

    update(dt) {
        this.x += this.speedX * dt;
        this.y += this.speedY * dt;
        this.speedY += 98 * dt; // gravity
        this.life -= dt;
        this.size = Math.max(0, this.size * (this.life / this.initialLife));
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

export class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    addParticle(x, y, color, size, speedX, speedY, life) {
        this.particles.push(new Particle(x, y, color, size, speedX, speedY, life));
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update(dt);
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        if (!ctx) return;
        ctx.save();
        for (const p of this.particles) {
            p.draw(ctx);
        }
        ctx.restore();
    }
}


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

    const aspectRatio = 1408 / 768; // Environ 1.8333
    const wrapperWidth = wrapper.clientWidth - 10; // -10 pour un petit padding
    const wrapperHeight = wrapper.clientHeight - 10;

    let newWidth = wrapperWidth;
    let newHeight = wrapperWidth / aspectRatio;

    if (newHeight > wrapperHeight) {
        newHeight = wrapperHeight;
        newWidth = wrapperHeight * aspectRatio;
    }
    
    newWidth = Math.max(10, newWidth);
    newHeight = Math.max(10, newHeight);

    container.style.width = `${newWidth}px`;
    container.style.height = `${newHeight}px`;

    const mainViewCanvas = document.getElementById('main-view-canvas');
    const charactersCanvas = document.getElementById('characters-canvas');
    
    if(mainViewCanvas) {
        mainViewCanvas.width = newWidth;
        mainViewCanvas.height = newHeight;
    }
    if(charactersCanvas) {
        charactersCanvas.width = newWidth;
        charactersCanvas.height = newHeight;
    }
}