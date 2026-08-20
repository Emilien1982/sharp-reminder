import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getReminderRepository } from '@/data/reminderRepository';
import { newId } from '@/domain/id';
import {
  createReminder,
  deleteReminder,
} from '@/domain/reminders/reminderService';
import type { Reminder } from '@/domain/reminders/types';
import type { TriggerEngineDiagnostics } from '@/domain/triggers/snapshot';
import { getDiagnostics } from '@/native/triggerEngine';

/**
 * Demande la permission de notification.
 *
 * Depuis Android 13, une notification publiée sans cette permission est
 * silencieusement ignorée : le rappel se déclenche mais reste invisible. On la
 * demande donc au moment de créer un rappel, conformément au principe de
 * permission contextuelle (§4 du brief).
 */
async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version < 33) {
    return true;
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function formatCondition(reminder: Reminder): string {
  return reminder.conditions
    .map(condition =>
      condition.type === 'datetime'
        ? new Date(condition.at).toLocaleString()
        : condition.type,
    )
    .join(reminder.combinator === 'AND' ? ' ET ' : ' OU ');
}

export function RemindersListScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [diagnostics, setDiagnostics] =
    useState<TriggerEngineDiagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const repository = await getReminderRepository();
      setReminders(await repository.list());
      setDiagnostics(await getDiagnostics());
    } catch (cause) {
      // Les erreurs sont affichées plutôt que masquées : sans backend ni
      // télémétrie (§8 du brief), l'écran est le seul canal de diagnostic.
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createTestReminder = useCallback(
    async (minutesFromNow: number) => {
      try {
        const granted = await ensureNotificationPermission();
        if (!granted) {
          Alert.alert(t('devPanel.notificationsDenied'));
        }

        const at = new Date(Date.now() + minutesFromNow * 60_000);

        await createReminder({
          text: `Test ${at.toLocaleTimeString()}`,
          enabled: true,
          combinator: 'OR',
          conditions: [{ id: newId(), type: 'datetime', at: at.toISOString() }],
          afterFire: 'keep',
        });

        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [load, t],
  );

  const confirmDelete = useCallback(
    (reminder: Reminder) => {
      Alert.alert(t('reminders.deleteConfirmTitle'), reminder.text, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            void deleteReminder(reminder.id).then(load);
          },
        },
      ]);
    },
    [load, t],
  );

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

  return (
    <View style={styles.screen}>
      {/*
        Panneau temporaire : il n'existe que pour valider la chaîne complète
        UI → SQLite → moteur natif → notification avant que l'écran de création
        réel n'existe. Il sera retiré en phase 3.
      */}
      <View style={styles.devPanel}>
        <Text style={styles.devTitle}>{t('devPanel.title')}</Text>

        <Pressable
          style={styles.devButton}
          onPress={() => {
            void createTestReminder(1);
          }}
        >
          <Text style={styles.devButtonText}>
            {t('devPanel.createInOneMinute')}
          </Text>
        </Pressable>

        <Pressable
          style={styles.devButton}
          onPress={() => {
            void createTestReminder(2);
          }}
        >
          <Text style={styles.devButtonText}>
            {t('devPanel.createInTwoMinutes')}
          </Text>
        </Pressable>

        {diagnostics !== null && !diagnostics.notificationsAuthorized && (
          <Text style={styles.devWarning}>
            {t('devPanel.notificationsBlocked')}
          </Text>
        )}

        {diagnostics !== null && (
          <Text style={styles.devState}>
            {t('devPanel.engineState', {
              count: diagnostics.ruleCount,
              types:
                diagnostics.activeTriggerTypes.length > 0
                  ? diagnostics.activeTriggerTypes.join(', ')
                  : t('devPanel.noActiveListener'),
            })}
          </Text>
        )}
      </View>

      {reminders.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>{t('reminders.empty')}</Text>
          <Text style={styles.emptyHint}>{t('reminders.emptyHint')}</Text>
        </View>
      ) : (
        <FlatList
          data={reminders}
          keyExtractor={reminder => reminder.id}
          onRefresh={load}
          refreshing={false}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onLongPress={() => confirmDelete(item)}
            >
              <Text style={styles.rowText}>{item.text}</Text>
              <Text style={styles.rowMeta}>{formatCondition(item)}</Text>
              <Text style={styles.rowMeta}>
                {item.lastFiredAt === null
                  ? t('reminders.neverFired')
                  : t('reminders.firedAt', {
                      date: new Date(item.lastFiredAt).toLocaleString(),
                    })}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: { fontSize: 17, marginBottom: 6 },
  emptyHint: { fontSize: 14, opacity: 0.6 },
  error: { fontSize: 14, textAlign: 'center' },
  devPanel: {
    padding: 12,
    backgroundColor: '#fff6e5',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0c9a0',
  },
  devTitle: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.6,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  devButton: {
    backgroundColor: '#2c6cb0',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 6,
  },
  devButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '500' },
  devState: { fontSize: 12, opacity: 0.7, marginTop: 4 },
  devWarning: {
    fontSize: 13,
    color: '#a4302a',
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 2,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d8d8d8',
  },
  rowText: { fontSize: 16, marginBottom: 4 },
  rowMeta: { fontSize: 12, opacity: 0.6 },
});
