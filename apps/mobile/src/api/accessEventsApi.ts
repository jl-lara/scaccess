import type { AccessEventDto, PaginatedResponse } from '@scaccess/shared'

import { apiFetch } from './httpClient'

/**
 * Lista los eventos de acceso del usuario autenticado, con paginacion opcional.
 */
export async function listMyAccessEvents(
  params: { page?: number; pageSize?: number } = {},
): Promise<PaginatedResponse<AccessEventDto>> {
  const queryParts: string[] = []
  if (params.page !== undefined) {
    queryParts.push(`page=${params.page}`)
  }
  if (params.pageSize !== undefined) {
    queryParts.push(`pageSize=${params.pageSize}`)
  }
  const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''
  return apiFetch<PaginatedResponse<AccessEventDto>>(
    `/me/access-events${query}`,
  )
}

/** Devuelve el detalle de un evento de acceso propio por id. */
export async function getMyAccessEventById(id: string): Promise<AccessEventDto> {
  return apiFetch<AccessEventDto>(`/me/access-events/${encodeURIComponent(id)}`)
}
