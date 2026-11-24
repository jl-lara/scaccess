import { useEffect, useRef, useState, type RefObject } from 'react'

interface ScrollProgressResult<T extends HTMLElement> {
  ref: RefObject<T | null>
  progress: number
  isVisible: boolean
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useScrollProgress<T extends HTMLElement>(
  threshold = 0.15,
): ScrollProgressResult<T> {
  const ref = useRef<T | null>(null)
  const [isVisible, setIsVisible] = useState<boolean>(() => prefersReducedMotion())
  const [progress, setProgress] = useState<number>(() => (prefersReducedMotion() ? 1 : 0))

  useEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }

    if (prefersReducedMotion()) {
      setIsVisible(true)
      setProgress(1)
      return
    }

    let frameId: number | null = null
    let currentlyVisible = false

    const updateProgress = () => {
      frameId = null
      const rect = element.getBoundingClientRect()
      const viewportHeight = window.innerHeight || 800
      const totalDistance = viewportHeight + rect.height
      if (totalDistance <= 0) {
        setProgress(1)
        return
      }
      const raw = (viewportHeight - rect.top) / totalDistance
      const clamped = Math.min(1, Math.max(0, raw))
      setProgress(clamped)
    }

    const scheduleUpdate = () => {
      if (frameId !== null || !currentlyVisible) {
        return
      }
      frameId = window.requestAnimationFrame(updateProgress)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) {
          return
        }
        currentlyVisible = entry.isIntersecting
        if (entry.isIntersecting) {
          setIsVisible(true)
          scheduleUpdate()
        }
      },
      { threshold },
    )

    observer.observe(element)
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [threshold])

  return { ref, progress, isVisible }
}

export function usePageScrollProgress(): number {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined' || prefersReducedMotion()) {
      setProgress(0)
      return
    }

    let frameId: number | null = null

    const update = () => {
      frameId = null
      const doc = document.documentElement
      const scrollable = doc.scrollHeight - window.innerHeight
      if (scrollable <= 0) {
        setProgress(0)
        return
      }
      const raw = window.scrollY / scrollable
      setProgress(Math.min(1, Math.max(0, raw)))
    }

    const schedule = () => {
      if (frameId !== null) {
        return
      }
      frameId = window.requestAnimationFrame(update)
    }

    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })

    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [])

  return progress
}
