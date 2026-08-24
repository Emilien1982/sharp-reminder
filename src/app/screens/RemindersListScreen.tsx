import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { HeaderButton } from '@/app/components/HeaderButton';
import { formatDateTime } from '@/app/formatting';
import type { RootStackParamList } from '@/app/navigation/routes';
import { getReminderRepository } from '@/data/reminderRepository';
import {
  deleteReminder,
  duplicateReminder,
  updateReminder,
} from '@/domain/reminders/reminderService';
import type { Reminder } from '@/domain/reminders/types';
import type { TriggerEngineDiagnostics } from '@/domain/triggers/snapshot';
import type { TriggerCondition } from '@/domain/triggers/types';
import { assertNeverCondition } from '@/domain/triggers/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDiagnostics } from '@/native/triggerEngine';

type Props = NativeStackScreenProps<RootStackParamList, 'RemindersList'>;

/**
 * Normalise une cause de rejet en message affichable.
 *
 * `setError` attend une chaîne : lui passer directement un `Error` le ferait
 * rendre tel quel dans un `<Text>`, ce que React refuse — l'écran planterait
 * au lieu de montrer la panne qu'il est censé signaler.
 */
function toMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export function RemindersListScreen({ navigation }: Props): React.JSX.Element {
  const { t, i18n } = useTranslation();
  // La barre de navigation système recouvre le bas de l'écran : sans cette
  // marge, le pied de page de diagnostic passe dessous et devient illisible.
  const insets = useSafeAreaInsets();
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
      setError(toMessage(cause));
    }
  }, []);

  // Rechargé à chaque retour sur l'écran, et pas seulement au montage : sinon
  // un rappel créé ou modifié dans l'éditeur ne s'afficherait qu'après un
  // tirer-pour-rafraîchir.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton
          label="＋"
          glyph
          accessibilityLabel={t('reminders.add')}
          onPress={() => navigation.navigate('ReminderEditor')}
        />
      ),
    });
  }, [navigation, t]);

  /**
   * Résumé d'une condition sur une ligne.
   *
   * Deuxième point d'extension des phases 4 à 6, avec `ConditionEditor` :
   * ajouter un type de déclencheur fera échouer la compilation ici.
   */
  const describe = useCallback(
    (condition: TriggerCondition): string => {
      switch (condition.type) {
        case 'datetime':
          return formatDateTime(condition.at, i18n.language);
        case 'wifi':
          return `${t('triggers.wifi')} · ${condition.ssid}`;
        case 'bluetooth':
          return `${t('triggers.bluetooth')} · ${condition.deviceName}`;
        case 'location':
          return [
            t('triggers.location'),
            t(`editor.location.direction.${condition.direction}`),
            `${condition.radiusMeters} m`,
          ].join(' · ');
        default:
          return assertNeverCondition(condition);
      }
    },
    [i18n.language, t],
  );

  const summarise = useCallback(
    (reminder: Reminder): string => {
      const separator = ` ${t(
        `triggers.combinatorShort.${reminder.combinator}`,
      )} `;
      return reminder.conditions.map(describe).join(separator);
    },
    [describe, t],
  );

  const confirmDelete = useCallback(
    (reminder: Reminder) => {
      Alert.alert(t('reminders.deleteConfirmTitle'), reminder.text, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            void deleteReminder(reminder.id)
              .then(load)
              .catch(cause => setError(toMessage(cause)));
          },
        },
      ]);
    },
    [load, t],
  );

  const showActions = useCallback(
    (reminder: Reminder) => {
      Alert.alert(t('reminders.actionsTitle'), reminder.text, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.duplicate'),
          onPress: () => {
            void duplicateReminder(reminder.id)
              .then(load)
              .catch(cause => setError(toMessage(cause)));
          },
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => confirmDelete(reminder),
        },
      ]);
    },
    [confirmDelete, load, t],
  );

  const toggleEnabled = useCallback(
    (reminder: Reminder, enabled: boolean) => {
      void updateReminder(reminder.id, { enabled })
        .then(load)
        .catch(cause => setError(toMessage(cause)));
    },
    [load],
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
        Ce bandeau n'est pas décoratif. Des notifications refusées rendent
        l'application totalement muette — les rappels se déclenchent, le moteur
        tourne, et rien ne s'affiche. C'est le mode de défaillance le plus
        trompeur du projet ; il doit rester visible en permanence.
      */}
      {diagnostics !== null && !diagnostics.notificationsAuthorized && (
        <Text style={styles.blocked}>{t('notifications.blocked')}</Text>
      )}

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
            <View style={styles.row}>
              <Pressable
                style={styles.rowMain}
                accessibilityRole="button"
                onPress={() =>
                  navigation.navigate('ReminderEditor', { reminderId: item.id })
                }
                onLongPress={() => showActions(item)}
              >
                <Text style={[styles.rowText, !item.enabled && styles.faded]}>
                  {item.text}
                </Text>
                <Text style={styles.rowMeta}>{summarise(item)}</Text>
                <Text style={styles.rowMeta}>
                  {item.enabled
                    ? item.lastFiredAt === null
                      ? t('reminders.neverFired')
                      : t('reminders.firedAt', {
                          date: formatDateTime(item.lastFiredAt, i18n.language),
                        })
                    : t('reminders.inactive')}
                </Text>
              </Pressable>

              <Switch
                value={item.enabled}
                onValueChange={enabled => toggleEnabled(item, enabled)}
              />
            </View>
          )}
        />
      )}

      {/*
        État réel du moteur natif. Conservé après le retrait du panneau de test
        parce que c'est le seul moyen de constater qu'une écoute s'éteint quand
        on désactive un rappel — une application sans backend ni télémétrie n'a
        pas d'autre canal.
      */}
      {diagnostics !== null && (
        <Text
          style={[styles.engineState, { paddingBottom: insets.bottom + 8 }]}
        >
          {t('diagnostics.engineState', {
            count: diagnostics.ruleCount,
            types:
              diagnostics.activeTriggerTypes.length > 0
                ? diagnostics.activeTriggerTypes.join(', ')
                : t('diagnostics.noActiveListener'),
          })}
        </Text>
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
  blocked: {
    fontSize: 13,
    color: '#ffffff',
    backgroundColor: '#a4302a',
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d8d8d8',
  },
  rowMain: { flex: 1 },
  rowText: { fontSize: 16, marginBottom: 4 },
  faded: { opacity: 0.5 },
  rowMeta: { fontSize: 12, opacity: 0.6 },
  engineState: {
    fontSize: 11,
    opacity: 0.5,
    textAlign: 'center',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
});
