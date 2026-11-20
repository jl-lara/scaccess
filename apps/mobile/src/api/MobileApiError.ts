/** Error HTTP o de red normalizado para la app movil. */
export class MobileApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'MobileApiError'
  }
}
