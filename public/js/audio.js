// public/js/audio.js
// Moteur sonore procédural (WebAudio) : effets + ambiance de l'île, sans fichiers audio.

let ctx = null;
let masterGain = null;
let ambientGain = null;
// Préférence sonore mémorisée entre les sessions
let enabled = (() => { try { return localStorage.getItem('sound-enabled') !== '0'; } catch { return true; } })();
let started = false;

function ensureContext() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = enabled ? 0.55 : 0;
    masterGain.connect(ctx.destination);
    return true;
}

/** À appeler après le premier geste utilisateur (politique d'autoplay). */
export function initAudio() {
    if (started) {
        if (ctx && ctx.state === 'suspended') ctx.resume();
        return;
    }
    if (!ensureContext()) return;
    started = true;
    startAmbient();
}

export function isEnabled() { return enabled; }

export function toggleAudio() {
    enabled = !enabled;
    if (masterGain) masterGain.gain.value = enabled ? 0.55 : 0;
    try { localStorage.setItem('sound-enabled', enabled ? '1' : '0'); } catch {}
    return enabled;
}

// --- Ambiance : vagues de l'océan (bruit filtré + houle lente) ---
function startAmbient() {
    if (!ctx) return;
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02; // Bruit brun (grave, doux)
        data[i] = lastOut * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;

    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0.05;

    // Houle : le volume ondule lentement comme des vagues
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain);
    lfoGain.connect(ambientGain.gain);

    noise.connect(filter);
    filter.connect(ambientGain);
    ambientGain.connect(masterGain);
    noise.start();
    lfo.start();
}

// --- Briques de synthèse ---
function tone(freq, dur, { type = 'sine', vol = 0.2, when = 0, slideTo = null } = {}) {
    if (!ctx || !enabled) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
}

function noiseBurst(dur, { vol = 0.25, when = 0, freq = 800 } = {}) {
    if (!ctx || !enabled) return;
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filter); filter.connect(g); g.connect(masterGain);
    src.start(t0);
}

// --- Effets sonores du jeu ---
export function sfx(name) {
    if (!ctx || !enabled) return;
    switch (name) {
        case 'click':
            tone(660, 0.06, { type: 'triangle', vol: 0.08 });
            break;
        case 'gain': // Objet ramassé / réussite
            tone(520, 0.09, { type: 'triangle', vol: 0.14 });
            tone(780, 0.12, { type: 'triangle', vol: 0.12, when: 0.07 });
            break;
        case 'hit': // On encaisse des dégâts
            noiseBurst(0.15, { vol: 0.3, freq: 300 });
            tone(140, 0.22, { type: 'sawtooth', vol: 0.22, slideTo: 60 });
            break;
        case 'attack': // On frappe
            noiseBurst(0.08, { vol: 0.2, freq: 1400 });
            tone(300, 0.1, { type: 'square', vol: 0.1, slideTo: 180 });
            break;
        case 'crit':
            noiseBurst(0.12, { vol: 0.3, freq: 1800 });
            tone(440, 0.16, { type: 'square', vol: 0.16, slideTo: 220 });
            tone(880, 0.2, { type: 'triangle', vol: 0.14, when: 0.06 });
            break;
        case 'combat': // Début de combat : roulement menaçant
            tone(98, 0.5, { type: 'sawtooth', vol: 0.2, slideTo: 65 });
            noiseBurst(0.3, { vol: 0.18, freq: 200, when: 0.1 });
            tone(98, 0.4, { type: 'sawtooth', vol: 0.16, when: 0.35, slideTo: 55 });
            break;
        case 'levelup': { // Arpège ascendant
            const notes = [392, 494, 587, 784];
            notes.forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.16, when: i * 0.09 }));
            break;
        }
        case 'death':
            tone(220, 0.7, { type: 'sawtooth', vol: 0.2, slideTo: 55 });
            noiseBurst(0.5, { vol: 0.15, freq: 150, when: 0.15 });
            break;
        case 'event': // Événement du jour : carillon
            tone(587, 0.2, { type: 'sine', vol: 0.14 });
            tone(880, 0.28, { type: 'sine', vol: 0.12, when: 0.12 });
            break;
        case 'victory': { // Fanfare !
            const melody = [[523, 0], [659, 0.14], [784, 0.28], [1047, 0.45], [784, 0.65], [1047, 0.8]];
            melody.forEach(([f, w]) => tone(f, 0.22, { type: 'triangle', vol: 0.2, when: w }));
            tone(262, 1.1, { type: 'sine', vol: 0.12 });
            break;
        }
    }
}
