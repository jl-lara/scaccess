import type { AccessEventDto } from '@scaccess/shared'
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '../context/ThemeContext'
import { radii, spacing, type ThemeColors } from '../theme/colors'
import { getSyncDelayInfo } from '../utils/accessHistory'
import {
  DECISION_LABELS,
  getEventAreaDisplayName,
  getEventDeviceDisplayName,
  REASON_LABELS,
} from '../utils/areaLabels'
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

  const areaName = getEventAreaDisplayName(event)
  const dateTime = formatDateTime(event.occurredAt)
  const deviceName =
    event.device !== undefined ? getEventDeviceDisplayName(event) : null
  const reasonLabel = REASON_LABELS[event.reasonCode]
  const decisionLabel = DECISION_LABELS[event.decision]
  const syncDelay = getSyncDelayInfo(event.occurredAt, event.receivedAt)
  const delayLabel = syncDelay.isDelayed ? syncDelay.shortLabel : null

  const accessibilityParts = [areaName, decisionLabel, dateTime]
  if (deviceName !== null) {
    accessibilityParts.push(deviceName)
  }
  accessibilityParts.push(reasonLabel)
  if (delayLabel !== null) {
    accessibilityParts.push(delayLabel)
  }
  const accessibilityLabel = accessibilityParts.join(', ')

  return (
    <Pressable
      onPress={() => onPress(event)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Abre el detalle del evento de acceso"
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.content}>
        <Text style={styles.areaName}>{areaName}</Text>
        <Text style={styles.dateTime}>{dateTime}</Text>
        {deviceName !== null ? (
          <Text style={styles.device}>{deviceName}</Text>
        ) : null}
        <Text style={styles.reason}>{reasonLabel}</Text>
        {delayLabel !== null ? (
          <View style={styles.delayPill}>
            <Text style={styles.delayPillText}>{delayLabel}</Text>
          </View>
        ) : null}
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
    device: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: spacing.xs,
    },
    reason: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: spacing.xs,
    },
    delayPill: {
      alignSelf: 'flex-start',
      marginTop: spacing.xs,
      borderRadius: radii.pill,
      borderWidth: 1,
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningBorder,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    delayPillText: {
      color: colors.warningText,
      fontSize: 11,
      fontWeight: '600',
    },
  })
}
