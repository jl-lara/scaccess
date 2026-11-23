import { describe, expect, it, vi } from 'vitest'

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}))

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}))

import {
  createKeyValueStorage,
  type SecureStoreLike,
  type WebStorageLike,
} from '../src/config/storage'

function createMockSecureStore(): SecureStoreLike {
  return {
    getItemAsync: vi.fn(async () => 'secure-value'),
    setItemAsync: vi.fn(async () => undefined),
    deleteItemAsync: vi.fn(async () => undefined),
  }
}

describe('createKeyValueStorage', () => {
  it('delega en SecureStore cuando la plataforma es iOS o Android', async () => {
    for (const platformOS of ['ios', 'android']) {
      const secureStore = createMockSecureStore()
      const storage = createKeyValueStorage({
        platformOS,
        secureStore,
        getWebStorage: () => null,
      })

      expect(await storage.getItem('session')).toBe('secure-value')
      await storage.setItem('session', 'token-123')
      await storage.removeItem('session')

      expect(secureStore.getItemAsync).toHaveBeenCalledWith('session')
      expect(secureStore.setItemAsync).toHaveBeenCalledWith('session', 'token-123')
      expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('session')
    }
  })

  it('usa localStorage cuando la plataforma es web', async () => {
    const store = new Map<string, string>()
    const webStorage: WebStorageLike = {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value)
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key)
      }),
    }
    const secureStore = createMockSecureStore()
    const storage = createKeyValueStorage({
      platformOS: 'web',
      secureStore,
      getWebStorage: () => webStorage,
    })

    await storage.setItem('theme', 'dark')
    expect(await storage.getItem('theme')).toBe('dark')
    await storage.removeItem('theme')
    expect(await storage.getItem('theme')).toBeNull()

    expect(secureStore.getItemAsync).not.toHaveBeenCalled()
    expect(secureStore.setItemAsync).not.toHaveBeenCalled()
    expect(secureStore.deleteItemAsync).not.toHaveBeenCalled()
  })

  it('maneja de forma segura web sin localStorage disponible o con error de cuota/privacidad', async () => {
    const secureStore = createMockSecureStore()

    const nullStorage = createKeyValueStorage({
      platformOS: 'web',
      secureStore,
      getWebStorage: () => null,
    })
    expect(await nullStorage.getItem('key')).toBeNull()
    await expect(nullStorage.setItem('key', 'val')).resolves.toBeUndefined()
    await expect(nullStorage.removeItem('key')).resolves.toBeUndefined()

    const throwingStorage = createKeyValueStorage({
      platformOS: 'web',
      secureStore,
      getWebStorage: () => {
        throw new Error('SecurityError')
      },
    })
    expect(await throwingStorage.getItem('key')).toBeNull()
    await expect(throwingStorage.setItem('key', 'val')).resolves.toBeUndefined()
    await expect(throwingStorage.removeItem('key')).resolves.toBeUndefined()
  })
})
