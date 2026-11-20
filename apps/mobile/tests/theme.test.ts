import { describe, expect, it } from 'vitest'

import {
  darkColors,
  getThemeColors,
  lightColors,
  resolveThemeMode,
} from '../src/theme/colors'

describe('theme', () => {
  it('prioriza la preferencia guardada frente al esquema del sistema', () => {
    expect(resolveThemeMode('dark', 'light')).toBe('dark')
    expect(resolveThemeMode('light', 'dark')).toBe('light')
  })

  it('usa el esquema del sistema cuando no hay preferencia manual', () => {
    expect(resolveThemeMode(null, 'dark')).toBe('dark')
    expect(resolveThemeMode(undefined, 'light')).toBe('light')
    expect(resolveThemeMode('valor-invalido', 'dark')).toBe('dark')
    expect(resolveThemeMode(null, null)).toBe('light')
  })

  it('devuelve las mismas claves de color para modo claro y oscuro con superficies diferenciadas', () => {
    const light = getThemeColors('light')
    const dark = getThemeColors('dark')

    expect(light).toEqual(lightColors)
    expect(dark).toEqual(darkColors)
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort())
    expect(light.background).not.toBe(dark.background)
    expect(light.surface).not.toBe(dark.surface)
    expect(light.textPrimary).not.toBe(dark.textPrimary)
  })
})
