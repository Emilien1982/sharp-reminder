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
    empty: 'No reminders yet.',
    emptyHint: 'Tap + to create one.',
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
    costWarning: {
      title: 'Battery-intensive trigger',
      body: 'This trigger type keeps a sensor running. It stays active only while a reminder uses it.',
      confirm: 'Got it',
    },
  },
};
