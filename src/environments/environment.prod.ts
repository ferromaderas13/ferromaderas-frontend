/**
 * Entorno de producción.
 * Reemplaza environment.ts cuando se compila con --configuration=production
 */
export const environment = {
  production: true,
  /** Contenedor GTM de producción (otro contenedor cuando exista dominio prod). */
  gtmId: 'GTM-PX6XXWD6',
  /**
   * Ruta relativa: en Vercel configurá rewrite `/api/*` → tu URL de Railway (`vercel.json`).
   * Si llamás al API en otro dominio sin proxy, poné la URL absoluta y en Railway `AUTH_CROSS_ORIGIN=true`.
   */
  apiUrl: '/api',
};
