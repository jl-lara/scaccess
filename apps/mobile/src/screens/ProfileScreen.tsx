import type {
  CredentialStatus,
  EmployeeStatus,
  MyProfileResponseDto,
} from '@scaccess/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { getMyProfile } from '../api/meApi'
import { EmptyState } from '../components/EmptyState'
import { ThemeToggleButton } from '../components/ThemeToggleButton'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { radii, spacing, type ThemeColors } from '../theme/colors'
import {
  CREDENTIAL_STATUS_LABELS,
  EMPLOYEE_STATUS_LABELS,
} from '../utils/areaLabels'
import { confirmAction } from '../utils/confirmAction'
import { toProfileError } from '../utils/errorMessages'
import {
  formatCardUid,
  formatDate,
  formatDateTime,
} from '../utils/formatters'

const MONO_FONT = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
})

interface StatusPillTokens {
  backgroundColor: string
  borderColor: string
  textColor: string
}

function getEmployeeStatusTokens(
  status: EmployeeStatus,
  colors: ThemeColors,
): StatusPillTokens {
  switch (status) {
    case 'active':
      return {
        backgroundColor: colors.grantedSoft,
        borderColor: colors.grantedBorder,
        textColor: colors.grantedText,
      }
    case 'suspended':
      return {
        backgroundColor: colors.warningSoft,
        borderColor: colors.warningBorder,
        textColor: colors.warningText,
      }
    case 'inactive':
      return {
        backgroundColor: colors.deniedSoft,
        borderColor: colors.deniedBorder,
        textColor: colors.deniedText,
      }
  }
}

function getCredentialStatusTokens(
  status: CredentialStatus,
  colors: ThemeColors,
): StatusPillTokens {
  switch (status) {
    case 'active':
      return {
        backgroundColor: colors.grantedSoft,
        borderColor: colors.grantedBorder,
        textColor: colors.grantedText,
      }
    case 'blocked':
    case 'lost':
      return {
        backgroundColor: colors.deniedSoft,
        borderColor: colors.deniedBorder,
        textColor: colors.deniedText,
      }
    case 'retired':
      return {
        backgroundColor: colors.surfaceElevated,
        borderColor: colors.borderSubtle,
        textColor: colors.textMuted,
      }
  }
}

