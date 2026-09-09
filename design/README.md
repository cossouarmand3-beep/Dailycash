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
- **Le numéro de paiement du message de relance vient du compte, pas de la
  maquette.** Le prototype affichait « réglez au 77 000 00 00 » en dur ; envoyer
  ça à un vrai client l'enverrait payer un numéro qui n'appartient à personne.
  Le numéro se saisit dans le profil, et tant qu'il est vide le message demande
  simplement au client comment il souhaite régler.
- La maquette n'avait aucun écran de suppression. L'application en a besoin :
  un montant tapé de travers restait sinon dans le total du mois pour toujours.
  D'où la croix sur les tâches, les prospects et les factures, et l'entrée
  « Corriger un encaissement » dans le profil.

## Règles métier à connaître avant de modifier une route

- Les totaux (jour / semaine / mois) sont des `SUM` sur `Income.receivedAt`,
  jamais des compteurs. Toute action qui solde une facture **doit** créer un
  `Income`, sinon la dette disparaît sans que le mois bouge.
- Chaque fenêtre de total est semi-ouverte `[début, fin)`. Sans borne haute, un
  paiement daté dans le futur gonflait « aujourd'hui » sans entrer dans le mois.
- Un paiement ne solde une facture que si le montant correspond **exactement**
  (`lib/server/dailycash/settle.ts`). Solder silencieusement la mauvaise dette
  est pire que n'en solder aucune : le freelance arrête de réclamer un argent
  qu'on lui doit encore.
- « Marquer reçu » est un compare-and-swap sur le statut : deux tapes
  concurrentes (le cas normal sur un réseau lent) ne créent qu'un seul revenu.
- Supprimer un revenu rouvre la facture qu'il avait soldée, dans la même
  transaction.
- Supprimer un client ou une facture ne détruit jamais l'argent déjà encaissé
  (`onDelete: SetNull` des deux côtés) — le revenu devient « Sans client ».

## Envoi des emails

Sans `RESEND_API_KEY` / `EMAIL_FROM` (et les clés Upstash), aucun email ne part.
Hors production, le code de vérification est alors écrit dans les logs du
serveur avec un avertissement explicite
(`lib/server/auth/dev-code-notice.ts`), pour que le développement ne soit pas
bloqué. **En production ce garde-fou est inactif** : il faut configurer Resend.
