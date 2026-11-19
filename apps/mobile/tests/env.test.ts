import { describe, it, expect } from 'vitest'

import { env } from '../src/config/env'

describe('env', () => {
  it('expone la URL base versionada sin barra final extra', () => {
    expect(env.API_BASE_URL.endsWith('/api/v1')).toBe(true)
    expect(env.API_BASE_URL).not.toMatch(/\/$/)
  })

  it('expone la URL de Supabase usando https', () => {
    expect(env.SUPABASE_URL.startsWith('https://')).toBe(true)
  })
})
