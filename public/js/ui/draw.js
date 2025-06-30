// js/ui/draw.js
import { TILE_TYPES, CONFIG } from '../config.js';
import DOM from './dom.js';

const loadedAssets = {};

const TILE_ICONS = { // Utilisé comme fallback si tile.type.icon n'est pas défini
    'Lagon': '🌊', 'Plage': '🏖️', 'Forêt': '🌲', 'Friche': '🍂',
    'Plaine': '🌳', 'Mine': '⛰️', 'Feu de Camp': '🔥', // #29 Gisement de Pierre -> Mine (terrain)
    'Abri Individuel': '⛺', 'Abri Collectif': '🏠', 'Mine (Bâtiment)': '⛏️🏭', // #29 Renamed Mine building
    // Trésor Caché utilise déjà TILE_TYPES.TREASURE_CHEST.icon
    'default': '❓'
};

export function loadAssets(paths) {
    const promises = Object.entries(paths).map(([key, src]) => new Promise((resolve, reject) => {
        const img = new Image();
        img.src = src + '?v=' + new Date().getTime(); // Cache busting for development
        img.onload = () => {
            loadedAssets[key] = img;
            resolve();
        };
        img.onerror = (err) => {
            console.error(`Failed to load ${key} from ${src}:`, err);
            reject(new Error(`Failed to load ${src}: ${err}`));
        };
    }));
    return Promise.all(promises);
}

export function drawMainBackground(gameState) {
    const { mainViewCtx, mainViewCanvas } = DOM;
    if (!mainViewCtx || !mainViewCanvas) {
        // console.error("[draw.js] drawMainBackground: Canvas context or element not found!"); // Removed to reduce console noise
        return;
    }

    if (!gameState || !gameState.player || !gameState.map ||
        !gameState.map[gameState.player.y] || !gameState.map[gameState.player.y][gameState.player.x]) {
        mainViewCtx.fillStyle = 'grey';
        mainViewCtx.fillRect(0, 0, mainViewCanvas.width, mainViewCanvas.height);
        mainViewCtx.fillStyle = 'white';
        mainViewCtx.fillText("Données de jeu manquantes pour le fond", 20, 40);
        return;
    }

    const playerTile = gameState.map[gameState.player.y][gameState.player.x];
    const backgroundKey = playerTile.backgroundKey;
    const imageToDraw = loadedAssets[backgroundKey];

    mainViewCtx.fillStyle = 'black'; // Fond noir par défaut
    mainViewCtx.fillRect(0, 0, mainViewCanvas.width, mainViewCanvas.height);

    if (imageToDraw) {
        if (imageToDraw.complete && imageToDraw.naturalWidth > 0 && imageToDraw.naturalHeight > 0) {
            const canvasAspect = mainViewCanvas.width / mainViewCanvas.height;
            const imageAspect = imageToDraw.naturalWidth / imageToDraw.naturalHeight; // Should be 1408 / 768
            let sx = 0, sy = 0, sWidth = imageToDraw.naturalWidth, sHeight = imageToDraw.naturalHeight;

            // Ajout de l'animation de balancement
            const sway = Math.sin(Date.now() / 2000) * 10; // Mouvement de balancement lent

            // Calcul pour rogner l'image et remplir le canvas en gardant l'aspect ratio (cover)
            if (imageAspect > canvasAspect) { // Image plus large que le canvas (relativement)
                sHeight = imageToDraw.naturalHeight;
                sWidth = sHeight * canvasAspect;
                sx = (imageToDraw.naturalWidth - sWidth) / 2 + sway;
            } else if (imageAspect < canvasAspect) { // Image plus haute que le canvas (relativement)
                sWidth = imageToDraw.naturalWidth;
                sHeight = sWidth / canvasAspect;
                sy = (imageToDraw.naturalHeight - sHeight) / 2 + sway;
            }
            mainViewCtx.drawImage(imageToDraw, sx, sy, sWidth, sHeight, 0, 0, mainViewCanvas.width, mainViewCanvas.height);
        } else {
            // L'image n'est pas encore chargée ou a des dimensions invalides
            mainViewCtx.fillStyle = '#333'; // Couleur de secours si l'image n'est pas prête
            mainViewCtx.fillRect(0, 0, mainViewCanvas.width, mainViewCanvas.height);
        }
    } else {
        // Point 5: Si Bois (Forêt) ou Pierre (Gisement de Pierre) n'ont pas d'image de fond, afficher une couleur
        // Cette logique est déjà dans config.js pour TILE_TYPES.FOREST.color et TILE_TYPES.MINE_TERRAIN.color (anciennement STONE_DEPOSIT)
        // On utilise la couleur définie dans TILE_TYPES si backgroundKey est manquant
        let fallbackColor = playerTile.type.color || '#222'; // Couleur par défaut si aucune image et aucune couleur de tuile
        mainViewCtx.fillStyle = fallbackColor;
        mainViewCtx.fillRect(0, 0, mainViewCanvas.width, mainViewCanvas.height);
    }
}

