import type { CSSProperties, ReactNode } from 'react'
import { useReveal } from '../hooks/useReveal'

type RevealElement = 'div' | 'section' | 'article' | 'li'
type RevealVariant = 'up' | 'fade' | 'scale'

interface RevealProps {
  children: ReactNode
  className?: string
  delayMs?: number
  as?: RevealElement
  variant?: RevealVariant
}

export function Reveal({
  children,
  className = '',
  delayMs = 0,
  as = 'div',
  variant = 'up',
}: RevealProps) {
  const { ref, isVisible } = useReveal<HTMLElement>()
  const classes = [
    'reveal',
    `reveal-${variant}`,
    isVisible ? 'reveal-visible' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const style =
    delayMs > 0 ? ({ '--reveal-delay': `${delayMs}ms` } as CSSProperties) : undefined

  if (as === 'section') {
    return (
      <section ref={ref} className={classes} style={style}>
        {children}
      </section>
    )
  }

  if (as === 'article') {
    return (
      <article ref={ref} className={classes} style={style}>
        {children}
      </article>
    )
  }

  if (as === 'li') {
    return (
      <li ref={ref as RefObjectFix<HTMLLIElement>} className={classes} style={style}>
        {children}
      </li>
    )
  }

  return (
    <div ref={ref as RefObjectFix<HTMLDivElement>} className={classes} style={style}>
      {children}
    </div>
  )
}

type RefObjectFix<T extends HTMLElement> = React.RefObject<T | null>
