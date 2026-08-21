import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { RootStackParamList } from '@/app/navigation/routes';
import { ReminderEditorScreen } from '@/app/screens/ReminderEditorScreen';
import { RemindersListScreen } from '@/app/screens/RemindersListScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="RemindersList"
          component={RemindersListScreen}
          options={{ title: t('reminders.listTitle') }}
        />
        <Stack.Screen
          name="ReminderEditor"
          component={ReminderEditorScreen}
          // En modal : l'édition est une tâche que l'on mène à son terme ou
          // que l'on abandonne, pas une étape de navigation dans laquelle on
          // s'enfonce. Le titre est posé par l'écran lui-même, qui seul sait
          // s'il crée ou s'il modifie.
          // Titre centré : c'est le motif standard d'un écran modal encadré
          // par deux actions (Annuler à gauche, Enregistrer à droite). La
          // liste, qui n'a qu'un bouton, garde son titre aligné à gauche.
          options={{ presentation: 'modal', headerTitleAlign: 'center' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
