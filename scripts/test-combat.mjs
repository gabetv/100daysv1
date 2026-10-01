// Test d'intégration du combat, contre le vrai serveur.
//
// Le combat vient de quitter sa fenêtre modale pour s'installer dans la scène,
// avec un enchaînement automatique des coups. Deux règles nouvelles doivent
// tenir, et aucune ne se vérifie en lisant le code :
//
//   1. on ne quitte plus un combat en marchant — sinon le bouton « Fuir » et
//      son tirage au sort ne servent à rien ;
//   2. l'enchaînement automatique du client doit suivre le tour serveur sans
//      jamais envoyer deux attaques pour un même tour.
//
// Le test ouvre une vraie connexion WebSocket, déclenche un combat avec les
// outils de test du jeu, puis rejoue la boucle d'attaque du client.
//
// Usage : node scripts/test-combat.mjs [url]
//   ex.  : node scripts/test-combat.mjs ws://localhost:3000

import { WebSocket } from 'ws';
import { createAutoAttacker } from '../public/js/ui/combat-loop.js';

const URL = process.argv[2] || 'ws://localhost:3000';
const USER = `bot_combat_${Date.now().toString(36)}`;

let failures = 0;
const ok = (n) => console.log(`  ok  ${n}`);
const fail = (n, d = '') => { failures += 1; console.error(`FAIL  ${n}${d ? ` — ${d}` : ''}`); };

// --- Automate d'attaque : vérification hors réseau -------------------------
// Le serveur ne diffuse que deux fois par seconde : le client revoit donc le
// même tour plusieurs fois. Un seul coup doit en sortir.
console.log('== Automate : un coup par tour ==');
{
    const a = createAutoAttacker();
    const seq = [
        ['player', true,  'premier état du tour joueur → on frappe'],
        ['player', false, 'état répété du même tour → on ne frappe pas'],
        ['player', false, 'troisième répétition → toujours pas'],
        ['enemy',  false, "tour de l'ennemi → on attend"],
        ['enemy',  false, "riposte en cours → on attend encore"],
        ['player', true,  'la main revient → on frappe à nouveau'],
        ['player', false, 'répétition → non'],
    ];
    seq.forEach(([turn, expected, label]) => {
        const got = a.onState({ turn });
        if (got === expected) ok(label);
        else fail(label, `attendu ${expected}, obtenu ${got}`);
    });
    // Fin de combat puis nouvelle rencontre : l'automate doit repartir propre.
    a.onState(null);
    if (a.onState({ turn: 'player' })) ok('nouveau combat → on frappe dès le premier état');
    else fail('nouveau combat', "l'automate est resté verrouillé");
    a.reset();
    if (a.onState({ turn: 'player' })) ok('reset() réarme bien l\'automate');
    else fail('reset()', "l'automate est resté verrouillé");
}
console.log('');

const ws = new WebSocket(URL);
let myId = null;
let world = null;              // dernier payload gameState complet
const waiters = [];

const me = () => (myId && world?.players?.[myId]) || null;

ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === 'playerId') { myId = msg.payload; return; }
    if (msg.type !== 'gameState') return;
    world = msg.payload;
    for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i].test()) waiters.splice(i, 1)[0].resolve();
    }
});

const send = (id, data) => ws.send(JSON.stringify({ id, data }));

