import type { ImageSourcePropType } from 'react-native'

import isotipoLight from '../../assets/isotipo.png'
import isotipoDark from '../../assets/isotipo_oscuro_transparente.png'
import wordmarkLight from '../../assets/logo_accesa_fondo_blanco.png'
import wordmarkDark from '../../assets/logo_accesa_fondo_blanco_oscuro_transparente.png'

export interface BrandAssets {
  isotipo: ImageSourcePropType
  wordmark: ImageSourcePropType
}

/**
 * Devuelve las variantes de isotipo y wordmark de Accesa segun el tema activo.
 */
export function getBrandAssets(isDark: boolean): BrandAssets {
  return isDark
    ? { isotipo: isotipoDark, wordmark: wordmarkDark }
    : { isotipo: isotipoLight, wordmark: wordmarkLight }
}
