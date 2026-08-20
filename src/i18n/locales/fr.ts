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
    empty: 'Aucun rappel pour le moment.',
    emptyHint: 'Appuyez sur + pour en créer un.',
    neverFired: 'Jamais déclenché',
    firedAt: 'Déclenché le {{date}}',
    deleteConfirmTitle: 'Supprimer ce rappel ?',
  },
  devPanel: {
    title: 'Panneau de test (temporaire)',
    createInTwoMinutes: 'Créer un rappel dans 2 minutes',
    createInOneMinute: 'Créer un rappel dans 1 minute',
    engineState: 'Moteur : {{count}} règle(s), écoutes actives : {{types}}',
    noActiveListener: 'aucune',
    notificationsDenied:
      'Notifications refusées — le rappel ne s’affichera pas.',
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
    costWarning: {
      title: 'Déclencheur gourmand',
      body: "Ce type de déclencheur sollicite la batterie en continu. Il ne restera actif que tant qu'un rappel l'utilise.",
      confirm: 'J’ai compris',
    },
  },
} as const;
