import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AccessEventDto, PaginatedResponse } from '@scaccess/shared'
import { useAuth } from '../context/AuthContext'
import { listMyAccessEvents } from '../api/accessEventsApi'
import { MobileApiError } from '../api/httpClient'
import { EventListItem } from '../components/EventListItem'
import { EmptyState } from '../components/EmptyState'
import { colors, radii, spacing } from '../theme/colors'
import type { RootStackParamList } from '../navigation/types'

function toHistoryError(error: unknown): string {
  if (error instanceof MobileApiError) {
    if (error.status === 403) {
      return 'Esta cuenta no tiene acceso al historial de empleado.'
    }
    if (error.status === 0) {
      return 'Sin conexión o el servidor tarda en responder. Inténtalo de nuevo.'
    }
    return 'No se pudo cargar el historial. Inténtalo de nuevo.'
  }

  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('unable to resolve')
  ) {
    return 'Sin conexión o el servidor tarda en responder. Inténtalo de nuevo.'
  }

  return 'No se pudo cargar el historial. Inténtalo de nuevo.'
}

export function AccessHistoryScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'AccessHistory'>) {
  const { userAccount, signOut } = useAuth()

  const [events, setEvents] = useState<AccessEventDto[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPage = useCallback(
    (pageNumber: number): Promise<PaginatedResponse<AccessEventDto>> =>
      listMyAccessEvents({ page: pageNumber, pageSize: 20 }),
    [],
  )

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const response = await loadPage(1)
      setEvents(response.data)
      setPage(1)
      setTotalPages(response.pagination.totalPages)
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
    try {
      const response = await loadPage(nextPage)
      setEvents((prev) => [...prev, ...response.data])
      setPage(nextPage)
      setTotalPages(response.pagination.totalPages)
    } catch (err) {
      setError(toHistoryError(err))
    } finally {
      setLoading(false)
    }
  }, [loading, refreshing, page, totalPages, loadPage])

  useEffect(() => {
    let cancelled = false

    async function initialLoad() {
      setLoading(true)
      setError(null)
      try {
        const response = await loadPage(1)
        if (cancelled) {
          return
        }
        setEvents(response.data)
        setPage(1)
        setTotalPages(response.pagination.totalPages)
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

  const isInitialLoading = loading && events.length === 0
  const showErrorState = error !== null && events.length === 0

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Historial de accesos</Text>
          <Text style={styles.headerEmail}>{userAccount?.email ?? ''}</Text>
        </View>
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={signOut}
          accessibilityRole="button"
        >
          <Text style={styles.signOutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>

      {isInitialLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
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
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
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
            ) : undefined
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  headerInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerEmail: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  signOutButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  listEmptyContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
})
