import * as SecureStore from 'expo-secure-store'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { Platform, useColorScheme } from 'react-native'

import {
  getThemeColors,
  resolveThemeMode,
  type ThemeColors,
  type ThemeMode,
} from '../theme/colors'

const THEME_STORAGE_KEY = 'accesa.theme.mode'

export interface ThemeContextValue {
  mode: ThemeMode
  isDark: boolean
  colors: ThemeColors
  toggleTheme: () => void
  setThemeMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme()
  const [manualMode, setManualMode] = useState<ThemeMode | null>(null)

  useEffect(() => {
    if (Platform.OS === 'web') {
      return
    }

    let cancelled = false

    async function loadStoredTheme() {
      try {
        const stored = await SecureStore.getItemAsync(THEME_STORAGE_KEY)
        if (!cancelled && (stored === 'light' || stored === 'dark')) {
          setManualMode(stored)
        }
      } catch {
        // Ignora errores de almacenamiento y usa el tema del sistema.
      }
    }

    void loadStoredTheme()

    return () => {
      cancelled = true
    }
  }, [])

  const mode = resolveThemeMode(manualMode, systemScheme)
  const isDark = mode === 'dark'
  const palette = getThemeColors(mode)

  const setThemeMode = useCallback((nextMode: ThemeMode) => {
    setManualMode(nextMode)
    if (Platform.OS !== 'web') {
      void SecureStore.setItemAsync(THEME_STORAGE_KEY, nextMode).catch(() => undefined)
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeMode(mode === 'dark' ? 'light' : 'dark')
  }, [mode, setThemeMode])

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      isDark,
      colors: palette,
      toggleTheme,
      setThemeMode,
    }),
    [mode, isDark, palette, toggleTheme, setThemeMode],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (context === null) {
    throw new Error('useTheme debe usarse dentro de un ThemeProvider')
  }
  return context
}
