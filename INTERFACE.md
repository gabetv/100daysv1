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
