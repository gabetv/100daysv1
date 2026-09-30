// Couche 3D légère et sans dépendance : des particules WebGL en profondeur
// donnent à la scène un effet de diorama vivant sans remplacer les décors pixel-art.
// Le rendu reste optionnel : les machines sans WebGL conservent le jeu 2D complet.

let gl = null;
let program = null;
let positionBuffer = null;
let colorBuffer = null;
let sizeBuffer = null;
let alphaBuffer = null;
let positionLocation = -1;
let colorLocation = -1;
let sizeLocation = -1;
let alphaLocation = -1;
let ready = false;
let width = 1;
let height = 1;
let particles = [];
let lastFrame = 0;

const VERTEX_SHADER = `
    attribute vec2 a_position;
    attribute vec3 a_color;
    attribute float a_size;
    attribute float a_alpha;
    varying vec3 v_color;
    varying float v_alpha;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        gl_PointSize = a_size;
        v_color = a_color;
        v_alpha = a_alpha;
    }
`;

const FRAGMENT_SHADER = `
    precision mediump float;
    varying vec3 v_color;
    varying float v_alpha;
    void main() {
        vec2 point = gl_PointCoord - vec2(0.5);
        float distanceFromCenter = length(point);
        float glow = smoothstep(0.5, 0.0, distanceFromCenter);
        if (glow < 0.01) discard;
        gl_FragColor = vec4(v_color, glow * v_alpha);
    }
`;

const BIOME_COLORS = {
    Forêt: [0.40, 0.95, 0.62],
    Plaine: [0.76, 0.96, 0.43],
    Plage: [1.00, 0.83, 0.46],
    Lagon: [0.42, 0.92, 1.00],
    Friche: [0.95, 0.60, 0.31],
    'Mine (Terrain)': [0.74, 0.84, 0.92],
    'Trésor Caché': [1.00, 0.76, 0.25],
};

function shader(type, source) {
    const item = gl.createShader(type);
    gl.shaderSource(item, source);
    gl.compileShader(item);
    if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) {
        console.warn('[3D] Shader indisponible:', gl.getShaderInfoLog(item));
        gl.deleteShader(item);
        return null;
    }
    return item;
}

function createProgram() {
    const vertex = shader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = shader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertex || !fragment) return false;
    program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('[3D] Programme WebGL indisponible:', gl.getProgramInfoLog(program));
        return false;
    }
    positionLocation = gl.getAttribLocation(program, 'a_position');
    colorLocation = gl.getAttribLocation(program, 'a_color');
    sizeLocation = gl.getAttribLocation(program, 'a_size');
    alphaLocation = gl.getAttribLocation(program, 'a_alpha');
    positionBuffer = gl.createBuffer();
    colorBuffer = gl.createBuffer();
    sizeBuffer = gl.createBuffer();
    alphaBuffer = gl.createBuffer();
    return true;
}

function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
        value += 0x6D2B79F5;
        let t = value;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function createParticles(gameState) {
    const tile = gameState?.map?.[gameState.player?.y]?.[gameState.player?.x];
    const seed = hashString(`${tile?.x ?? 0}:${tile?.y ?? 0}:${tile?.type?.name ?? ''}`);
    const random = seededRandom(seed);
    // z représente la distance : plus il est grand, plus le point est petit.
    particles = Array.from({ length: 30 }, (_, index) => ({
        x: random() * 2 - 1,
        y: random() * 1.55 - 0.82,
        z: 0.05 + random() * 0.95,
        speed: 0.08 + random() * 0.18,
        phase: random() * Math.PI * 2,
        size: 2 + random() * 4,
        index,
    }));
}

export function initScene3D(canvas) {
    if (!canvas || ready) return ready;
    try {
        gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true });
        if (!gl || !createProgram()) return false;
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        ready = true;
        canvas.classList.add('webgl-ready');
        return true;
    } catch (error) {
        console.warn('[3D] WebGL non disponible, retour au rendu 2D.', error);
        return false;
    }
}

export function resizeScene3D(canvas) {
    if (!canvas || !ready) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
}

function project(p, time) {
    // Petite caméra orbitale : elle donne un mouvement de profondeur perceptible
    // tout en restant assez lent pour ne pas perturber la lecture du décor.
    const orbit = Math.sin(time * 0.00022 + p.phase) * 0.018 * p.z;
    const perspective = 0.78 + p.z * 0.45;
    const x = (p.x + orbit) / perspective;
    const y = p.y * (0.72 + p.z * 0.22) + Math.sin(time * 0.001 * p.speed + p.phase) * 0.012;
    return { x, y, size: p.size * (1.55 - p.z * 0.9) * Math.min(2, window.devicePixelRatio || 1) };
}

export function drawScene3D(gameState, time = performance.now()) {
    if (!ready || !gl || !gameState?.player) return;
    if (!particles.length) createParticles(gameState);
    if (time - lastFrame < 1000 / 30) return;
    lastFrame = time;

    const tile = gameState.map?.[gameState.player.y]?.[gameState.player.x];
    const color = BIOME_COLORS[tile?.type?.name] || [0.60, 0.86, 0.92];
    const positions = [];
    const colors = [];
    const sizes = [];
    const alphas = [];
    const day = (time % 120000) / 120000;
    const nightBoost = day > 0.8 ? 1.35 : day < 0.12 ? 0.95 : 0.7;

    particles.forEach((particle) => {
        const point = project(particle, time);
        positions.push(point.x, point.y);
        colors.push(color[0], color[1], color[2]);
        sizes.push(point.size);
        const pulse = 0.36 + Math.sin(time * 0.0014 + particle.phase) * 0.18;
        alphas.push(Math.max(0.04, pulse * nightBoost * (1 - particle.z * 0.45)));
    });

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sizes), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(sizeLocation);
    gl.vertexAttribPointer(sizeLocation, 1, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(alphas), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(alphaLocation);
    gl.vertexAttribPointer(alphaLocation, 1, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.POINTS, 0, particles.length);
}

export function refreshScene3D(gameState) {
    createParticles(gameState);
}

export default { initScene3D, resizeScene3D, drawScene3D, refreshScene3D };
