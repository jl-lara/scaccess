import type { ReactNode } from 'react'

export type BadgeVariant = 'success' | 'danger' | 'warning' | 'neutral' | 'info'

export function StatusBadge({
  variant,
  children,
}: {
  variant: BadgeVariant
  children: ReactNode
}) {
  return <span className={`status-badge ${variant}`}>{children}</span>
}
