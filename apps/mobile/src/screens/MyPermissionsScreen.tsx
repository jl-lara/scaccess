import type { MyAccessPermissionDto } from '@scaccess/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { listMyPermissions } from '../api/meApi'
import { EmptyState } from '../components/EmptyState'
import { useTheme } from '../context/ThemeContext'
import { radii, spacing, type ThemeColors } from '../theme/colors'
import { toPermissionsError } from '../utils/errorMessages'
import { TIJUANA_TIME_ZONE } from '../utils/formatters'
import {
  formatPermissionSchedule,
  formatValidityRange,
  getPermissionEffectiveStatus,
  PERMISSION_STATUS_LABELS,
  type PermissionEffectiveStatus,
} from '../utils/permissionsFormatters'

const FILTER_OPTIONS: Array<{
  key: string
  label: string
  targetShowAll: boolean
}> = [
  { key: 'active', label: 'Solo permisos vigentes', targetShowAll: false },
  { key: 'all', label: 'Incluir vencidos y revocados', targetShowAll: true },
]

interface StatusPillTokens {
  backgroundColor: string
  borderColor: string
  textColor: string
}

function getPermissionStatusTokens(
  status: PermissionEffectiveStatus,
  colors: ThemeColors,
): StatusPillTokens {
  switch (status) {
    case 'active':
      return {
        backgroundColor: colors.grantedSoft,
        borderColor: colors.grantedBorder,
        textColor: colors.grantedText,
      }
    case 'scheduled':
      return {
        backgroundColor: colors.brandSoft,
        borderColor: colors.brandBorder,
        textColor: colors.brand,
      }
    case 'expired':
    case 'area_inactive':
      return {
        backgroundColor: colors.warningSoft,
        borderColor: colors.warningBorder,
        textColor: colors.warningText,
      }
    case 'revoked':
      return {
        backgroundColor: colors.deniedSoft,
        borderColor: colors.deniedBorder,
        textColor: colors.deniedText,
      }
  }
}

function CardSeparator() {
  return <View style={separatorStyle.box} />
}

const separatorStyle = StyleSheet.create({
  box: {
    height: spacing.md,
  },
})

function DetailRow({
  label,
  value,
  styles,
}: {
  label: string
  value: string
  styles: ReturnType<typeof createStyles>
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  )
}

function PermissionCard({
  permission,
  colors,
  styles,
}: {
  permission: MyAccessPermissionDto
  colors: ThemeColors
  styles: ReturnType<typeof createStyles>
}) {
  const status = getPermissionEffectiveStatus(permission)
  const statusLabel = PERMISSION_STATUS_LABELS[status]
  const statusTokens = getPermissionStatusTokens(status, colors)

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.areaName}>{permission.area.name}</Text>
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: statusTokens.backgroundColor,
              borderColor: statusTokens.borderColor,
            },
          ]}
        >
          <Text
            style={[styles.statusPillText, { color: statusTokens.textColor }]}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      {permission.area.description ? (
        <Text style={styles.areaDescription}>{permission.area.description}</Text>
      ) : null}

      <View style={styles.detailsSection}>
        <DetailRow
          label="Vigencia"
          value={formatValidityRange(permission.validFrom, permission.validTo)}
          styles={styles}
        />
        <DetailRow
          label="Horario"
          value={formatPermissionSchedule(permission.schedule)}
          styles={styles}
        />
        {permission.area.timezone !== TIJUANA_TIME_ZONE ? (
          <DetailRow
            label="Zona horaria"
            value={permission.area.timezone}
            styles={styles}
          />
        ) : null}
      </View>
    </View>
  )
}

/**
 * Pantalla de permisos de acceso por area asignados al empleado autenticado.
 * Permite alternar entre permisos vigentes y el listado completo.
 */
