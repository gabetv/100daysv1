// js/ui/character-anim.js — Moteur d'animation des survivants
//
// Chaque personnage (joueur, autre survivant, PNJ) possède un « runtime »
// d'animation autonome. Ce module est volontairement découplé du rendu et du
// DOM : il observe l'état du personnage (position, santé, discussion, combat)
// à chaque image, en déduit une intention de mouvement, et produit une POSE —
// un simple objet de nombres — que draw.js se charge de peindre en pixels.
//
// Conventions :
//   • Unités « personnage » : 1 unité = p pixels à l'écran (p ≈ 4×scale).
//     L'origine (0, 0) est le point d'ancrage passé au dessin ; le sol est à
//     FEET_Y unités sous cette origine (voir characterAnchorForGround).
//   • Angles en radians. 0 = membre tendu vers le bas ; positif = vers
//     l'avant (le personnage regarde vers +x, la scène est mise en miroir
//     pour l'ouest). Les genoux se plient vers l'arrière (k > 0), les coudes
//     vers l'avant (e > 0).

// -------------------------------------------------------------
// Squelette et timings
// -------------------------------------------------------------
export const SKELETON = {
    FEET_Y: 7.2,        // ligne de sol sous l'origine
    HIP_H: 12.2,        // hauteur des hanches au-dessus des pieds
    TORSO_H: 9.6,       // hanches → épaules
    TORSO_W: 8.4,       // largeur de buste
    NECK_H: 1.6,        // épaules → bas de la tête
    HEAD_HW: 4.2,       // demi-largeur de la tête
    HEAD_HH: 3.9,       // demi-hauteur de la tête
    SHOULDER_X: 1.7,    // décalage avant/arrière des épaules
    HIP_X: 1.2,         // décalage avant/arrière des hanches
    ARM: { upper: 4.8, fore: 4.6, w: 2.5 },
    LEG: { upper: 6.2, lower: 6.0, w: 2.9 },
};

/** Table action serveur → animation du survivant. */
export const ACTION_ANIM_MAP = {
    // Récolte / ressources
    harvest_wood_hache: 'chop', harvest_wood_scie: 'chop', harvest_wood_mains: 'chop',
    harvest: 'mine', search_ore_tile: 'mine',
    harvest_sand: 'dig', harvest_salt_water: 'forage',
    search_zone: 'forage', take_hidden_item: 'forage', open_treasure: 'dig',
    fish: 'fish', net_fish: 'fish', hunt: 'throw',
    // Fabrication / construction
    craft_item_workshop: 'craft', use_atelier: 'craft', use_etabli: 'craft', use_forge: 'craft',
    cook: 'cook', build_structure: 'build', repair_building: 'build',
    dismantle_building: 'build', place_trap: 'craft',
    plant_tree: 'plant', regenerate_forest: 'plant',
    // Repos / consommation
    sleep: 'sleep', sleep_by_campfire: 'sleep',
    // Social / combat / divers
    talk_to_npc: 'talk', attract_npc_attention: 'talk',
    initiate_combat: 'attack', play_electric_guitar: 'guitar',
    fire_distress_gun: 'throw', fire_distress_flare: 'throw',
    generate_plan: 'craft', observe_weather: 'look',
};

/** Durées (ms) et nombre de boucles par animation. */
const ANIM_DEFS = {
    walkin:  { dur: 620 },
    run:     { dur: 520 },
    chop:    { dur: 980,  loops: 2 },
    mine:    { dur: 820,  loops: 2 },
    dig:     { dur: 940,  loops: 2 },
    forage:  { dur: 1250 },
    fish:    { dur: 1900 },
    craft:   { dur: 1150, loops: 3 },
    cook:    { dur: 1150, loops: 3 },
    build:   { dur: 1150 },
    plant:   { dur: 1250 },
    eat:     { dur: 1150, loops: 2 },
    drink:   { dur: 1150, loops: 2 },
    throw:   { dur: 680 },
    attack:  { dur: 430 },
    hurt:    { dur: 500 },
    cheer:   { dur: 1500 },
    talk:    { dur: 2000 },
    wave:    { dur: 1400 },
    yawn:    { dur: 1400 },
    guitar:  { dur: 2600 },
    look:    { dur: 1600 },
    sleep:   { dur: 3200 },
};

const CHAT_FRESH_MS = 5000;
const RUNTIME_TTL_MS = 40000;
const TAU = Math.PI * 2;

const clamp01 = v => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeInOutQuad = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// -------------------------------------------------------------
// Registre des runtimes (un par personnage, clé = id stable)
// -------------------------------------------------------------
const runtimes = new Map();

