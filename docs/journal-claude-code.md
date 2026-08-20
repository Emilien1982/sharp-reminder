# Journal Claude Code

Ce projet est d'abord un support d'apprentissage : l'app en est le prétexte,
l'objectif réel est de savoir tirer parti de Claude Code. Ce fichier consigne
les observations au fil de l'eau — ce qui a marché, ce qui a failli mal
tourner, et les fonctionnalités encore inexploitées.

Il est tenu par Claude, à la demande de l'utilisateur. Il survit aux
réinitialisations de contexte, contrairement à la conversation elle-même.

---

## Phase 0 — Cadrage et environnement (19–20 août 2026)

### Ce qui a bien fonctionné

**Le brief écrit avant la première ligne de code.** Le cadrage a été fait dans
Claude (chat), puis livré à Claude Code sous forme de fichier Markdown
structuré. Effet mesurable : quatre questions ciblées ont suffi là où une
description orale en aurait demandé vingt. Le brief marquait en plus
explicitement ses décisions ouvertes (« framework à trancher », « convention
Git à discuter »), ce qui a empêché Claude de trancher seul sur deux sujets
structurants.

*À reproduire* : pour tout nouveau projet, écrire le brief ailleurs, le relire,
puis l'attacher.

**Le plan mode.** Aucun fichier n'a été écrit tant que l'architecture n'était
pas validée. Le plan a servi de document de référence, relu et **modifié** par
l'utilisateur avant approbation.

**Approuver en modifiant, pas en bloc.** L'utilisateur avait initialement choisi
« les deux plateformes en parallèle ». Au moment d'approuver le plan, il est
revenu sur sa propre décision : Android d'abord, validation, puis iOS. Motif
correct — une erreur de conception du moteur découverte après l'écriture du
Swift se corrige deux fois. C'est exactement l'usage attendu du plan mode : il
sert à réfléchir, pas à valider vite.

### L'incident évité

L'utilisateur a demandé : « avant, explique-moi ce que fait zulu ? »

Cette question a évité un incident en série :

1. La commande proposée par Claude (`brew install --cask zulu17`) aurait
   installé un JDK **x86_64 émulé** — la machine est un Apple M4, mais son
   Homebrew était l'installation Intel dans `/usr/local`, tournant sous
   Rosetta 2. Tous les builds Gradle auraient été ralentis, tous les jours.
2. La réponse suivante de l'utilisateur — « je préfère désinstaller
   Homebrew Intel » — aurait coupé un **PostgreSQL actif contenant 679 Mo de
   données** et un nginx servant un autre projet. L'utilisateur ignorait que ce
   Homebrew hébergeait cet environnement.

Claude a inspecté l'état avant d'agir, a signalé le risque, et a produit une
sauvegarde vérifiée (22 tables en base = 22 dans le dump) avant toute
suppression.

*Leçon* : **demander ce que fait une commande avant de la lancer.** Un agent qui
exécute vite n'est pas un agent qui a raison. Le rôle de relecteur de
l'utilisateur est ce qui a fonctionné ici.

### Log ≠ état

Question posée : « relis le terminal, l'installation s'est bien passée ? »

Le log était trompeur dans les deux sens. Il affichait des `Permission denied`
alarmants sur des suppressions qui avaient en fait réussi, et faisait défiler
sans alerte un `sudo xcode-select --switch /Library/Developer/CommandLineTools`
exécuté par l'installeur Homebrew — qui **cassait toute possibilité de build
iOS**. Personne ne l'aurait vu avant la première erreur incompréhensible en
Phase 2.

*Leçon* : ne pas demander de **lire un log**, demander de **vérifier l'état**.
Un log raconte ce qui s'est passé ; un contrôle d'état (`xcode-select -p`,
`brew config`, l'architecture réelle de chaque binaire) dit ce qui est vrai
maintenant.

### Vérifier par le résultat, pas par la version

La Phase 0 n'a pas été déclarée terminée sur la foi de `--version`, mais sur un
`./gradlew assembleDebug` → BUILD SUCCESSFUL en 4 min 40. C'est la seule preuve
que la chaîne complète — JDK 17 arm64, SDK 36, build-tools, Gradle — fonctionne
réellement ensemble.

Même principe appliqué au typage des clés de traduction : une sonde temporaire
avec une clé volontairement fausse a révélé que l'augmentation de module
`react-i18next` **compilait sans rien vérifier**. La cible correcte est le
module `i18next` depuis la v23. Sans la sonde, le projet aurait eu un typage
décoratif pendant des mois.

*Leçon* : quand Claude annonce qu'une configuration « est en place », demander
la preuve par un cas qui doit échouer.

---

## Phase 1 — Fondations

### Fonctionnalités Claude Code introduites

| Outil | Fichier | Ce qu'il apporte |
|---|---|---|
| Mémoire projet | `CLAUDE.md` | Architecture et règles rechargées à chaque session, sans les redire |
| Commande custom | `.claude/commands/verif.md` | `/verif` lance et interprète toutes les vérifications |
| Permissions | `.claude/settings.json` | Les commandes de lecture ne demandent plus d'autorisation |
| ADR | `docs/adr/` | Trace le *pourquoi* des décisions, pas seulement le *quoi* |

### Commits découpés pour la relecture

Sept commits séparés plutôt qu'un gros. L'objectif est explicite : permettre une
relecture par petits morceaux (`git show <hash>`), puisque l'utilisateur n'écrit
pas le code mais doit pouvoir le juger. Un commit « Phase 1 » de 40 fichiers
serait illisible et donc validé à l'aveugle.

### Encore inexploité — à introduire au bon moment

- **`/code-review`** — à lancer avant de taguer chaque phase.
- **Sous-agents** — utiles en Phase 2 pour une revue croisée Kotlin ↔ Swift.
- **Hooks** — lancer `npm run verify` automatiquement après édition.
- **Worktrees** — deux déclencheurs en parallèle, en Phase 5-6.
- **`/clear`** — entre deux phases, pour repartir sur un contexte propre.
- **`/nouveau-trigger`** — commande à écrire en Phase 2, une fois le motif
  d'un déclencheur réellement établi. L'écrire avant reviendrait à automatiser
  un motif qui n'existe pas encore.

### Point de vigilance pour la suite

Le combo choisi — CLI bare + deux plateformes — produit de **gros diffs
natifs** : un déclencheur représente environ six fichiers Kotlin ou Swift. La
dérive classique est de valider en diagonale parce que « ça compile ». C'est
précisément ce que la porte de validation sur appareil physique doit empêcher :
un build réussi ne prouve rien sur un déclencheur.
