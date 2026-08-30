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

### Le défaut que six vérifications n'ont pas vu

Signalé par l'utilisateur après la livraison : un rappel daté d'hier refusait
d'être reprogrammé à aujourd'hui, l'application affirmant « cette date est déjà
passée » devant une date qui, à l'écran, ne l'était pas.

Cause : `minimumDate={new Date()}` sur le sélecteur iOS. Quand la valeur
stockée est antérieure au minimum, `UIDatePicker` **remonte la valeur
affichée** jusqu'au minimum — sans émettre le moindre événement. L'écran
montrait le 22, l'état JavaScript était resté au 21. Et re-sélectionner le 22
ne produisait aucun changement, puisque le sélecteur croyait déjà l'avoir.

La preuve a été immédiate une fois la bonne question posée : lire la ligne
SQLite dans le conteneur du simulateur. Base `2026-08-21T19:03Z`, écran
`22 août`. Deux valeurs pour un même champ, la discussion était close.

Ce qui rend ce défaut instructif, c'est **tout ce qui l'a laissé passer** : le
typage, le lint, les 69 tests, la revue de code à effort élevé, et les essais
manuels sur les deux plateformes — y compris sur cet écran précis. Aucun ne
pouvait l'attraper, pour une raison unique : la vérité n'était pas dans le
code. Elle était dans ce qu'une vue native décidait d'afficher, et rien en
JavaScript n'en avait connaissance.

*Leçon* : quand un composant natif reçoit une contrainte (`minimumDate`,
`maxLength`, `keyboardType`…), il peut modifier ce qu'il **montre** sans en
informer l'état qui le pilote. La règle sûre est qu'une seule couche décide :
ici la validation, qui refuse explicitement et le dit, plutôt que le sélecteur,
qui contournait en silence.

*Corollaire pour la suite* : le seul test qui l'aurait attrapé aurait comparé
la valeur affichée à la valeur stockée. C'est le genre de contrôle à réclamer
sur tout écran d'édition adossé à un composant natif.

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

---

## Phase 2 — Moteur de déclencheurs

### Le filet de sécurité, éprouvé pour de vrai

L'évaluateur AND/OU existe en trois exemplaires (TypeScript, Kotlin, Swift).
Pour vérifier que `shared/fixtures/evaluator-cases.json` protège réellement
contre une divergence, la version Kotlin a été **volontairement cassée** :
`isAfter` au lieu de `!isBefore`. Un seul caractère de différence, qui aurait
empêché tout rappel réglé sur un instant précis de sonner.

Deux cas partagés ont immédiatement échoué. Le filet fonctionne.

*Leçon* : un mécanisme de protection non éprouvé n'est pas une protection,
c'est une hypothèse. Demander à Claude de **casser volontairement** le code
pour montrer que le test l'attrape coûte deux minutes et vaut plus qu'une
promesse.

### L'erreur « undefined is not a function »

À la première ouverture après l'ajout du moteur natif, l'application affichait
une erreur illisible. Diagnostic :

`org.json` sur Android ne sait pas sérialiser une `List` Kotlin. Passer
directement `registry.activeTypeNames()` à `JSONObject.put` produisait la
*chaîne* `"[datetime]"` au lieu d'un tableau JSON. Côté JavaScript, cette
chaîne possède une propriété `length`, la vérification naïve
`activeTriggerTypes.length > 0` passait donc, et l'échec ne survenait qu'à
l'appel de `.join()`, plusieurs lignes plus loin que sa cause.

Deux corrections ont été apportées, pas une :

1. Le défaut lui-même : `JSONArray(...)` explicite côté Kotlin.
2. **La classe de défaut** : `src/native/parsing.ts` valide désormais toute
   charge utile reçue du natif et nomme le champ fautif. Six tests reproduisent
   les malformations, dont celle-ci exactement.

Détail instructif : un test JUnit n'aurait **pas** reproduit ce bug, car
l'`org.json` de Maven, utilisé par les tests unitaires, sérialise correctement
les collections — contrairement à celui d'Android. La protection devait donc
vivre côté JavaScript, à la frontière.

*Leçon* : face à un bug, la bonne demande n'est pas « corrige ça » mais
« corrige ça **et** rends cette catégorie d'erreur détectable ». Sinon le même
défaut réapparaît sous une autre forme au déclencheur suivant.