function runtimeKey(character) {
    return String(character?.id ?? character?.name ?? character?.color ?? 'anonyme');
}

function makeRuntime(key) {
    return {
        key,
        createdAt: Date.now(),
        lastSeen: 0,
        isPlayer: false,
        // Détection automatique
        lastX: null, lastY: null,
        prevHealth: null,
        // Animation en cours
        action: null,          // { type, start, dur, loops, data }
        facing: 1,
        lastDustStep: 0,
        // Micro-vie
        gestureAt: 0,
        nextGestureIn: 4000 + Math.random() * 6000,
        yawnAt: 0,
        // Particules (unités locales)
        particles: [],
    };
}

export function resetCharacterAnims() {
    runtimes.clear();
}

function runtimeFor(character, isPlayer = false, keyOverride = null) {
    const key = keyOverride || runtimeKey(character);
    let rt = runtimes.get(key);
    if (!rt) {
        rt = makeRuntime(key);
        runtimes.set(key, rt);
    }
    rt.lastSeen = Date.now();
    if (isPlayer) rt.isPlayer = true;
    return rt;
}

// -------------------------------------------------------------
// Déclencheurs publics
// -------------------------------------------------------------
/**
 * Lance une animation sur un personnage.
 * @param {object|string} character (ou identifiant) personnage visé
 * @param {string} type clé de ANIM_DEFS
 * @param {object} [opts] { duration, facing, force, data }
 */
export function triggerCharacterAnim(character, type, opts = {}) {
    const def = ANIM_DEFS[type];
    if (!def) return;
    const key = typeof character === 'string' ? character : runtimeKey(character);
    let rt = runtimes.get(key);
    if (!rt) { rt = makeRuntime(key); runtimes.set(key, rt); }
    // Sans `force`, relancer la même animation en cours est ignoré : cela
    // évite qu'une rafale de notifications ne la redémarre sans cesse.
    if (!opts.force && rt.action && rt.action.type === type) return;
    const dur = opts.duration ?? def.dur;
    rt.action = {
        type,
        start: Date.now(),
        dur,
        loops: def.loops || 1,
        data: opts.data || {},
    };
    if (opts.facing) rt.facing = opts.facing;
}

/** Associe une action serveur à une animation (utilisé par main.js). */
export function animForAction(actionId, data = {}) {
    if (!actionId || actionId === 'move') return null; // l'arrivée déclenche la marche
    if (actionId === 'consume_item_context' || actionId === 'consume_eau_salee') {
        // L'eau salée se boit ; pour les autres objets, on regarde le nom.
        const name = actionId === 'consume_eau_salee'
            ? 'eau'
            : String(data?.itemName || data?.itemKey || '');
        return /eau|boisson|jus|thé|café|limonade/i.test(name) ? 'drink' : 'eat';
    }
    return ACTION_ANIM_MAP[actionId] || null;
}

// -------------------------------------------------------------
// Particules
// -------------------------------------------------------------
function spawnParticles(rt, kind, x, y, count, opts = {}) {
    for (let i = 0; i < count; i++) {
        if (rt.particles.length > 90) rt.particles.shift();
        rt.particles.push({
            kind,
            x: x + (Math.random() - 0.5) * (opts.r ?? 1.2),
            y: y + (Math.random() - 0.5) * (opts.r ?? 1.2),
            vx: (Math.random() - 0.5) * (opts.vx ?? 2.4),
            vy: -(opts.vy ?? 1.2) - Math.random() * (opts.vyRand ?? 1.5),
            g: opts.g ?? 4.5,
            life: 0,
            maxLife: opts.maxLife ?? (420 + Math.random() * 380),
            size: opts.size ?? (0.9 + Math.random() * 0.7),
            seed: Math.random() * 10,
        });
    }
}

function updateParticles(rt, dt) {
    const arr = rt.particles;
    for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        p.life += dt * 1000;
        if (p.life >= p.maxLife) { arr.splice(i, 1); continue; }
        p.vy += p.g * dt;
        // Les Z, notes et paillettes flottent au lieu de tomber.
        if (p.kind === 'zzz' || p.kind === 'note' || p.kind === 'heart' || p.kind === 'sparkle') {
            p.x += (p.vx + Math.sin(p.life / 160 + p.seed) * 1.4) * dt;
            p.y += (p.vy * 0.22 - 1.8) * dt;
        } else {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
        }
    }
}

