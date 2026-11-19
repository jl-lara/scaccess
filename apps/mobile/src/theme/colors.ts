/**
 * Paleta de colores de la app movil, derivada del logotipo de Accesa.
 *
 * El isotipo y el wordmark usan la tinta `#1E1427` sobre fondo blanco
 * `#FFFFFF` (ver `logo/` en la raiz del repositorio). Estos tokens replican
 * la paleta clara que ya usa la web administrativa (`apps/admin/src/styles/theme.css`)
 * para mantener una identidad visual coherente entre plataformas.
 */

export const colors = {
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
} as const

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
