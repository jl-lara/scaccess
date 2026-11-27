import type { AccessDecision } from '@scaccess/shared'
import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useTheme } from '../context/ThemeContext'
import { radii, spacing, type ThemeColors } from '../theme/colors'
import { DECISION_LABELS } from '../utils/areaLabels'

interface DecisionBadgeProps {
  decision: AccessDecision
  compact?: boolean
}

const COMPACT_DECISION_LABELS: Record<AccessDecision, string> = {
  granted: 'Permitido',
  denied: 'Denegado',
}

/**
 * Insignia (pill) que resume la decision de un evento de acceso.
 * El texto ya es explicito ("Acceso permitido" / "Acceso denegado",
 * o su version compacta "Permitido" / "Denegado"), por lo que no depende
 * solo del color para comunicar el estado.
 */
export function DecisionBadge({ decision, compact = false }: DecisionBadgeProps) {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const isGranted = decision === 'granted'
  const accessibilityLabel = DECISION_LABELS[decision]
  const displayLabel = compact
    ? COMPACT_DECISION_LABELS[decision]
    : accessibilityLabel

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[styles.badge, isGranted ? styles.granted : styles.denied]}
    >
      <Text style={[styles.label, isGranted ? styles.grantedText : styles.deniedText]}>
        {displayLabel}
      </Text>
    </View>
  )
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    badge: {
      alignSelf: 'flex-start',
      borderRadius: radii.pill,
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    granted: {
      backgroundColor: colors.grantedSoft,
      borderColor: colors.grantedBorder,
    },
    denied: {
      backgroundColor: colors.deniedSoft,
      borderColor: colors.deniedBorder,
    },
    label: {
      fontSize: 12,
      fontWeight: '700',
    },
    grantedText: {
      color: colors.grantedText,
    },
    deniedText: {
      color: colors.deniedText,
    },
  })
}