### Une erreur de ma part, à connaître

En vérifiant les tests, j'ai écrit `npm run verify 2>&1 | grep -E "Tests:|error"`
et conclu au succès parce que le filtre ne remontait rien — alors que Prettier
échouait. J'avais lu un **log filtré** au lieu du **code de sortie**, exactement
la faute que je venais de recommander d'éviter. La forme correcte :

```bash
npm run verify && echo "✅" || echo "❌"
```

*Leçon* : quand Claude annonce qu'une vérification passe, la question utile est
« sur quoi te fondes-tu ? ». Un `grep` sur une sortie n'est pas une preuve ;
un code de sortie en est une.

### Le bug le plus grave : un rappel qui ne sonne pas

Sur iOS, tout paraissait fonctionner. La règle enregistrée, l'interface
affichant « Moteur : 1 règle, écoutes actives : datetime », aucune erreur,
aucun log. Et la notification n'arrivait jamais.

Cause : dans `syncRules`, les notifications étaient programmées **avant** la
demande d'autorisation, et `UNUserNotificationCenter.add()` échoue en silence
tant qu'elle n'est pas accordée. Deux lignes dans le mauvais ordre.

Trois corrections, pas une — c'est le réflexe à demander systématiquement :

1. **Le défaut** : l'autorisation précède désormais la programmation.
2. **La visibilité** : `notificationsAuthorized` remonte dans le diagnostic sur
   les deux plateformes, et l'écran affiche un avertissement rouge. Le mode de
   défaillance muet est devenu bruyant.
3. **La régression** : un test rejette ce champ s'il disparaît du contrat.

**Aucune vérification automatique ne pouvait l'attraper.** Ni le typage, ni le
lint, ni les 49 tests JS, ni JUnit, ni les 26 cas partagés. La logique était
juste, le contrat respecté, les trois implémentations d'accord. Seul le fait de
créer un vrai rappel, tuer l'application et regarder l'écran l'a révélé.

C'est la justification concrète de la porte de validation sur appareil réel que
l'utilisateur a imposée en approuvant le plan.

### Quand la vérification elle-même est fausse

Le principe « vérifie l'état, pas le log » a été appliqué correctement, mais
avec de mauvais instruments — trois fois :

| Vérification | Verdict | Réalité |
|---|---|---|
| `simctl get_app_container com.sharpreminder` | « app absente » | Mauvais identifiant : iOS utilise `org.reactjs.native.example.SharpReminder` |
| `nm` sur le binaire iOS | « module natif absent » | Les classes ObjC ne s'inspectent pas ainsi |
| `strings` sur une classe Java | « champ absent » | Les chaînes d'un `.class` sont en UTF-8 modifié — il fallait `javap` |

Dans les trois cas, le code était bon et la mesure fausse. La règle complète
n'est donc pas « vérifie l'état » mais : **vérifie l'état, puis demande-toi si
l'instrument mesure bien ce que tu crois.** Ici, la preuve décisive a chaque
fois été la plus directe — une capture d'écran montrant l'application faire ce
qu'on attend d'elle.

Corollaire pratique : `exit 0` n'est pas non plus une preuve.
`react-native run-ios` a renvoyé `0` sur un `xcodebuild` en erreur 65.

### Le mode bare a un coût, désormais chiffré

Trois échecs de compilation iOS, trois causes distinctes : chemins de groupe
Xcode erronés, ordre des `#import` dans le fichier Objective-C++, nom de
produit vide pour la cible de test. Aucun n'était un défaut de logique — tous
relevaient de la plomberie que le mode *bare* laisse à la charge du
développeur, et chacun a coûté un cycle de compilation complet.

C'est le prix assumé du contrôle total. La contrepartie est réelle : chaque
fichier du pont Swift ↔ React Native est lisible et modifiable.

### Fonctionnalité Claude Code introduite ici

`/verif` accepte désormais une portée (`js`, `android`, `ios`, `tout`) et
embarque les leçons ci-dessus sous forme de règles : ne pas filtrer les
sorties, vérifier l'existence des artefacts, lire les rapports XML plutôt que
les messages de fin, utiliser `javap` et non `strings`.

