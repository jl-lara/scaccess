import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

export interface KeyValueStorage {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}

export interface WebStorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export interface SecureStoreLike {
  getItemAsync: (key: string) => Promise<string | null>
  setItemAsync: (key: string, value: string) => Promise<void>
  deleteItemAsync: (key: string) => Promise<void>
}

export interface CreateKeyValueStorageOptions {
  platformOS: string
  secureStore: SecureStoreLike
  getWebStorage: () => WebStorageLike | null | undefined
}

/**
 * Crea un adaptador clave-valor compatible con iOS/Android (SecureStore) y web
 * (localStorage con proteccion ante navegacion privada o cuotas).
 */
export function createKeyValueStorage({
  platformOS,
  secureStore,
  getWebStorage,
}: CreateKeyValueStorageOptions): KeyValueStorage {
  if (platformOS === 'web') {
    const readStorage = (): WebStorageLike | null => {
      try {
        return getWebStorage() ?? null
      } catch {
        return null
      }
    }

    return {
      getItem: async (key: string) => {
        try {
          return readStorage()?.getItem(key) ?? null
        } catch {
          return null
        }
      },
      setItem: async (key: string, value: string) => {
        try {
          readStorage()?.setItem(key, value)
        } catch {
          // Ignora errores de almacenamiento web (modo privado / cuota llena).
        }
      },
      removeItem: async (key: string) => {
        try {
          readStorage()?.removeItem(key)
        } catch {
          // Ignora errores de almacenamiento web.
        }
      },
    }
  }

  return {
    getItem: (key: string) => secureStore.getItemAsync(key),
    setItem: (key: string, value: string) => secureStore.setItemAsync(key, value),
    removeItem: (key: string) => secureStore.deleteItemAsync(key),
  }
}

function getDefaultWebStorage(): WebStorageLike | null {
  try {
    return (globalThis as { localStorage?: WebStorageLike }).localStorage ?? null
  } catch {
    return null
  }
}

export const appStorage: KeyValueStorage = createKeyValueStorage({
  platformOS: Platform.OS,
  secureStore: SecureStore,
  getWebStorage: getDefaultWebStorage,
})