/** Couleurs des particules — partagées avec le rendu de draw.js. */
export const PARTICLE_COLORS = {
    dust: [196, 178, 148], dirt: [122, 92, 58], spark: [255, 214, 92],
    wood: [150, 106, 62], splash: [140, 205, 235], zzz: [225, 238, 248],
    note: [232, 141, 205], heart: [244, 130, 157], sweat: [168, 216, 238],
    leaf: [128, 186, 96], sparkle: [255, 236, 150], crumb: [205, 150, 92],
};

// -------------------------------------------------------------
// Mise à jour automatique (appelée à chaque image de dessin)
// -------------------------------------------------------------
/**
 * Met à jour le runtime depuis l'état observé du personnage :
 * changement de case → marche d'arrivée, perte de santé → encaissement.
 * Retourne le runtime prêt à produire une pose.
 */
export function updateCharacterRuntime(character, { isPlayer = false } = {}) {
    const rt = runtimeFor(character, isPlayer);
    const now = Date.now();
    const x = character?.x ?? null;
    const y = character?.y ?? null;

    // --- Déplacement : le personnage vient d'arriver sur sa case ---
    // Le runtime mémorise les coordonnées du dernier passage : quelqu'un qui
    // était déjà là (PNJ, survivant installé) ne « rentre » pas en scène,
    // seul un vrai changement de case déclenche la marche.
    if (x != null && y != null) {
        const moved = rt.lastX != null && (rt.lastX !== x || rt.lastY !== y);
        if (moved) {
            const dx = Math.sign(x - rt.lastX);
            const dy = Math.sign(y - rt.lastY);
            triggerCharacterAnim(rt.key, 'walkin', {
                force: true,
                facing: dx !== 0 ? dx : rt.facing,
                data: { dirX: dx, dirY: dy },
            });
        }
        rt.lastX = x;
        rt.lastY = y;
    }

    // --- Santé : une chute déclenche l'encaissement ---
    const hp = character?.health;
    if (typeof hp === 'number') {
        if (rt.prevHealth != null && hp < rt.prevHealth - 0.4) {
            triggerCharacterAnim(rt.key, 'hurt', { force: true });
        }
        rt.prevHealth = hp;
    }

    // --- Nettoyage des runtimes oubliés ---
    if (runtimes.size > 40) {
        for (const [key, stale] of runtimes) {
            if (now - stale.lastSeen > RUNTIME_TTL_MS && !stale.isPlayer) runtimes.delete(key);
        }
    }

    return rt;
}

// -------------------------------------------------------------
// Poses
// -------------------------------------------------------------
function basePose() {
    return {
        bob: 0, sway: 0, lean: 0,
        crouch: 0, sit: 0,
        headNod: 0, headTurn: 0,
        eyes: 1, mouth: 'neutral',
        armFront: { s: 0, e: 0 }, armBack: { s: 0, e: 0 },
        legFront: { h: 0.06, k: 0.04 }, legBack: { h: -0.06, k: 0.04 },
        hairSway: 0,
        offsetX: 0, offsetY: 0,           // dans l'espace du personnage (+x = avant)
        tint: 0, shadowScale: 1,
        tool: null,                        // { type, twoHand } — outil imposé par l'action
        walkPhase: null,                   // phase de pas → poussière
        facing: 1,
    };
}

/** Cycle de pas complet appliqué à la pose. */
function applyWalk(pose, cycle, intensity = 1) {
    const c = cycle;
    pose.legFront = { h: Math.sin(c) * 0.62 * intensity, k: Math.max(0, Math.cos(c)) * 0.85 * intensity + 0.06 };
    pose.legBack = { h: Math.sin(c + Math.PI) * 0.62 * intensity, k: Math.max(0, Math.cos(c + Math.PI)) * 0.85 * intensity + 0.06 };
    pose.armFront = { s: -Math.sin(c) * 0.5 * intensity, e: 0.3 + Math.max(0, Math.sin(c)) * 0.4 * intensity };
    pose.armBack = { s: -Math.sin(c + Math.PI) * 0.5 * intensity, e: 0.3 + Math.max(0, Math.sin(c + Math.PI)) * 0.4 * intensity };
    pose.bob = -Math.abs(Math.sin(c)) * 0.85 * intensity;
    pose.lean = 0.09 * intensity;
    pose.hairSway = -Math.sin(c) * 0.5 * intensity;
    pose.walkPhase = Math.sin(c);
}