C'est le bon moment pour écrire une commande custom : **quand le motif
répétitif existe réellement.** L'écrire en phase 1, comme le plan l'envisageait
pour `/nouveau-trigger`, aurait automatisé un motif encore inconnu.

---

## Phase 3 — Écran de création et d'édition

### Fonctionnalités Claude Code introduites

| Outil | Ce qu'il a apporté |
|---|---|
| **Plan mode** (2ᵉ usage) | Deux décisions posées avant la première ligne : dépendance native pour le sélecteur, et périmètre CRUD complet plutôt que minimal. Le plan a aussi fait apparaître un conflit interne — voir « le plan avait tort » ci-dessous. |
| **`/code-review`** | Lancée avant de taguer, comme la phase 1 l'avait prévu. Quatre défauts confirmés, dont deux que ni le typage, ni le lint, ni les 65 tests, ni les essais manuels sur les deux plateformes n'avaient attrapés. |
| **Sous-agents** | Toujours pas utilisés. Le besoin ne s'est pas présenté : la phase 3 est du JavaScript partagé, sans revue croisée Kotlin ↔ Swift à mener. |

### La revue de code a trouvé ce que l'appareil réel ne pouvait pas trouver

Deux défauts confirmés méritent d'être retenus, parce qu'ils étaient
**invisibles à l'usage normal** :

1. `.catch(setError)` passait un objet `Error` à un état typé `string`, ensuite
   rendu dans un `<Text>`. React refuse un objet comme enfant : l'écran aurait
   planté au lieu d'afficher la panne qu'il était censé signaler. Le chemin
   n'est emprunté que si SQLite échoue — jamais pendant un test manuel.
2. Le chargement de l'éditeur lançait une async sans `.catch` : toute erreur
   laissait un indicateur de chargement tourner indéfiniment, sans message.

*Leçon* : les tests sur appareil réel couvrent le chemin nominal ; la revue de
code couvre les chemins d'erreur, que personne ne déclenche à la main. Les deux
sont nécessaires, aucun ne remplace l'autre.

### Le plan avait tort, et l'a montré tout seul

Le plan disait de retirer entièrement le panneau de test, en ne gardant que
l'avertissement des notifications. Mais son propre paragraphe de vérification
demandait de « désactiver un rappel et constater que l'écoute s'éteint » —
impossible sans l'affichage de l'état du moteur. Le pied de page a donc été
conservé, et `CLAUDE.md` corrigé pour dire *pourquoi* il n'est pas un résidu.

*Leçon* : écrire la procédure de vérification **dans** le plan révèle les
incohérences du plan avant qu'elles ne deviennent du code.

### Deux fois piégé par l'instrument, pas par le code

La phase 2 avait déjà consigné « vérifie l'état, puis demande-toi si
l'instrument mesure bien ce que tu crois ». La phase 3 l'a confirmé deux fois :

| Symptôme | Conclusion tentante | Réalité |
|---|---|---|
| `security find-generic-password` ne trouve pas la passphrase SSH | « le Trousseau n'a rien mémorisé » | macOS 26 range la passphrase dans le *data protection keychain*, invisible à l'ancienne CLI. Preuve correcte : `ssh -o BatchMode=yes`, qui échouerait s'il fallait saisir quoi que ce soit. |
| Le correctif « date passée » reste sans effet à l'écran | « mon correctif est faux » | Bundle Metro périmé. Un `terminate` + `launch` a tranché en dix secondes. |

*Leçon* : avant de corriger un correctif qui « ne marche pas », vérifier que
c'est bien le nouveau code qui tourne.

### Deux problèmes d'environnement, jamais de code

`ANDROID_HOME` puis `LANG` manquaient dans le shell non interactif de Claude,
alors que le terminal de l'utilisateur les avait — `~/.zshrc` n'est chargé que
pour les shells interactifs. Le second cas était trompeur : CocoaPods a planté
**dans son propre rapport d'erreur**, masquant complètement la cause.

*Leçon* : un échec de build qui n'a aucun rapport avec le diff est presque
toujours un problème d'environnement. Le chercher là avant de suspecter le code.

### Le point d'extension, posé et vérifiable

