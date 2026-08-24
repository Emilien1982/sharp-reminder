import type { TranslationResources } from '@/i18n/types';

/** English translations. Must mirror the French reference exactly. */
export const en: TranslationResources = {
  common: {
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    duplicate: 'Duplicate',
    edit: 'Edit',
  },
  reminders: {
    listTitle: 'Reminders',
    add: 'New reminder',
    empty: 'No reminders yet.',
    emptyHint: 'Tap + to create one.',
    neverFired: 'Never fired',
    firedAt: 'Fired on {{date}}',
    deleteConfirmTitle: 'Delete this reminder?',
    actionsTitle: 'What would you like to do?',
    inactive: 'Disabled',
  },
  editor: {
    createTitle: 'New reminder',
    editTitle: 'Edit reminder',
    textLabel: 'Reminder text',
    textPlaceholder: 'Take out the bins',
    enabledLabel: 'Reminder active',
    enabledHint:
      'A disabled reminder is kept but stops listening, so it uses no battery.',
    conditionsTitle: 'Conditions',
    addCondition: 'Add a condition',
    removeCondition: 'Remove this condition',
    combinatorTitle: 'Trigger when…',
    afterFireTitle: 'Once fired',
    afterFire: {
      delete: 'Delete the reminder',
      keep: 'Keep it',
    },
    changeDate: 'Date',
    changeTime: 'Time',
    deleteReminder: 'Delete this reminder',
    chooseConditionType: 'What kind of condition?',
    errors: {
      textRequired: 'Enter the reminder text.',
      conditionRequired: 'Add at least one condition.',
      dateTimeInPast: 'That date has already passed.',
      radiusTooSmall: 'The radius must be at least {{min}} metres.',
      locationNotPlaced: 'Place the location on the map.',
    },
    location: {
      hint: 'Tap the map to place the location. Pinch to zoom.',
      useMyPosition: 'My position',
      radius: 'Radius: {{meters}} m',
      direction: {
        enter: 'I am inside the area',
        exit: 'I am outside the area',
      },
      edgeHint:
        'The reminder fires the moment all its conditions become true together.',
      backgroundRequired:
        'Location is only allowed while the app is open: place reminders will not fire in the background. Choose “Allow all the time” in Settings.',
      openSettings: 'Open Settings',
    },
  },
  notifications: {
    blocked: 'Notifications blocked — no reminder will appear.',
    denied: 'Notifications denied — the reminder will not appear.',
  },
  diagnostics: {
    engineState: 'Engine: {{count}} rule(s), active listeners: {{types}}',
    noActiveListener: 'none',
  },
  triggers: {
    datetime: 'Date and time',
    wifi: 'Wi-Fi network',
    bluetooth: 'Bluetooth device',
    location: 'Place',
    combinator: {
      AND: 'All conditions',
      OR: 'Any condition',
    },
    combinatorShort: {
      AND: 'and',
      OR: 'or',
    },
    costWarning: {
      title: 'Battery-intensive trigger',
      body: 'This trigger type keeps a sensor running. It stays active only while a reminder uses it.',
      confirm: 'Got it',
    },
  },
};
