/**
 * Paleta de colores de la app movil, derivada del logotipo de Accesa.
 *
 * El isotipo y el wordmark cuentan con versiones claras (`#1E1427` sobre
 * blanco) y oscuras transparentes para adaptarse dinamicamente a modo claro
 * y modo oscuro, replicando los tokens de `apps/admin/src/styles/theme.css`.
 */

export type ThemeMode = 'light' | 'dark'

export interface ThemeColors {
  brand: string
  brandHover: string
  brandSoft: string
  brandBorder: string
  brandContrast: string

  background: string
  surface: string
  surfaceElevated: string
  surfaceHover: string

  textPrimary: string
  textSecondary: string
  textMuted: string
  textOnBrand: string

  borderSubtle: string
  borderStrong: string

  granted: string
  grantedSoft: string
  grantedBorder: string
  grantedText: string

  denied: string
  deniedSoft: string
  deniedBorder: string
  deniedText: string

  warning: string
  warningSoft: string
  warningBorder: string
  warningText: string

  codeBg: string
  codeText: string

  shadow: string
  white: string
}

export const lightColors: ThemeColors = {
  /** Tinta principal del logo (morado-negro). */
  brand: '#1E1427',
  brandHover: '#312240',
  brandSoft: 'rgba(30, 20, 39, 0.07)',
  brandBorder: 'rgba(30, 20, 39, 0.22)',
  brandContrast: '#FFFFFF',

  background: '#F7F6FA',
  surface: '#FFFFFF',
  surfaceElevated: '#F2EFF6',
  surfaceHover: '#EAE5F0',

  textPrimary: '#1E1427',
  textSecondary: '#4A3E56',
  textMuted: '#766A84',
  textOnBrand: '#F7F5FA',

  borderSubtle: 'rgba(30, 20, 39, 0.09)',
  borderStrong: 'rgba(30, 20, 39, 0.18)',

  /** Acceso permitido (teal). */
  granted: '#0D9488',
  grantedSoft: 'rgba(13, 148, 136, 0.10)',
  grantedBorder: 'rgba(13, 148, 136, 0.28)',
  grantedText: '#0F766E',

  /** Acceso denegado (rosa). */
  denied: '#BE123C',
  deniedSoft: 'rgba(190, 18, 60, 0.09)',
  deniedBorder: 'rgba(190, 18, 60, 0.26)',
  deniedText: '#9F1239',

  /** Advertencia (ambar). */
  warning: '#B45309',
  warningSoft: 'rgba(180, 83, 9, 0.10)',
  warningBorder: 'rgba(180, 83, 9, 0.28)',
  warningText: '#92400E',

  /** Fondo de codigo (UIDs RFID, identificadores). */
  codeBg: '#1E1427',
  codeText: '#F7F5FA',

  shadow: 'rgba(30, 20, 39, 0.12)',
  white: '#FFFFFF',
}

export const darkColors: ThemeColors = {
  brand: '#EDE8F5',
  brandHover: '#FFFFFF',
  brandSoft: 'rgba(237, 232, 245, 0.11)',
  brandBorder: 'rgba(237, 232, 245, 0.28)',
  brandContrast: '#1E1427',

  background: '#120C18',
  surface: '#1E1427',
  surfaceElevated: '#271B33',
  surfaceHover: '#322340',

  textPrimary: '#F7F5FA',
  textSecondary: '#C6BDD1',
  textMuted: '#8E829D',
  textOnBrand: '#1E1427',

  borderSubtle: 'rgba(247, 245, 250, 0.09)',
  borderStrong: 'rgba(247, 245, 250, 0.18)',

  granted: '#10B981',
  grantedSoft: 'rgba(16, 185, 129, 0.14)',
  grantedBorder: 'rgba(16, 185, 129, 0.32)',
  grantedText: '#6EE7B7',

  denied: '#F43F5E',
  deniedSoft: 'rgba(244, 63, 94, 0.14)',
  deniedBorder: 'rgba(244, 63, 94, 0.32)',
  deniedText: '#FDA4AF',

  warning: '#F59E0B',
  warningSoft: 'rgba(245, 158, 11, 0.14)',
  warningBorder: 'rgba(245, 158, 11, 0.32)',
  warningText: '#FCD34D',

  codeBg: '#120C18',
  codeText: '#EDE8F5',

  shadow: 'rgba(0, 0, 0, 0.45)',
  white: '#FFFFFF',
}

export const colors = lightColors

export function getThemeColors(mode: ThemeMode): ThemeColors {
  return mode === 'dark' ? darkColors : lightColors
}

export function resolveThemeMode(
  stored: string | null | undefined,
  systemScheme: string | null | undefined,
): ThemeMode {
  if (stored === 'light' || stored === 'dark') {
    return stored
  }
  return systemScheme === 'dark' ? 'dark' : 'light'
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const
