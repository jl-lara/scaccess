import type { AccessEventDto } from '@scaccess/shared'

/**
 * Contrato de rutas de la pila de navegacion nativa.
 * Lo consumen `AppNavigator` y las pantallas para tipar sus props.
 */
export type RootStackParamList = {
  AccessHistory: undefined
  AccessEventDetail: {
    eventId: string
    /** Objeto ya cargado para pintar de inmediato mientras se revalida el detalle. */
    initialEvent?: AccessEventDto
  }
}
