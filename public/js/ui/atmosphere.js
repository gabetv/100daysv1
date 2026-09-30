// js/ui/atmosphere.js — Ambiance visuelle : cycle jour/nuit, météo, lumières et particules

const DAY_DURATION_MS = 120000; // Doit correspondre à CONFIG.DAY_DURATION_MS du serveur

let currentDay = null;
let dayStartedAt = Date.now();

// --- Suivi de la progression de la journée (côté client) ---
export function syncDay(day) {
    if (day == null) return;
    if (currentDay === null) { currentDay = day; dayStartedAt = Date.now(); return; }
    if (day !== currentDay) { currentDay = day; dayStartedAt = Date.now(); }
}

export function dayProgress() {
    const p = (Date.now() - dayStartedAt) / DAY_DURATION_MS;
    return Math.max(0, Math.min(1, p));
}

/**
 * Renvoie l'état lumineux courant : aube → jour → crépuscule → nuit.
 */
export function getLighting() {
    const p = dayProgress();
    // 0-0.12 aube | 0.12-0.62 plein jour | 0.62-0.80 crépuscule | 0.80-1 nuit
    if (p < 0.12) {
        const k = p / 0.12;
        return { phase: 'aube', label: '🌅 Aube', night: 0.35 * (1 - k), warm: 0.55 * (1 - k * 0.4), tint: [255, 170, 120] };
    }
    if (p < 0.62) {
        return { phase: 'jour', label: '☀️ Jour', night: 0, warm: 0.12, tint: [255, 245, 210] };
    }
    if (p < 0.80) {
        const k = (p - 0.62) / 0.18;
        return { phase: 'crepuscule', label: '🌇 Crépuscule', night: 0.45 * k, warm: 0.55 * (1 - k * 0.5), tint: [255, 140, 90] };
    }
    const k = (p - 0.80) / 0.20;
    return { phase: 'nuit', label: '🌙 Nuit', night: 0.45 + 0.25 * Math.min(1, k * 1.5), warm: 0, tint: [70, 110, 190] };
}

// --- Systèmes de particules ---
const particles = { rain: [], flakes: [], embers: [], fireflies: [], dust: [] };
let lastW = 0, lastH = 0;

function rand(a, b) { return a + Math.random() * (b - a); }

function ensurePool(kind, count, factory) {
    const pool = particles[kind];
    while (pool.length < count) pool.push(factory());
    if (pool.length > count) pool.length = count;
    return pool;
}

function resetPoolsIfResized(w, h) {
    if (w !== lastW || h !== lastH) {
        lastW = w; lastH = h;
        Object.keys(particles).forEach(k => { particles[k].length = 0; });
    }
}

