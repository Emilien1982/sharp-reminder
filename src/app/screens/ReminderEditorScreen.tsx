import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CombinatorSelector } from '@/app/components/CombinatorSelector';
import { HeaderButton } from '@/app/components/HeaderButton';
import { ConditionEditor } from '@/app/components/ConditionEditor';
import type { RootStackParamList } from '@/app/navigation/routes';
import { ensureNotificationPermission } from '@/app/permissions/notifications';
import { getReminderRepository } from '@/data/reminderRepository';
import {
  addCondition,
  createDateTimeCondition,
  emptyForm,
  formFromReminder,
  formToDraft,
  removeCondition,
  replaceCondition,
  validateForm,
  type ReminderFormError,
  type ReminderFormState,
} from '@/domain/reminders/reminderForm';
import {
  createReminder,
  updateReminder,
} from '@/domain/reminders/reminderService';
import type { AfterFireBehaviour } from '@/domain/reminders/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ReminderEditor'>;

const AFTER_FIRE_CHOICES: AfterFireBehaviour[] = ['delete', 'keep'];

export function ReminderEditorScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const { t } = useTranslation();
  const reminderId = route.params?.reminderId;

  // `null` tant que le rappel à modifier n'est pas chargé. En création, le
  // formulaire est disponible immédiatement.
  const [form, setForm] = useState<ReminderFormState | null>(
    reminderId === undefined ? emptyForm() : null,
  );
  const [errors, setErrors] = useState<ReminderFormError[]>([]);
  // Version chargée depuis la base, jamais modifiée : sert à distinguer une
  // date passée que l'utilisateur vient de choisir d'une date passée qu'il n'a
  // jamais touchée.
  const [original, setOriginal] = useState<ReminderFormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (reminderId === undefined) {
      return;
    }

    void (async () => {
      try {
        const repository = await getReminderRepository();
        const reminder = await repository.get(reminderId);

        if (reminder === null) {
          // Le rappel a disparu entre l'affichage de la liste et l'ouverture
          // de l'éditeur — un déclenchement avec `afterFire: 'delete'` suffit.
          navigation.goBack();
          return;
        }

        const loaded = formFromReminder(reminder);
        setOriginal(loaded);
        setForm(loaded);
      } catch (cause) {
        // Sans ce filet, un échec laissait l'écran sur un indicateur de
        // chargement perpétuel, sans message ni moyen de comprendre.
        Alert.alert(cause instanceof Error ? cause.message : String(cause));
        navigation.goBack();
      }
    })();
  }, [navigation, reminderId]);

  /** Toute modification efface les erreurs du dernier essai d'enregistrement. */
  const applyChange = useCallback((next: ReminderFormState) => {
    setForm(next);
    setErrors([]);
  }, []);

  const save = useCallback(async () => {
    if (form === null || saving) {
      return;
    }

    // Revalidé avec l'heure courante, et non celle de la dernière frappe :
    // remplir le formulaire prend du temps, et une date choisie « dans une
    // minute » peut être passée au moment d'enregistrer.
    const found = validateForm(form, new Date(), original ?? undefined);
    setErrors(found);

    if (found.length > 0) {
      return;
    }

    setSaving(true);
    try {
      // Permission demandée ici, au moment où elle devient nécessaire.
      // L'enregistrement se poursuit même en cas de refus : le rappel reste
      // valide, l'utilisateur est simplement averti qu'il ne le verra pas.
      const granted = await ensureNotificationPermission();
      if (!granted) {
        Alert.alert(t('notifications.denied'));
      }

      const draft = formToDraft(form);
      if (reminderId === undefined) {
        await createReminder(draft);
      } else {
        await updateReminder(reminderId, draft);
      }

      navigation.goBack();
    } catch (cause) {
      setSaving(false);
      Alert.alert(cause instanceof Error ? cause.message : String(cause));
    }
  }, [form, navigation, original, reminderId, saving, t]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title:
        reminderId === undefined
          ? t('editor.createTitle')
          : t('editor.editTitle'),
      headerLeft: () => (
        <HeaderButton label={t('common.cancel')} onPress={navigation.goBack} />
      ),
      headerRight: () => (
        <HeaderButton
          label={t('common.save')}
          emphasis
          disabled={saving}
          onPress={() => {
            void save();
          }}
        />
      ),
    });
  }, [navigation, reminderId, save, saving, t]);

  if (form === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const errorFor = (code: ReminderFormError['code']): boolean =>
    errors.some(
      error => error.code === code && error.conditionId === undefined,
    );

  const conditionError = (conditionId: string): string | null => {
    const found = errors.find(error => error.conditionId === conditionId);
    return found ? t(`editor.errors.${found.code}`) : null;
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>{t('editor.textLabel')}</Text>
        <TextInput
          style={[
            styles.input,
            errorFor('textRequired') && styles.inputInvalid,
          ]}
          value={form.text}
          onChangeText={text => applyChange({ ...form, text })}
          placeholder={t('editor.textPlaceholder')}
          multiline
        />
        {errorFor('textRequired') && (
          <Text style={styles.error}>{t('editor.errors.textRequired')}</Text>
        )}

        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.label}>{t('editor.enabledLabel')}</Text>
            <Text style={styles.hint}>{t('editor.enabledHint')}</Text>
          </View>
          <Switch
            value={form.enabled}
            onValueChange={enabled => applyChange({ ...form, enabled })}
          />
        </View>

        <Text style={styles.sectionTitle}>{t('editor.conditionsTitle')}</Text>

        {form.conditions.length > 1 && (
          <View style={styles.combinator}>
            <Text style={styles.hint}>{t('editor.combinatorTitle')}</Text>
            <CombinatorSelector
              value={form.combinator}
              onChange={combinator => applyChange({ ...form, combinator })}
            />
          </View>
        )}

        {form.conditions.map(condition => (
          <ConditionEditor
            key={condition.id}
            condition={condition}
            errorMessage={conditionError(condition.id)}
            onChange={next => applyChange(replaceCondition(form, next))}
            onRemove={() => applyChange(removeCondition(form, condition.id))}
          />
        ))}

        {errorFor('conditionRequired') && (
          <Text style={styles.error}>
            {t('editor.errors.conditionRequired')}
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          style={styles.addButton}
          onPress={() =>
            applyChange(addCondition(form, createDateTimeCondition(new Date())))
          }
        >
          <Text style={styles.addButtonText}>+ {t('editor.addCondition')}</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>{t('editor.afterFireTitle')}</Text>
        <View style={styles.afterFireRow}>
          {AFTER_FIRE_CHOICES.map(choice => {
            const selected = choice === form.afterFire;

            return (
              <Pressable
                key={choice}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => applyChange({ ...form, afterFire: choice })}
              >
                <Text
                  style={[
                    styles.optionText,
                    selected && styles.optionTextSelected,
                  ]}
                >
                  {t(`editor.afterFire.${choice}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  hint: { fontSize: 12, opacity: 0.6 },
  input: {
    borderWidth: 1,
    borderColor: '#c9c9c9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    minHeight: 48,
  },
  inputInvalid: { borderColor: '#a4302a' },
  error: { fontSize: 13, color: '#a4302a', marginTop: 6 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 12,
  },
  switchText: { flex: 1 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.6,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 10,
  },
  combinator: { marginBottom: 14, gap: 6 },
  addButton: {
    borderWidth: 1,
    borderColor: '#2c6cb0',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  addButtonText: { color: '#2c6cb0', fontSize: 15, fontWeight: '500' },
  afterFireRow: { flexDirection: 'row', gap: 8 },
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
  optionText: { fontSize: 14, textAlign: 'center' },
  optionTextSelected: { color: '#ffffff', fontWeight: '600' },
});
