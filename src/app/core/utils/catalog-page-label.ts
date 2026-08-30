/** Nombre comercial de una ruta del catálogo (GA4 y título del navegador). */
export function catalogPageLabel(url: string): string {
  const path = (url.split('?')[0] || '/').replace(/\/+$/, '') || '/';
  if (path === '/' || path === '') return 'Inicio';
  if (path === '/categorias') return 'Categorías';
  if (path.startsWith('/categoria/')) return 'Página de una categoría';
  if (path.startsWith('/producto/')) return 'Ficha de producto';
  if (path.startsWith('/buscar')) return 'Búsqueda del catálogo';
  if (path === '/carrito') return 'Carrito y cotización';
  if (path === '/ubicacion') return 'Ubicación';
  if (path === '/politicas') return 'Políticas';
  if (path === '/mis-cotizaciones') return 'Mis cotizaciones';
  if (path.startsWith('/admin')) return 'Panel admin';
  return 'Catálogo';
}