// --- Météo ---
function drawRain(ctx, w, h, intensity, dt, wind) {
    const count = Math.round(intensity * (w * h) / 9000);
    const pool = ensurePool('rain', count, () => ({
        x: rand(0, w), y: rand(0, h), len: rand(10, 26), speed: rand(700, 1250), a: rand(0.18, 0.5)
    }));
    ctx.save();
    ctx.lineCap = 'round';
    pool.forEach(p => {
        p.y += p.speed * dt;
        p.x += wind * p.speed * dt;
        if (p.y > h) { p.y = -20; p.x = rand(-40, w + 40); }
        if (p.x > w + 40) p.x = -40;
        ctx.strokeStyle = `rgba(190, 225, 255, ${p.a})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - wind * p.len * 3, p.y + p.len);
        ctx.stroke();
    });
    ctx.restore();
}

function drawFloaters(ctx, w, h, count, colorFn, dt, opts = {}) {
    const key = opts.key || 'flakes';
    const pool = ensurePool(key, count, () => ({
        x: rand(0, w), y: rand(0, h), r: rand(opts.min || 1.5, opts.max || 4),
        vx: rand(-14, 26), vy: rand(6, 26), t: rand(0, 6.28)
    }));
    ctx.save();
    pool.forEach(p => {
        p.t += dt * 1.6;
        p.x += (p.vx + Math.sin(p.t) * 12) * dt;
        p.y += p.vy * dt;
        if (p.y > h + 6) { p.y = -6; p.x = rand(0, w); }
        if (p.x > w + 6) p.x = -6;
        if (p.x < -6) p.x = w + 6;
        ctx.fillStyle = colorFn(p);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

function drawFireflies(ctx, w, h, dt) {
    const pool = ensurePool('fireflies', 18, () => ({
        x: rand(0, w), y: rand(h * 0.35, h * 0.92), t: rand(0, 6.28),
        vx: rand(-18, 18), vy: rand(-8, 8), r: rand(1.4, 2.6)
    }));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    pool.forEach(p => {
        p.t += dt * rand(0.8, 1.4);
        p.x += (p.vx + Math.sin(p.t * 1.3) * 14) * dt;
        p.y += (p.vy + Math.cos(p.t) * 8) * dt;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < h * 0.3) p.y = h * 0.9; if (p.y > h * 0.95) p.y = h * 0.35;
        const glow = (Math.sin(p.t * 2.2) * 0.5 + 0.5) ** 2;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
        g.addColorStop(0, `rgba(210, 255, 150, ${0.75 * glow})`);
        g.addColorStop(1, 'rgba(210, 255, 150, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

function drawEmbers(ctx, w, h, cx, cy, dt) {
    const pool = ensurePool('embers', 26, () => ({
        x: cx + rand(-18, 18), y: cy + rand(-10, 10), vy: rand(-60, -22), vx: rand(-14, 14),
        life: rand(0, 1), r: rand(1, 2.4)
    }));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    pool.forEach(p => {
        p.life -= dt * 0.45;
        p.x += (p.vx + Math.sin(p.life * 9) * 12) * dt;
        p.y += p.vy * dt;
        if (p.life <= 0) {
            p.life = 1; p.x = cx + rand(-16, 16); p.y = cy + rand(-6, 8);
            p.vy = rand(-70, -25); p.vx = rand(-14, 14);
        }
        const a = Math.max(0, p.life) * 0.9;
        ctx.fillStyle = `rgba(255, ${Math.round(140 + 90 * p.life)}, 60, ${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

function drawDust(ctx, w, h, dt) {
    drawFloaters(ctx, w, h, 26, p => `rgba(255, 240, 200, ${0.10 + 0.14 * Math.abs(Math.sin(p.t))})`, dt, { key: 'dust', min: 1, max: 2.6 });
}

// --- Effets de lumière ---
function drawSunRays(ctx, w, h, strength, tint) {
    if (strength <= 0.02) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sunX = w * 0.74, sunY = h * 0.05;
    const g = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, h * 1.05);
    g.addColorStop(0, `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, ${0.30 * strength})`);
    g.addColorStop(0.35, `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, ${0.10 * strength})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Rayons obliques
    const t = Date.now() / 6000;
    ctx.globalAlpha = 0.07 * strength;
    ctx.fillStyle = `rgb(${tint[0]}, ${tint[1]}, ${tint[2]})`;
    for (let i = 0; i < 4; i++) {
        const off = Math.sin(t + i) * 24;
        ctx.beginPath();
        ctx.moveTo(sunX - 60 + i * 40 + off, -10);
        ctx.lineTo(sunX + 10 + i * 40 + off, -10);
        ctx.lineTo(sunX - 220 + i * 90 + off, h + 10);
        ctx.lineTo(sunX - 330 + i * 90 + off, h + 10);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}

function drawStars(ctx, w, h, strength) {
    if (strength <= 0.05) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const t = Date.now() / 1000;
    for (let i = 0; i < 46; i++) {
        const x = ((i * 137.51) % 1) * w;
        const y = ((i * 91.7) % 1) * h * 0.45;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.7 + i));
        ctx.fillStyle = `rgba(230, 240, 255, ${0.55 * strength * tw})`;
        ctx.beginPath();
        ctx.arc(x, y, i % 7 === 0 ? 1.7 : 1.05, 0, Math.PI * 2);
        ctx.fill();
    }
    // Lune
    const mx = w * 0.18, my = h * 0.13, mr = Math.max(14, h * 0.045);
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 4);
    g.addColorStop(0, `rgba(215, 230, 255, ${0.5 * strength})`);
    g.addColorStop(1, 'rgba(215, 230, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(mx, my, mr * 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(238, 245, 255, ${0.85 * strength})`;
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

function drawGroundMist(ctx, w, h, strength) {
    if (strength <= 0.02) return;
    const t = Date.now() / 4000;
    ctx.save();
    for (let i = 0; i < 3; i++) {
        const y = h * (0.72 + i * 0.09) + Math.sin(t + i) * 5;
        const g = ctx.createLinearGradient(0, y - h * 0.12, 0, y + h * 0.12);
        g.addColorStop(0, 'rgba(200, 220, 235, 0)');
        g.addColorStop(0.5, `rgba(205, 225, 240, ${0.12 * strength})`);
        g.addColorStop(1, 'rgba(200, 220, 235, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, y - h * 0.12, w, h * 0.24);
    }
    ctx.restore();
}

function drawVignette(ctx, w, h, strength) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0, 0, 0, ${strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
}

// --- Éclair d'orage ---
let nextLightning = 0;
let lightningUntil = 0;
function stormLightning(ctx, w, h) {
    const now = Date.now();
    if (now > nextLightning) {
        nextLightning = now + rand(3500, 9000);
        lightningUntil = now + 180;
    }
    if (now < lightningUntil) {
        const a = (lightningUntil - now) / 180;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(200, 220, 255, ${0.45 * a * (Math.random() > 0.4 ? 1 : 0.3)})`;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        return true;
    }
    return false;
}

let lastFrame = Date.now();

/**
 * Applique toute l'ambiance par-dessus le décor.
 * @param {CanvasRenderingContext2D} ctx contexte du canvas de fond
 */
export function drawAtmosphere(ctx, w, h, gameState) {
    if (!ctx || !gameState || !gameState.player) return;
    const now = Date.now();
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;

    resetPoolsIfResized(w, h);
    syncDay(gameState.day);

    const light = getLighting();
    const tile = gameState.map?.[gameState.player.y]?.[gameState.player.x];
    const event = (gameState.lastEvent && gameState.lastEvent.day === gameState.day) ? gameState.lastEvent.name : null;
    const buildings = tile?.buildings || [];
    const hasFire = buildings.some(b => b.key === 'CAMPFIRE');
    const biome = tile?.type?.name || '';

    // 1. Étalonnage colorimétrique selon le biome
    ctx.save();
    const biomeTints = {
        'Forêt': ['rgba(30, 90, 60, 0.16)', 'multiply'],
        'Plaine': ['rgba(120, 170, 60, 0.10)', 'multiply'],
        'Plage': ['rgba(255, 220, 150, 0.12)', 'overlay'],
        'Lagon': ['rgba(80, 180, 220, 0.16)', 'overlay'],
        'Mine (Terrain)': ['rgba(120, 130, 150, 0.16)', 'multiply'],
        'Friche': ['rgba(160, 110, 60, 0.14)', 'multiply'],
    };
    const bt = biomeTints[biome];
    if (bt) {
        ctx.globalCompositeOperation = bt[1];
        ctx.fillStyle = bt[0];
        ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();

    // 2. Nuit / chaleur du jour
    if (light.night > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = `rgba(${light.phase === 'nuit' ? '60, 85, 150' : '120, 110, 150'}, ${light.night})`;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }
    if (light.warm > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'soft-light';
        ctx.fillStyle = `rgba(${light.tint[0]}, ${light.tint[1]}, ${light.tint[2]}, ${light.warm})`;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }

    drawStars(ctx, w, h, Math.max(0, (light.night - 0.3) * 2.2));
    drawSunRays(ctx, w, h, light.phase === 'nuit' ? 0 : (1 - light.night) * (light.phase === 'jour' ? 0.9 : 1.1), light.tint);

    // 3. Météo liée à l'événement du jour
    switch (event) {
        case 'Tempête tropicale': {
            ctx.save();
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = 'rgba(40, 55, 80, 0.38)';
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
            drawRain(ctx, w, h, 2.2, dt, 0.22);
            stormLightning(ctx, w, h);
            drawGroundMist(ctx, w, h, 0.9);
            break;
        }
        case 'Pluie bienfaisante':
            ctx.save();
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = 'rgba(90, 110, 140, 0.18)';
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
            drawRain(ctx, w, h, 0.9, dt, 0.08);
            break;
        case 'Journée radieuse':
            drawSunRays(ctx, w, h, 0.8, [255, 235, 180]);
            drawDust(ctx, w, h, dt);
            break;
        case 'Abondance':
            drawFloaters(ctx, w, h, 30, p => `rgba(190, 240, 150, ${0.35 + 0.3 * Math.abs(Math.sin(p.t))})`, dt, { key: 'flakes', min: 2, max: 4.5 });
            break;
        case 'Meute affamée':
            drawGroundMist(ctx, w, h, 1.2);
            ctx.save();
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = 'rgba(70, 60, 80, 0.20)';
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
            break;
        default:
            if (light.phase === 'jour') drawDust(ctx, w, h, dt);
            break;
    }

    // 4. Lucioles nocturnes en forêt / plaine
    if (light.night > 0.4 && (biome === 'Forêt' || biome === 'Plaine' || biome === 'Friche')) {
        drawFireflies(ctx, w, h, dt);
    }

    // 5. Halo et braises du feu de camp
    if (hasFire) {
        const fx = w * 0.5, fy = h * 0.78;
        const flicker = 0.75 + Math.sin(now / 90) * 0.12 + Math.sin(now / 37) * 0.08;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, Math.max(w, h) * 0.45);
        g.addColorStop(0, `rgba(255, 170, 70, ${0.34 * flicker})`);
        g.addColorStop(0.45, `rgba(255, 120, 40, ${0.13 * flicker})`);
        g.addColorStop(1, 'rgba(255, 90, 20, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        drawEmbers(ctx, w, h, fx, fy, dt);
    }

    // 6. Profondeur : ombre au sol + vignette
    ctx.save();
    const gg = ctx.createLinearGradient(0, h * 0.62, 0, h);
    gg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gg.addColorStop(1, 'rgba(0, 0, 0, 0.32)');
    ctx.fillStyle = gg;
    ctx.fillRect(0, h * 0.62, w, h * 0.38);
    ctx.restore();

    drawVignette(ctx, w, h, 0.32 + light.night * 0.25);

    // 7. Alerte visuelle : santé critique
    const player = gameState.player;
    if (player && player.maxHealth && player.health / player.maxHealth < 0.35) {
        const pulse = 0.12 + 0.10 * Math.abs(Math.sin(now / 420));
        ctx.save();
        const rg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.7);
        rg.addColorStop(0, 'rgba(160, 20, 20, 0)');
        rg.addColorStop(1, `rgba(170, 25, 25, ${pulse})`);
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }
}

export default { drawAtmosphere, getLighting, syncDay, dayProgress };
