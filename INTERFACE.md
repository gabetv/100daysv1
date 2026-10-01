# Interface — adaptation d'écran, minuteurs et interactions de scène

Ce document décrit les quatre briques ajoutées à la couche d'interface et la
façon de les faire évoluer.

---

## 1. Adaptation à la résolution — `public/js/ui/viewport.js` + `public/responsive.css`

Le problème corrigé : entre 900 px et ~1180 px de large, l'ancienne grille à
trois colonnes réclamait plus de place que l'écran n'en offrait (la scène
tombait sous 400 px) ; sous 760 px de haut, la barre basse figée à 142 px
étouffait la scène.

Deux contraintes sont désormais mesurées **séparément** et exposées sur
`<html>` :

| Attribut | Valeur | Déclenché par | Effet |
| --- | --- | --- | --- |
| `data-shell` | `full` / `compact` / `mobile` | synthèse des deux suivantes | sélecteur général |
| `data-narrow` | `on` sous 1180 px de large | largeur | 2 colonnes, le panneau **Statut** devient un tiroir |
| `data-short` | `on` sous 760 px de haut | hauteur | la barre basse devient un **dock à onglets** |
| `data-density` | `xs`…`xl` | largeur | réglages fins |
| `data-vheight` | `tiny`…`tall` | hauteur | masque le superflu du HUD |
| `--ui-scale` | 0.88 → 1.10 | min(l/1440, h/900) | pilote `font-size` de `<html>`, plancher 14 px |

Un 1280×720 garde donc ses trois colonnes mais gagne un dock compact ; un
960×900 passe en deux colonnes mais conserve sa barre basse complète.

**Commandes** (dans le HUD en haut à gauche, jamais au-dessus des flèches) :

- **Statut** — ouvre/ferme le tiroir (visible seulement si `data-narrow=on`) ;
- **Dock** — replie la barre basse (visible seulement si `data-short=on`) ;
- **Focus** — masque les panneaux latéraux et la barre basse (touche `F`).

Les préférences *focus*, *dock ouvert* et *onglet du dock* sont mémorisées dans
`localStorage` sous la clé `shellPreferences`.

Dès que le panneau Statut n'est plus affiché en permanence (tiroir ou focus),
les quatre jauges de survie remontent sur la scène : l'information n'est jamais
perdue, seulement déplacée.

### Mode d'affichage : Auto / Mobile / PC

Un réglage persistant (bouton **Auto / Mobile / PC** dans la carte Jour du HUD,
à côté du son) permet d'afficher la version mobile sur PC — ou l'inverse sur
une machine tactile. Mémorisé dans `localStorage` sous la clé `layoutMode` :

