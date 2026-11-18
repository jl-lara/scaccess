import type { UserAccountDto } from '@scaccess/shared'

import { apiFetch } from './httpClient'

/** Devuelve la cuenta del usuario autenticado (perfil propio). */
export async function getMe(): Promise<UserAccountDto> {
  return apiFetch<UserAccountDto>('/auth/me')
}
