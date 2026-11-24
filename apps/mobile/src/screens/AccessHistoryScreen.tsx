import type { AccessEventDto, PaginatedResponse } from '@scaccess/shared'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { listMyAccessEvents } from '../api/accessEventsApi'
import { EmptyState } from '../components/EmptyState'
import { EventListItem } from '../components/EventListItem'
import { HistorySkeleton } from '../components/HistorySkeleton'
import { HistorySummaryCard } from '../components/HistorySummaryCard'
import { ThemeToggleButton } from '../components/ThemeToggleButton'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/types'
import { getBrandAssets } from '../theme/brandAssets'
import { radii, spacing, type ThemeColors } from '../theme/colors'
import {
  groupEventsByDay,
  summarizeAccessEvents,
  type AccessEventSection,
} from '../utils/accessHistory'
import { confirmAction } from '../utils/confirmAction'
import { toHistoryError } from '../utils/errorMessages'

function CardSeparator() {
  return <View style={separatorStyle.box} />
}

const separatorStyle = StyleSheet.create({
  box: {
    height: spacing.md,
  },
})

export function AccessHistoryScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'AccessHistory'>) {
  const { userAccount, signOut } = useAuth()
  const { colors, isDark } = useTheme()
  const brandAssets = getBrandAssets(isDark)
  const styles = useMemo(() => createStyles(colors), [colors])

  const [events, setEvents] = useState<AccessEventDto[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [slowStart, setSlowStart] = useState(false)

  const loadPage = useCallback(
    (pageNumber: number): Promise<PaginatedResponse<AccessEventDto>> =>
      listMyAccessEvents({ page: pageNumber, pageSize: 20 }),
    [],
  )

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    setLoadMoreError(null)
    try {
      const response = await loadPage(1)
      setEvents(response.data)
      setPage(1)
      setTotalPages(response.pagination.totalPages)
      setTotalCount(response.pagination.total)
    } catch (err) {
      setError(toHistoryError(err))
    } finally {
      setRefreshing(false)
    }
  }, [loadPage])

  const loadMore = useCallback(async () => {
    if (loading || refreshing) {
      return
    }
    if (page >= totalPages) {
      return
    }

    const nextPage = page + 1
    setLoading(true)
    setLoadMoreError(null)
    try {
      const response = await loadPage(nextPage)
      setEvents((prev) => [...prev, ...response.data])
      setPage(nextPage)
      setTotalPages(response.pagination.totalPages)
      setTotalCount(response.pagination.total)
    } catch (err) {
      setLoadMoreError(toHistoryError(err))
    } finally {
      setLoading(false)
    }
  }, [loading, refreshing, page, totalPages, loadPage])

  useEffect(() => {
    let cancelled = false

    async function initialLoad() {
      setLoading(true)
      setError(null)
      setLoadMoreError(null)
      try {
        const response = await loadPage(1)
        if (cancelled) {
          return
        }
        setEvents(response.data)
        setPage(1)
        setTotalPages(response.pagination.totalPages)
        setTotalCount(response.pagination.total)
      } catch (err) {
        if (cancelled) {
          return
        }
        setError(toHistoryError(err))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void initialLoad()

    return () => {
      cancelled = true
    }
  }, [loadPage])

  const isInitialLoading = (loading || refreshing) && events.length === 0
  const showErrorState = error !== null && events.length === 0

  useEffect(() => {
    if (!isInitialLoading) {
      setSlowStart(false)
      return
    }
    const timer = setTimeout(() => setSlowStart(true), 3000)
    return () => clearTimeout(timer)
  }, [isInitialLoading])

  const sections = useMemo(() => groupEventsByDay(events), [events])
  const summary = useMemo(
    () => summarizeAccessEvents(events, totalCount),
    [events, totalCount],
  )

  const handleSignOut = useCallback(() => {
    confirmAction({
      title: 'Cerrar sesión',
      message: '¿Seguro que deseas cerrar tu sesión en Accesa Móvil?',
      confirmLabel: 'Cerrar sesión',
      cancelLabel: 'Cancelar',
      destructive: true,
      onConfirm: signOut,
    })
  }, [signOut])

  const listHeader =
    error !== null || events.length > 0 ? (
      <View>
        {error !== null ? (
          <View style={styles.inlineErrorBanner} role="alert">
            <Text style={styles.inlineErrorText}>{error}</Text>
            <Pressable
              onPress={refresh}
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
        {events.length > 0 ? <HistorySummaryCard summary={summary} /> : null}
      </View>
    ) : undefined

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={brandAssets.isotipo}
            style={styles.headerLogo}
            resizeMode="contain"
            accessibilityLabel="Accesa"
          />
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Historial de accesos
            </Text>
            <Text style={styles.headerEmail} numberOfLines={1}>
              {userAccount?.email ?? ''}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <ThemeToggleButton />
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            accessibilityRole="button"
            accessibilityLabel="Cerrar sesión"
            accessibilityHint="Solicita confirmación antes de cerrar tu sesión"
          >
            <Text style={styles.signOutText}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isInitialLoading ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          {slowStart ? (
            <Text style={styles.slowHint}>
              Conectando con el servidor… puede tardar unos segundos si estaba en reposo.
            </Text>
          ) : null}
          <HistorySkeleton />
        </ScrollView>
      ) : showErrorState ? (
        <View style={styles.centered}>
          <EmptyState
            title="No se pudo cargar el historial"
            message={error ?? ''}
            actionLabel="Reintentar"
            onAction={refresh}
          />
        </View>
      ) : (
        <SectionList<AccessEventDto, AccessEventSection>
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                {section.title}
              </Text>
              <View
                accessible
                accessibilityLabel={`${section.data.length} ${section.data.length === 1 ? 'evento' : 'eventos'}`}
                style={styles.sectionCountPill}
              >
                <Text style={styles.sectionCountText}>
                  {section.data.length}
                </Text>
              </View>
            </View>
          )}
          renderItem={({ item }) => (
            <EventListItem
              event={item}
              onPress={(e) =>
                navigation.navigate('AccessEventDetail', {
                  eventId: e.id,
                  initialEvent: e,
                })
              }
            />
          )}
          ItemSeparatorComponent={CardSeparator}
          contentContainerStyle={
            events.length === 0 ? styles.listEmptyContent : styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.brand}
              colors={[colors.brand]}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <EmptyState
              title="Sin accesos registrados"
              message="Aún no tienes eventos de acceso. Cuando pases tu tarjeta RFID por un lector, aparecerán aquí."
            />
          }
          ListFooterComponent={
            loading && events.length > 0 ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : loadMoreError !== null ? (
              <View style={styles.footerError} role="alert">
                <Text style={styles.inlineErrorText}>{loadMoreError}</Text>
                <Pressable
                  onPress={loadMore}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.retryButton,
                    pressed && styles.retryButtonPressed,
                  ]}
                >
                  <Text style={styles.retryButtonText}>Reintentar</Text>
                </Pressable>
              </View>
            ) : undefined
          }
        />
      )}
    </SafeAreaView>
  )
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
      gap: spacing.sm,
    },
    headerLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm + 2,
    },
    headerLogo: {
      width: 24,
      height: 35,
    },
    headerInfo: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    headerEmail: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    signOutButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    signOutText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      gap: spacing.md,
    },
    slowHint: {
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
      alignSelf: 'center',
      maxWidth: 280,
      marginBottom: spacing.md,
      color: colors.textMuted,
    },
    listContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    listEmptyContent: {
      flexGrow: 1,
      padding: spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    sectionTitle: {
      flex: 1,
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    sectionCountPill: {
      minWidth: 24,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      alignItems: 'center',
    },
    sectionCountText: {
      fontSize: 11,
      fontWeight: '700',
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
    footer: {
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    footerError: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      backgroundColor: colors.deniedSoft,
      borderColor: colors.deniedBorder,
      borderWidth: 1,
      borderRadius: radii.md,
      padding: spacing.md,
      marginTop: spacing.md,
    },
  })
}
