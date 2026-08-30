/**
 * Traductions françaises.
 *
 * Ce fichier fait référence : il définit la forme de l'objet de traduction
 * (voir `TranslationResources` dans src/i18n/index.ts). Toute clé ajoutée ici
 * devient obligatoire dans les autres langues, et son absence est signalée à
 * la compilation.
 */
export const fr = {
  common: {
    cancel: 'Annuler',
    save: 'Enregistrer',
    delete: 'Supprimer',
    duplicate: 'Dupliquer',
    edit: 'Modifier',
  },
  reminders: {
    listTitle: 'Rappels',
    add: 'Nouveau rappel',
    empty: 'Aucun rappel pour le moment.',
    emptyHint: 'Appuyez sur + pour en créer un.',
    neverFired: 'Jamais déclenché',
    firedAt: 'Déclenché le {{date}}',
    firedDone: 'Déclenché le {{date}} · terminé',
    expired: 'Plage expirée · ne sonnera plus',
    deleteConfirmTitle: 'Supprimer ce rappel ?',
    actionsTitle: 'Que faire de ce rappel ?',
    inactive: 'Désactivé',
  },
  editor: {
    createTitle: 'Nouveau rappel',
    editTitle: 'Modifier le rappel',
    textLabel: 'Texte du rappel',
    textPlaceholder: 'Sortir les poubelles',
    enabledLabel: 'Rappel actif',
    enabledHint:
      'Un rappel désactivé est conservé mais n’écoute plus rien, et n’use donc pas la batterie.',
    conditionsTitle: 'Conditions',
    addCondition: 'Ajouter une condition',
    removeCondition: 'Retirer cette condition',
    combinatorTitle: 'Déclencher quand…',
    afterFireTitle: 'Une fois déclenché',
    afterFire: {
      delete: 'Supprimer le rappel',
      keep: 'Le conserver',
    },
    modeAfter: 'À partir de',
    modeWindow: 'Entre… et…',
    windowStart: 'Début',
    windowEnd: 'Fin',
    changeDate: 'Date',
    changeTime: 'Heure',
    deleteReminder: 'Supprimer ce rappel',
    chooseConditionType: 'Quel type de condition ?',
    errors: {
      textRequired: 'Indiquez le texte du rappel.',
      conditionRequired: 'Ajoutez au moins une condition.',
      dateTimeInPast: 'Cette date est déjà passée.',
      radiusTooSmall: 'Le rayon doit faire au moins {{min}} mètres.',
      locationNotPlaced: 'Placez le lieu sur la carte.',
      windowInverted: 'La fin doit être après le début.',
      windowClosed: 'Cette plage horaire est déjà terminée.',
      windowAlreadyOpen:
        'Cette plage a déjà commencé : le rappel ne sonnerait jamais.',
    },
    location: {
      hint: 'Appui long sur la carte pour la déplacer.',
      hintMoving: 'Déplacez la carte : le lieu est au centre.',
      unlockDone: 'Terminé',
      useMyPosition: 'Ma position',
      radius: 'Rayon : {{meters}} m',
      /**
       * Ces libellés décrivent un **état**, pas un franchissement — c'est ce
       * que l'évaluateur vérifie réellement. Les nommer « En arrivant » et
       * « En partant » laissait croire l'inverse, et rendait impossible à
       * concevoir un rappel « si je suis encore là à 13h35 », pourtant
       * parfaitement exprimable.
       */
      direction: {
        enter: 'Je suis dans la zone',
        exit: 'Je suis hors de la zone',
      },
      edgeHint:
        'Le rappel part au moment où toutes ses conditions deviennent vraies ensemble.',
      backgroundRequired:
        'Localisation autorisée seulement quand l’app est ouverte : les rappels de lieu ne se déclencheront pas en arrière-plan. Choisissez « Toujours autoriser » dans les réglages.',
      openSettings: 'Ouvrir les réglages',
    },
  },
  notifications: {
    blocked: 'Notifications bloquées — aucun rappel ne s’affichera.',
    denied: 'Notifications refusées — le rappel ne s’affichera pas.',
  },
  diagnostics: {
    engineState: 'Moteur : {{count}} règle(s), écoutes actives : {{types}}',
    noActiveListener: 'aucune',
  },
  triggers: {
    datetime: 'Date et heure',
    wifi: 'Réseau Wi-Fi',
    bluetooth: 'Appareil Bluetooth',
    location: 'Lieu',
    combinator: {
      AND: 'Toutes les conditions',
      OR: "N'importe quelle condition",
    },
    /** Séparateur employé pour résumer une règle sur une ligne. */
    combinatorShort: {
      AND: 'et',
      OR: 'ou',
    },
    costWarning: {
      title: 'Déclencheur gourmand',
      body: "Ce type de déclencheur sollicite la batterie en continu. Il ne restera actif que tant qu'un rappel l'utilise.",
      confirm: 'J’ai compris',
    },
  },
} as const;
