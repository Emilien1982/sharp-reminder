import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Combinator } from '@/domain/triggers/types';

const CHOICES: Combinator[] = ['OR', 'AND'];

interface Props {
  value: Combinator;
  onChange: (value: Combinator) => void;
}

/**
 * Choix entre « n'importe quelle condition » et « toutes les conditions ».
 *
 * L'éditeur ne l'affiche qu'à partir de deux conditions : `combinator` est
 * sans effet en deçà, et le proposer suggérerait à tort qu'il change quelque
 * chose.
 */
export function CombinatorSelector({
  value,
  onChange,
}: Props): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      {CHOICES.map(choice => {
        const selected = choice === value;

        return (
          <Pressable
            key={choice}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.option, selected && styles.optionSelected]}
            onPress={() => onChange(choice)}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {t(`triggers.combinator.${choice}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c9c9c9',
    alignItems: 'center',
  },
  optionSelected: { backgroundColor: '#2c6cb0', borderColor: '#2c6cb0' },
  label: { fontSize: 14, textAlign: 'center' },
  labelSelected: { color: '#ffffff', fontWeight: '600' },
});