function drawCharacter(ctx, character, x, y, isPlayer = false, animationProgress = 0) {
    const headRadius = 15;
    const bodyWidth = 28;
    const bodyHeight = 40;
    const legHeight = 20;
    const legWidth = 10;
    const armWidth = 8;
    const armHeight = 38;

    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 3;
    ctx.fillStyle = character.color;

    // Animation de marche
    const walkCycle = Math.sin(animationProgress * Math.PI * 2); // Cycle de -1 à 1
    const legOffset = walkCycle * 5;
    const armOffset = walkCycle * 4;

    // Position de base
    const bodyTopY = y - bodyHeight / 2;
    const bodyBottomY = y + bodyHeight / 2;

    // Bras (derrière le corps)
    ctx.fillStyle = '#d2b48c'; // Couleur peau
    // Bras gauche
    ctx.beginPath();
    ctx.ellipse(x - bodyWidth / 2 + armWidth / 2, bodyTopY + armHeight / 2, armWidth / 2, armHeight / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Bras droit
    ctx.beginPath();
    ctx.ellipse(x + bodyWidth / 2 - armWidth / 2, bodyTopY + armHeight / 2, armWidth / 2, armHeight / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();


    // Jambes
    ctx.fillStyle = '#5a3a22'; // Couleur pantalon
    // Jambe gauche
    ctx.beginPath();
    ctx.ellipse(x - bodyWidth / 4, bodyBottomY + legHeight / 2 - legOffset, legWidth / 2, legHeight / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Jambe droite
    ctx.beginPath();
    ctx.ellipse(x + bodyWidth / 4, bodyBottomY + legHeight / 2 + legOffset, legWidth / 2, legHeight / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Corps
    ctx.fillStyle = character.color;
    ctx.beginPath();
    ctx.ellipse(x, bodyTopY + bodyHeight / 2, bodyWidth / 2, bodyHeight / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Tête
    ctx.fillStyle = '#d2b48c'; // Couleur peau
    ctx.beginPath();
    ctx.arc(x, bodyTopY - headRadius + 5, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Yeux
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(x - 5, bodyTopY - headRadius + 3, 3, 0, Math.PI * 2); // Oeil gauche
    ctx.arc(x + 5, bodyTopY - headRadius + 3, 3, 0, Math.PI * 2); // Oeil droit
    ctx.fill();
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(x - 5, bodyTopY - headRadius + 3, 1.5, 0, Math.PI * 2); // Pupille gauche
    ctx.arc(x + 5, bodyTopY - headRadius + 3, 1.5, 0, Math.PI * 2); // Pupille droite
    ctx.fill();

    // Display chat message above head
    if (character.chatMessage && (Date.now() - character.chatMessage.timestamp < 5000)) { // Display for 5 seconds
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.font = '14px Poppins';
        const text = character.chatMessage.text;
        const textWidth = ctx.measureText(text).width;
        const bubbleX = x - textWidth / 2 - 10;
        const bubbleY = y - bodyHeight - 40;
        const bubbleWidth = textWidth + 20;
        const bubbleHeight = 25;

        // Bubble
        ctx.beginPath();
        ctx.moveTo(bubbleX + 10, bubbleY);
        ctx.lineTo(bubbleX + bubbleWidth - 10, bubbleY);
        ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY, bubbleX + bubbleWidth, bubbleY + 10);
        ctx.lineTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight - 10);
        ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight, bubbleX + bubbleWidth - 10, bubbleY + bubbleHeight);
        ctx.lineTo(bubbleX + 10, bubbleY + bubbleHeight);
        ctx.quadraticCurveTo(bubbleX, bubbleY + bubbleHeight, bubbleX, bubbleY + bubbleHeight - 10);
        ctx.lineTo(bubbleX, bubbleY + 10);
        ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + 10, bubbleY);
        ctx.closePath();
        ctx.fill();

        // Pointer
        ctx.beginPath();
        ctx.moveTo(x - 5, bubbleY + bubbleHeight + 5);
        ctx.lineTo(x, bubbleY + bubbleHeight -1);
        ctx.lineTo(x + 5, bubbleY + bubbleHeight + 5);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, bubbleY + bubbleHeight / 2 + 2);
    }

    ctx.restore();
}


export function drawSceneCharacters(gameState) {
    if (!gameState || !gameState.player) return;
    const { player, npcs, enemies, map } = gameState;
    const { charactersCtx, charactersCanvas } = DOM;
    if (!charactersCtx || !charactersCanvas) return;

    charactersCtx.clearRect(0, 0, charactersCanvas.width, charactersCanvas.height);
    const canvasWidth = charactersCanvas.width;
    const canvasHeight = charactersCanvas.height;

    // Position de base du joueur (plus bas sur l'écran)
    const playerBaseX = canvasWidth / 2;
    const playerBaseY = canvasHeight * 0.70; // Ajusté pour être plus bas

    const charactersOnTile = [];
    // Ajouter le joueur
    charactersOnTile.push({ char: player, x: playerBaseX, y: playerBaseY, isPlayer: true, sortOrder: 1 }); // Joueur au premier plan (sortOrder plus élevé)

    // Ajouter les autres joueurs sur la même tuile
    for (const playerId in gameState.players) {
        if (playerId !== player.id) {
            const otherPlayer = gameState.players[playerId];
            if (otherPlayer.x === player.x && otherPlayer.y === player.y) {
                const sideOffset = (charactersOnTile.length % 2 === 0) ? -1 : 1; // Alterner gauche/droite
                const distanceOffset = 150 + (Math.floor(charactersOnTile.length / 2) * 50);
                const offsetX = sideOffset * distanceOffset;
                charactersOnTile.push({ char: otherPlayer, x: playerBaseX + offsetX, y: playerBaseY, isPlayer: false, sortOrder: 0 });
            }
        }
    }

    // Ajouter les PNJ visibles sur la même tuile
    const visibleNpcs = npcs.filter(npc => npc.x === player.x && npc.y === player.y);
    visibleNpcs.forEach((npc, index) => {
        const sideOffset = (index % 2 === 0) ? -1 : 1; // Alterner gauche/droite
        const distanceOffset = 100 + (Math.floor(index / 2) * 40); // Éloignement progressif
        const offsetX = sideOffset * distanceOffset;
        charactersOnTile.push({ char: npc, x: playerBaseX + offsetX, y: playerBaseY, isPlayer: false, sortOrder: 0 }); // PNJ derrière le joueur
    });

    // Trier les personnages pour le dessin (le joueur sera dessiné en dernier s'il a le sortOrder le plus élevé)
    charactersOnTile.sort((a, b) => a.sortOrder - b.sortOrder);

    // Gérer l'animation de transition du joueur
    if (player.animationState) {
        const { type, direction, progress } = player.animationState;
        const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const easedProgress = easeInOutCubic(progress);

        charactersOnTile.forEach(p => {
            let modX = 0, modY = 0;
            // Distance de déplacement pour l'animation (plus grande pour le joueur)
            let distanceFactor = p.isPlayer ? 1 : 0.9; // Les PNJ bougent un peu moins
            let baseDistance = (canvasWidth / 2) + (p.char.bodyWidth || 30) + 20; // Distance pour sortir de l'écran

            if (type === 'out') { // Animation de sortie
                let distance = baseDistance * easedProgress * distanceFactor;
                if(direction === 'east') modX = distance;
                else if(direction === 'west') modX = -distance;
                else if(direction === 'south') modY = distance;
                else if(direction === 'north') modY = -distance;
                charactersCtx.globalAlpha = 1 - easedProgress; // Fade out
            } else { // Animation d'entrée (type === 'in')
                let distance = baseDistance * (1 - easedProgress) * distanceFactor; // Commence loin et se rapproche
                if(direction === 'east') modX = -distance; // Vient de la droite
                else if(direction === 'west') modX = distance;  // Vient de la gauche
                else if(direction === 'south') modY = -distance; // Vient du bas
                else if(direction === 'north') modY = distance;  // Vient du haut
                charactersCtx.globalAlpha = easedProgress; // Fade in
            }
            drawCharacter(charactersCtx, p.char, p.x + modX, p.y + modY, p.isPlayer, progress);
        });
        charactersCtx.globalAlpha = 1; // Réinitialiser l'alpha
    } else {
        // Dessiner les personnages normalement si pas d'animation
        charactersOnTile.forEach(p => {
            const animProgress = p.isPlayer ? player.animationProgress || 0 : 0;
            drawCharacter(charactersCtx, p.char, p.x, p.y, p.isPlayer, animProgress);
        });
    }

    // Dessiner les ennemis (simplifié, comme un "sprite" de texte)
    const visibleEnemies = enemies.filter(e => e.x === player.x && e.y === player.y && !gameState.combatState); // Ne pas afficher si en combat
    if (visibleEnemies.length > 0) {
        const enemy = visibleEnemies[0]; // Afficher le premier ennemi sur la tuile
        const enemyX = canvasWidth / 2; // Centré
        const enemyY = canvasHeight * 0.30; // Plus haut sur l'écran
        charactersCtx.save();
        charactersCtx.fillStyle = enemy.color || '#ff0000';
        charactersCtx.font = "70px sans-serif"; // Grande taille pour l'icône
        charactersCtx.textAlign = 'center';
        charactersCtx.textBaseline = 'middle';
        charactersCtx.fillText(enemy.icon || '❓', enemyX, enemyY);
        charactersCtx.restore();
    }

    // Afficher les quantités de ressources restantes sur le côté droit de l'image
    if (map && map[player.y] && map[player.y][player.x]) {
        const currentTile = map[player.y][player.x];
        let resources = [];
        if (currentTile.type.name === TILE_TYPES.FOREST.name) {
            resources.push({ icon: '🌲', count: currentTile.woodActionsLeft || 0, label: 'Bois' });
            resources.push({ icon: '🦊', count: currentTile.huntActionsLeft || 0, label: 'Chasse' });
            resources.push({ icon: '🔍', count: currentTile.searchActionsLeft || 0, label: 'Fouille' });
        } else if (currentTile.type.name === TILE_TYPES.PLAINS.name) {
            resources.push({ icon: '🦊', count: currentTile.huntActionsLeft || 0, label: 'Chasse' });
            resources.push({ icon: '🔍', count: currentTile.searchActionsLeft || 0, label: 'Fouille' });
        } else if (currentTile.type.name === TILE_TYPES.MINE_TERRAIN.name) {
            resources.push({ icon: '⛰️', count: currentTile.harvestsLeft || 0, label: 'Pierre' });
        } else if (currentTile.type.name === TILE_TYPES.PLAGE.name && currentTile.actionsLeft) {
            resources.push({ icon: '🔍', count: currentTile.actionsLeft.search_zone || 0, label: 'Fouilles' });
            resources.push({ icon: '🏖️', count: currentTile.actionsLeft.harvest_sand || 0, label: 'Sable' });
            resources.push({ icon: '🎣', count: currentTile.actionsLeft.fish || 0, label: 'Pêche' });
            resources.push({ icon: '💧', count: currentTile.actionsLeft.harvest_salt_water || 0, label: 'Eau salée' });
        } else if (currentTile.buildings && currentTile.buildings.length > 0 && TILE_TYPES[currentTile.buildings[0].key]?.maxHarvestsPerCycle) {
            const building = currentTile.buildings[0];
            resources.push({ icon: '🔨', count: building.harvestsAvailable || 0, label: 'Récoltes' });
        }

        if (resources.length > 0) {
            const resourceX = canvasWidth - 100; // Position sur le côté droit
            const resourceStartY = 30; // Début en haut à droite
            const resourceHeight = 30; // Hauteur par ressource
            charactersCtx.save();
            resources.forEach((res, index) => {
                const yPos = resourceStartY + index * resourceHeight;
                charactersCtx.fillStyle = 'rgba(0, 0, 0, 0.3)'; // Fond plus transparent pour la lisibilité
                charactersCtx.fillRect(resourceX - 40, yPos - 15, 80, 30);
                charactersCtx.fillStyle = 'white';
                charactersCtx.font = 'bold 22px sans-serif'; // Texte en gras et plus grand pour meilleure lisibilité
                charactersCtx.textAlign = 'center';
                charactersCtx.textBaseline = 'middle';
                charactersCtx.fillText(`${res.icon} ${res.count}`, resourceX, yPos);
            });
            charactersCtx.restore();
        }
    }
}

export function drawMinimap(gameState, config) {
    if (!gameState || !gameState.map || !gameState.player || !config) {
        // console.error("[draw.js] drawMinimap: Missing critical game data or config."); // Removed to reduce console noise
        return;
    }
    const { map, player, npcs, enemies, globallyRevealedTiles } = gameState;
    const { MAP_WIDTH, MAP_HEIGHT, MINIMAP_DOT_SIZE } = config;
    const { minimapCanvas, minimapCtx } = DOM;
    if(!minimapCtx || !minimapCanvas) {
        // console.error("[draw.js] drawMinimap: Minimap canvas context or element not found!"); // Removed to reduce console noise
        return;
    }

    // Ajuster la taille du canvas de la minimap dynamiquement
    minimapCanvas.width = MAP_WIDTH * MINIMAP_DOT_SIZE;
    minimapCanvas.height = MAP_HEIGHT * MINIMAP_DOT_SIZE;
    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);

    // Dessiner les tuiles
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const tileKey = `${x},${y}`;
            const tile = map[y]?.[x];
            const isWater = tile?.type.name === 'Lagon';
            const isVisible = player.visitedTiles.has(tileKey) || globallyRevealedTiles.has(tileKey) || isWater;

            if (!isVisible) {
                minimapCtx.fillStyle = '#111'; // Non découvert
                minimapCtx.fillRect(x * MINIMAP_DOT_SIZE, y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE);
            } else if (tile && tile.type) {
                minimapCtx.fillStyle = map[y][x].type.color || '#ff00ff'; // Couleur par défaut pour type inconnu
                minimapCtx.fillRect(x * MINIMAP_DOT_SIZE, y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE);
                
                // Ajouter un indicateur pour le nombre total d'actions restantes
                const currentTile = map[y][x];
                let totalActions = 0;
                if (tile.type.name === TILE_TYPES.FOREST.name) {
                    totalActions = (tile.woodActionsLeft || 0) + (tile.huntActionsLeft || 0) + (tile.searchActionsLeft || 0);
                } else if (tile.type.name === TILE_TYPES.PLAINS.name) {
                    totalActions = (tile.huntActionsLeft || 0) + (tile.searchActionsLeft || 0);
                } else if (tile.type.name === TILE_TYPES.MINE_TERRAIN.name) {
                    totalActions = tile.harvestsLeft || 0;
                } else if (tile.type.name === TILE_TYPES.PLAGE.name && tile.actionsLeft) {
                    totalActions = (tile.actionsLeft.search_zone || 0) + (tile.actionsLeft.harvest_sand || 0) + (tile.actionsLeft.fish || 0) + (tile.actionsLeft.harvest_salt_water || 0);
                } else if (tile.buildings && tile.buildings.length > 0 && TILE_TYPES[tile.buildings[0].key]?.maxHarvestsPerCycle) {
                    totalActions = tile.buildings[0].harvestsAvailable || 0;
                }
                
                if (totalActions > 0) {
                    minimapCtx.fillStyle = 'white';
                    minimapCtx.font = `${MINIMAP_DOT_SIZE * 0.6}px sans-serif`;
                    minimapCtx.textAlign = 'right';
                    minimapCtx.textBaseline = 'bottom';
                    minimapCtx.fillText(totalActions, (x + 1) * MINIMAP_DOT_SIZE - 1, (y + 1) * MINIMAP_DOT_SIZE - 1);
                }
            }
        }
    }
    // Grille optionnelle
    minimapCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    minimapCtx.lineWidth = 1;
    for (let x = 0; x <= MAP_WIDTH; x++) { minimapCtx.beginPath(); minimapCtx.moveTo(x * MINIMAP_DOT_SIZE, 0); minimapCtx.lineTo(x * MINIMAP_DOT_SIZE, minimapCanvas.height); minimapCtx.stroke(); }
    for (let y = 0; y <= MAP_HEIGHT; y++) { minimapCtx.beginPath(); minimapCtx.moveTo(0, y * MINIMAP_DOT_SIZE); minimapCtx.lineTo(minimapCanvas.width, y * MINIMAP_DOT_SIZE); minimapCtx.stroke(); }

    // Dessiner les PNJ (points)
    npcs.forEach(npc => {
        const tileKey = `${npc.x},${npc.y}`;
        if (player.visitedTiles.has(tileKey) || globallyRevealedTiles.has(tileKey)) {
            minimapCtx.fillStyle = npc.color;
            minimapCtx.fillRect(npc.x * MINIMAP_DOT_SIZE, npc.y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE);
        }
    });

    // Dessiner les Ennemis (triangles)
    enemies.forEach(enemy => {
        const tileKey = `${enemy.x},${enemy.y}`;
        if (player.visitedTiles.has(tileKey) || globallyRevealedTiles.has(tileKey)) {
            minimapCtx.fillStyle = enemy.color || '#ff0000';
            const ex = enemy.x * MINIMAP_DOT_SIZE;
            const ey = enemy.y * MINIMAP_DOT_SIZE;
            minimapCtx.beginPath();
            minimapCtx.moveTo(ex, ey + MINIMAP_DOT_SIZE);
            minimapCtx.lineTo(ex + MINIMAP_DOT_SIZE / 2, ey);
            minimapCtx.lineTo(ex + MINIMAP_DOT_SIZE, ey + MINIMAP_DOT_SIZE);
            minimapCtx.closePath();
            minimapCtx.fill();
        }
    });

    // Dessiner le camp tile (shelterLocation) avec un contour noir
    if (gameState.shelterLocation) {
        minimapCtx.strokeStyle = 'black';
        minimapCtx.lineWidth = 2;
        minimapCtx.strokeRect(
            gameState.shelterLocation.x * MINIMAP_DOT_SIZE - 1, 
            gameState.shelterLocation.y * MINIMAP_DOT_SIZE - 1, 
            MINIMAP_DOT_SIZE + 2, 
            MINIMAP_DOT_SIZE + 2
        );
    }

    // Dessiner le joueur (carré avec contour)
    minimapCtx.fillStyle = player.color || 'yellow';
    minimapCtx.fillRect(player.x * MINIMAP_DOT_SIZE, player.y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE);
    minimapCtx.strokeStyle = 'white';
    minimapCtx.lineWidth = 2; // Contour plus épais
    minimapCtx.strokeRect(player.x * MINIMAP_DOT_SIZE -1, player.y * MINIMAP_DOT_SIZE -1, MINIMAP_DOT_SIZE + 2, MINIMAP_DOT_SIZE + 2);

    // Dessiner les autres joueurs
    for (const playerId in gameState.players) {
        if (playerId !== player.id) {
            const otherPlayer = gameState.players[playerId];
            const tileKey = `${otherPlayer.x},${otherPlayer.y}`;
            if (player.visitedTiles.has(tileKey) || globallyRevealedTiles.has(tileKey)) {
                minimapCtx.fillStyle = '#4299e1'; // Blue for other players
                minimapCtx.fillRect(otherPlayer.x * MINIMAP_DOT_SIZE, otherPlayer.y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE);
                minimapCtx.strokeStyle = 'black';
                minimapCtx.lineWidth = 1;
                minimapCtx.strokeRect(otherPlayer.x * MINIMAP_DOT_SIZE, otherPlayer.y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE);
            }
        }
    }
}

