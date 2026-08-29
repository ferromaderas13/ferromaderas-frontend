export type QuotationStatus =
  | 'nueva'
  | 'en_seguimiento'
  | 'confirmada'
  | 'cerrada'
  | 'cancelada';

/** Estado del flujo de aprobación comercial de descuentos. */
export type ApprovalState =
  | 'no_requiere'
  | 'pendiente'
  | 'aprobada'
  | 'rechazada';

export interface Quotation {
  /** Identificador interno (uuid del backend), usado para las acciones del API. */
  id: string;
  /** Código legible mostrado al usuario (FM-2026-XXXX). */
  codigo: string;
  fechaHora: string; // DD/MM/YYYY o formato legible
  cliente: string;
  telefono: string;
  email?: string;
  /** Total bruto (antes de descuento). */
  subtotal: number;
  descuentoPorcentaje: number;
  descuentoMonto: number;
  descuentoMotivo?: string;
  /** Total final (subtotal - descuento, sin IVA). */
  total: number;
  neto: number;
  ivaPorcentaje: number;
  ivaMonto: number;
  /** Total a pagar incluyendo IVA. */
  totalConIva: number;
  direccion: string;
  estado: QuotationStatus;
  /** Flujo de aprobación del descuento aplicado. */
  aprobacion: ApprovalState;
  aprobadoPorNombre?: string;
  aprobadoEn?: string;
  aprobacionNota?: string;
  /** Vendedor asignado para dar seguimiento */
  vendedorId?: string;
  vendedorNombre?: string;
  /** ISO de creación (filtros de período en reportes). */
  createdAt?: string;
  items?: { codigo: string; nombre: string; cantidad: number }[];
}
