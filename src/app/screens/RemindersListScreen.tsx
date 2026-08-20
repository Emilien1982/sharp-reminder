import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getReminderRepository } from '@/data/reminderRepository';
import type { Reminder } from '@/domain/reminders/types';

export function RemindersListScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const repository = await getReminderRepository();
      setReminders(await repository.list());
    } catch (cause) {
      // Les erreurs de base sont affichées plutôt que masquées : sans backend
      // ni télémétrie (§8 du brief), l'écran est le seul canal de diagnostic.
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error !== null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (reminders === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (reminders.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>{t('reminders.empty')}</Text>
        <Text style={styles.emptyHint}>{t('reminders.emptyHint')}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={reminders}
      keyExtractor={reminder => reminder.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.rowText}>{item.text}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: { fontSize: 17, marginBottom: 6 },
  emptyHint: { fontSize: 14, opacity: 0.6 },
  error: { fontSize: 14, textAlign: 'center' },
  list: { paddingVertical: 8 },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d8d8d8',
  },
  rowText: { fontSize: 16 },
});