function waitFor(label, test, timeout = 8000) {
    return new Promise((resolve, reject) => {
        if (test()) return resolve();
        const w = { test, resolve };
        waiters.push(w);
        setTimeout(() => {
            const i = waiters.indexOf(w);
            if (i >= 0) { waiters.splice(i, 1); reject(new Error(`délai dépassé : ${label}`)); }
        }, timeout);
    });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Un pas vers (tx,ty), en diagonale si la case le permet. */
function stepToward(tx, ty) {
    const p = me();
    const dx = Math.sign(tx - p.x);
    const dy = Math.sign(ty - p.y);
    const candidates = [[dx, dy], [dx, 0], [0, dy]].filter(([a, b]) => a || b);
    for (const [a, b] of candidates) {
        const tile = world.map?.[p.y + b]?.[p.x + a];
        if (tile?.type?.accessible) {
            const names = { '0,-1': 'north', '0,1': 'south', '-1,0': 'west', '1,0': 'east',
                            '-1,-1': 'nw', '1,-1': 'ne', '-1,1': 'sw', '1,1': 'se' };
            return names[`${a},${b}`];
        }
    }
    return null;
}

try {
    await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
    console.log(`Connecté à ${URL} en tant que ${USER}\n`);
    send('join', { username: USER });
    await waitFor('état initial', () => me() && world.map);

    // Invincibilité de test : le but est de vérifier les règles, pas de mourir.
    send('admin_toggle_invincibility', {});
    await sleep(400);

    // --- Rejoindre un ennemi pour déclencher un combat ----------------------
    console.log('== Déclenchement du combat ==');
    const target = (world.enemies || [])
        .filter((e) => e.currentHealth > 0)
        .sort((a, b) => (Math.abs(a.x - me().x) + Math.abs(a.y - me().y)) - (Math.abs(b.x - me().x) + Math.abs(b.y - me().y)))[0];
    if (!target) throw new Error('aucun ennemi vivant sur la carte');
    console.log(`  cible : ${target.name} en (${target.x},${target.y}), joueur en (${me().x},${me().y})`);

    // On marche jusqu'à sa case, puis on engage explicitement : un ennemi
    // n'attaque de lui-même qu'au gré de ses propres déplacements.
    for (let i = 0; i < 60 && !me().combatState; i++) {
        const here = (world.enemies || []).find((e) => e.x === me().x && e.y === me().y && e.currentHealth > 0);
        if (here) { send('initiate_combat', {}); await sleep(400); continue; }
        const dir = stepToward(target.x, target.y);
        if (!dir) { await sleep(300); continue; }
        send('move', { direction: dir });
        await sleep(260);
    }
    if (!me().combatState) throw new Error(`combat non déclenché (joueur en ${me().x},${me().y})`);
    ok(`combat engagé contre ${me().combatState.enemy.name}`);

    // --- 1. On ne s'échappe pas à pied --------------------------------------
    console.log('\n== Le déplacement est refusé pendant le combat ==');
    const before = { x: me().x, y: me().y };
    for (const dir of ['north', 'south', 'east', 'west', 'ne', 'sw']) send('move', { direction: dir });
    await sleep(1400);
    if (me().x === before.x && me().y === before.y) ok('six tentatives de déplacement ignorées');
    else fail('le joueur a bougé en plein combat', `(${before.x},${before.y}) → (${me().x},${me().y})`);
    if (me().combatState) ok('le combat est toujours en cours');
    else fail("le combat s'est interrompu tout seul");

    // --- 2. La boucle automatique suit le tour serveur ----------------------
    console.log('\n== Enchaînement automatique des coups ==');
    const enemyStart = me().combatState.enemy.currentHealth;
    // On rejoue EXACTEMENT l'automate du client (public/js/ui/combat-loop.js),
    // interrogé au même rythme que les états reçus : c'est lui qui est testé,
    // pas une approximation écrite pour l'occasion.
    const attacker = createAutoAttacker();
    let sent = 0, doubleSend = 0, lastWasSend = false;
    for (let i = 0; i < 60 && me()?.combatState; i++) {
        if (attacker.onState(me().combatState)) {
            if (lastWasSend) doubleSend += 1;   // deux envois sans riposte entre les deux
            send('combat_action', { type: 'attack' });
            sent += 1;
            lastWasSend = true;
        } else if (me().combatState.turn !== 'player') {
            lastWasSend = false;
        }
        await sleep(220);
    }
    if (sent > 0) ok(`${sent} attaque(s) envoyée(s)`);
    else fail("aucune attaque n'a pu être envoyée");
    if (!me()?.combatState) ok("l'ennemi a été vaincu, le combat s'est fermé seul");
    else if (me().combatState.enemy.currentHealth < enemyStart) ok(`vitalité ennemie ${enemyStart} → ${me().combatState.enemy.currentHealth}`);
    else fail("les attaques n'ont rien fait");
    if (doubleSend === 0) ok('jamais deux attaques pour un même tour');
    else fail('attaques doublées', `${doubleSend} fois`);

    // --- 3. Le déplacement redevient possible une fois libre ----------------
    console.log('\n== Après le combat ==');
    if (!me().combatState) {
        const p0 = { x: me().x, y: me().y };
        for (let i = 0; i < 8 && me().x === p0.x && me().y === p0.y; i++) {
            const dir = stepToward(p0.x + 2, p0.y) || stepToward(p0.x, p0.y + 2);
            if (!dir) break;
            send('move', { direction: dir });
            await sleep(300);
        }
        if (me().x !== p0.x || me().y !== p0.y) ok('le déplacement redevient possible après le combat');
        else fail('le joueur reste bloqué après la fin du combat');
    } else {
        console.log('  --  combat toujours en cours, déplacement non testé');
    }

} catch (err) {
    fail('exécution', err.message);
} finally {
    ws.close();
}

console.log(failures === 0
    ? '\nLe combat tient ses nouvelles règles.\n'
    : `\n${failures} test(s) en échec.\n`);
process.exit(failures === 0 ? 0 : 1);
