import { Product } from '../models/product.model';

/** Precio de venta vigente: promocional si es válido, si no el de lista. */
export function productEffectivePrice(product: Pick<Product, 'price' | 'promotionalPrice'>): number {
  const list = Number(product.price ?? 0);
  const promo = product.promotionalPrice;
  if (promo != null && Number(promo) > 0 && Number(promo) < list) {
    return Number(promo);
  }
  return list;
}

export function productIsOnPromotion(product: Pick<Product, 'price' | 'promotionalPrice'>): boolean {
  return productEffectivePrice(product) < Number(product.price ?? 0);
}
