import { describe, expect, it } from 'vitest'

import { validateLoginForm } from '../src/utils/validation'

describe('validateLoginForm', () => {
  it('pide correo y contraseña cuando ambos estan vacios', () => {
    expect(validateLoginForm('', '')).toBe('Ingresa tu correo electrónico y contraseña.')
    expect(validateLoginForm('   ', '')).toBe('Ingresa tu correo electrónico y contraseña.')
  })

  it('pide correo cuando solo falta el correo', () => {
    expect(validateLoginForm('', 'secreto123')).toBe('Ingresa tu correo electrónico.')
    expect(validateLoginForm('   ', 'secreto123')).toBe('Ingresa tu correo electrónico.')
  })

  it('valida el formato basico de correo electronico', () => {
    expect(validateLoginForm('usuario-sin-arroba', 'secreto123')).toBe(
      'Ingresa un correo electrónico válido.',
    )
    expect(validateLoginForm('usuario@dominio', 'secreto123')).toBe(
      'Ingresa un correo electrónico válido.',
    )
  })

  it('pide contraseña cuando el correo es valido pero falta la contraseña', () => {
    expect(validateLoginForm('empleado@scaccess.local', '')).toBe(
      'Ingresa tu contraseña.',
    )
  })

  it('devuelve null con credenciales validas incluso con espacios laterales en el correo', () => {
    expect(validateLoginForm('  empleado@scaccess.local  ', 'secreto123')).toBeNull()
  })
})
