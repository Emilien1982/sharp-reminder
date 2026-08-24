import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DateTimeConditionEditor } from '@/app/components/DateTimeConditionEditor';
import { LocationConditionEditor } from '@/app/components/LocationConditionEditor';
import type { TriggerCondition } from '@/domain/triggers/types';
import { assertNeverCondition } from '@/domain/triggers/types';

/**
 * Rend l'éditeur correspondant au type d'une condition.
 *
 * **C'est le point d'extension des phases 4 à 6.** Ajouter un membre à l'union
 * `TriggerCondition` fera échouer la compilation ici, sur
 * `assertNeverCondition`, avec le nom exact du type à traiter — plutôt que de
 * produire un écran silencieusement incomplet.
 */

interface Props {
  condition: TriggerCondition;
  errorMessage: string | null;
  onChange: (condition: TriggerCondition) => void;
  onRemove: () => void;
}

function ConditionBody({
  condition,
  onChange,
}: Pick<Props, 'condition' | 'onChange'>): React.JSX.Element {
  switch (condition.type) {
    case 'datetime':
      return (
        <DateTimeConditionEditor condition={condition} onChange={onChange} />
      );

    case 'location':
      return (
        <LocationConditionEditor condition={condition} onChange={onChange} />
      );

    // Pas encore constructibles depuis l'interface : les phases 5 et 6 y
    // substitueront un éditeur dédié. En attendant, une condition de ce type
    // ne peut provenir que d'une base écrite par une version ultérieure — on
    // l'affiche plutôt que de la faire disparaître silencieusement.
    case 'wifi':
    case 'bluetooth':
      return <NotEditableYet type={condition.type} />;

    default:
      return assertNeverCondition(condition);
  }
}

function NotEditableYet({
  type,
}: {
  type: 'wifi' | 'bluetooth';
}): React.JSX.Element {
  const { t } = useTranslation();

  return <Text style={styles.notEditable}>{t(`triggers.${type}`)}</Text>;
}

export function ConditionEditor({
  condition,
  errorMessage,
  onChange,
  onRemove,
}: Props): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <View style={[styles.card, errorMessage !== null && styles.cardInvalid]}>
      <View style={styles.header}>
        <Text style={styles.type}>{t(`triggers.${condition.type}`)}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('editor.removeCondition')}
          hitSlop={8}
          onPress={onRemove}
        >
          <Text style={styles.remove}>✕</Text>
        </Pressable>
      </View>

      <ConditionBody condition={condition} onChange={onChange} />

      {errorMessage !== null && (
        <Text style={styles.error}>{errorMessage}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#d8d8d8',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  cardInvalid: { borderColor: '#a4302a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  type: { fontSize: 13, fontWeight: '600', opacity: 0.7 },
  remove: { fontSize: 16, opacity: 0.5, paddingHorizontal: 4 },
  notEditable: { fontSize: 15, opacity: 0.6 },
  error: { fontSize: 13, color: '#a4302a', marginTop: 8 },
});
