# Décisions d'architecture

Un ADR (*Architecture Decision Record*) consigne une décision structurante :
le problème posé, l'option retenue, et surtout **ce qu'on abandonne en la
retenant**.

L'intérêt n'est pas documentaire mais pratique : dans six mois, face à un
choix qui semble absurde, l'ADR dit s'il était réfléchi ou accidentel. Il évite
de refaire trois fois le même débat.

Un ADR ne se modifie pas : il se remplace. Une décision annulée reste dans le
dossier avec le statut « Remplacée par 000X ».

| N° | Décision | Statut |
|---|---|---|
| [0001](0001-choix-du-framework.md) | React Native CLI plutôt que Expo, Flutter ou natif | Acceptée |
| [0002](0002-moteur-de-triggers-natif.md) | Le moteur de déclencheurs vit dans le natif | Acceptée |
| [0003](0003-stockage-local.md) | SQLite, conditions stockées en JSON | Acceptée |
| [0004](0004-selecteur-date-heure.md) | Sélecteur date/heure natif plutôt que saisie texte | Acceptée |
