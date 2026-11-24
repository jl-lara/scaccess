import { useEffect, useMemo, useRef } from 'react'
import { Animated, Platform, StyleSheet, View } from 'react-native'

import { useTheme } from '../context/ThemeContext'
import { radii, spacing, type ThemeColors } from '../theme/colors'

const METRIC_SKELETON_INDICES = [0, 1, 2]
const EVENT_SKELETON_INDICES = [0, 1, 2, 3]

/**
 * Esqueleto animado de carga para la pantalla de historial de accesos.
 * Simula la tarjeta de resumen superior, el encabezado de seccion de dia
 * y cuatro tarjetas de evento mientras llegan los datos.
 */
export function HistorySkeleton() {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const pulse = useRef(new Animated.Value(0.45)).current

  useEffect(() => {
    const useNativeDriver = Platform.OS !== 'web'
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 750, useNativeDriver }),
        Animated.timing(pulse, { toValue: 0.45, duration: 750, useNativeDriver }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel="Cargando historial de accesos"
    >
      <View style={styles.summaryCard}>
        <Animated.View style={[styles.summaryTitle, { opacity: pulse }]} />
        <View style={styles.summaryRow}>
          {METRIC_SKELETON_INDICES.map((index) => (
            <Animated.View
              key={index}
              style={[styles.summaryBox, { opacity: pulse }]}
            />
          ))}
        </View>
      </View>

      <Animated.View style={[styles.sectionHeader, { opacity: pulse }]} />

      {EVENT_SKELETON_INDICES.map((index) => (
        <View key={index} style={styles.eventCard}>
          <View style={styles.eventContent}>
            <Animated.View style={[styles.eventTitle, { opacity: pulse }]} />
            <Animated.View style={[styles.eventDate, { opacity: pulse }]} />
            <Animated.View style={[styles.eventReason, { opacity: pulse }]} />
          </View>
          <Animated.View style={[styles.eventBadge, { opacity: pulse }]} />
        </View>
      ))}
    </View>
  )
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    summaryCard: {
      backgroundColor: colors.surface,
      borderColor: colors.borderSubtle,
      borderWidth: 1,
      borderRadius: radii.lg,
      padding: spacing.lg,
      gap: spacing.md,
    },
    summaryTitle: {
      width: 140,
      height: 16,
      borderRadius: radii.sm,
      backgroundColor: colors.surfaceElevated,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    summaryBox: {
      flex: 1,
      height: 56,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceElevated,
    },
    sectionHeader: {
      width: 96,
      height: 14,
      borderRadius: radii.sm,
      backgroundColor: colors.surfaceElevated,
      marginTop: spacing.xs,
    },
    eventCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderColor: colors.borderSubtle,
      borderWidth: 1,
      borderRadius: radii.lg,
      padding: spacing.lg,
    },
    eventContent: {
      flex: 1,
      marginRight: spacing.md,
      gap: spacing.xs,
    },
    eventTitle: {
      width: '65%',
      height: 16,
      borderRadius: radii.sm,
      backgroundColor: colors.surfaceElevated,
    },
    eventDate: {
      width: '45%',
      height: 12,
      borderRadius: radii.sm,
      backgroundColor: colors.surfaceElevated,
    },
    eventReason: {
      width: '55%',
      height: 12,
      borderRadius: radii.sm,
      backgroundColor: colors.surfaceElevated,
    },
    eventBadge: {
      width: 96,
      height: 24,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceElevated,
    },
  })
}
