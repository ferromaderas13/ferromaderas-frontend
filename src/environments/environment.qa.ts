/**
 * Entorno de QA/Calidad.
 * Reemplaza environment.ts cuando se compila con --configuration=qa
 */
export const environment = {
  production: false,
  /** Contenedor GTM QA (workspace "test" → GA4 G-2H58LRM0SD). */
  gtmId: 'GTM-5S8865HP',
  /** Igual que desarrollo/producción: proxy o rewrite hacia el API */
  apiUrl: '/api',
};
