import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDate, formatTime } from '@/app/formatting';
import type { DateTimeCondition } from '@/domain/triggers/types';

/**
 * Saisie de la date et de l'heure d'un déclencheur.
 *
 * Ce composant existe pour absorber une divergence d'API entre les deux
 * plateformes, et l'empêcher de contaminer l'écran d'édition :
 *
 * - **Android** n'a pas de mode `datetime`. Il faut deux dialogues successifs,
 *   ouverts en impératif via `DateTimePickerAndroid.open()`.
 * - **iOS** rend le sélecteur comme un composant inline, affiché en
 *   permanence.
 *
 * Dans les deux cas, choisir une date ne doit pas écraser l'heure déjà réglée,
 * et inversement — d'où les fusions par partie ci-dessous.
 *
 * **Ne jamais remettre `minimumDate` ici.** Le sélecteur natif s'en sert pour
 * remonter la valeur *affichée* jusqu'au minimum, sans émettre le moindre
 * événement : l'écran montrait alors une date que l'état JavaScript n'avait
 * pas, et re-sélectionner cette date ne produisait aucun changement, puisque
 * le sélecteur croyait déjà l'avoir. Un rappel daté d'hier devenait
 * impossible à reprogrammer, l'application affirmant « cette date est déjà
 * passée » devant une date qui, à l'écran, ne l'était pas.
 *
 * L'interdiction d'une date passée appartient à `validateForm`, qui la dit
 * explicitement au lieu de la contourner en silence.
 */

interface Props {
  condition: DateTimeCondition;
  onChange: (condition: DateTimeCondition) => void;
}

/** Remplace le jour sans toucher à l'heure. */
function withDatePart(base: Date, picked: Date): Date {
  const merged = new Date(base);
  merged.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
  return merged;
}

/** Remplace l'heure sans toucher au jour. Les secondes sont remises à zéro. */
function withTimePart(base: Date, picked: Date): Date {
  const merged = new Date(base);
  merged.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  return merged;
}

export function DateTimeConditionEditor({
  condition,
  onChange,
}: Props): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const current = new Date(condition.at);

  const emit = useCallback(
    (next: Date) => {
      onChange({ ...condition, at: next.toISOString() });
    },
    [condition, onChange],
  );

  const openAndroid = useCallback(
    (mode: 'date' | 'time') => {
      DateTimePickerAndroid.open({
        value: new Date(condition.at),
        mode,
        onValueChange: (_event, picked) => {
          const base = new Date(condition.at);
          emit(
            mode === 'date'
              ? withDatePart(base, picked)
              : withTimePart(base, picked),
          );
        },
      });
    },
    [condition.at, emit],
  );

  if (Platform.OS === 'android') {
    return (
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('editor.changeDate')}
          style={styles.field}
          onPress={() => openAndroid('date')}
        >
          <Text style={styles.fieldLabel}>{t('editor.changeDate')}</Text>
          <Text style={styles.fieldValue}>
            {formatDate(condition.at, i18n.language)}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('editor.changeTime')}
          style={styles.field}
          onPress={() => openAndroid('time')}
        >
          <Text style={styles.fieldLabel}>{t('editor.changeTime')}</Text>
          <Text style={styles.fieldValue}>
            {formatTime(condition.at, i18n.language)}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <DateTimePicker
        value={current}
        mode="date"
        display="compact"
        locale={i18n.language}
        onValueChange={(_event, picked) =>
          emit(withDatePart(new Date(condition.at), picked))
        }
      />
      <DateTimePicker
        value={current}
        mode="time"
        display="compact"
        locale={i18n.language}
        onValueChange={(_event, picked) =>
          emit(withTimePart(new Date(condition.at), picked))
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  field: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c9c9c9',
  },
  fieldLabel: { fontSize: 11, opacity: 0.6, textTransform: 'uppercase' },
  fieldValue: { fontSize: 15, marginTop: 2 },
});
