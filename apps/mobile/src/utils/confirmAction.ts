import { Alert, Platform } from 'react-native'

export interface ConfirmActionOptions {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void | Promise<void>
}

interface ConfirmCapableGlobal {
  confirm?: (message?: string) => boolean
}

/**
 * Muestra un dialogo de confirmacion multiplataforma (Alert nativo en iOS/Android
 * y `globalThis.confirm` en web) antes de ejecutar `onConfirm`.
 */
export function confirmAction(options: ConfirmActionOptions): void {
  const { title, message, confirmLabel, cancelLabel, destructive, onConfirm } =
    options

  if (Platform.OS === 'web') {
    const webConfirm = (globalThis as ConfirmCapableGlobal).confirm
    const confirmed =
      typeof webConfirm === 'function'
        ? webConfirm(`${title}\n\n${message}`)
        : true
    if (confirmed) {
      void onConfirm()
    }
    return
  }

  Alert.alert(title, message, [
    { text: cancelLabel ?? 'Cancelar', style: 'cancel' },
    {
      text: confirmLabel,
      style: destructive ? 'destructive' : 'default',
      onPress: () => {
        void onConfirm()
      },
    },
  ])
}
