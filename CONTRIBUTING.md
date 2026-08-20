# Conventions du projet

## Messages de commit — Conventional Commits

Un message de commit suit toujours cette forme :

```
type(portée): description à l'impératif, en minuscule

Corps optionnel expliquant le POURQUOI, pas le comment — le diff dit déjà
le comment. C'est ici qu'on justifie un choix non évident.
```

### Les types

| Type | Quand l'utiliser |
|---|---|
| `feat` | Nouvelle fonctionnalité visible par l'utilisateur |
| `fix` | Correction d'un bug |
| `refactor` | Réorganisation du code sans changement de comportement |
| `test` | Ajout ou modification de tests seulement |
| `docs` | Documentation seulement |
| `chore` | Outillage, dépendances, configuration |
| `style` | Formatage automatique, aucun changement de logique |
| `perf` | Amélioration de performance |

### La portée

Le morceau du projet touché : `triggers`, `data`, `i18n`, `app`, `android`,
`ios`, `tooling`. Elle est facultative mais rend l'historique nettement plus
lisible : `feat(triggers): ajoute le déclencheur wifi` se comprend d'un coup
d'œil dans une liste de cinquante commits.

### Exemples tirés de ce dépôt

```
feat(data): ajoute la persistance SQLite et le dépôt de rappels
fix(android): rearme l'alarme exacte apres un redemarrage
refactor(triggers): extrait l'évaluateur du registre
chore(tooling): durcit TypeScript et ajoute les alias d'import
```

### Pourquoi s'imposer ça

Trois bénéfices concrets, au-delà de la cosmétique :

1. **Retrouver quelque chose** : `git log --oneline --grep "^feat(triggers)"`
   donne l'histoire complète d'un sous-système en une commande.
2. **Comprendre l'impact d'un changement** : le type dit immédiatement si un
   commit peut avoir cassé quelque chose (`fix`, `refactor`) ou non (`docs`,
   `style`).
3. **Générer un changelog** : les outils de release lisent ces types pour
   produire les notes de version automatiquement.

## Versions — semver

Le format est `MAJEUR.MINEUR.CORRECTIF`, par exemple `1.4.2`.

| Segment | On l'incrémente quand… | Exemple ici |
|---|---|---|
| **CORRECTIF** | on corrige un bug sans rien changer d'autre | `0.2.0` → `0.2.1` |
| **MINEUR** | on ajoute une fonctionnalité, sans casser l'existant | `0.2.1` → `0.3.0` |
| **MAJEUR** | on casse la compatibilité | `0.9.0` → `1.0.0` |

Incrémenter un segment remet à zéro ceux de droite : après `0.2.1`, une
nouvelle fonctionnalité donne `0.3.0`, pas `0.3.1`.

### Le cas particulier du zéro

Tant que le MAJEUR vaut `0`, le projet est déclaré instable : on s'autorise à
casser la compatibilité sur un incrément mineur. C'est pour cela que la V1 de
Sharp Reminder progresse en `0.1.0`, `0.2.0`, `0.3.0`… et n'atteindra `1.0.0`
qu'une fois les quatre déclencheurs livrés et testés.

### Poser un tag

```bash
git tag -a v0.2.0 -m "Moteur de déclencheurs et déclencheur date/heure"
git tag -l                 # lister les tags
git show v0.2.0            # voir ce que contient une version
```

L'option `-a` crée un tag *annoté* : il porte un auteur, une date et un
message, contrairement au tag léger (`git tag v0.2.0`) qui n'est qu'un
signet. Toujours utiliser `-a` pour une version.

## Rythme de livraison

Une phase du plan = une série de commits + un tag. Chaque déclencheur suit
impérativement ce cycle :

```
implémentation Android → 🚦 test et validation par l'utilisateur
                       → corrections
                       → implémentation iOS
                       → 🚦 test et validation
                       → commit + tag
```

## Avant chaque commit

```bash
npm run verify
```

Typecheck, lint, formatage et tests. Un commit qui ne passe pas `verify` n'est
pas poussé.