/** Posture assise, jambes tendues en avant (sommeil, repos au feu). */
function applySit(pose, t, sleeping) {
    pose.sit = 1;
    pose.legFront = { h: 1.35, k: 0.17 };
    pose.legBack = { h: 1.15, k: -0.05 };
    pose.armFront = { s: 0.55, e: 0.95 };
    pose.armBack = { s: 0.15, e: 0.5 };
    pose.lean = -0.1 + Math.sin(t * 0.9) * 0.02;
    pose.headNod = 0.3 + (sleeping ? 0.18 + Math.sin(t * 1.1) * 0.05 : Math.sin(t * 0.8) * 0.04);
    if (sleeping) { pose.eyes = 0; pose.mouth = 'small'; }
}

// --- Bibliothèque d'actions : chaque fonction reçoit (u, t, pose, rt, data) ---
const ACTION_POSES = {
    walkin(u, t, pose, rt, data) {
        const ease = easeOutCubic(u);
        if (data.dirX) {
            pose.offsetX = -Math.sign(data.dirX) * (1 - ease) * 26;
            pose.facing = Math.sign(data.dirX);
        } else if (data.dirY) {
            pose.offsetY = -Math.sign(data.dirY) * (1 - ease) * 7;
        }
        applyWalk(pose, t * 10.5, 1);
        pose.shadowScale = 0.94;
    },
    run(u, t, pose) {
        applyWalk(pose, t * 13, 1.35);
        pose.lean = 0.22;
    },
    chop(u, t, pose, rt, data) {
        const loopU = (u * (data.loops || 2)) % 1;
        // Lever lent, abattage rapide, impact, remontée.
        let swing;
        if (loopU < 0.38) swing = easeInOutQuad(loopU / 0.38);
        else if (loopU < 0.52) swing = 1 + 2.2 * ((loopU - 0.38) / 0.14);
        else if (loopU < 0.66) swing = 3.2;
        else swing = 3.2 - 3.2 * easeInOutQuad((loopU - 0.66) / 0.34);
        const s = lerp(0.35, -2.55, Math.min(swing, 1)) + (swing > 1 ? (swing - 1) * 1.65 : 0);
        // Le bras se tend à l'abattage : le fer descend jusqu'aux genoux.
        const strike = clamp01((swing - 1) / 2.2);
        pose.armFront = { s, e: lerp(0.5, 0.1, strike) };
        pose.armBack = { s: s * 0.72, e: lerp(0.8, 0.25, strike) };
        pose.lean = lerp(-0.14, 0.24, strike);
        pose.tool = { type: 'axe', twoHand: true, angleBias: 0.15 };
        pose.headNod = pose.lean * 0.5;
        if (loopU > 0.52 && loopU < 0.6) {
            spawnParticles(rt, 'wood', 8, 3, 3, { vy: 2.6, vyRand: 2, g: 6, maxLife: 500 });
            spawnParticles(rt, 'dust', 8, 5, 2, { vy: 1, g: 2.5, maxLife: 460 });
        }
    },
    mine(u, t, pose, rt) {
        const loopU = (u * 2) % 1;
        let swing;
        if (loopU < 0.34) swing = easeInOutQuad(loopU / 0.34);
        else if (loopU < 0.46) swing = 1 + 2.0 * ((loopU - 0.34) / 0.12);
        else if (loopU < 0.6) swing = 3;
        else swing = 3 - 3 * easeInOutQuad((loopU - 0.6) / 0.4);
        const s = lerp(-0.2, -1.85, Math.min(swing, 1)) + (swing > 1 ? (swing - 1) * 1.45 : 0);
        const strike = clamp01((swing - 1) / 2);
        pose.armFront = { s, e: lerp(0.5, 0.12, strike) };
        pose.armBack = { s: s * 0.75, e: lerp(0.85, 0.3, strike) };
        pose.lean = lerp(-0.1, 0.24, strike);
        pose.tool = { type: 'pick', twoHand: true, angleBias: 0.18 };
        pose.headNod = 0.22;
        if (loopU > 0.46 && loopU < 0.54) {
            spawnParticles(rt, 'spark', 9, 2, 5, { vy: 2.4, vyRand: 2.4, g: 7, maxLife: 380, r: 1.8 });
            spawnParticles(rt, 'dust', 8, 5, 2, { g: 2.5, maxLife: 440 });
        }
    },
    dig(u, t, pose, rt) {
        const loopU = (u * 2) % 1;
        const press = Math.sin(loopU * Math.PI * 2);
        const s = 1.05 + press * 0.35;
        pose.armFront = { s, e: 0.55 - press * 0.3 };
        pose.armBack = { s: s - 0.55, e: 0.85 };
        pose.lean = 0.12 + press * 0.08;
        pose.crouch = 0.22;
        pose.tool = { type: 'shovel', twoHand: true, angleBias: 0.1 };
        pose.headNod = 0.18;
        if (press < -0.92) {
            spawnParticles(rt, 'dirt', 9, 3, 4, { vy: 3, vyRand: 2.4, g: 7, maxLife: 520, r: 1.6 });
        }
    },
    forage(u, t, pose, rt) {
        const crouchIn = clamp01(u / 0.18);
        const crouchOut = clamp01((1 - u) / 0.18);
        pose.crouch = Math.min(crouchIn, crouchOut) * 0.9;
        const scratch = Math.sin(t * 11);
        pose.armFront = { s: 1.55 + scratch * 0.14, e: 0.35 };
        pose.armBack = { s: 0.35, e: 1.0 };
        pose.lean = 0.3 * pose.crouch;
        pose.headNod = 0.34 * pose.crouch;
        pose.mouth = 'small';
        if (scratch > 0.96) {
            spawnParticles(rt, Math.random() > 0.5 ? 'leaf' : 'dirt', 8.5, 3.5, 2, { vy: 1.6, vyRand: 1.4, g: 5, maxLife: 480 });
        }
    },
    fish(u, t, pose, rt) {
        const tug = u > 0.52 && u < 0.72 ? Math.sin((u - 0.52) / 0.2 * Math.PI) : 0;
        const wiggle = Math.sin(t * 3.2) * 0.06;
        pose.armFront = { s: 1.02 + tug * 0.3 + wiggle, e: 0.3 };
        pose.armBack = { s: 0.78, e: 0.62 };
        pose.lean = 0.04 + tug * 0.14;
        pose.legFront = { h: 0.22, k: 0.16 };
        pose.legBack = { h: -0.3, k: 0.2 };
        pose.tool = { type: 'rod', twoHand: true, angleBias: 0.7 };
        pose.headNod = 0.1 + tug * 0.12;
        pose.mouth = tug > 0.5 ? 'open' : 'small';
        if (tug > 0.85) {
            spawnParticles(rt, 'splash', 13, 2, 3, { vy: 2.2, vyRand: 2, g: 6, maxLife: 460 });
        }
    },
    craft(u, t, pose, rt) {
        const loopU = (u * 3) % 1;
        const strike = loopU < 0.3 ? Math.sin(loopU / 0.3 * Math.PI) : 0;
        pose.armFront = { s: 1.5 - strike * 0.55, e: 0.5 };
        pose.armBack = { s: 0.6, e: 0.9 };
        pose.lean = 0.1 + strike * 0.05;
        pose.headNod = 0.24;
        pose.tool = { type: 'hammer', twoHand: false };
        pose.mouth = 'small';
        if (strike > 0.9) {
            spawnParticles(rt, 'spark', 8, -1, 3, { vy: 2, vyRand: 1.8, g: 6, maxLife: 320, r: 1.2 });
        }
    },
    cook(u, t, pose, rt) {
        const stir = Math.sin(t * 6);
        pose.armFront = { s: 1.15 + stir * 0.12, e: 0.7 };
        pose.armBack = { s: 0.5, e: 0.9 };
        pose.lean = 0.12;
        pose.headNod = 0.2;
        pose.tool = { type: 'spoon', twoHand: false };
        pose.mouth = 'small';
        if (stir > 0.98) spawnParticles(rt, 'sparkle', 8, -1, 1, { vy: 1.4, g: 0.6, maxLife: 600 });
    },
    build(u, t, pose, rt) {
        const pat = Math.sin(u * Math.PI * 4);
        if (u < 0.45) {
            // Lève le matériau…
            pose.armFront = { s: 0.9 - u * 0.5, e: 0.6 };
            pose.armBack = { s: 0.6 - u * 0.4, e: 0.7 };
            pose.crouch = 0.25 * (1 - u);
        } else {
            // …puis tasse la construction.
            pose.crouch = 0.3;
            pose.armFront = { s: 1.1, e: 0.9 - Math.max(0, pat) * 0.5 };
            pose.armBack = { s: 0.7, e: 1.0 };
            pose.lean = 0.18;
            pose.headNod = 0.24;
            if (pat > 0.95) spawnParticles(rt, 'dust', 7.5, 2.5, 2, { vy: 1, g: 3, maxLife: 420 });
        }
        pose.mouth = 'small';
    },
    plant(u, t, pose, rt) {
        const pat = Math.sin(u * Math.PI * 3);
        pose.crouch = clamp01(Math.sin(u * Math.PI)) * 0.8;
        pose.armFront = { s: 1.5, e: 0.5 - Math.max(0, pat) * 0.35 };
        pose.armBack = { s: 0.4, e: 0.9 };
        pose.lean = 0.2;
        pose.headNod = 0.3;
        if (pat > 0.95) spawnParticles(rt, 'leaf', 7.5, 2.5, 2, { vy: 1.4, g: 3.5, maxLife: 520 });
        pose.mouth = 'small';
    },
    eat(u, t, pose, rt) {
        const chew = Math.sin(t * 9) > 0;
        pose.armFront = { s: 1.32, e: 1.95 };
        pose.headNod = -0.06;
        pose.mouth = chew ? 'open' : 'small';
        pose.eyes = Math.sin(t * 2.2) > 0.97 ? 0 : 1; // se régale
        pose.tool = { type: 'food', twoHand: false };
        if (chew && Math.random() < 0.06) {
            spawnParticles(rt, 'crumb', 5.2, -8.5, 1, { vy: 0.6, vyRand: 0.6, g: 6, maxLife: 420 });
        }
    },
    drink(u, t, pose, rt) {
        const sip = Math.sin(t * 3.4) > 0.2;
        pose.armFront = { s: 1.38, e: 2.05 };
        pose.headNod = -0.12;
        pose.eyes = 0;
        pose.mouth = 'small';
        pose.tool = { type: 'canteen', twoHand: false };
        if (sip && Math.random() < 0.04) {
            spawnParticles(rt, 'splash', 5, -9, 1, { vy: 0.8, g: 6, maxLife: 380, size: 0.7 });
        }
    },
    throw(u, t, pose) {
        let s;
        if (u < 0.4) s = lerp(0.3, -1.4, easeInOutQuad(u / 0.4));       // arme derrière
        else if (u < 0.55) s = lerp(-1.4, 1.7, (u - 0.4) / 0.15);       // fouette
        else s = lerp(1.7, 0.2, easeInOutQuad((u - 0.55) / 0.45));
        pose.armFront = { s, e: 0.3 };
        pose.armBack = { s: -0.35, e: 0.5 };
        pose.lean = u > 0.4 && u < 0.7 ? 0.2 : -0.05;
        pose.legFront = { h: u > 0.4 ? 0.4 : 0.1, k: 0.15 };
        pose.legBack = { h: -0.35, k: 0.12 };
    },
    attack(u, t, pose) {
        let s, lean;
        if (u < 0.28) { const k = u / 0.28; s = lerp(0.9, -0.75, k); lean = -0.1; }
        else if (u < 0.46) { const k = (u - 0.28) / 0.18; s = lerp(-0.75, 1.6, k); lean = 0.2; }
        else if (u < 0.66) { s = 1.6; lean = 0.2; }
        else { const k = (u - 0.66) / 0.34; s = lerp(1.6, 0.9, k); lean = lerp(0.2, 0.06, k); }
        pose.armFront = { s, e: 0.22 };
        pose.armBack = { s: -0.3, e: 0.55 };
        pose.lean = lean;
        pose.legFront = { h: lean > 0.1 ? 0.45 : 0.15, k: 0.12 };
        pose.legBack = { h: -0.4, k: 0.18 };
        pose.offsetX = lean > 0.15 ? 2.2 : 0;
        pose.mouth = lean > 0.1 ? 'open' : 'neutral';
    },
    hurt(u, t, pose) {
        const k = Math.sin(Math.min(1, u * 1.6) * Math.PI);
        pose.lean = -0.26 * k;
        pose.armFront = { s: 1.05 * k, e: 1.5 * k };
        pose.armBack = { s: 0.75 * k, e: 1.3 * k };
        pose.offsetX = -3 * k;
        // La rougeur frappe fort puis s'efface.
        pose.tint = Math.pow(1 - u, 1.4) * 0.9;
        pose.mouth = 'grimace';
        pose.eyes = u < 0.5 ? 0.15 : 1;
        pose.headNod = 0.15 * k;
    },
    cheer(u, t, pose, rt) {
        const jump = Math.abs(Math.sin(u * Math.PI * 3));
        pose.offsetY = -jump * 2.6;
        pose.shadowScale = 1 - jump * 0.28;
        pose.armFront = { s: 2.45 + Math.sin(t * 9) * 0.1, e: 0.35 };
        pose.armBack = { s: 2.3, e: 0.4 };
        pose.mouth = 'smile';
        pose.headNod = -0.12;
        pose.bob = 0;
        if (Math.random() < 0.12) {
            spawnParticles(rt, 'sparkle', (Math.random() - 0.5) * 14, -20 - Math.random() * 8, 1, { vy: 0.8, g: 0.2, maxLife: 700, size: 1 });
        }
    },
    talk(u, t, pose) {
        const beat = Math.sin(t * 5.2);
        pose.armFront = { s: 0.95 + beat * 0.22, e: 1.15 + Math.sin(t * 5.2 + 1) * 0.3 };
        pose.armBack = { s: 0.05, e: 0.2 };
        pose.headNod = 0.05 + Math.sin(t * 4.4) * 0.05;
        pose.mouth = beat > 0 ? 'open' : 'small';
        pose.lean = 0.03;
    },
    wave(u, t, pose) {
        const wig = Math.sin(t * 10);
        pose.armFront = { s: 2.5, e: 0.5 + wig * 0.45 };
        pose.armBack = { s: 0.1, e: 0.15 };
        pose.mouth = 'smile';
        pose.headNod = -0.04;
    },
    yawn(u, t, pose) {
        const k = Math.sin(u * Math.PI);
        pose.headNod = -0.22 * k;
        pose.mouth = u > 0.2 && u < 0.8 ? 'open' : 'small';
        pose.eyes = 0;
        pose.armFront = { s: 0.35 + k * 0.5, e: 0.2 + k * 0.4 };
        pose.armBack = { s: 0.2 + k * 0.35, e: 0.15 + k * 0.3 };
        pose.lean = -0.05 * k;
    },
    guitar(u, t, pose, rt) {
        const strum = Math.sin(t * 8.5);
        pose.armFront = { s: 1.05, e: 0.75 + strum * 0.3 };
        pose.armBack = { s: 1.25, e: 0.45 };
        pose.lean = 0.08;
        pose.headNod = 0.1 + strum * 0.05;
        pose.mouth = 'open';
        pose.tool = { type: 'guitar', twoHand: true };
        if (strum > 0.97) {
            spawnParticles(rt, 'note', 6 + (Math.random() - 0.5) * 4, -14, 1, { vy: 0.4, vyRand: 0.4, g: 0, maxLife: 900 });
        }
    },
    look(u, t, pose) {
        // Observe le ciel / la météo : tête levée, main au-dessus des yeux.
        const k = Math.sin(u * Math.PI);
        pose.headNod = -0.2 * k;
        pose.headTurn = Math.sin(u * Math.PI * 2) * 0.6;
        pose.armFront = { s: 2.0 * k, e: 1.15 * k };
        pose.mouth = 'small';
    },
    sleep(u, t, pose, rt) {
        applySit(pose, t, true);
        if (!rt._zzzAt || t - rt._zzzAt > 2.1) {
            rt._zzzAt = t;
            spawnParticles(rt, 'zzz', 3.4, -21, 1, { vy: 0.6, vyRand: 0.4, g: 0, maxLife: 1700, size: 1.3 });
        }
    },
};

