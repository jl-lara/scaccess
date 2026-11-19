import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { useAuth } from '../context/AuthContext'
import { AccessEventDetailScreen } from '../screens/AccessEventDetailScreen'
import { AccessHistoryScreen } from '../screens/AccessHistoryScreen'
import { LoginScreen } from '../screens/LoginScreen'
import { UnsupportedAccountScreen } from '../screens/UnsupportedAccountScreen'
import { colors, spacing } from '../theme/colors'
import type { RootStackParamList } from './types'

const Stack = createNativeStackNavigator<RootStackParamList>()

/**
 * Pantalla de carga mientras se resuelve el estado de la sesion.
 * No requiere `NavigationContainer`: es un render condicional previo a la navegacion.
 */
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.brand} />
      <Text style={styles.loadingText}>Cargando sesión…</Text>
    </View>
  )
}

/**
 * Navegacion raiz de la app movil.
 *
 * Solo monta `NavigationContainer` cuando hay una sesion valida; las ramas de
 * carga, cierre de sesion y cuenta no soportada se resuelven como pantallas
 * simples sin contenedor de navegacion.
 */
export function AppNavigator() {
  const { status } = useAuth()

  if (status === 'loading') {
    return <LoadingScreen />
  }

  if (status === 'signedOut') {
    return <LoginScreen />
  }

  if (status === 'unsupported') {
    return <UnsupportedAccountScreen />
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="AccessHistory"
          component={AccessHistoryScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AccessEventDetail"
          component={AccessEventDetailScreen}
          options={{
            title: 'Detalle del evento',
            headerBackTitle: 'Historial',
            headerTintColor: colors.brand,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.textMuted,
  },
})
