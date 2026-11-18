import type { ApiErrorBody } from '@scaccess/shared'

import { env } from '../config/env'
import { supabase } from '../config/supabase'

export class MobileApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'MobileApiError'
  }
}

const REQUEST_TIMEOUT_MS = 35_000

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new MobileApiError(
      401,
      'UNAUTHORIZED',
      'Sesión expirada. Inicia sesión nuevamente.',
    )
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${env.API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...init?.headers,
      },
    })
    if (!response.ok) {
      const errorBody = (await response
        .json()
        .catch(() => null)) as ApiErrorBody | null
      throw new MobileApiError(
        response.status,
        errorBody?.error.code ?? 'UNKNOWN_ERROR',
        errorBody?.error.message ?? `Error HTTP ${response.status}`,
      )
    }
    return (await response.json()) as T
  } finally {
    clearTimeout(timer)
  }
}
