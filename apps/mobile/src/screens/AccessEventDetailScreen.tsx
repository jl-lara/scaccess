import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AccessEventDto } from '@scaccess/shared'
import { getMyAccessEventById } from '../api/accessEventsApi'
import { REASON_LABELS, getAreaDisplayName } from '../utils/areaLabels'
import { formatCardUid, formatDateTime } from '../utils/formatters'
import { DecisionBadge } from '../components/DecisionBadge'
import { EmptyState } from '../components/EmptyState'
import { colors, radii, spacing } from '../theme/colors'
import type { RootStackParamList } from '../navigation/types'

const MONO_FONT = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })

function DetailBlock({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockLabel}>{label}</Text>
      <Text style={[styles.blockValue, mono && styles.blockMono]}>{value}</Text>
    </View>
  )
}

export function AccessEventDetailScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'AccessEventDetail'>) {
  const { eventId, initialEvent } = route.params

  const [event, setEvent] = useState<AccessEventDto | null>(initialEvent ?? null)
  const [loading, setLoading] = useState(initialEvent == null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const fresh = await getMyAccessEventById(eventId)
      setEvent(fresh)
    } catch {
      setError('No se pudo cargar el evento. Verifica tu conexión e inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void reload()
  }, [reload])

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Detalle del evento' })
  }, [navigation])

  if (loading && event === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    )
  }

  if (error !== null && event === null) {
    return (
      <View style={styles.centered}>
        <EmptyState
          title="No se pudo cargar el evento"
          message={error}
          actionLabel="Reintentar"
          onAction={reload}
        />
      </View>
    )
  }

  if (event === null) {
    return null
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.block}>
        <Text style={styles.blockLabel}>Resultado</Text>
        <DecisionBadge decision={event.decision} />
        <Text style={styles.reasonText}>{REASON_LABELS[event.reasonCode]}</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockLabel}>Área</Text>
        <Text style={styles.blockValue}>{getAreaDisplayName(event.areaId)}</Text>
        <Text style={styles.blockMono}>{event.areaId}</Text>
      </View>

      <DetailBlock label="Lectura en el lector" value={formatDateTime(event.occurredAt)} />
      <DetailBlock label="Sincronizado al servidor" value={formatDateTime(event.receivedAt)} />
      <DetailBlock label="Tarjeta RFID" value={formatCardUid(event.cardUid)} mono />
      <DetailBlock label="Identificador del evento" value={event.clientEventId} mono />

      {event.deviceSequence !== null ? (
        <DetailBlock label="Secuencia del dispositivo" value={event.deviceSequence} mono />
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  block: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  blockLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  blockValue: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  blockMono: {
    fontFamily: MONO_FONT,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  reasonText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
})
