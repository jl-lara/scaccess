import type {
  AccessDecision,
  AccessEventDto,
  PaginatedResponse,
} from '@scaccess/shared'

import { apiFetch } from './httpClient'

export interface ListMyAccessEventsParams {
  page?: number
  pageSize?: number
  areaId?: string
  decision?: AccessDecision
  from?: string
  to?: string
}

/**
 * Lista los eventos de acceso del usuario autenticado, con paginacion y filtros opcionales.
 */
export async function listMyAccessEvents(
  params: ListMyAccessEventsParams = {},
): Promise<PaginatedResponse<AccessEventDto>> {
  const queryParts: string[] = []
  if (params.page !== undefined) {
    queryParts.push(`page=${params.page}`)
  }
  if (params.pageSize !== undefined) {
    queryParts.push(`pageSize=${params.pageSize}`)
  }
  if (params.areaId !== undefined) {
    queryParts.push(`areaId=${encodeURIComponent(params.areaId)}`)
  }
  if (params.decision !== undefined) {
    queryParts.push(`decision=${encodeURIComponent(params.decision)}`)
  }
  if (params.from !== undefined) {
    queryParts.push(`from=${encodeURIComponent(params.from)}`)
  }
  if (params.to !== undefined) {
    queryParts.push(`to=${encodeURIComponent(params.to)}`)
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
