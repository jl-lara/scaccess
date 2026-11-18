import type { AccessDecision } from '@scaccess/shared'
import { StyleSheet, Text, View } from 'react-native'

import { colors, radii, spacing } from '../theme/colors'
import { DECISION_LABELS } from '../utils/areaLabels'

interface DecisionBadgeProps {
  decision: AccessDecision
}

/**
 * Insignia (pill) que resume la decision de un evento de acceso.
 * El texto ya es explicito ("Acceso permitido" / "Acceso denegado"),
 * por lo que no depende solo del color para comunicar el estado.
 */
export function DecisionBadge({ decision }: DecisionBadgeProps) {
  const isGranted = decision === 'granted'

  return (
    <View style={[styles.badge, isGranted ? styles.granted : styles.denied]}>
      <Text style={[styles.label, isGranted ? styles.grantedText : styles.deniedText]}>
        {DECISION_LABELS[decision]}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
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