export function drawLargeMap(gameState, config) {
    if (!gameState || !gameState.map || !gameState.player || !config) return;
    const { map, player, npcs, enemies, globallyRevealedTiles } = gameState;
    const { MAP_WIDTH, MAP_HEIGHT } = config;
    const { largeMapCanvas, largeMapCtx } = DOM;
    if(!largeMapCtx || !largeMapCanvas) return;

    const headerSize = 30; // Espace pour les coordonnées
    const parentWrapper = largeMapCanvas.parentElement; // Le div #large-map-content-wrapper
    if (!parentWrapper) return;

    // Calculer la taille disponible pour le canvas, en tenant compte de la légende
    const legendWidth = DOM.largeMapLegendEl ? DOM.largeMapLegendEl.offsetWidth + 20 : 0; // +20 pour le gap
    const availableWidth = parentWrapper.clientWidth - legendWidth - 40 ; // -40 pour padding du wrapper
    const availableHeight = parentWrapper.clientHeight - 40; // -40 pour padding du wrapper

    let canvasSize = Math.min(availableWidth, availableHeight);
    canvasSize = Math.max(canvasSize, 200); // Taille minimale

    largeMapCanvas.width = canvasSize;
    largeMapCanvas.height = canvasSize;
    const cellSize = (canvasSize - headerSize) / Math.max(MAP_WIDTH, MAP_HEIGHT); // Cellules carrées

    largeMapCtx.clearRect(0, 0, largeMapCanvas.width, largeMapCanvas.height);
    largeMapCtx.fillStyle = '#1d3557'; // Fond bleu foncé
    largeMapCtx.fillRect(0, 0, largeMapCanvas.width, largeMapCanvas.height);

    // Dessiner les tuiles
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const tileKey = `${x},${y}`;
            const drawX = headerSize + x * cellSize;
            const drawY = headerSize + y * cellSize;

            const tile = map[y]?.[x];
            const isWater = tile?.type.name === 'Lagon';
            const isVisible = player.visitedTiles.has(tileKey) || globallyRevealedTiles.has(tileKey) || isWater;

            if (!isVisible) {
                largeMapCtx.fillStyle = '#000'; // Non découvert
                largeMapCtx.fillRect(drawX, drawY, cellSize, cellSize);
                continue;
            }

            if (!map[y] || !map[y][x] || !map[y][x].type) continue;
            const currentTile = map[y][x];
            largeMapCtx.fillStyle = tile.type.color || '#ff00ff';
            largeMapCtx.fillRect(drawX, drawY, cellSize, cellSize);

            // Utiliser tile.type.icon si disponible, sinon TILE_ICONS comme fallback
            const icon = tile.type.icon || TILE_ICONS[tile.type.name] || TILE_ICONS.default;
            largeMapCtx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // Ombre pour l'icône
            largeMapCtx.font = `bold ${cellSize * 0.6}px Poppins`;
            largeMapCtx.textAlign = 'center';
            largeMapCtx.textBaseline = 'middle';
            let iconOffsetY = 0; // Ajustement vertical pour certains emojis
            if (icon === '💎' || icon === '🌊' || icon === '🏖️' || icon === '🍂' || icon === '🔥' || icon === '⛏️' || icon === '⛺' || icon === '🏠' || icon === '🌲' || icon === '⛰️' || icon === '🌳' || icon === '⛏️🏭') { // Added Mine Building
                iconOffsetY = cellSize * 0.05;
            }
            largeMapCtx.fillText(icon, drawX + cellSize / 2, drawY + cellSize / 2 + iconOffsetY);
            
            // Ajouter un indicateur pour le nombre total d'actions restantes
            let totalActions = 0;
            if (tile.type.name === TILE_TYPES.FOREST.name) {
                totalActions = (tile.woodActionsLeft || 0) + (tile.huntActionsLeft || 0) + (tile.searchActionsLeft || 0);
            } else if (tile.type.name === TILE_TYPES.PLAINS.name) {
                totalActions = (tile.huntActionsLeft || 0) + (tile.searchActionsLeft || 0);
            } else if (tile.type.name === TILE_TYPES.MINE_TERRAIN.name) {
                totalActions = tile.harvestsLeft || 0;
            } else if (tile.type.name === TILE_TYPES.PLAGE.name && tile.actionsLeft) {
                totalActions = (tile.actionsLeft.search_zone || 0) + (tile.actionsLeft.harvest_sand || 0) + (tile.actionsLeft.fish || 0) + (tile.actionsLeft.harvest_salt_water || 0);
            } else if (tile.buildings && tile.buildings.length > 0 && TILE_TYPES[tile.buildings[0].key]?.maxHarvestsPerCycle) {
                totalActions = tile.buildings[0].harvestsAvailable || 0;
            }
            
            if (totalActions > 0) {
                largeMapCtx.fillStyle = 'white';
                largeMapCtx.font = `${cellSize * 0.3}px Poppins`;
                largeMapCtx.textAlign = 'right';
                largeMapCtx.textBaseline = 'bottom';
                largeMapCtx.fillText(totalActions, drawX + cellSize - 2, drawY + cellSize - 2);
            }
        }
    }

    // Dessiner la grille et les coordonnées
    largeMapCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    largeMapCtx.lineWidth = 1;
    largeMapCtx.fillStyle = '#f1faee'; // Couleur pour les textes des coordonnées
    largeMapCtx.font = `600 ${Math.min(14, headerSize * 0.5)}px Poppins`; // Taille de police pour les coordonnées
    largeMapCtx.textAlign = 'center';
    largeMapCtx.textBaseline = 'middle';

    for (let i = 0; i < MAP_WIDTH; i++) {
        const xCoordText = headerSize + (i + 0.5) * cellSize;
        largeMapCtx.fillText(i, xCoordText, headerSize / 2); // Coordonnées X en haut
        const lineX = headerSize + i * cellSize;
        if (i > 0) { // Ne pas dessiner la première ligne verticale à gauche
            largeMapCtx.beginPath(); largeMapCtx.moveTo(lineX, headerSize); largeMapCtx.lineTo(lineX, headerSize + MAP_HEIGHT * cellSize); largeMapCtx.stroke();
        }
    }
    for (let i = 0; i < MAP_HEIGHT; i++) {
        const yCoordText = headerSize + (i + 0.5) * cellSize;
        largeMapCtx.fillText(i, headerSize / 2, yCoordText); // Coordonnées Y à gauche
        const lineY = headerSize + i * cellSize;
        if (i > 0) { // Ne pas dessiner la première ligne horizontale en haut
            largeMapCtx.beginPath(); largeMapCtx.moveTo(headerSize, lineY); largeMapCtx.lineTo(headerSize + MAP_WIDTH * cellSize, lineY); largeMapCtx.stroke();
        }
    }
    // Contour de la carte
    largeMapCtx.strokeRect(headerSize, headerSize, MAP_WIDTH * cellSize, MAP_HEIGHT * cellSize);

    // Dessiner les PNJ (cercles)
    npcs.forEach(npc => {
        const tileKey = `${npc.x},${npc.y}`;
        if (player.visitedTiles.has(tileKey) || globallyRevealedTiles.has(tileKey)) {
            const drawX = headerSize + npc.x * cellSize + cellSize / 2;
            const drawY = headerSize + npc.y * cellSize + cellSize / 2;
            largeMapCtx.fillStyle = npc.color;
            largeMapCtx.beginPath(); largeMapCtx.arc(drawX, drawY, cellSize * 0.35, 0, Math.PI * 2); largeMapCtx.fill();
        }
    });

    // Dessiner les Ennemis (icônes)
    enemies.forEach(enemy => {
        const tileKey = `${enemy.x},${enemy.y}`;
        if (player.visitedTiles.has(tileKey) || globallyRevealedTiles.has(tileKey)) {
            const drawX = headerSize + enemy.x * cellSize + cellSize / 2;
            const drawY = headerSize + enemy.y * cellSize + cellSize / 2;
            largeMapCtx.fillStyle = enemy.color || '#ff0000';
            largeMapCtx.font = `bold ${cellSize * 0.7}px Poppins`; // Icône plus grande pour les ennemis
            largeMapCtx.textAlign = 'center';
            largeMapCtx.textBaseline = 'middle';
            largeMapCtx.fillText(enemy.icon || '❓', drawX, drawY);
        }
    });

    // Dessiner le joueur (cercle avec contour)
    const playerDrawX = headerSize + player.x * cellSize + cellSize / 2;
    const playerDrawY = headerSize + player.y * cellSize + cellSize / 2;
    largeMapCtx.fillStyle = player.color;
    largeMapCtx.beginPath(); largeMapCtx.arc(playerDrawX, playerDrawY, cellSize * 0.4, 0, Math.PI * 2); largeMapCtx.fill();
    largeMapCtx.strokeStyle = 'white';
    largeMapCtx.lineWidth = 3; // Contour plus épais
    largeMapCtx.stroke();

    // Dessiner les autres joueurs
    for (const playerId in gameState.players) {
        if (playerId !== player.id) {
            const otherPlayer = gameState.players[playerId];
            const tileKey = `${otherPlayer.x},${otherPlayer.y}`;
            if (player.visitedTiles.has(tileKey) || globallyRevealedTiles.has(tileKey)) {
                const otherPlayerDrawX = headerSize + otherPlayer.x * cellSize + cellSize / 2;
                const otherPlayerDrawY = headerSize + otherPlayer.y * cellSize + cellSize / 2;
                largeMapCtx.fillStyle = '#4299e1'; // Blue for other players
                largeMapCtx.beginPath();
                largeMapCtx.arc(otherPlayerDrawX, otherPlayerDrawY, cellSize * 0.35, 0, Math.PI * 2);
                largeMapCtx.fill();
                largeMapCtx.strokeStyle = 'black';
                largeMapCtx.lineWidth = 2;
                largeMapCtx.stroke();
            }
        }
    }
}


