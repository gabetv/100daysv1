# Audit produit et technique — Île des 100 Jours

_Date de l'audit : 30 septembre 2026_

## 1. Verdict rapide

Le jeu possède déjà une base solide : un monde persistant, du multijoueur WebSocket, une boucle de survie, des objectifs multiples, du craft, du combat, des PNJ, une mini-carte et une interface mobile. Le problème principal n'est donc pas le manque de contenu, mais le manque de **lisibilité de la boucle de jeu** : le joueur reçoit beaucoup de possibilités sans toujours comprendre quoi faire maintenant, pourquoi le faire et quel risque il prend.

### Note indicative avant cette passe

| Axe | État | Commentaire |
| --- | --- | --- |
| Boucle de jeu | 6/10 | Exploration, ressources, fabrication et objectifs existent, mais la priorité est peu lisible. |
| Onboarding | 5/10 | Le tutoriel explique beaucoup de panneaux et certains anciens sélecteurs ne correspondaient plus au DOM. |
| UX desktop | 6/10 | Riche et complète, mais très dense : trois panneaux, une barre inférieure et des contrôles superposés. |
| UX mobile | 7/10 | Les feuilles et le swipe sont de bonnes bases ; il faut conserver une hiérarchie forte. |
| Direction artistique | 7/10 | Les fonds, sprites, particules et cycle jour/nuit sont déjà présents. Le HUD manquait d'un langage visuel unifié. |
| Feedback des actions | 6/10 | Sons, texte flottant et journal sont présents, mais le choix recommandé n'était pas identifiable. |
| Robustesse réseau | 6/10 | Reconnexion et sauvegarde existent ; il fallait limiter le spam de chat et ne pas pénaliser un déplacement bloqué. |

## 2. Points forts conservés

- **Identité claire** : île de survie, 100 jours, trésor, gardien et signal de détresse.
- **Plusieurs chemins de victoire** : ouvrir le trésor puis appeler les secours, ou tenir 100 jours.
- **Systèmes systémiques intéressants** : météo, ennemis qui se déplacent, pièges, durabilité, ressources régénérées, événements quotidiens.
- **Bonne intention multiplateforme** : D-pad, clavier, swipe, feuilles mobiles et chat rapide.
- **Rendu vivant existant** : cycle jour/nuit, pluie, lucioles, braises, animations de feu et créatures.

## 3. Risques et irritants identifiés

### P0 — à corriger avant une bêta publique

1. **Le joueur ne sait pas quelle action est prioritaire.** La liste mélange combat, récolte, construction, coffre et actions de bâtiment sans regroupement.
2. **Le contexte de la case était partiellement orphelin.** Le code mettait à jour `#tile-info-hud`, `#tile-info` et `#interaction-panel`, alors que ces éléments avaient évolué dans le HTML. Une partie du tutoriel ne pouvait donc pas guider vers le bon composant.
3. **Une tentative de déplacement bloquée consommait quand même des ressources.** C'est vécu comme une punition injuste, surtout au clavier ou sur mobile.
4. **Le chat acceptait des messages sans longueur maximale ni cooldown côté serveur.** Un joueur pouvait spammer le journal de toute la partie.

### P1 — amélioration de rétention

1. **Le premier objectif doit être jouable en moins de 60 secondes** : se déplacer, fouiller, boire/manger, puis recevoir un choix clair.
2. **Les ressources doivent raconter un choix** : fabriquer maintenant un outil, conserver pour un abri, ou partager au camp.
3. **Les actions rares doivent créer de l'anticipation** : signal météo, bruit d'ennemi, empreintes, danger sur la mini-carte.
4. **Le coopératif doit avoir des micro-rôles** : éclaireur, bâtisseur, cuisinier, chasseur, gardien du coffre.
5. **Le feedback doit être localisé** : effet près de la ressource ou du personnage, pas uniquement au centre de l'écran.

### P2 — qualité et évolutivité

- Découper le CSS historique en tokens, composants et media queries ; plusieurs règles se redéfinissent actuellement.
- Ajouter des tests de simulation serveur : déplacement, inventaire, combat, victoire, sauvegarde et reprise.
- Envoyer à terme des deltas d'état plutôt que l'état complet deux fois par seconde.
- Ajouter une télémétrie respectueuse de la vie privée : abandon après connexion, première action, première mort, chemin de victoire.
- Dépendances corrigées dans cette passe : Express `4.22.3` et `ws` `8.22.0`. `npm audit --omit=dev` retourne désormais **0 vulnérabilité**.

## 4. Refonte UX livrée dans cette passe

