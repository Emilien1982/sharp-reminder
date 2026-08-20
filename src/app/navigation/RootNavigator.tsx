import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { RootStackParamList } from '@/app/navigation/routes';
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
