import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '../context/ThemeContext'
import { radii, spacing, type ThemeColors } from '../theme/colors'

export type MainTabKey = 'history' | 'permissions' | 'profile'

interface TabItem {
  key: MainTabKey
  label: string
  accessibilityLabel: string
}

const TABS: readonly TabItem[] = [
  {
    key: 'history',
    label: 'Historial',
    accessibilityLabel: 'Pestaña Historial de accesos',
  },
  {
    key: 'permissions',
    label: 'Permisos',
    accessibilityLabel: 'Pestaña Mis permisos y áreas',
  },
  {
    key: 'profile',
    label: 'Perfil',
    accessibilityLabel: 'Pestaña Mi perfil y credencial RFID',
  },
]

interface BottomTabBarProps {
  activeTab: MainTabKey
  onSelectTab: (tab: MainTabKey) => void
}

/** Barra inferior fija para cambiar entre las vistas principales del empleado. */
export function BottomTabBar({ activeTab, onSelectTab }: BottomTabBarProps) {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  return (
    <View style={styles.container} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const isActive = tab.key === activeTab

        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelectTab(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.accessibilityLabel}
            style={({ pressed }) => [
              styles.tab,
              isActive ? styles.tabActive : pressed && styles.tabPressed,
            ]}
          >
            <Text style={[styles.label, isActive && styles.textActive]}>
              {tab.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    tab: {
      flex: 1,
      minHeight: 44,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.xs,
    },
    tabActive: {
      backgroundColor: colors.brandSoft,
      borderColor: colors.brandBorder,
    },
    tabPressed: {
      backgroundColor: colors.surfaceHover,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    textActive: {
      color: colors.brand,
      fontWeight: '700',
    },
  })
}
