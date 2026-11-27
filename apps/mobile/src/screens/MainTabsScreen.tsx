import type { AccessEventDto } from '@scaccess/shared'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCallback, useMemo, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BottomTabBar, type MainTabKey } from '../components/BottomTabBar'
import { ThemeToggleButton } from '../components/ThemeToggleButton'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/types'
import { getBrandAssets } from '../theme/brandAssets'
import { radii, spacing, type ThemeColors } from '../theme/colors'
import { confirmAction } from '../utils/confirmAction'
import { AccessHistoryScreen } from './AccessHistoryScreen'
import { MyPermissionsScreen } from './MyPermissionsScreen'
import { ProfileScreen } from './ProfileScreen'

const TAB_TITLES: Record<MainTabKey, string> = {
  history: 'Historial de accesos',
  permissions: 'Mis permisos',
  profile: 'Mi perfil',
}

/**
 * Pantalla contenedora principal con cabecera unificada y barra inferior fija
 * para alternar entre Historial de accesos, Mis permisos y Mi perfil.
 */
export function MainTabsScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'MainTabs'>) {
  const { signOut } = useAuth()
  const { colors, isDark } = useTheme()
  const brandAssets = getBrandAssets(isDark)
  const styles = useMemo(() => createStyles(colors), [colors])

  const [activeTab, setActiveTab] = useState<MainTabKey>('history')

  const handleSignOut = useCallback(() => {
    confirmAction({
      title: 'Cerrar sesión',
      message: '¿Seguro que deseas cerrar tu sesión en Accesa Móvil?',
      confirmLabel: 'Cerrar sesión',
      cancelLabel: 'Cancelar',
      destructive: true,
      onConfirm: signOut,
    })
  }, [signOut])

  const handleSelectEvent = useCallback(
    (event: AccessEventDto) => {
      navigation.navigate('AccessEventDetail', {
        eventId: event.id,
        initialEvent: event,
      })
    },
    [navigation],
  )

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Image
            source={brandAssets.isotipo}
            style={styles.headerLogo}
            resizeMode="contain"
            accessibilityLabel="Accesa"
          />
          <Text
            style={styles.title}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {TAB_TITLES[activeTab]}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <ThemeToggleButton />
          <Pressable
            onPress={handleSignOut}
            accessibilityRole="button"
            accessibilityLabel="Cerrar sesión"
            accessibilityHint="Solicita confirmación antes de cerrar tu sesión"
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.signOutButtonPressed,
            ]}
          >
            <Text style={styles.signOutText}>Salir</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.content}>
        {activeTab === 'history' ? (
          <AccessHistoryScreen onSelectEvent={handleSelectEvent} />
        ) : activeTab === 'permissions' ? (
          <MyPermissionsScreen />
        ) : (
          <ProfileScreen />
        )}
      </View>

      <BottomTabBar activeTab={activeTab} onSelectTab={setActiveTab} />
    </SafeAreaView>
  )
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    headerBrand: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm + 2,
      minWidth: 0,
    },
    headerLogo: {
      width: 24,
      height: 35,
    },
    title: {
      flex: 1,
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    signOutButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radii.pill,
      backgroundColor: colors.deniedSoft,
      borderWidth: 1,
      borderColor: colors.deniedBorder,
    },
    signOutButtonPressed: {
      opacity: 0.8,
    },
    signOutText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.deniedText,
    },
    content: {
      flex: 1,
    },
  })
}
