import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useTheme } from '../context/ThemeContext'
import { radii, spacing, type ThemeColors } from '../theme/colors'
import type { AccessHistorySummary } from '../utils/accessHistory'
import { formatDateTime } from '../utils/formatters'

interface HistorySummaryCardProps {
  summary: AccessHistorySummary
}

interface SummaryMetric {
  key: string
  value: number
  label: string
  backgroundColor: string
  borderColor: string
  valueColor: string
  labelColor: string
}

/**
 * Tarjeta compacta con metricas agregadas del historial personal de accesos
 * (permitidos, denegados, eventos en diferido y fecha del ultimo acceso).
 */
export function HistorySummaryCard({ summary }: HistorySummaryCardProps) {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  const subtitle =
    summary.loadedCount < summary.totalCount
      ? `Mostrando ${summary.loadedCount} de ${summary.totalCount}`
      : `${summary.totalCount} ${summary.totalCount === 1 ? 'registro' : 'registros'}`

  const metrics: SummaryMetric[] = [
    {
      key: 'granted',
      value: summary.grantedCount,
      label: 'Permitidos',
      backgroundColor: colors.grantedSoft,
      borderColor: colors.grantedBorder,
      valueColor: colors.grantedText,
      labelColor: colors.grantedText,
    },
    {
      key: 'denied',
      value: summary.deniedCount,
      label: 'Denegados',
      backgroundColor: colors.deniedSoft,
      borderColor: colors.deniedBorder,
      valueColor: colors.deniedText,
      labelColor: colors.deniedText,
    },
    summary.delayedCount > 0
      ? {
          key: 'delayed',
          value: summary.delayedCount,
          label: 'En diferido',
          backgroundColor: colors.warningSoft,
          borderColor: colors.warningBorder,
          valueColor: colors.warningText,
          labelColor: colors.warningText,
        }
      : {
          key: 'total',
          value: summary.totalCount,
          label: 'Total',
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.borderSubtle,
          valueColor: colors.textPrimary,
          labelColor: colors.textMuted,
        },
  ]

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title} accessibilityRole="header">
          Resumen de actividad
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.metricsRow}>
        {metrics.map((metric) => (
          <View
            key={metric.key}
            accessible
            accessibilityLabel={`${metric.label}: ${metric.value}`}
            style={[
              styles.metricBox,
              {
                backgroundColor: metric.backgroundColor,
                borderColor: metric.borderColor,
              },
            ]}
          >
            <Text style={[styles.metricValue, { color: metric.valueColor }]}>
              {metric.value}
            </Text>
            <Text
              style={[styles.metricLabel, { color: metric.labelColor }]}
              numberOfLines={1}
            >
              {metric.label}
            </Text>
          </View>
        ))}
      </View>

      {summary.latestOccurredAt !== null ? (
        <Text style={styles.footerText}>
          {`Último acceso: ${formatDateTime(summary.latestOccurredAt)}`}
        </Text>
      ) : null}
    </View>
  )
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.borderSubtle,
      borderWidth: 1,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      gap: spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      flexShrink: 1,
    },
    subtitle: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textMuted,
    },
    metricsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    metricBox: {
      flex: 1,
      borderWidth: 1,
      borderRadius: radii.md,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    metricValue: {
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 24,
    },
    metricLabel: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
    },
    footerText: {
      fontSize: 12,
      color: colors.textMuted,
    },
  })
}