export function populateLargeMapLegend() {
    const { largeMapLegendEl } = DOM;
    if(!largeMapLegendEl) return;

    largeMapLegendEl.innerHTML = '<h3>Légende</h3>';
    const addedTypes = new Set(); // Pour éviter les doublons dans la légende

    // Ajouter les types de tuiles depuis TILE_TYPES
    for (const tileKey in TILE_TYPES) {
        const tileType = TILE_TYPES[tileKey];
        if (!addedTypes.has(tileType.name)) { // Si le nom du type n'a pas encore été ajouté
            const item = document.createElement('div');
            item.className = 'legend-item';
            // Utiliser tile.type.icon si disponible, sinon TILE_ICONS comme fallback
            const icon = tileType.icon || TILE_ICONS[tileType.name] || TILE_ICONS.default;
            item.innerHTML = `<div class="legend-color-box" style="background-color: ${tileType.color};"></div><span>${icon} ${tileType.name}</span>`;
            largeMapLegendEl.appendChild(item);
            addedTypes.add(tileType.name); // Marquer ce nom de type comme ajouté
        }
    }
    // Séparateur
    largeMapLegendEl.insertAdjacentHTML('beforeend', '<hr style="border-color: rgba(255,255,255,0.1); margin: 10px 0;">');
    // Entités
    const playerItem = document.createElement('div');
    playerItem.className = 'legend-item';
    playerItem.innerHTML = `<div class="legend-color-box legend-character-icon" style="color: #ffd700;">●</div><span>Vous</span>`; // Utiliser un rond pour le joueur
    largeMapLegendEl.appendChild(playerItem);

    const npcItem = document.createElement('div');
    npcItem.className = 'legend-item';
    npcItem.innerHTML = `<div class="legend-color-box legend-character-icon" style="color: #ff6347;">●</div><span>Survivants (PNJ)</span>`; // Utiliser un rond pour les PNJ
    largeMapLegendEl.appendChild(npcItem);

    const enemyItem = document.createElement('div');
    enemyItem.className = 'legend-item';
    enemyItem.innerHTML = `<div class="legend-color-box legend-character-icon" style="color: #dc2626;">▲</div><span>Ennemis</span>`; // Utiliser un triangle pour les ennemis
    largeMapLegendEl.appendChild(enemyItem);

    const unknownItem = document.createElement('div'); // Tuile non découverte
    unknownItem.className = 'legend-item';
    unknownItem.innerHTML = `<div class="legend-color-box" style="background-color: #000;"></div><span>Non découvert</span>`;
    largeMapLegendEl.appendChild(unknownItem);
}
