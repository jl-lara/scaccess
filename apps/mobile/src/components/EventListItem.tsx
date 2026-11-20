import type { AccessEventDto } from '@scaccess/shared'
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '../context/ThemeContext'
import { radii, spacing, type ThemeColors } from '../theme/colors'
import { getAreaDisplayName, REASON_LABELS } from '../utils/areaLabels'
import { formatDateTime } from '../utils/formatters'
import { DecisionBadge } from './DecisionBadge'

interface EventListItemProps {
  event: AccessEventDto
  onPress: (event: AccessEventDto) => void
}

/**
 * Tarjeta presionable que resume un evento de acceso: area, fecha/hora,
 * motivo y decision. Abre el detalle del evento al presionarse.
 */
export function EventListItem({ event, onPress }: EventListItemProps) {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  return (
    <Pressable
      onPress={() => onPress(event)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.content}>
        <Text style={styles.areaName}>{getAreaDisplayName(event.areaId)}</Text>
        <Text style={styles.dateTime}>{formatDateTime(event.occurredAt)}</Text>
        <Text style={styles.reason}>{REASON_LABELS[event.reasonCode]}</Text>
      </View>
      <DecisionBadge decision={event.decision} />
    </Pressable>
  )
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderColor: colors.borderSubtle,
      borderWidth: 1,
      borderRadius: radii.lg,
      padding: spacing.lg,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: 2,
    },
    cardPressed: {
      backgroundColor: colors.surfaceHover,
    },
    content: {
      flex: 1,
      marginRight: spacing.md,
    },
    areaName: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    dateTime: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: spacing.xs,
    },
    reason: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: spacing.xs,
    },
  })
}
