import type { ReactNode } from 'react'

export type NoticeVariant = 'error' | 'warning' | 'success'

export interface NoticeBannerProps {
  variant: NoticeVariant
  children: ReactNode
  action?: ReactNode
}

export function NoticeBanner({ variant, children, action }: NoticeBannerProps) {
  return (
    <div
      className={`alert-banner ${variant}`}
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <span>{children}</span>
      {action ? <div className="notice-action">{action}</div> : null}
    </div>
  )
}
