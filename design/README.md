# Sources de design

Ces fichiers viennent de [Claude Design](https://claude.ai/design) et sont la
source visuelle de l'application. Ils ne sont **pas** exécutés par le projet :
ils servent de référence pour vérifier une couleur, un espacement ou un
comportement quand on modifie un écran.

| Fichier | Contenu |
|---|---|
| `handoff-claude-design.zip` | Le bundle complet : les 5 écrans `.dc.html`, `support.js`, la capture Dribbble de référence |
| `Daily Cash Landing.html` | La landing exportée seule, en bundle auto-extractible |

## Où chaque écran a atterri

| Maquette | Route |
|---|---|
| `Daily Cash Landing.dc.html` | `/` |
| `Daily Cash Onboarding.dc.html` | `/onboarding` |
| `Daily Cash Auth.dc.html` | `/signup` et `/login` |
| `Daily Cash.dc.html` | `/app` |
| `Daily Cash Desktop.dc.html` | `/app/desktop` |

## Écarts assumés

- Le châssis de téléphone (390×844) et la fausse barre d'état « 07:42 · 4G · 84% »
  étaient de l'échafaudage de présentation : supprimés.
- Les bascules « Vue mobile / Desktop » et « Premier lancement » ont disparu au
  profit d'un vrai responsive et d'un état vide réel.
- **L'authentification a changé de nature** : la maquette entrait par téléphone
  et code SMS à 4 chiffres ; le projet utilise email + mot de passe + code à
  8 caractères. Le pavé numérique a disparu avec elle — l'alphabet du code
  contient des lettres.
- Les polices (Archivo, DM Mono) sont chargées via `next/font/google` plutôt
  que depuis les WOFF2 du bundle : même rendu, auto-hébergé au build.