- **Auto** — la coquille suit l'écran (mobile ≤ 900 px ou tactile ≤ 1100 px) ;
- **Mobile** — la coquille mobile (barre d'onglets, feuilles, d-pad) s'applique
  partout, y compris sur un grand écran de bureau. Le rendu de la scène garde
  le cadrage verrouillé 412 px des téléphones mais son échelle est relevée
  pour rester nette sur une grande dalle ;
- **PC** — la coquille bureau est forcée même sur écran tactile étroit.

Techniquement, `js/ui/layout-mode.js` est la seule source de vérité
(`isMobileActive()`) et réécrit le `mediaText` des blocs `@media` de la
coquille mobile (`all` / `not all` / texte d'origine) : aucune règle CSS n'est
dupliquée.

### Rien ne se masque plus

Les informations du joueur et du lieu restent affichées dans toutes les
coquilles : carte « Vous êtes ici » (nom de la case, biome, position,
description), niveau et barre d'XP, nombre de survivants, minuteurs complets
(légende incluse), valeurs chiffrées des jauges de survie. Seuls les indices
de saisie (`#controls-hint`) et, sous 460 px de haut en paysage, la longue
description du lieu restent retirés.

> **Règle à respecter** : tout nouveau panneau doit poser `min-width: 0` dans la
> grille, sans quoi il repousse la scène hors de l'écran.

---

## 2. Décompte de la journée — `public/js/ui/daytimer.js`

### Contrat serveur

`gameState` transporte trois champs (voir `server/state.js` et `server.js`) :

| Champ | Rôle |
| --- | --- |
| `dayStartedAt` | horodatage serveur du début du jour courant |
| `dayDurationMs` | `CONFIG.DAY_DURATION_MS` (120 000 ms) |
| `serverNow` | horodatage serveur de l'envoi, pour corriger l'horloge du client |

Le changement de jour est planifié par un `setTimeout` replanifié
(`scheduleNextDay()`), et non par un `setInterval` figé : `dayStartedAt`
correspond donc toujours à la vraie prochaine échéance, y compris après un
`restart_game` ou une restauration de sauvegarde.

### Affichage

`atmosphere.js` expose la source de vérité du découpage :

```js
DAY_PHASES = [
  { id: 'aube',       from: 0,    to: 0.12, sheetFrame: 0 },
  { id: 'jour',       from: 0.12, to: 0.62, sheetFrame: 2 },
  { id: 'crepuscule', from: 0.62, to: 0.80, sheetFrame: 4 },
  { id: 'nuit',       from: 0.80, to: 1,    sheetFrame: 6 },
];
```

Le HUD affiche le temps restant avant le jour suivant (`mm:ss`), le temps
restant avant la phase suivante (« Nuit dans 0:42 ») et une barre segmentée aux
couleurs des quatre moments. Les quinze dernières secondes passent en alerte
(`.is-urgent`, sprite réveil).

Le minuteur bat sur son propre `setInterval` de 150 ms : la boucle de rendu
s'arrête quand une modale est ouverte ou l'onglet masqué, or le temps continue.

---

## 3. Interactions à l'écran — `public/js/ui/hotspots.js`

Chaque élément dessiné enregistre sa zone pendant le rendu :

```
drawMainBackground()  -> beginHotspotFrame()   (nouvelle carte de zones)
  … décors, constructions …   registerHotspot()
drawSceneCharacters() -> … butin, survivants, créatures …
                         commitHotspotFrame() + drawHotspotMarkers()
```

| Type | Priorité | Marqueur | Action |
| --- | --- | --- | --- |
| `enemy` | 5 | `danger` | `initiate_combat` |
| `loot` | 4 | `loot` | `pickup_item_context` |
| `player` / `npc` / `survivor` | 3 | `talk` (PNJ) | fiche, `talk_to_npc`, `pvp_attack` |
| `building` | 2 | `loot` / `build` déduits | action déclarée par `TILE_TYPES` |
| `ground` | −1 | — | première action de fouille/récolte disponible |

À priorité égale, la plus petite zone l'emporte : un objet posé devant une
grande construction reste atteignable.

**Aucune règle de jeu n'est réimplémentée.** Une zone pointe vers une action
déjà présente dans `player.availableActions` et, quand le bouton existe dans le
panneau Actions, c'est **ce bouton** qui est cliqué — les modales de coffre,
d'atelier et de cadenas continuent donc de fonctionner telles quelles.

Entrées : survol souris (réticule + étiquette), clic, et tap tactile court
(moins de 16 px et 520 ms). Le balayage de déplacement exige 55 px : les deux
gestes ne se marchent pas dessus.

---

## 4. Planches pixel art — `scripts/generate_ui_sheets.js`

```bash
npm run generate:ui         # cadres 9-slice et boussole
npm run generate:sheets     # planches + assets/ui/sheets.json
npm run generate:mobile-hud # jauges, actions et onglets mobiles groupés
npm run generate:sprites    # spritesheets de jeu
npm run generate:assets     # tous les assets procéduraux
```

Tout passe par `scripts/lib/pixel-canvas.js` (aucune dépendance, encodeur PNG
maison). Quatre planches sont produites :

| Planche | Grille | Lignes |
| --- | --- | --- |
| `sheet-timer.png` | 32×32, 8 colonnes | `hourglass`, `phase`, `dial`, `urgent` |
| `sheet-interactions.png` | 32×32, 6 colonnes | `focus`, `alert`, `loot`, `danger`, `talk`, `build` |
| `sheet-hud-icons.png` | 24×24, 8×2 | 16 icônes, de `sun` à `layout` |
| `sheet-mobile-hud.png` | 48×48, 8×2 | 4 jauges + 4 actions, puis les 8 onglets mobiles |

La planche mobile est générée par `scripts/generate_mobile_hud_sheet.js` et
accompagnée de `assets/ui/mobile-hud.json`. Elle remplace seize petits fichiers
par une seule requête ; `public/reference-ui.css` choisit chaque cellule avec
`background-position`. La commande dédiée est `npm run generate:mobile-hud` et
elle est incluse dans `npm run generate:assets`.

Les six décors verticaux `mobile-{forest,plains,beach,wasteland,mine,campfire}-backdrop.png`
couvrent les biomes mobiles principaux et le feu de camp. `draw.js` les choisit
uniquement en portrait ; les illustrations 16:9 historiques restent utilisées
sur ordinateur et pour les autres lieux spéciaux.

Côté client, `public/js/ui/sheets.js` lit `UI_SHEETS` et offre
`applySpriteFrame()` (sprite CSS), `applyHudIcon()` / `hydrateHudIcons()`
(attribut `data-hud-icon` dans le HTML) et `drawSheetFrame()` (canvas).

---

## 5. Résolution de la scène — `public/js/ui/resolution.js`

Trois règles, une seule source de vérité. Le module ne dépend d'aucun autre
fichier ; `effects.js` (redimensionnement), `render.js` (mesure) et `draw.js`
(échelle des personnages) s'y réfèrent.

### Mobile : résolution logique verrouillée

Le petit côté de la scène vaut toujours **412 px logiques**, quel que soit le
téléphone. Deux appareils de tailles différentes affichent exactement le même
cadrage ; seule la finesse du rendu change :

| Écran | Échelle d'appareil | Canvas (portrait 390×844) |
| --- | --- | --- |
| 1× (émulateur) | 1 | 412×891 |
| 2× | 2 | 824×1782 |
| 3× (iPhone Pro, Pixel) | 3 | 1236×2673 |

Le canvas est ensuite étiré en CSS pour remplir l'écran. Le mode de mapping
(`image-rendering`) est choisi dynamiquement : `pixelated` quand le canvas
contient moins de pixels que l'écran physique (agrandissement net), `auto`
sinon — un canvas verrouillé étant rarement à un facteur entier de l'écran.

### PC : plein écran, plus de letterbox

L'ancien format imposé 1408/768 laissait des bandes inutilisées dès que la
fenêtre s'écartait du 16:9 (≈ 200 px perdus en hauteur sur un écran 16:9
typique) et le rendu ignorait la densité de l'écran (flou en HiDPI). Désormais :

- le conteneur de scène remplit **toute** la zone disponible (le plafond
  `max-width/max-height` de `style.css` est retiré) ;
- le rendu suit la densité de l'écran, jusqu'à **2×**, avec un budget de
  **12,6 Mpx** pour rester fluide sur les très grandes dalles ;
- ultra-large ou fenêtre haute : la scène s'étire réellement.

### Cadrage « sol verrouillé » — `draw.js`

Un fond carré (mine, feu de camp, abris, trésor, carrières : 1024×1024)
recadré « cover » sur un écran large centre son horizon et perd sa ligne de sol
sous le cadre. `sceneGroundProfile()` (ancres des personnages) et la table
`SCENE_GROUND_LINE` (position du sol dans chaque illustration) permettent à
`paintBackgroundImage()` de résoudre le recadrage pour que **le sol peint
reste à la même hauteur à l'écran**, aligné avec les personnages, du 16:9 à
l'ultra-large. Sur le format historique 1408/768, le calcul retombe à moins
d'un pixel près sur l'ancien cadrage centré (vérifié par test).

Les illustrations peintes profitent aussi d'un lissage adaptatif :
`imageSmoothingEnabled` uniquement à l'agrandissement (rendu propre sur écran
dense), pixels francs en réduction (grain pixel art conservé).