Deux `switch` sur `condition.type` sont fermés par `assertNeverCondition` :
`ConditionEditor.tsx` et le résumé de `RemindersListScreen.tsx`. Ajouter le
Wi-Fi en phase 4 fera échouer la compilation à ces deux endroits exactement,
avec le nom du type manquant. C'est le contraire d'un écran silencieusement
incomplet.

### Le défaut que six vérifications n'ont pas vu

Signalé par l'utilisateur après la livraison : un rappel daté d'hier refusait
d'être reprogrammé à aujourd'hui, l'application affirmant « cette date est déjà
passée » devant une date qui, à l'écran, ne l'était pas.

Cause : `minimumDate={new Date()}` sur le sélecteur iOS. Quand la valeur
stockée est antérieure au minimum, `UIDatePicker` **remonte la valeur
affichée** jusqu'au minimum — sans émettre le moindre événement. L'écran
montrait le 22, l'état JavaScript était resté au 21. Et re-sélectionner le 22
ne produisait aucun changement, puisque le sélecteur croyait déjà l'avoir.

La preuve a été immédiate une fois la bonne question posée : lire la ligne
SQLite dans le conteneur du simulateur. Base `2026-08-21T19:03Z`, écran
`22 août`. Deux valeurs pour un même champ, la discussion était close.

Ce qui rend ce défaut instructif, c'est **tout ce qui l'a laissé passer** : le
typage, le lint, les 69 tests, la revue de code à effort élevé, et les essais
manuels sur les deux plateformes — y compris sur cet écran précis. Aucun ne
pouvait l'attraper, pour une raison unique : la vérité n'était pas dans le
code. Elle était dans ce qu'une vue native décidait d'afficher, et rien en
JavaScript n'en avait connaissance.

*Leçon* : quand un composant natif reçoit une contrainte (`minimumDate`,
`maxLength`, `keyboardType`…), il peut modifier ce qu'il **montre** sans en
informer l'état qui le pilote. La règle sûre est qu'une seule couche décide :
ici la validation, qui refuse explicitement et le dit, plutôt que le sélecteur,
qui contournait en silence.

*Corollaire pour la suite* : le seul test qui l'aurait attrapé aurait comparé
la valeur affichée à la valeur stockée. C'est le genre de contrôle à réclamer
sur tout écran d'édition adossé à un composant natif.

### Encore inexploité

- **Sous-agents** — la phase 4 (Wi-Fi Android puis iOS) offrira enfin la revue
  croisée Kotlin ↔ Swift qui les justifie.
- **Hooks** — `npm run verify` après édition. Aurait fait gagner les deux
  allers-retours Prettier de cette phase.
- **Worktrees** — phases 5-6.
- **`/nouveau-trigger`** — le motif d'un déclencheur est désormais établi côté
  natif *et* côté interface. C'est en phase 4 qu'il faudra l'écrire, une fois
  le deuxième type réellement ajouté.

---

## Phase 4 — Déclencheur de lieu

### Ce qui distingue cette phase des précédentes

Les trois premières phases ont livré du code qui marchait au premier essai
utilisateur. Celle-ci a demandé **cinq allers-retours**, et presque tous les
défauts venaient de moi. C'est la phase la plus instructive à ce titre.

### Quatre défauts introduits par Claude, et ce qui les a révélés

| Défaut | Ce qui l'a trouvé |
|---|---|
| `pod install` jamais relancé après l'ajout de la carte | L'utilisateur, sur iOS : « la création du trigger lieu lève des erreurs » |
| `start()` effaçait l'état des zones à chaque évaluation, juste après le franchissement qu'il venait d'enregistrer | Ma propre relecture avant compilation |
| Une réinitialisation de ligne de base avalait le déclenchement au lieu de notifier | La base SQLite du simulateur : règle passée à « satisfaite », absente des déclenchements |
| Évaluer à chaque réponse de zone créait une **récursion infinie** | Le journal du simulateur : `startMonitoring → requestState → didDetermineState → evaluateAll → …` |

Aucun n'était détectable par le typage, le lint ou les tests. Trois l'ont été
en **lisant l'état réel** — base de données, journal système — plutôt que
l'écran.

*Leçon* : plus une phase touche au natif, plus la proportion de défauts
invisibles aux vérifications automatiques augmente. En phase 1 elles suffisaient
presque ; ici elles n'ont rien attrapé.

### Le piège le plus coûteux : l'instrument qui ment, troisième récidive

