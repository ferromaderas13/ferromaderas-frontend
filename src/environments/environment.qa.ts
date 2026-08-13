/**
 * Entorno de QA/Calidad.
 * Reemplaza environment.ts cuando se compila con --configuration=qa
 */
export const environment = {
  production: false,
  /** Contenedor GTM QA (FerroMaderas Web QA → GA4 G-2H58LRM0SD). */
  gtmId: 'GTM-PX6XXWD6',
  /** Igual que desarrollo/producción: proxy o rewrite hacia el API */
  apiUrl: '/api',
};
