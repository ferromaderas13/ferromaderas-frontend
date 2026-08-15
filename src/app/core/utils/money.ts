/**
 * Dinero de Ferromaderas: precios exactos en quetzales.
 * Evita céntimos fantasma (99.99) por float o por desglosar/rearmar IVA.
 */

export function toCents(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100);
}

/** Precio comercial exacto. Si está a 1 céntimo de un quetzal entero, se normaliza (99.99 → 100). */
export function exactPrice(n: number): number {
  const cents = toCents(n);
  if (!Number.isFinite(cents)) return 0;
  const nearestInt = Math.round(cents / 100);
  if (Math.abs(cents - nearestInt * 100) <= 1) {
    return nearestInt;
  }
  return cents / 100;
}

export function lineAmount(unitPrice: number, qty: number): number {
  const safeQty = Number.isFinite(qty) ? Math.trunc(qty) : 0;
  return exactPrice(unitPrice) * Math.max(0, safeQty);
}

export function formatQuetzales(n: number): string {
  const v = exactPrice(n);
  const isInt = Number.isInteger(v);
  return `Q${v.toLocaleString('es-GT', {
    minimumFractionDigits: isInt ? 0 : 2,
    maximumFractionDigits: isInt ? 0 : 2,
  })}`;
}