Après avoir corrigé le garde-fou de permission, j'ai vérifié dans le journal :
zéro refus de Play Services. J'ai failli conclure à la réussite. Or **il n'y
avait aucune règle en base** — l'utilisateur avait tout supprimé. Aucune
tentative d'enregistrement n'avait eu lieu, et mon « zéro refus » ne mesurait
rien.

C'est la troisième fois du projet, après `security find-generic-password` et le
bundle Metro périmé. Le contrôle positif — vérifier que la mesure porte sur
quelque chose — n'est pas une précaution facultative.

### Le modèle était juste, le vocabulaire était faux

L'utilisateur a signalé une « erreur de design » : impossible d'exprimer « si je
suis encore dans ce lieu à 13h35 ». Vérification faite sur les cas partagés,
c'était **parfaitement exprimable** : `direction: 'enter'` est évalué comme
« la zone est occupée », un état, et non comme un franchissement.

Ce qui était faux, ce sont les libellés que j'avais écrits : « En arrivant »
décrivait un événement là où le champ décrit une présence. Une limite imaginaire
née d'un mot mal choisi.

*Leçon* : quand un utilisateur signale une limite du modèle, vérifier d'abord
ce que le code fait réellement. Ici la correction a coûté deux lignes de
traduction, pas une refonte.

### La revue de code, deuxième démonstration

Quatre défauts confirmés, dont deux que ni les tests ni l'usage n'avaient
atteints : une permission d'arrière-plan jamais vérifiée alors que la fonction
qui la vérifie existait en code mort, et une course entre le retrait et l'ajout
de zones — deux opérations asynchrones lancées en parallèle, dont l'ordre
inversé efface les zones qu'on vient d'enregistrer.

### Fonctionnalités Claude Code de la phase

| Outil | Ce qu'il a apporté |
|---|---|
| **Plan mode** | A tranché la question de la carte sur un critère de l'utilisateur, avec vérification en ligne plutôt que de mémoire |
| **`/code-review`** | 4 défauts, dont 2 hors de portée de toute vérification automatique |
| **Mémoire** | Deux règles durables ajoutées : l'environnement du shell non interactif, et la séparation visuelle entre notes et synthèse |
| **Sous-agents** | Toujours pas utilisés. La phase 5 (Wi-Fi) offrira enfin la revue croisée Kotlin ↔ Swift qui les justifie |

### Le test terrain, fait depuis le bureau

Le doute laissé ouvert — Play Services journalisant `registration not
permitted` — a été levé sans se déplacer, en simulant la position sur le
téléphone physique.

Le piège a coûté deux essais : **un fournisseur de position fictive est détruit
avec la session `adb shell` qui l'a créé.** Enchaîner les commandes depuis le
Mac ne fonctionne donc pas, la position réelle revenant avant que le système
n'ait rien propagé. Le journal l'a montré noir sur blanc : `added mock provider
override` à 11:51:08, `removed` à 11:51:37 — la fin de ma commande. Tout doit
tenir dans une seule invocation, ce qu'encode `scripts/simuler-position.sh`.

Aller-retour Saint-Nicolas-de-Port ↔ Nancy centre, 11 km. La file du moteur
natif porte trois déclenchements : l'entrée à la création, **la sortie** au
départ, **l'entrée** au retour. Notification vue à l'écran par l'utilisateur.

L'avertissement de Play Services était donc du bruit. *Leçon* : un avertissement
de bibliothèque tierce n'est pas une preuve de panne — seul le comportement
observé en est une, dans un sens comme dans l'autre.

### La carte : deux contraintes qui s'excluent

Une carte dans un formulaire défilant pose un conflit irréductible : les deux
veulent capter le glissement vertical. Trois états ont été essayés :

1. carte libre → le formulaire ne défile plus, tout ce qui est sous la carte
   devient inatteignable, suppression comprise ;
2. carte figée → le formulaire défile, mais viser un lieu éloigné devient
   impossible ;
3. **carte verrouillée, déverrouillée par appui long d'une seconde**, avec
   l'épingle fixe au centre et un bouton explicite pour refermer.

Le troisième est venu de l'utilisateur. Il ajoute aussi que viser en déplaçant
la carte est plus précis que de traîner une épingle sous le doigt — lequel
masque précisément ce qu'on cherche à viser.

