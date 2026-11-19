import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { colors, radii, spacing } from '../theme/colors'

export function UnsupportedAccountScreen() {
  const { signOut } = useAuth()

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>!</Text>
        </View>

        <Text style={styles.title}>Esta cuenta no tiene un perfil de empleado vinculado</Text>
        <Text style={styles.message}>
          Esta es una cuenta administrativa y no puede ver el historial de accesos. Usa una
          cuenta vinculada a un perfil de empleado para consultar tus eventos.
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={signOut}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warningSoft,
    marginBottom: spacing.lg,
  },
  iconText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.warningText,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  button: {
    backgroundColor: colors.brand,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonText: {
    color: colors.brandContrast,
    fontSize: 16,
    fontWeight: '600',
  },
})