- Ajout d'un **cartouche de contexte de case** sur la scène : biome, coordonnées, description et bâtiment actif.
- Ajout d'un **compteur d'actions directement sur la scène** : le joueur voit instantanément s'il y a quelque chose à faire ici.
- Actions regroupées par intention : **Danger**, **Survie & exploration**, **Découvrir**, **Fabriquer**, **Aménager**.
- Mise en évidence de l'action recommandée lorsque la situation le justifie : santé critique, trésor accessible, signal de détresse ou gardien.
- Correction des cibles du tutoriel vers les composants réellement présents.
- Indice de commandes clavier et geste mobile dans le HUD.
- Les actions de gestion du sac ne consomment plus les jauges de survie.
- Un déplacement bloqué ne coûte plus d'énergie ; un déplacement valide reste coûteux.
- Chat limité à 240 caractères avec un cooldown serveur de 700 ms.
- Respect de `prefers-reduced-motion` pour les animations et la couche 3D.
- Tutoriel désormais réellement lancé à la première connexion, ramené à 5 étapes et relié aux boutons de l'interface.
- Anti-double-clic côté client pendant le retour d'état serveur pour éviter les actions accidentellement répétées.
- Messages rapides coopératifs ajoutés : découverte, rassemblement au camp et demande d'aide au combat.

## 5. Direction artistique proposée

### Palette

- Fond nuit : `#07151d`
- Surface verre : bleu pétrole translucide
- Accent survie : ambre `#ffd479`
- Gain : vert menthe
- Danger : corail
- Information : cyan

L'ambre sert aux objectifs et à la progression ; le rouge reste réservé aux conséquences dangereuses. Cette hiérarchie évite que tout ait l'air urgent.

### Hiérarchie d'écran

1. **La scène** doit rester la première information.
2. **L'objectif et la phase du jour** doivent rester visibles sans ouvrir de panneau.
3. **L'action contextuelle** doit être à portée du pouce et lisible en une seconde.
4. **Le détail** (inventaire, craft, chat, carte) vit dans les panneaux et modales.

### Animations

- Mouvement : transitions courtes de 180–300 ms.
- Récompense : texte flottant + micro-particules + son bref.
- Danger : pulsation limitée à la jauge concernée et vignette rouge douce.
- Découverte rare : halo doré, pas un flash blanc agressif.
- Désactiver ou réduire ces effets avec `prefers-reduced-motion`.

## 6. Stratégie 3D

### Ce qui est livré

Une couche WebGL facultative (`public/js/ui/scene3d.js`) ajoute des particules avec profondeur, projection perspective et variation de caméra au-dessus des décors pixel-art. Elle est transparente, légère, sans dépendance et retourne automatiquement au rendu 2D si WebGL n'est pas disponible. L'objectif est d'apporter de la profondeur sans casser les assets ni les performances mobiles.

### Étape suivante recommandée

Ne pas convertir tout le jeu en 3D immédiatement. Faire d'abord un prototype jouable avec :

1. une caméra orthographique/isométrique ;
2. une tuile 3D par biome ;
3. un seul personnage animé et une créature ;
4. les mêmes données serveur et les mêmes actions ;
5. un bouton de qualité graphique : **Pixel**, **Diorama**, **3D**.

Si ce prototype améliore la compréhension et reste à 45–60 FPS sur mobile moyen, migrer progressivement les bâtiments et le combat. Une migration totale immédiate vers Three.js ou Babylon.js augmenterait fortement le poids, la complexité des assets et le risque de régression.

## 7. Roadmap gameplay recommandée

### Sprint 1 — lisibilité et plaisir immédiat

- Première minute guidée par trois actions : se déplacer, fouiller, gérer une jauge.
- Une recommandation contextuelle, déjà introduite dans le panneau Actions.
- Une récompense visible à chaque première découverte : XP, recette ou objet utile.
- Tutoriel en 4 étapes maximum, puis explications à la demande.

### Sprint 2 — tension et choix

- Bruits directionnels avant l'arrivée d'un ennemi.
- Prévisions météo avec conséquences prévisibles.
- Coût/risque affiché avant les actions importantes.
- Événements de camp tous les 3 à 5 jours proposant un vote collectif.

### Sprint 3 — coopération

- Missions partagées avec contribution par joueur.
- Rôles temporaires, bonus de camp et coffre commun réellement utile.
- Ping sur la carte et messages rapides contextuels : « danger », « ressource », « rassemblement ».

### Sprint 4 — contenu de fin de partie

- Variantes de l'île et graines de génération.
- Boss avec télégraphes visuels et phases.
- Défis hebdomadaires non obligatoires.
- Statistiques de fin : décisions, entraide, exploration, morts évitées.

## 8. Critères de validation

- Un nouveau joueur comprend son objectif en moins de 15 secondes.
- Il réalise sa première action utile en moins de 60 secondes.
- Il identifie la meilleure action du contexte sans lire toute la liste.
- Une action donne un feedback visuel, sonore et journal en moins de 500 ms.
- Le HUD mobile ne masque jamais le personnage ni le D-pad.
- La couche 3D reste désactivable et ne bloque jamais la boucle de jeu.
- Aucun déplacement bloqué ne consomme de jauge.
- Un message de chat ne peut pas dépasser 240 caractères ni être envoyé plus d'une fois en 700 ms.
