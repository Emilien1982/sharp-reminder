import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

/**
 * Bouton de barre de navigation.
 *
 * Factorisé parce que trois en-têtes le réclament (Annuler, Enregistrer,
 * Nouveau rappel) et que React Navigation impose de les fournir sous forme de
 * fonction rendue : sans composant nommé, le même bloc de styles serait
 * recopié à chaque emplacement.
 */
interface Props {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  /** Action principale de l'écran : rendue en gras. */
  emphasis?: boolean;
  /** Glyphe seul, agrandi — pour le « + » de la liste. */
  glyph?: boolean;
}

export function HeaderButton({
  label,
  onPress,
  accessibilityLabel,
  disabled = false,
  emphasis = false,
  glyph = false,
}: Props): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
    >
      <Text
        style={[
          styles.label,
          emphasis && styles.emphasis,
          glyph && styles.glyph,
          disabled && styles.disabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 16, color: '#2c6cb0' },
  emphasis: { fontWeight: '600' },
  glyph: { fontSize: 24 },
  disabled: { opacity: 0.4 },
});