export function MyPermissionsScreen() {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  const [permissions, setPermissions] = useState<MyAccessPermissionDto[]>([])
  const [showAll, setShowAll] = useState(false)
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slowStart, setSlowStart] = useState(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadPermissions() {
      setLoading(true)
      setError(null)
      try {
        const response = await listMyPermissions({ activeOnly: !showAll })
        if (cancelled) {
          return
        }
        setPermissions(response.data)
      } catch (err) {
        if (cancelled) {
          return
        }
        setError(toPermissionsError(err))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadPermissions()

    return () => {
      cancelled = true
    }
  }, [showAll])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const response = await listMyPermissions({ activeOnly: !showAll })
      if (!isMountedRef.current) {
        return
      }
      setPermissions(response.data)
    } catch (err) {
      if (!isMountedRef.current) {
        return
      }
      setError(toPermissionsError(err))
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false)
      }
    }
  }, [showAll])

  const isInitialLoading = (loading || refreshing) && permissions.length === 0
  const showErrorState = error !== null && permissions.length === 0

  useEffect(() => {
    if (!isInitialLoading) {
      setSlowStart(false)
      return
    }
    const timer = setTimeout(() => setSlowStart(true), 3000)
    return () => clearTimeout(timer)
  }, [isInitialLoading])

  const listHeader =
    error !== null || (loading && permissions.length > 0) ? (
      <View style={styles.listHeader}>
        {error !== null ? (
          <View style={styles.inlineErrorBanner} role="alert">
            <Text style={styles.inlineErrorText}>{error}</Text>
            <Pressable
              onPress={() => void refresh()}
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
        {loading && permissions.length > 0 ? (
          <View style={styles.updatingRow}>
            <ActivityIndicator size="small" color={colors.brand} />
            <Text style={styles.updatingText}>Actualizando permisos…</Text>
          </View>
        ) : null}
      </View>
    ) : undefined

  return (
    <View style={styles.root}>
      <View style={styles.filterBar}>
        <Pressable
          onPress={() => setFilterMenuOpen(true)}
          accessibilityRole="button"
          accessibilityState={{ expanded: filterMenuOpen }}
          style={({ pressed }) => [
            styles.filterTrigger,
            filterMenuOpen && styles.filterTriggerOpen,
            pressed && styles.filterTriggerPressed,
          ]}
        >
          <Text style={styles.filterTriggerText}>
            {showAll ? 'Mostrar: Todos los permisos' : 'Mostrar: Solo vigentes'}
          </Text>
          <Text style={styles.filterTriggerCaret}>▾</Text>
        </Pressable>
      </View>

      {isInitialLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.loadingText}>Cargando permisos…</Text>
          {slowStart ? (
            <Text style={styles.slowHint}>
              Conectando con el servidor… puede tardar unos segundos si estaba en reposo.
            </Text>
          ) : null}
        </View>
      ) : showErrorState ? (
        <View style={styles.centered}>
          <EmptyState
            title="No se pudieron cargar tus permisos"
            message={error ?? ''}
            actionLabel="Reintentar"
            onAction={() => void refresh()}
          />
        </View>
      ) : (
        <FlatList
          data={permissions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PermissionCard
              permission={item}
              colors={colors}
              styles={styles}
            />
          )}
          ItemSeparatorComponent={CardSeparator}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <EmptyState
              title="Sin permisos asignados"
              message={
                showAll
                  ? 'No tienes permisos registrados en el sistema.'
                  : 'No tienes permisos vigentes en este momento.'
              }
            />
          }
          contentContainerStyle={
            permissions.length === 0
              ? styles.listEmptyContent
              : styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              tintColor={colors.brand}
              colors={[colors.brand]}
            />
          }
        />
      )}

      <Modal
        visible={filterMenuOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setFilterMenuOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={[StyleSheet.absoluteFill, styles.modalBackdrop]}
            onPress={() => setFilterMenuOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar filtros"
          />

          <View style={styles.modalCard} accessibilityViewIsModal>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} accessibilityRole="header">
                Filtrar permisos
              </Text>
              <Pressable
                onPress={() => setFilterMenuOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Cerrar filtros"
                style={({ pressed }) => [
                  styles.modalCloseButton,
                  pressed && styles.modalCloseButtonPressed,
                ]}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            {FILTER_OPTIONS.map((option, index) => {
              const checked = showAll === option.targetShowAll
              return (
                <Pressable
                  key={option.key}
                  onPress={() => {
                    setShowAll(option.targetShowAll)
                    setFilterMenuOpen(false)
                  }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  style={({ pressed }) => [
                    styles.filterOptionRow,
                    index > 0 && styles.filterOptionDivider,
                    pressed && styles.filterOptionPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.checkbox,
                      checked ? styles.checkboxChecked : styles.checkboxUnchecked,
                    ]}
                  >
                    {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
                  </View>
                  <Text
                    style={[
                      styles.filterOptionText,
                      checked && styles.filterOptionTextChecked,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      </Modal>
    </View>
  )
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    filterBar: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    filterTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    filterTriggerOpen: {
      borderColor: colors.brandBorder,
      backgroundColor: colors.brandSoft,
    },
    filterTriggerPressed: {
      backgroundColor: colors.surfaceHover,
    },
    filterTriggerText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    filterTriggerCaret: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    modalBackdrop: {
      backgroundColor: 'rgba(18, 12, 24, 0.52)',
    },
    modalCard: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 1,
      shadowRadius: 16,
      elevation: 8,
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    modalTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    modalCloseButton: {
      width: 28,
      height: 28,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalCloseButtonPressed: {
      backgroundColor: colors.surfaceHover,
    },
    modalCloseText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    filterOptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    filterOptionDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
    },
    filterOptionPressed: {
      backgroundColor: colors.surfaceHover,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: radii.sm,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      backgroundColor: colors.brand,
      borderColor: colors.brand,
    },
    checkboxUnchecked: {
      backgroundColor: colors.surface,
      borderColor: colors.borderStrong,
    },
    checkboxMark: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.brandContrast,
    },
    filterOptionText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    filterOptionTextChecked: {
      fontWeight: '700',
      color: colors.textPrimary,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      gap: spacing.md,
    },
    loadingText: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    slowHint: {
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
      maxWidth: 280,
      color: colors.textMuted,
    },
    listContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    listEmptyContent: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: spacing.lg,
    },
    listHeader: {
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    updatingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    updatingText: {
      fontSize: 13,
      color: colors.textMuted,
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
      gap: spacing.sm,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    areaName: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    statusPill: {
      borderRadius: radii.pill,
      borderWidth: 1,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
    },
    statusPillText: {
      fontSize: 12,
      fontWeight: '700',
    },
    areaDescription: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    detailsSection: {
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
      paddingTop: spacing.sm,
      marginTop: spacing.xs,
      gap: spacing.xs + 2,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    detailLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    detailValue: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '500',
      color: colors.textPrimary,
      textAlign: 'right',
    },
  })
}
