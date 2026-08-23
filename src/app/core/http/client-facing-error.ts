import { HttpErrorResponse } from '@angular/common/http';

/**
 * Mensaje seguro para la interfaz: no expone cuerpo de errores HTTP ni datos internos del servidor.
 */
export function clientFacingHttpMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 401 || err.status === 403) {
      const nested = err.error?.message;
      if (typeof nested === 'string' && nested.trim()) {
        return nested;
      }
      if (Array.isArray(nested) && typeof nested[0] === 'string' && nested[0].trim()) {
        return nested[0];
      }
    }
    if (err.status === 0) {
      return 'No hay conexión con el servidor. Intenta más tarde.';
    }
    if (err.status === 403) {
      return 'No tienes permiso para realizar esta acción.';
    }
    if (err.status === 404) {
      return 'No se encontró lo solicitado.';
    }
    if (err.status === 503 || err.status === 502 || err.status === 504) {
      const nested = err.error?.message;
      if (typeof nested === 'string' && nested.trim()) {
        return nested;
      }
      return 'El servicio no está disponible en este momento. Intenta más tarde.';
    }
    if (err.status >= 500) {
      return 'Ocurrió un problema en el servidor. Intenta más tarde.';
    }
    return fallback;
  }
  const named = err as { name?: string } | null | undefined;
  if (named?.name === 'TimeoutError') {
    return 'La operación tardó demasiado. Intenta de nuevo.';
  }
  return fallback;
}