/**
 * Calcule la pose complète d'un personnage pour l'instant présent.
 * @param {object} character état du personnage (santé, discussion, combat…)
 * @param {object} rt runtime d'animation (voir updateCharacterRuntime)
 * @param {object} opts { isPlayer, faceHint, preview }
 */
export function computeCharacterPose(character, rt, opts = {}) {
    const nowMs = Date.now();
    const t = nowMs / 1000;
    // Déphase chaque personnage : deux survivants côte à côte ne respirent
    // pas en phase, ni ne clignent des yeux au même moment.
    let phase = 0;
    for (let i = 0; i < rt.key.length; i++) phase = (phase * 31 + rt.key.charCodeAt(i)) >>> 0;
    phase = (phase % 100) / 100;

    const pose = basePose();
    pose.facing = rt.facing || 1;
    if (opts.faceHint && Math.sign(opts.faceHint) !== 0) pose.facing = Math.sign(opts.faceHint);

    // ---------- Idle : respiration, clignement, regard, poids ----------
    const breath = Math.sin(t * 1.35 + phase * TAU);
    pose.bob = breath * 0.38;
    pose.armFront = { s: 0.06 + Math.sin(t * 0.8 + phase * 9) * 0.05, e: 0.14 + breath * 0.04 };
    pose.armBack = { s: -0.04 + Math.sin(t * 0.8 + phase * 9 + 1) * 0.05, e: 0.12 };
    pose.sway = Math.sin(t * 0.34 + phase * 5) * 0.35;
    pose.eyes = ((t + phase * 4) % 4.3) < 0.13 ? 0 : 1;
    const glanceT = (t * 0.14 + phase) % 1;
    pose.headTurn = glanceT < 0.1 ? (phase > 0.5 ? 1 : -1) : 0;

    // ---------- Contexte : santé, fatigue, discussion, combat ----------
    const hp = character?.health ?? 1;
    const hpMax = character?.maxHealth ?? 10;
    const ratio = hpMax > 0 ? clamp01(hp / hpMax) : 1;
    const isTalking = character?.chatMessage && (nowMs - character.chatMessage.timestamp) < CHAT_FRESH_MS;
    const inCombat = !!character?.combatState;

    if (inCombat && !rt.action) {
        // Garde du combattant : léger rebond, arme prête, regard fixe.
        pose.lean = 0.07;
        pose.crouch = 0.13 + Math.sin(t * 3.1) * 0.02;
        pose.armFront = { s: 0.95 + Math.sin(t * 3.1) * 0.04, e: 0.4 };
        pose.armBack = { s: -0.3, e: 0.55 };
        pose.legFront = { h: 0.28, k: 0.14 };
        pose.legBack = { h: -0.34, k: 0.16 };
        pose.eyes = 1;
        pose.facing = 1; // les créatures occupent le côté droit de la scène
    } else if (isTalking && !rt.action) {
        ACTION_POSES.talk(0, t, pose, rt);
    }

    // Fatigue extrême : le survivant vacille et serre les dents.
    if (!inCombat && ratio <= 0.32) {
        pose.lean += 0.07;
        pose.headNod += 0.16;
        if (!rt.action) {
            pose.mouth = 'grimace';
            pose.armFront = { s: 0.28, e: 1.65 }; // main sur le flanc
            pose.armBack = { s: -0.1, e: 0.25 };
        }
        if (Math.random() < 0.008) {
            spawnParticles(rt, 'sweat', 4.2, -19, 1, { vy: 0.5, vyRand: 0.5, g: 5, maxLife: 600, size: 0.8 });
        }
    }

    // ---------- Action en cours ----------
    if (rt.action) {
        const { type, start, dur, loops, data } = rt.action;
        const u = (nowMs - start) / dur;
        if (u >= 1) {
            rt.action = null;
        } else {
            const fn = ACTION_POSES[type];
            if (fn) fn(u, t, pose, rt, { ...data, loops });
        }
    }

    // ---------- Somnolence (stat de sommeil très basse) ----------
    const sleepStat = character?.sleep;
    if (!rt.action && !inCombat && typeof sleepStat === 'number' && character?.maxSleep > 0) {
        const sleepy = clamp01(1 - sleepStat / character.maxSleep);
        if (sleepy > 0.65 && nowMs - rt.yawnAt > 11000 + phase * 4000) {
            rt.yawnAt = nowMs;
            triggerCharacterAnim(rt.key, 'yawn', { force: true });
        }
    }

    // ---------- PNJ : petits gestes sociaux réguliers ----------
    const isNpc = !!(character?.isNpc || Array.isArray(character?.dialogue) || character?.availableQuest);
    if (isNpc && !rt.action && !inCombat && !isTalking) {
        if (nowMs - rt.gestureAt > rt.nextGestureIn) {
            rt.gestureAt = nowMs;
            rt.nextGestureIn = 6000 + Math.random() * 9000;
            triggerCharacterAnim(rt.key, Math.random() > 0.5 ? 'talk' : 'look', { force: true });
        }
    }

    // ---------- Poussière du pas ----------
    if (pose.walkPhase != null && Math.abs(pose.walkPhase) > 0.985) {
        const stepIndex = Math.floor(t * 10.5 / Math.PI);
        if (stepIndex !== rt.lastDustStep) {
            rt.lastDustStep = stepIndex;
            spawnParticles(rt, 'dust', pose.walkPhase > 0 ? 2.2 : -2.2, 6.6, 2, { vy: 0.9, vyRand: 0.8, g: 1.6, maxLife: 460, size: 0.9 });
        }
    }

    rt.facing = pose.facing;
    updateParticles(rt, 1 / 30);
    return pose;
}

/** Particules du personnage, dessinées par draw.js en unités locales. */
export function characterParticles(rt) {
    return rt ? rt.particles : [];
}

/**
 * Runtime d'aperçu (personnalisation, fiches) : isolé du monde, il joue une
 * garde animée et salue le joueur de temps en temps.
 */
export function previewRuntime(character, keyOverride = 'preview:avatar') {
    const rt = runtimeFor(character, true, keyOverride);
    if (!rt.action) {
        const nowMs = Date.now();
        if (nowMs - (rt._waveAt || 0) > 6200) {
            rt._waveAt = nowMs;
            triggerCharacterAnim(rt.key, 'wave', { force: true });
        }
    }
    return rt;
}
