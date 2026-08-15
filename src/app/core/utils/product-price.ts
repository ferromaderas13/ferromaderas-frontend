import { Product } from '../models/product.model';
import { exactPrice } from './money';

/** Precio de venta vigente: promocional si es válido, si no el de lista. */
export function productEffectivePrice(product: Pick<Product, 'price' | 'promotionalPrice'>): number {
  const list = exactPrice(product.price ?? 0);
  const promo = product.promotionalPrice;
  if (promo != null && Number(promo) > 0 && exactPrice(promo) < list) {
    return exactPrice(promo);
  }
  return list;
}

export function productIsOnPromotion(product: Pick<Product, 'price' | 'promotionalPrice'>): boolean {
  return productEffectivePrice(product) < Number(product.price ?? 0);
}
