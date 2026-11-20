import { useMemo } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'

import { useTheme } from '../context/ThemeContext'
import { radii, spacing, type ThemeColors } from '../theme/colors'

/** Boton compacto para alternar entre tema claro y oscuro. */
export function ThemeToggleButton() {
  const { isDark, colors, toggleTheme } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  return (
    <Pressable
      onPress={toggleTheme}
      accessibilityRole="button"
      accessibilityLabel="Cambiar entre modo claro y modo oscuro"
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <Text style={styles.label}>{isDark ? 'Modo claro' : 'Modo oscuro'}</Text>
    </Pressable>
  )
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    button: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    buttonPressed: {
      backgroundColor: colors.surfaceHover,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  })
}
