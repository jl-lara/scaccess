import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react'

export type AppRoute = '/' | '/contacto'

interface RouterContextValue {
  route: AppRoute
  navigate: (to: string) => void
}

const RouterContext = createContext<RouterContextValue | null>(null)

export function normalizePath(pathname: string): AppRoute {
  const cleaned = pathname.replace(/\/+$/, '') || '/'
  if (cleaned === '/contacto') {
    return '/contacto'
  }
  return '/'
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function parseDestination(to: string): { path: AppRoute; hash: string; url: string } {
  if (to.startsWith('#')) {
    return {
      path: '/',
      hash: to.slice(1),
      url: `/${to}`,
    }
  }

  const [rawPath = '/', rawHash = ''] = to.split('#')
  const normalized = normalizePath(rawPath || '/')
  const url = rawHash ? `${normalized}#${rawHash}` : normalized
  return {
    path: normalized,
    hash: rawHash,
    url,
  }
}

function scrollToTarget(hash: string): void {
  if (typeof window === 'undefined') {
    return
  }

  const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth'

  if (!hash) {
    if (typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior })
    }
    return
  }

  const target = document.getElementById(hash)
  if (target && typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ behavior })
  }
}

interface RouterProviderProps {
  initialPath?: string
  children: ReactNode
}

export function RouterProvider({ initialPath, children }: RouterProviderProps) {
  const [route, setRoute] = useState<AppRoute>(() => {
    if (initialPath !== undefined) {
      return normalizePath(initialPath)
    }
    if (typeof window !== 'undefined') {
      return normalizePath(window.location.pathname)
    }
    return '/'
  })

  useEffect(() => {
    if (initialPath !== undefined && typeof window !== 'undefined') {
      const normalized = normalizePath(initialPath)
      if (window.location.pathname !== normalized) {
        window.history.replaceState({}, '', normalized)
      }
    }
  }, [initialPath])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title =
        route === '/contacto'
          ? 'Contacto y Demostración — Accesa'
          : 'Accesa — Control de Acceso RFID'
    }
  }, [route])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const handlePopState = () => {
      setRoute(normalizePath(window.location.pathname))
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback(
    (to: string) => {
      const { path, hash, url } = parseDestination(to)
      const routeChanged = path !== route

      if (typeof window !== 'undefined') {
        const currentFull = `${normalizePath(window.location.pathname)}${window.location.hash}`
        if (currentFull !== url) {
          window.history.pushState({}, '', url)
        }
      }

      if (routeChanged) {
        setRoute(path)
      }

      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          scrollToTarget(hash)
        })
      }
    },
    [route],
  )

  const value = useMemo<RouterContextValue>(() => ({ route, navigate }), [route, navigate])

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

export function useRouter(): RouterContextValue {
  const context = useContext(RouterContext)
  if (!context) {
    throw new Error('useRouter debe usarse dentro de un RouterProvider.')
  }
  return context
}

type AppLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  to: string
}

export function AppLink({ to, onClick, target, ...rest }: AppLinkProps) {
  const { navigate } = useRouter()

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      target === '_blank' ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }
    event.preventDefault()
    navigate(to)
  }

  return <a href={to} target={target} onClick={handleClick} {...rest} />
}
