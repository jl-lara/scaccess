import type { ReactNode } from 'react'

/**
 * Shared cold-start guidance for loading states. Render Free suspends idle
 * services, so the first request after a pause can legitimately take up to
 * about a minute. Showing this avoids users mistaking a slow start for a bug.
 */
export const COLD_START_HINT =
  'Si el servicio estuvo suspendido en Render, la primera respuesta puede tardar hasta 60 segundos.'

export interface TableMessageProps {
  colSpan: number
  title: string
  description?: string
  children?: ReactNode
}

/**
 * Full-width row for loading, empty and error states inside a data table.
 * The optional children slot is where pages put the next actionable step.
 */
export function TableMessage({ colSpan, title, description, children }: TableMessageProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="empty-cell">
        <div role="status" aria-live="polite" aria-atomic="true">
          <p className="empty-title">{title}</p>
          {description ? <p className="empty-description">{description}</p> : null}
        </div>
        {children}
      </td>
    </tr>
  )
}
