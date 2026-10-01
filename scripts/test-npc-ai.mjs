// Test headless de l'IA des PNJ : récolte de ressources + construction.
// Usage : node scripts/test-npc-ai.mjs
import { CONFIG } from '../public/js/config.js';
import { initializeGameState, gameState } from '../server/state.js';
import { updateNpcs } from '../server/npc.js';

initializeGameState(CONFIG);

// On retire les ennemis pour tester la logique de travail sans interruptions.
gameState.enemies = [];

const TICK = CONFIG.NPC_ACTION_INTERVAL_MS;
const HOURS_SIMULATED = 1.5; // ~1800 ticks de 3s
const totalTicks = Math.round((HOURS_SIMULATED * 3600 * 1000) / TICK);

let buildEvents = [];
for (let t = 0; t < totalTicks; t++) {
    updateNpcs(TICK);
    for (const row of gameState.map) {
        for (const tile of row) {
            for (const b of tile.buildings || []) {
                if (b.builtByNpc && !b._seen) {
                    b._seen = true;
                    buildEvents.push({ tick: t, key: b.key, by: b.ownerName, x: tile.x ?? '?', y: tile.y ?? '?' });
                }
            }
        }
    }
}

console.log('--- État final des PNJ ---');
for (const npc of gameState.npcs) {
    console.log(`${npc.name} @(${npc.x},${npc.y}) goal=${npc.goal} projet=${npc.project || '—'} inv=${JSON.stringify(npc.inventory)} activité="${npc.activity}" constructions=${npc.buildingsBuilt || 0}`);
}

console.log('\n--- Constructions réalisées par les PNJ ---');
buildEvents.forEach(e => console.log(`tick ${e.tick} (~${Math.round(e.tick * TICK / 60000)} min) : ${e.by} a bâti ${e.key} en (${e.x}, ${e.y})`));

const gathered = gameState.npcs.some(n => Object.keys(n.inventory).length > 0) || buildEvents.length > 0;
if (!gathered) {
    console.error('\n❌ ÉCHEC : aucun PNJ n\'a récolté de ressources ni construit.');
    process.exit(1);
}
if (buildEvents.length === 0) {
    console.error('\n❌ ÉCHEC : aucune construction PNJ après la simulation.');
    process.exit(1);
}
console.log(`\n✅ OK : ${buildEvents.length} bâtiment(s) construit(s) par les PNJ, IA fonctionnelle.`);
