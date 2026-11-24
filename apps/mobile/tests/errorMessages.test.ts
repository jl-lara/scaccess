import { describe, expect, it } from 'vitest'

import { MobileApiError } from '../src/api/MobileApiError'
import {
  toDetailError,
  toHistoryError,
  toPermissionsError,
  toProfileError,
  toSignInMessage,
} from '../src/utils/errorMessages'

describe('errorMessages', () => {
  describe('toSignInMessage', () => {
    it('traduce timeout y errores de red de MobileApiError', () => {
      expect(toSignInMessage(new MobileApiError(0, 'TIMEOUT', 'timeout'))).toBe(
        'El servidor tardó demasiado en responder. Puede estar iniciando; inténtalo de nuevo.',
      )
      expect(toSignInMessage(new MobileApiError(0, 'NETWORK_ERROR', 'offline'))).toBe(
        'Sin conexión a Internet. Revisa tu conexión e inténtalo de nuevo.',
      )
    })

    it('traduce codigos HTTP 401, 403, 404 y 500', () => {
      expect(toSignInMessage(new MobileApiError(401, 'UNAUTHORIZED', 'bad'))).toBe(
        'Tu sesión expiró o no es válida. Inicia sesión de nuevo.',
      )
      expect(toSignInMessage(new MobileApiError(403, 'FORBIDDEN', 'disabled'))).toBe(
        'Tu cuenta está deshabilitada o no tiene permisos para acceder.',
      )
      expect(toSignInMessage(new MobileApiError(404, 'NOT_FOUND', 'missing'))).toBe(
        'Tu cuenta de acceso no está registrada en el sistema. Contacta a un administrador.',
      )
      expect(toSignInMessage(new MobileApiError(500, 'INTERNAL_SERVER_ERROR', 'err'))).toBe(
        'El servidor encontró un error temporal. Inténtalo de nuevo en unos momentos.',
      )
    })

    it('traduce mensajes comunes de Supabase Auth y fallbacks', () => {
      expect(toSignInMessage(new Error('Invalid login credentials'))).toBe(
        'Correo o contraseña incorrectos.',
      )
      expect(toSignInMessage(new Error('Email not confirmed'))).toBe(
        'Tu correo aún no ha sido confirmado.',
      )
      expect(toSignInMessage(new Error('Too many requests'))).toBe(
        'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
      )
      expect(toSignInMessage(new TypeError('Network request failed'))).toBe(
        'Sin conexión a Internet. Revisa tu conexión e inténtalo de nuevo.',
      )
      expect(toSignInMessage(new Error('Error inesperado'))).toBe(
        'No se pudo iniciar sesión. Inténtalo de nuevo.',
      )
    })
  })

  describe('toHistoryError', () => {
    it('traduce 401, 403, timeout, red, 500 y fallback', () => {
      expect(toHistoryError(new MobileApiError(401, 'UNAUTHORIZED', 'expired'))).toBe(
        'Tu sesión expiró. Cierra sesión e ingresa de nuevo.',
      )
      expect(toHistoryError(new MobileApiError(403, 'FORBIDDEN', 'admin'))).toBe(
        'Esta cuenta no tiene acceso al historial de empleado.',
      )
      expect(toHistoryError(new MobileApiError(0, 'TIMEOUT', 't'))).toBe(
        'El servidor tardó demasiado en responder. Inténtalo de nuevo.',
      )
      expect(toHistoryError(new MobileApiError(0, 'NETWORK_ERROR', 'n'))).toBe(
        'Sin conexión a Internet. Revisa tu conexión e inténtalo de nuevo.',
      )
      expect(toHistoryError(new MobileApiError(503, 'HTTP_503', 'down'))).toBe(
        'El servidor encontró un error al consultar el historial. Inténtalo de nuevo.',
      )
      expect(toHistoryError(new Error('unknown'))).toBe(
        'No se pudo cargar el historial. Inténtalo de nuevo.',
      )
    })
  })

  describe('toDetailError', () => {
    it('traduce 401, 403, 404, timeout, red, 500 y fallback', () => {
      expect(toDetailError(new MobileApiError(401, 'UNAUTHORIZED', 'expired'))).toBe(
        'Tu sesión expiró. Cierra sesión e ingresa de nuevo.',
      )
      expect(toDetailError(new MobileApiError(403, 'FORBIDDEN', 'forbidden'))).toBe(
        'No tienes permiso para consultar este evento.',
      )
      expect(toDetailError(new MobileApiError(404, 'NOT_FOUND', 'missing'))).toBe(
        'El evento solicitado ya no está disponible.',
      )
      expect(toDetailError(new MobileApiError(0, 'TIMEOUT', 't'))).toBe(
        'El servidor tardó demasiado en responder. Inténtalo de nuevo.',
      )
      expect(toDetailError(new MobileApiError(0, 'NETWORK_ERROR', 'n'))).toBe(
        'Sin conexión a Internet. Revisa tu conexión e inténtalo de nuevo.',
      )
      expect(toDetailError(new MobileApiError(500, 'INTERNAL_SERVER_ERROR', 'e'))).toBe(
        'El servidor encontró un error al cargar el detalle. Inténtalo de nuevo.',
      )
      expect(toDetailError(new Error('unexpected'))).toBe(
        'No se pudo cargar el detalle del evento. Verifica tu conexión e inténtalo de nuevo.',
      )
    })
  })

  describe('toProfileError', () => {
    it('traduce 401, 403, 404, timeout, red, 500 y fallback', () => {
      expect(toProfileError(new MobileApiError(401, 'UNAUTHORIZED', 'expired'))).toBe(
        'Tu sesión expiró. Cierra sesión e ingresa de nuevo.',
      )
      expect(toProfileError(new MobileApiError(403, 'FORBIDDEN', 'forbidden'))).toBe(
        'Esta cuenta no tiene acceso al perfil de empleado.',
      )
      expect(toProfileError(new MobileApiError(404, 'NOT_FOUND', 'missing'))).toBe(
        'No se encontró tu perfil de empleado. Contacta a un administrador.',
      )
      expect(toProfileError(new MobileApiError(0, 'TIMEOUT', 't'))).toBe(
        'El servidor tardó demasiado en responder. Inténtalo de nuevo.',
      )
      expect(toProfileError(new MobileApiError(0, 'NETWORK_ERROR', 'n'))).toBe(
        'Sin conexión a Internet. Revisa tu conexión e inténtalo de nuevo.',
      )
      expect(toProfileError(new MobileApiError(500, 'INTERNAL_SERVER_ERROR', 'e'))).toBe(
        'El servidor encontró un error al cargar tu perfil. Inténtalo de nuevo.',
      )
      expect(toProfileError(new TypeError('Network request failed'))).toBe(
        'Sin conexión o el servidor tarda en responder. Inténtalo de nuevo.',
      )
      expect(toProfileError(new Error('unexpected'))).toBe(
        'No se pudo cargar tu perfil. Inténtalo de nuevo.',
      )
    })
  })

  describe('toPermissionsError', () => {
    it('traduce 401, 403, timeout, red, 500 y fallback', () => {
      expect(toPermissionsError(new MobileApiError(401, 'UNAUTHORIZED', 'expired'))).toBe(
        'Tu sesión expiró. Cierra sesión e ingresa de nuevo.',
      )
      expect(toPermissionsError(new MobileApiError(403, 'FORBIDDEN', 'forbidden'))).toBe(
        'Esta cuenta no tiene acceso a los permisos de empleado.',
      )
      expect(toPermissionsError(new MobileApiError(0, 'TIMEOUT', 't'))).toBe(
        'El servidor tardó demasiado en responder. Inténtalo de nuevo.',
      )
      expect(toPermissionsError(new MobileApiError(0, 'NETWORK_ERROR', 'n'))).toBe(
        'Sin conexión a Internet. Revisa tu conexión e inténtalo de nuevo.',
      )
      expect(toPermissionsError(new MobileApiError(500, 'INTERNAL_SERVER_ERROR', 'e'))).toBe(
        'El servidor encontró un error al consultar tus permisos. Inténtalo de nuevo.',
      )
      expect(toPermissionsError(new TypeError('Network request failed'))).toBe(
        'Sin conexión o el servidor tarda en responder. Inténtalo de nuevo.',
      )
      expect(toPermissionsError(new Error('unexpected'))).toBe(
        'No se pudieron cargar tus permisos. Inténtalo de nuevo.',
      )
    })
  })
})
