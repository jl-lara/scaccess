import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native'

import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { AccessEventDetailScreen } from '../screens/AccessEventDetailScreen'
import { LoginScreen } from '../screens/LoginScreen'
import { MainTabsScreen } from '../screens/MainTabsScreen'
import { UnsupportedAccountScreen } from '../screens/UnsupportedAccountScreen'
import { getBrandAssets } from '../theme/brandAssets'
import { spacing, type ThemeColors } from '../theme/colors'
import type { RootStackParamList } from './types'

const Stack = createNativeStackNavigator<RootStackParamList>()

/**
 * Pantalla de carga mientras se resuelve el estado de la sesion.
 * No requiere `NavigationContainer`: es un render condicional previo a la navegacion.
 */
function LoadingScreen() {
  const { colors, isDark } = useTheme()
  const brandAssets = getBrandAssets(isDark)
  const styles = useMemo(() => createStyles(colors), [colors])
  const [slowStart, setSlowStart] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setSlowStart(true), 3000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <View style={styles.loadingContainer}>
      <Image
        source={brandAssets.isotipo}
        style={styles.loadingLogo}
        resizeMode="contain"
        accessibilityLabel="Accesa"
      />
      <ActivityIndicator size="large" color={colors.brand} />
      <Text style={styles.loadingText}>Cargando sesión…</Text>
      {slowStart ? (
        <Text style={styles.slowHintText}>
          Conectando con el servidor… puede tardar unos segundos si estaba en reposo.
        </Text>
      ) : null}
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
  const { colors, isDark } = useTheme()

  const navigationTheme = useMemo<Theme>(() => {
    const base = isDark ? DarkTheme : DefaultTheme
    return {
      ...base,
      dark: isDark,
      colors: {
        ...base.colors,
        primary: colors.brand,
        background: colors.background,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.borderSubtle,
        notification: colors.denied,
      },
    }
  }, [isDark, colors])

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
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator>
        <Stack.Screen
          name="MainTabs"
          component={MainTabsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AccessEventDetail"
          component={AccessEventDetailScreen}
          options={{
            title: 'Detalle del evento',
            headerBackTitle: 'Historial',
            headerStyle: { backgroundColor: colors.surface },
            headerTitleStyle: { color: colors.textPrimary },
            headerTintColor: colors.brand,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      padding: spacing.xl,
      backgroundColor: colors.background,
    },
    loadingLogo: {
      width: 48,
      height: 70,
      marginBottom: spacing.xs,
    },
    loadingText: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    slowHintText: {
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
      maxWidth: 280,
      color: colors.textMuted,
    },
  })
}