---

## Phase 5 — Plage horaire et déclenchement unique

### Une fonctionnalité qui en révèle une autre, jamais nommée

Le besoin était double, et le second n'était pas visible avant que le premier
ne soit formulé : « si je passe devant mon magasin samedi entre 10 h et 18 h ».
La plage manquait, mais surtout **« le conserver » signifiait jusqu'ici
« resonner à chaque fois »** — le comportement que l'utilisateur imaginait
ajouter plus tard existait déjà, sans nom ni intention, comme effet de bord de
la remise à jour de la ligne de base.

*Leçon* : avant de construire une option, chercher si le comportement contraire
n'est pas déjà là par accident. La phase 5 n'a pas ajouté un mécanisme, elle a
nommé et inversé un défaut par défaut.

### Le défaut que seuls les doigts pouvaient trouver

`estInchangee` — la fonction qui épargne les règles de validation à une
condition que l'utilisateur n'a pas touchée — comparait `at` et rien d'autre.
En ajoutant `until`, j'ai créé un champ qu'elle ignorait : déplacer la seule fin
d'une fenêtre faisait passer la condition pour intacte, la règle du créneau
refermé était sautée, et un rappel mort s'enregistrait sans un mot.

**Aucun des 109 tests ne pouvait l'attraper.** Ils exerçaient `until` et
`estInchangee` séparément, jamais leur croisement. Il a fallu manipuler l'écran
du téléphone, ce que l'utilisateur avait exigé : « je ne veux pas faire les
vérifications moi-même, tu dois les faire toi-même ».

*Leçon* : deux mécanismes corrects séparément ne le sont pas ensemble. Quand un
champ s'ajoute à une structure, chercher **toutes** les fonctions qui comparent
cette structure, pas seulement celles qui la lisent.

### La revue de code, troisième démonstration — et la plus utile

Quatre défauts confirmés, dont deux graves, tous invisibles aux tests :

1. **Le déclenchement unique n'existait qu'en JavaScript.** Le natif gardait la
   règle et réarmait sa ligne de base : application tuée, repasser devant le
   magasin renotifiait. La fonctionnalité de la phase était donc à moitié
   absente, et mes propres essais sur appareil ne l'avaient pas vu — je
   rouvrais l'application entre deux mesures, ce qui appliquait justement le
   filtre JavaScript manquant.
2. **Une fenêtre déjà ouverte s'enregistrait sans avertissement et ne sonnait
   jamais** : aucune alarme ne se programme dans le passé, et la ligne de base
   est posée à « déjà satisfaite ». J'avais écrit en commentaire l'inverse de ce
   que le moteur savait faire.
3. Sur iOS, `soleSufficientDate` retenait la date minimale **avant** d'écarter
   les échéances passées : une plage close hier faisait taire une plage à venir
   demain, dans la même règle.
4. Une plage refermée sans avoir rien déclenché gardait son géorepérage armé
   indéfiniment.

*Leçon* : la revue ne vaut pas parce qu'elle relit le diff, mais parce qu'elle
suit chaque champ nouveau jusque dans le code natif qui ne le connaît pas.

### Le piège de l'auto-vérification : mes essais confirmaient ce qu'ils causaient

Le défaut n° 1 mérite d'être isolé. Mon protocole était : provoquer un
déclenchement, **rouvrir l'application**, constater « terminé ». Or c'est
l'ouverture qui appliquait la garantie. Le test passait parce qu'il contenait
la correction.

*Leçon* : quand une garantie doit tenir application fermée, tout protocole qui
ouvre l'application avant de conclure mesure autre chose.

### Une correction qui en a cassé une autre

Retirer du miroir natif toute règle qui vient de sonner a éteint le module de
lieu, dont l'arrêt effaçait les zones occupées. Au réarmement, la zone paraissait
neuve, l'amorce la redécouvrait occupée, et le rappel sonnait **immédiatement**
— sans que rien n'ait été franchi. Trouvé en observant le fichier de
préférences après un réarmement, pas en relisant le code.

Correction : l'arrêt oublie ce qui est *enregistré auprès du système*, jamais ce
qu'on *sait du monde*. Les deux plateformes avaient la même faute au même
endroit.

