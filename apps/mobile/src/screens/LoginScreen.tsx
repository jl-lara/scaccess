import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ThemeToggleButton } from '../components/ThemeToggleButton'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { getBrandAssets } from '../theme/brandAssets'
import { radii, spacing, type ThemeColors } from '../theme/colors'
import { validateLoginForm } from '../utils/validation'

export function LoginScreen() {
  const { status, error, signIn, clearError } = useAuth()
  const { colors, isDark } = useTheme()
  const brandAssets = getBrandAssets(isDark)
  const styles = useMemo(() => createStyles(colors), [colors])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [slowConnection, setSlowConnection] = useState(false)

  const isBusy = status === 'loading' || submitting
  const displayError = validationError ?? error

  useEffect(() => {
    if (!isBusy) {
      setSlowConnection(false)
      return
    }
    const timer = setTimeout(() => setSlowConnection(true), 3000)
    return () => clearTimeout(timer)
  }, [isBusy])

  const handleEmailChange = useCallback(
    (value: string) => {
      setEmail(value)
      if (validationError !== null) {
        setValidationError(null)
      }
      if (error !== null) {
        clearError()
      }
    },
    [validationError, error, clearError],
  )

  const handlePasswordChange = useCallback(
    (value: string) => {
      setPassword(value)
      if (validationError !== null) {
        setValidationError(null)
      }
      if (error !== null) {
        clearError()
      }
    },
    [validationError, error, clearError],
  )

  const handleSubmit = useCallback(async () => {
    const formError = validateLoginForm(email, password)
    if (formError !== null) {
      setValidationError(formError)
      return
    }

    setValidationError(null)
    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
    } catch {
      // `signIn` captura sus errores internamente y los expone via `error`.
    } finally {
      setSubmitting(false)
    }
  }, [email, password, signIn])

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          <ThemeToggleButton />
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.branding}>
            <Image
              source={brandAssets.wordmark}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="Accesa"
            />
            <Text style={styles.subtitle}>Control de acceso para empleados</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={handleEmailChange}
              placeholder="correo@empresa.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              editable={!isBusy}
            />

            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={handlePasswordChange}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                textContentType="password"
                editable={!isBusy}
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                }
                style={({ pressed }) => [
                  styles.togglePasswordButton,
                  pressed && styles.togglePasswordPressed,
                ]}
              >
                <Text style={styles.togglePasswordText}>
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </Text>
              </Pressable>
            </View>

            {displayError !== null ? (
              <View style={styles.alertBox} role="alert">
                <Text style={styles.alertText}>{displayError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.button, isBusy && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={isBusy}
              accessibilityRole="button"
              accessibilityState={{ disabled: isBusy, busy: isBusy }}
            >
              {isBusy ? (
                <ActivityIndicator color={colors.brandContrast} />
              ) : (
                <Text style={styles.buttonText}>Iniciar sesión</Text>
              )}
            </TouchableOpacity>

            {isBusy && slowConnection ? (
              <Text style={styles.slowHint}>
                Conectando con el servidor… puede tardar unos segundos si estaba en reposo.
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
    },
    container: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: spacing.xl,
    },
    branding: {
      alignItems: 'center',
      marginBottom: spacing.xxl,
    },
    logo: {
      width: 210,
      height: 54,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textMuted,
      marginTop: spacing.sm,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      shadowColor: colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: radii.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: 16,
      color: colors.textPrimary,
      backgroundColor: colors.surfaceElevated,
      marginBottom: spacing.lg,
    },
    passwordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    passwordInput: {
      flex: 1,
      marginBottom: 0,
    },
    togglePasswordButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceElevated,
      justifyContent: 'center',
      minHeight: 48,
    },
    togglePasswordPressed: {
      backgroundColor: colors.surfaceHover,
    },
    togglePasswordText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    alertBox: {
      backgroundColor: colors.deniedSoft,
      borderColor: colors.deniedBorder,
      borderWidth: 1,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      marginBottom: spacing.lg,
    },
    alertText: {
      color: colors.deniedText,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500',
    },
    button: {
      backgroundColor: colors.brand,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: colors.brandContrast,
      fontSize: 16,
      fontWeight: '600',
    },
    slowHint: {
      marginTop: spacing.md,
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
      color: colors.textMuted,
    },
  })
}
