import { useEffect, useRef, useState, type RefObject } from 'react'

interface RevealResult<T extends HTMLElement> {
  ref: RefObject<T | null>
  isVisible: boolean
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useReveal<T extends HTMLElement>(threshold = 0.14): RevealResult<T> {
  const ref = useRef<T | null>(null)
  const [isVisible, setIsVisible] = useState<boolean>(() => prefersReducedMotion())

  useEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }

    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(entry.target)
        }
      },
      { threshold },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, isVisible }
}
