import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Theme = 'dark' | 'light'

export interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

export const THEME_STORAGE_KEY = 'accesa-theme'

export const ThemeContext = createContext<ThemeContextValue | null>(null)

function isTheme(value: string | null | undefined): value is Theme {
  return value === 'dark' || value === 'light'
}

function applyThemeToDocument(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(stored) ? stored : 'light'
  } catch {
    return 'light'
  }
}

function readDocumentTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  const current = document.documentElement.dataset.theme
  return isTheme(current) ? current : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const initial = readStoredTheme()
    // Apply before paint so the first render already matches the resolved theme.
    applyThemeToDocument(initial)
    return initial
  })

  useEffect(() => {
    applyThemeToDocument(theme)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Storage can be unavailable (private mode); the document attribute still applies.
    }
  }, [theme])

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, toggleTheme, setTheme }),
    [theme, toggleTheme, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/**
 * Safe standalone implementation used when a component (usually in legacy tests)
 * renders outside ThemeProvider. It reads and updates the document directly.
 */
function useStandaloneTheme(): ThemeContextValue {
  const [theme, setThemeState] = useState<Theme>(readDocumentTheme)

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme)
    applyThemeToDocument(nextTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark'
    setThemeState(nextTheme)
    applyThemeToDocument(nextTheme)
  }, [theme])

  return useMemo<ThemeContextValue>(
    () => ({ theme, toggleTheme, setTheme }),
    [theme, toggleTheme, setTheme],
  )
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  const standalone = useStandaloneTheme()
  return context ?? standalone
}