function ProfileRow({
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

/**
 * Pantalla de perfil del empleado autenticado: muestra datos laborales,
 * tarjetas RFID asignadas, informacion de cuenta, tema y cierre de sesion.
 */
export function ProfileScreen() {
  const { signOut } = useAuth()
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  const [profile, setProfile] = useState<MyProfileResponseDto | null>(null)
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

    async function loadProfile() {
      setLoading(true)
      setError(null)
      try {
        const data = await getMyProfile()
        if (cancelled) {
          return
        }
        setProfile(data)
      } catch (err) {
        if (cancelled) {
          return
        }
        setError(toProfileError(err))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const data = await getMyProfile()
      if (!isMountedRef.current) {
        return
      }
      setProfile(data)
    } catch (err) {
      if (!isMountedRef.current) {
        return
      }
      setError(toProfileError(err))
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false)
      }
    }
  }, [])

  const isInitialLoading = (loading || refreshing) && profile === null
  const showErrorState = error !== null && profile === null

  useEffect(() => {
    if (!isInitialLoading) {
      setSlowStart(false)
      return
    }
    const timer = setTimeout(() => setSlowStart(true), 3000)
    return () => clearTimeout(timer)
  }, [isInitialLoading])

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

  if (isInitialLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={styles.loadingText}>Cargando perfil…</Text>
        {slowStart ? (
          <Text style={styles.slowHint}>
            Conectando con el servidor… puede tardar unos segundos si estaba en reposo.
          </Text>
        ) : null}
      </View>
    )
  }

  if (showErrorState) {
    return (
      <View style={styles.centered}>
        <EmptyState
          title="No se pudo cargar tu perfil"
          message={error ?? ''}
          actionLabel="Reintentar"
          onAction={() => void refresh()}
        />
      </View>
    )
  }

  if (profile === null) {
    return null
  }

  const { employee, account, credentials } = profile
  const initials = (
    (employee.firstName[0] ?? '') + (employee.lastName[0] ?? '')
  ).toUpperCase()
  const employeeStatusTokens = getEmployeeStatusTokens(employee.status, colors)

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          tintColor={colors.brand}
          colors={[colors.brand]}
        />
      }
    >
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

      <View style={styles.card}>
        <Text style={styles.sectionLabel} accessibilityRole="header">
          Datos del empleado
        </Text>

        <View style={styles.employeeHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitials}>{initials || '—'}</Text>
          </View>
          <View style={styles.employeeIdentity}>
            <Text style={styles.employeeName}>
              {`${employee.firstName} ${employee.lastName}`}
            </Text>
            <Text style={styles.employeeCode}>{employee.employeeCode}</Text>
          </View>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: employeeStatusTokens.backgroundColor,
                borderColor: employeeStatusTokens.borderColor,
              },
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                { color: employeeStatusTokens.textColor },
              ]}
            >
              {EMPLOYEE_STATUS_LABELS[employee.status]}
            </Text>
          </View>
        </View>

        <View style={styles.detailsSection}>
          <ProfileRow
            label="Departamento"
            value={employee.department ?? 'No asignado'}
            styles={styles}
          />
          <ProfileRow
            label="Puesto"
            value={employee.position ?? 'No asignado'}
            styles={styles}
          />
          <ProfileRow
            label="Correo"
            value={employee.email ?? account.email}
            styles={styles}
          />
          <ProfileRow
            label="Fecha de ingreso"
            value={
              employee.hiredAt
                ? formatDate(`${employee.hiredAt}T12:00:00Z`)
                : 'No registrada'
            }
            styles={styles}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel} accessibilityRole="header">
          Mis tarjetas RFID
        </Text>

        {credentials.length === 0 ? (
          <Text style={styles.emptyCredentialsText}>
            No tienes tarjetas RFID asignadas actualmente.
          </Text>
        ) : (
          <View style={styles.credentialsList}>
            {credentials.map((cred) => {
              const credTokens = getCredentialStatusTokens(cred.status, colors)
              const showInactiveNotice =
                cred.status === 'blocked' || cred.status === 'lost'

              return (
                <View key={cred.id} style={styles.credentialItem}>
                  <View style={styles.credentialHeader}>
                    <View style={styles.credentialInfo}>
                      <Text style={styles.credentialUid}>
                        {formatCardUid(cred.cardUid) || cred.cardUid}
                      </Text>
                      <Text style={styles.credentialLabel}>
                        {cred.label ?? 'Tarjeta RFID'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: credTokens.backgroundColor,
                          borderColor: credTokens.borderColor,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          { color: credTokens.textColor },
                        ]}
                      >
                        {CREDENTIAL_STATUS_LABELS[cred.status]}
                      </Text>
                    </View>
                  </View>

                  <ProfileRow
                    label="Emisión"
                    value={
                      cred.issuedAt ? formatDateTime(cred.issuedAt) : '—'
                    }
                    styles={styles}
                  />

                  {showInactiveNotice ? (
                    <Text style={styles.credentialNotice}>
                      Contacta a un administrador para reposición o reactivación.
                    </Text>
                  ) : null}
                </View>
              )
            })}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel} accessibilityRole="header">
          Cuenta y sesión
        </Text>

        <View style={styles.detailsSectionNoBorder}>
          <ProfileRow
            label="Correo de cuenta"
            value={account.email}
            styles={styles}
          />
          <ProfileRow
            label="Último acceso"
            value={
              account.lastLoginAt
                ? formatDateTime(account.lastLoginAt)
                : 'Sesión actual'
            }
            styles={styles}
          />
        </View>

        <View style={styles.themeRow}>
          <Text style={styles.detailLabel}>Tema de la aplicación</Text>
          <ThemeToggleButton />
        </View>

        <Pressable
          onPress={handleSignOut}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
          accessibilityHint="Solicita confirmación antes de cerrar tu sesión"
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.signOutButtonPressed,
          ]}
        >
          <Text style={styles.signOutButtonText}>Cerrar sesión</Text>
        </Pressable>
      </View>
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
      gap: spacing.md,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      gap: spacing.md,
      backgroundColor: colors.background,
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
      gap: spacing.md,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: 2,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.textMuted,
    },
    employeeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: radii.pill,
      backgroundColor: colors.brandSoft,
      borderWidth: 1,
      borderColor: colors.brandBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.brand,
    },
    employeeIdentity: {
      flex: 1,
      gap: 2,
    },
    employeeName: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    employeeCode: {
      fontFamily: MONO_FONT,
      fontSize: 12,
      color: colors.textMuted,
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
    detailsSection: {
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
      paddingTop: spacing.md,
      gap: spacing.sm,
    },
    detailsSectionNoBorder: {
      gap: spacing.sm,
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
    emptyCredentialsText: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
    },
    credentialsList: {
      gap: spacing.sm,
    },
    credentialItem: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.borderSubtle,
      borderWidth: 1,
      borderRadius: radii.md,
      padding: spacing.md,
      gap: spacing.sm,
    },
    credentialHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    credentialInfo: {
      flex: 1,
      gap: 2,
    },
    credentialUid: {
      fontFamily: MONO_FONT,
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    credentialLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    credentialNotice: {
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '500',
      color: colors.deniedText,
    },
    themeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
      paddingTop: spacing.md,
    },
    signOutButton: {
      minHeight: 46,
      borderRadius: radii.md,
      backgroundColor: colors.deniedSoft,
      borderColor: colors.deniedBorder,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
    },
    signOutButtonPressed: {
      opacity: 0.85,
    },
    signOutButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.deniedText,
    },
  })
}
