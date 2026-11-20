import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '../context/ThemeContext'
import { radii, spacing, type ThemeColors } from '../theme/colors'

interface EmptyStateProps {
  title: string
  message?: string
  actionLabel?: string
  onAction?: () => void
}

/**
 * Estado vacio centrado: titulo, mensaje opcional y, si se proveen
 * `actionLabel` y `onAction`, una accion primaria.
 */
export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {message !== undefined ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel !== undefined && onAction !== undefined ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      padding: spacing.xl,
      gap: spacing.sm,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      textAlign: 'center',
    },
    message: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    button: {
      backgroundColor: colors.brand,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      marginTop: spacing.sm,
    },
    buttonPressed: {
      opacity: 0.85,
    },
    buttonLabel: {
      color: colors.brandContrast,
      fontSize: 15,
      fontWeight: '600',
    },
  })
}
