import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDate, formatTime } from '@/app/formatting';
import type { DateTimeCondition } from '@/domain/triggers/types';

/**
 * Saisie d'un instant ou d'une fenêtre horaire.
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
 * le sélecteur croyait déjà l'avoir. Un rappel daté d'hier devenait impossible
 * à reprogrammer, l'application affirmant « cette date est déjà passée »
 * devant une date qui, à l'écran, ne l'était pas.
 *
 * L'interdiction d'une date passée appartient à `validateForm`, qui la dit
 * explicitement au lieu de la contourner en silence.
 *
 * **Deux modes seulement, et non trois.** « Avant Y » produirait exactement la
 * même donnée que « entre X et Y » : en rouvrant le rappel, rien ne permettrait
 * de retrouver le choix initial, et l'écran afficherait l'autre. Un mode qui ne
 * se reconstruit pas depuis ce qui est enregistré ment à l'utilisateur.
 */

/** Durée proposée pour une fenêtre nouvellement ouverte. */
const DEFAULT_WINDOW_MS = 8 * 60 * 60 * 1000;

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

/**
 * Couple date + heure pour un instant.
 *
 * Extrait parce qu'une fenêtre en demande deux, et que dupliquer la
 * divergence Android/iOS à deux endroits garantirait qu'ils divergent.
 */
function InstantField({
  value,
  onChange,
}: {
  value: string;
  onChange: (iso: string) => void;
}): React.JSX.Element {
  const { t, i18n } = useTranslation();

  const emit = useCallback(
    (next: Date) => onChange(next.toISOString()),
    [onChange],
  );

  const openAndroid = useCallback(
    (mode: 'date' | 'time') => {
      DateTimePickerAndroid.open({
        value: new Date(value),
        mode,
        onValueChange: (_event, picked) => {
          const base = new Date(value);
          emit(
            mode === 'date'
              ? withDatePart(base, picked)
              : withTimePart(base, picked),
          );
        },
      });
    },
    [emit, value],
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
            {formatDate(value, i18n.language)}
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
            {formatTime(value, i18n.language)}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <DateTimePicker
        value={new Date(value)}
        mode="date"
        display="compact"
        locale={i18n.language}
        onValueChange={(_event, picked) =>
          emit(withDatePart(new Date(value), picked))
        }
      />
      <DateTimePicker
        value={new Date(value)}
        mode="time"
        display="compact"
        locale={i18n.language}
        onValueChange={(_event, picked) =>
          emit(withTimePart(new Date(value), picked))
        }
      />
    </View>
  );
}

interface Props {
  condition: DateTimeCondition;
  onChange: (condition: DateTimeCondition) => void;
}

export function DateTimeConditionEditor({
  condition,
  onChange,
}: Props): React.JSX.Element {
  const { t } = useTranslation();
  const hasWindow = condition.until !== undefined;

  const setMode = useCallback(
    (windowed: boolean) => {
      if (windowed === (condition.until !== undefined)) {
        return;
      }

      onChange({
        ...condition,
        // Une fenêtre naît large : huit heures couvrent une journée de
        // courses, et rester le doigt sur le sélecteur pour la réduire est
        // moins pénible que de découvrir qu'elle s'est refermée trop tôt.
        until: windowed
          ? new Date(
              new Date(condition.at).getTime() + DEFAULT_WINDOW_MS,
            ).toISOString()
          : undefined,
      });
    },
    [condition, onChange],
  );

  return (
    <View style={styles.container}>
      <View style={styles.modes}>
        {[false, true].map(windowed => {
          const selected = windowed === hasWindow;
          return (
            <Pressable
              key={String(windowed)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.mode, selected && styles.modeSelected]}
              onPress={() => setMode(windowed)}
            >
              <Text
                style={[styles.modeText, selected && styles.modeTextSelected]}
              >
                {t(windowed ? 'editor.modeWindow' : 'editor.modeAfter')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {hasWindow && <Text style={styles.bound}>{t('editor.windowStart')}</Text>}
      <InstantField
        value={condition.at}
        onChange={at => onChange({ ...condition, at })}
      />

      {hasWindow && condition.until !== undefined && (
        <>
          <Text style={styles.bound}>{t('editor.windowEnd')}</Text>
          <InstantField
            value={condition.until}
            onChange={until => onChange({ ...condition, until })}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
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
  modes: { flexDirection: 'row', gap: 6 },
  mode: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#c9c9c9',
    alignItems: 'center',
  },
  modeSelected: { backgroundColor: '#2c6cb0', borderColor: '#2c6cb0' },
  modeText: { fontSize: 13 },
  modeTextSelected: { color: '#ffffff', fontWeight: '600' },
  bound: { fontSize: 11, opacity: 0.6, textTransform: 'uppercase' },
});