### Qualité adaptative

La boucle de rendu rapporte le coût réel de chaque image dessinée
(`reportFrameCost`). Toutes les 80 images (~2,5 s à 32 fps) :

- P90 > 34 ms → l'échelle de rendu baisse d'un cran (0,25), plancher 0,55 ;
- moyenne < 13 ms pendant 3 fenêtres → elle remonte d'un cran.

Un changement déclenche un redimensionnement immédiat du canvas. La taille
**affichée** des personnages est indépendante de cette échelle :
`characterScaleFor()` applique la formule historique
(`clamp(hauteur/620, 0.75, 1.6)`) à la hauteur « équivalente » d'avant la
refonte (pixels CSS sur PC, ≤ 2× sur mobile), puis la re-projette sur l'échelle
réelle — même rendu qu'avant sur 1×, 2× et 3×.

### Diagnostic

`<html>` expose `data-scene-scale` (échelle de rendu) et `data-scene-locked`
(`on` en mobile). La console affiche chaque changement :
`[scene] 1236×2673 (échelle 3, résolution mobile verrouillée)`.

### Tests

`npm run test:resolution` (strate pure : verrou, budget, qualité adaptative,
cadrage du sol, calibrage des personnages) et
`node scripts/test-scene-shell.mjs` (exécute le vrai `resizeGameView` sur un
mini-DOM : plein écran PC, verrou mobile, réaction à la qualité adaptative).

