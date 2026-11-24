import type {
  MyPermissionsResponseDto,
  MyProfileResponseDto,
} from '@scaccess/shared'

import { apiFetch } from './httpClient'

/** Devuelve el perfil de empleado, cuenta y credenciales RFID del usuario autenticado. */
export async function getMyProfile(): Promise<MyProfileResponseDto> {
  return apiFetch<MyProfileResponseDto>('/me/profile')
}

/** Lista los permisos de acceso por área asignados al empleado autenticado. */
export async function listMyPermissions(
  params: { activeOnly?: boolean } = {},
): Promise<MyPermissionsResponseDto> {
  const query =
    params.activeOnly !== undefined ? `?activeOnly=${params.activeOnly}` : ''
  return apiFetch<MyPermissionsResponseDto>(`/me/permissions${query}`)
}
