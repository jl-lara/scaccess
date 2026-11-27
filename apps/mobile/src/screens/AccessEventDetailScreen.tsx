import type { AccessEventDto } from '@scaccess/shared'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { getMyAccessEventById } from '../api/accessEventsApi'
import { DecisionBadge } from '../components/DecisionBadge'
import { EmptyState } from '../components/EmptyState'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/types'
import { radii, spacing, type ThemeColors } from '../theme/colors'
import { getSyncDelayInfo } from '../utils/accessHistory'
import { REASON_LABELS, getEventAreaDisplayName } from '../utils/areaLabels'
import { toDetailError } from '../utils/errorMessages'
import { buildEventReceiptMessage } from '../utils/eventReceipt'
import { formatCardUid, formatDateTime } from '../utils/formatters'

const MONO_FONT = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })

function InfoRow({
  label,
  value,
  mono = false,
  withDivider = true,
  styles,
  children,
}: {
  label: string
  value: string
  mono?: boolean
  withDivider?: boolean
  styles: ReturnType<typeof createStyles>
  children?: ReactNode
}) {
  return (
    <View style={[styles.row, withDivider && styles.rowDivider]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.rowMono]}>{value}</Text>
      {children}
    </View>
  )
}

export function AccessEventDetailScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'AccessEventDetail'>) {
  const { eventId, initialEvent } = route.params
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  const [event, setEvent] = useState<AccessEventDto | null>(initialEvent ?? null)
  const [loading, setLoading] = useState(initialEvent == null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const isMountedRef = useRef(true)

  const syncDelay = useMemo(
    () => (event ? getSyncDelayInfo(event.occurredAt, event.receivedAt) : null),
    [event],
  )

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const reload = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)
      try {
        const fresh = await getMyAccessEventById(eventId)
        if (!isMountedRef.current) return
        setEvent(fresh)
      } catch (err) {
        if (!isMountedRef.current) return
        setError(toDetailError(err))
      } finally {
        if (isMountedRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [eventId],
  )

  const handleShareReceipt = useCallback(async () => {
    if (!event || sharing) return
    setShareError(null)
    setSharing(true)
    try {
      await Share.share(buildEventReceiptMessage(event))
    } catch {
      if (isMountedRef.current) {
        setShareError('No se pudo abrir el menú de compartir en este dispositivo.')
      }
    } finally {
      if (isMountedRef.current) {
        setSharing(false)
      }
    }
  }, [event, sharing])

  useEffect(() => {
    void reload(false)
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
          onAction={() => reload(false)}
        />
      </View>
    )
  }

  if (event === null || syncDelay === null) {
    return null
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => reload(true)}
          tintColor={colors.brand}
          colors={[colors.brand]}
        />
      }
    >
      {error !== null ? (
        <View style={styles.inlineErrorBanner} role="alert">
          <Text style={styles.inlineErrorText}>{error}</Text>
          <Pressable
            onPress={() => reload(true)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
          >
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionLabel} accessibilityRole="header">
          Resumen
        </Text>
        <DecisionBadge decision={event.decision} />
        <Text style={styles.areaName}>{getEventAreaDisplayName(event)}</Text>
        <Text style={styles.reasonText}>{REASON_LABELS[event.reasonCode]}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel} accessibilityRole="header">
          Información del registro
        </Text>

        <InfoRow
          label="Fecha y hora"
          value={formatDateTime(event.occurredAt)}
          withDivider={false}
          styles={styles}
        />

        <InfoRow
          label="Registro en sistema"
          value={formatDateTime(event.receivedAt)}
          styles={styles}
        >
          <View
            style={[
              styles.syncPill,
              syncDelay.isDelayed
                ? styles.syncPillDelayed
                : syncDelay.delaySeconds !== null
                  ? styles.syncPillRealtime
                  : styles.syncPillUnavailable,
            ]}
          >
            <Text
              style={[
                styles.syncPillText,
                syncDelay.isDelayed
                  ? styles.syncPillTextDelayed
                  : syncDelay.delaySeconds !== null
                    ? styles.syncPillTextRealtime
                    : styles.syncPillTextUnavailable,
              ]}
            >
              {syncDelay.detailLabel}
            </Text>
          </View>
          {syncDelay.isDelayed ? (
            <Text style={styles.syncHint}>
              Este acceso se guardó sin conexión y se registró al restablecerse la red.
            </Text>
          ) : null}
        </InfoRow>

        <InfoRow
          label="Tarjeta RFID"
          value={formatCardUid(event.cardUid) || '—'}
          mono
          styles={styles}
        />

        <InfoRow
          label="Referencia"
          value={event.clientEventId}
          mono
          styles={styles}
        />
      </View>

      {shareError !== null ? (
        <View style={styles.shareErrorBox} role="alert">
          <Text style={styles.shareErrorText}>{shareError}</Text>
        </View>
      ) : null}

      <Pressable
        onPress={() => void handleShareReceipt()}
        disabled={sharing}
        accessibilityRole="button"
        accessibilityLabel="Compartir comprobante del evento"
        accessibilityHint="Comparte un resumen del evento de acceso con otras aplicaciones"
        accessibilityState={{ disabled: sharing, busy: sharing }}
        style={({ pressed }) => [
          styles.shareButton,
          pressed && !sharing && styles.shareButtonPressed,
          sharing && styles.shareButtonDisabled,
        ]}
      >
        {sharing ? (
          <View style={styles.shareButtonContent}>
            <ActivityIndicator size="small" color={colors.brandContrast} />
            <Text style={styles.shareButtonText}>Compartiendo…</Text>
          </View>
        ) : (
          <Text style={styles.shareButtonText}>Compartir comprobante</Text>
        )}
      </Pressable>
    </ScrollView>
  )
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
    inlineErrorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      backgroundColor: colors.deniedSoft,
      borderColor: colors.deniedBorder,
      borderWidth: 1,
      borderRadius: radii.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    inlineErrorText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: colors.deniedText,
      fontWeight: '500',
    },
    retryButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.deniedBorder,
    },
    retryButtonPressed: {
      opacity: 0.8,
    },
    retryButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.deniedText,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.borderSubtle,
      borderWidth: 1,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.textMuted,
      marginBottom: spacing.xs,
    },
    areaName: {
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 26,
      color: colors.textPrimary,
      marginTop: spacing.xs,
    },
    reasonText: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
    },
    row: {
      gap: spacing.xs,
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
      paddingTop: spacing.md,
      marginTop: spacing.xs,
    },
    rowLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    rowValue: {
      fontSize: 15,
      lineHeight: 21,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    rowMono: {
      fontFamily: MONO_FONT,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '400',
      color: colors.textSecondary,
    },
    syncPill: {
      alignSelf: 'flex-start',
      borderRadius: radii.pill,
      borderWidth: 1,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
      marginTop: spacing.sm,
    },
    syncPillDelayed: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningBorder,
    },
    syncPillRealtime: {
      backgroundColor: colors.grantedSoft,
      borderColor: colors.grantedBorder,
    },
    syncPillUnavailable: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.borderSubtle,
    },
    syncPillText: {
      fontSize: 12,
      fontWeight: '700',
    },
    syncPillTextDelayed: {
      color: colors.warningText,
    },
    syncPillTextRealtime: {
      color: colors.grantedText,
    },
    syncPillTextUnavailable: {
      color: colors.textMuted,
    },
    syncHint: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
      marginTop: spacing.sm,
    },
    shareErrorBox: {
      backgroundColor: colors.deniedSoft,
      borderColor: colors.deniedBorder,
      borderWidth: 1,
      borderRadius: radii.md,
      padding: spacing.md,
      marginTop: spacing.sm,
    },
    shareErrorText: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.deniedText,
      fontWeight: '500',
    },
    shareButton: {
      minHeight: 48,
      borderRadius: radii.md,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      marginTop: spacing.sm,
    },
    shareButtonPressed: {
      backgroundColor: colors.brandHover,
    },
    shareButtonDisabled: {
      opacity: 0.7,
    },
    shareButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    shareButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.brandContrast,
    },
  })
}
