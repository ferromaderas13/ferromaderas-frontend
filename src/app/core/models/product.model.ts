export interface Product {
  id: string;
  code: string;
  name: string;
  /** Precio de lista (GTQ, IVA incluido). */
  price: number;
  /** Precio promocional opcional; si es menor al de lista, aplica en catálogo/cotización. */
  promotionalPrice?: number | null;
  /** Precio vigente calculado por la API (opcional; el front también lo calcula). */
  effectivePrice?: number;
  onPromotion?: boolean;
  imageUrl: string;
  categoryId: string;
  featured?: boolean;
  active?: boolean;
  /** true = creado por carga masiva, falta foto, precio y categoría */
  pendingConfig?: boolean;
  /** Existencia / inventario teórico (Dichara) */
  stock?: number;
}