---

## 6. Actions rapides sur les objets — `public/js/ui/item-actions.js`

Le sac, le coffre et les objets au sol réclama un menu contextuel (clic
droit / appui long) ou un glisser-déposer précis pour chaque geste. Chaque
ligne d'inventaire porte désormais ses actions directement :

| Bouton | Geste | Où |
| --- | --- | --- |
| `✚` Équiper | équipe l'objet d'un clic | fiche Équipement, panneau Sac |
| `🍽` Utiliser | consomme nourriture, soin, parchemin | fiche Équipement (tout le sac), panneau Sac |
| `📥` Déposer | sac → coffre ouvert | modale Coffre |
| `✚` Prendre | coffre → sac | modale Coffre |
| `✚` Ramasser | sol → sac | panneau Objets au sol, butin de la scène |
| `⬇` Poser au sol | sac → case courante | toutes les listes du sac |
| `×` Déséquiper | emplacement → sac | fiche Équipement |
| `✚ Tout ramasser` / `✚ Tout prendre` | vident sol / coffre d'un clic | en-têtes des panneaux |

Règles communes :

- **clic = toute la pile**, **Maj/Ctrl+clic = un seul exemplaire** (les objets
  uniques — outils, armes — partent toujours à l'unité) ;
- les actions de gestion du sac sont **gratuites** (aucune faim/soif/sommeil
  consommée, voir `FREE_ACTIONS` dans `server/interactions.js`) ;
- le clic simple sur une ligne (hors bouton) ouvre le **menu contextuel
  complet**, qui reste disponible partout — clic droit et appui long inclus ;
- les écouteurs sont **délégués sur `document`** : ils couvrent les panneaux
  *et* les fenêtres modales (qui vivent hors de `#game-container` — avant,
  glisser-déposer et menu contextuel étaient inertes dans le coffre et la
  fiche Équipement).

### Fiche Équipement filtrée

La liste « Votre Inventaire » de la fiche Équipement n'affiche par défaut
**que les objets équipables**, triés par nom avec leur badge d'emplacement
(Tête, Arme/Outil…). Le commutateur « Équipables / Tout le sac » révèle le
reste ; le choix est mémorisé pendant la partie. Chaque objet équipable
porte son bouton `✚`, chaque emplacement occupé son bouton `×`.

### Objets uniques : la durabilité suit l'objet

Poser un outil au sol, le stocker dans un coffre ou le déséquiper **conserve
son instance** (clé + durabilité). Avant : l'aller-retour sac ↔ sol ou
sac ↔ équipement recréait l'objet neuf — équiper/déséquiper une hache usée
la réparait gratuitement. Les outils posés au sol restent cliquables dans
la scène (`itemKey` du hotspot) et reviennent à l'identique.

### Coffre vivant

La modale Coffre se rafraîchit à chaque état serveur (`refreshChestModal`
appelé depuis `updateAllUI`) : dépôt, retrait et « Tout prendre » se voient
immédiatement, sans fermer la fenêtre. Un coffre plein est signalé au lieu
d'échouer en silence.

### Tests

- `npm run test:item-actions` (`scripts/test-item-actions.mjs`) : usure
  conservée (équipement, sol, coffre), piles et instances, « Tout
  ramasser »/« Tout prendre », boutons rendus et messages construits ;
- `node scripts/test-ui-quick-actions.mjs` : le vrai `game.html` chargé dans
  un DOM (jsdom, `npm install --no-save jsdom`), filtre de la fiche
  Équipement, clics réels sur les boutons, menu contextuel, rafraîchissement
  du coffre.

---

## 7. Survivants animés — `public/js/ui/character-anim.js` + `draw.js`

Les personnages (joueur, autres survivants, PNJ) ne sont plus des sprites
figés : un moteur de pose squelettique les fait respirer, marcher, travailler,
se battre et dormir, en pixels tamponnés sur la grille comme les décors.

### Architecture en deux modules

| Responsabilité | Fichier |
| --- | --- |
| **Décider** — runtimes par personnage, détection automatique, poses, particules | `public/js/ui/character-anim.js` |
| **Peindre** — squelette, membres articulés, chevelures, outils tenus en main | `drawPixelCharacter` dans `public/js/ui/draw.js` |

`character-anim.js` ne connaît ni le DOM ni le canvas : à chaque image il
produit une **pose** (un objet de nombres : angles de membres, inclinaison,
regard, bouche, teinte). `draw.js` la traduit en pixels. Le module n'importe
rien → testable sous Node (`scripts/test-character-anim.mjs`).

### Conventions du squelette

- Origine = point d'ancrage du personnage ; le sol est à `SKELETON.FEET_Y`
  unités sous l'origine (aligné sur `characterAnchorForGround`) ;
- Angles en radians, `0` = membre vers le bas, positif = vers l'avant ; les
  genoux plient vers l'arrière, les coudes vers l'avant ;
- Le personnage regarde vers `+x` ; la scène est **miroîtée** (`ctx.scale(-1,1)`)
  pour l'ouest — étiquettes et bulles restent hors du miroir.

### Ce qui déclenche quoi

| Signal | Animation |
| --- | --- |
| `sendAction` (côté client, via `animForAction`) | le geste correspondant : `chop`, `mine`, `fish`, `craft`, `sleep`, `eat`… joué **dès l'envoi** |
| Changement de case détecté par le runtime | `walkin` : cycle de pas + poussière, entrée latérale dans le sens du déplacement |
| Chute de santé détectée par le runtime | `hurt` : recul, bras de garde, silhouette rougie (`pose.tint`) |
| `combatState` présent | garde du combattant ; `attack` (lunge) déclenché par l'attaque automatique de `combat.js` |
| `chatMessage` récent (joueur **et** PNJ) | `talk` : geste et hochements cadencés |
| Stat sommeil très basse / PV < 32 % | bâillements périodiques / posture voûtée main au flanc |
| PNJ sans activité | gestes sociaux aléatoires (`talk`, `look`) toutes les 6–15 s |
| Notification « niveau / victoire » | `cheer` : bras au ciel et petits sauts |

Les survivants et PNJ **font face au joueur** (`faceHint` passé par
`drawSceneCharacters`) : la scène semble répondre à sa présence. Chaque
runtime est déphasé par un hash de son identifiant — deux personnages côte à
côte ne respirent ni ne clignent des yeux en phase.

### Outils et équipement

L'arme équipée (`toolTypeForItem`) est dessinée **dans la main**, alignée sur
l'avant-bras : elle pend le long de la cuisse au repos, suit l'arc du geste en
action (biais d'alignement fourni par la pose). Les actions imposent leur
propre outil même s'il n'est pas équipé. Bouclier sur l'avant-bras arrière,
sac à dos, casque/chapeau par-dessus la chevelure.

### Particules attachées au personnage

Poussière du pas, éclats de bois, étincelles de minage, miettes, éclaboussures,
gouttes de sueur, Z du sommeil, notes de musique, paillettes de victoire — en
unités locales, donc solidaires du corps.

### Aperçus vivants

`drawCharacterPreview` (personnalisation, camp, fiches) et
`drawCombatPlayerAvatar` s'enregistrent dans une boucle d'images partagée
(`registerAnimatedCanvas`) : le survivant y respire et **salue** toutes les
~6 s. La boucle s'arrête seule quand plus aucun aperçu n'est visible.

### Tests

- `npm run test:character-anim` (`scripts/test-character-anim.mjs`) : les 23
  animations rendent sans erreur dans un faux contexte 2D qui rastérise
  réellement les pixels ; chaque pose dépasse 500 pixels de silhouette, reste
  ancrée au sol, **change** entre ses phases ; chevelures distinctes, retournement
  est/ouest, teinte rouge des dégâts.
- `node scripts/test-character-anim.mjs --save` produit
  `artifacts/character-poses.png`, une planche de contact des poses (fichier
  généré, hors Git).
- `node scripts/preview-character-ascii.mjs [idle|chop=0.29|sleep|…]` affiche
  une pose en ASCII dans le terminal — lecture rapide sans navigateur.
