import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product } from '../models/product.model';

export type RecommendationTipo = 'complementario' | 'alternativo' | 'relacionado';

export interface RecommendationItem {
  product: Product;
  score: number;
  tipo: RecommendationTipo;
  razon: string;
  fuentes: string[];
}

export interface RecommendationAgentMeta {
  consulta?: string;
  categoriaId?: string;
  productoContextoId?: string;
  productoContextoCodigo?: string;
  carritoCodigos: string[];
  fuentesDatos: string[];
  algoritmo: string;
  generadoEn: string;
}

export interface RecommendationAgentResponse {
  recomendaciones: RecommendationItem[];
  meta: RecommendationAgentMeta;
}

@Injectable({ providedIn: 'root' })
export class RecommendationAgentService {
  private readonly api = `${environment.apiUrl}/recommendation-agent`;

  constructor(private readonly http: HttpClient) {}

  suggest(params: {
    query?: string;
    productId?: string;
    categoryId?: string;
    cartCodes?: string[];
    limit?: number;
  }): Observable<RecommendationAgentResponse> {
    const q = new URLSearchParams();
    if (params.query?.trim()) q.set('query', params.query.trim());
    if (params.productId) q.set('productId', params.productId);
    if (params.categoryId) q.set('categoryId', params.categoryId);
    if (params.cartCodes?.length) q.set('cartCodes', params.cartCodes.join(','));
    if (params.limit != null) q.set('limit', String(params.limit));
    const query = q.toString();

    return this.http
      .get<{
        recomendaciones: Array<{
          product: Record<string, unknown>;
          score: number;
          tipo: RecommendationTipo;
          razon: string;
          fuentes: string[];
        }>;
        meta: RecommendationAgentMeta;
      }>(`${this.api}${query ? `?${query}` : ''}`)
      .pipe(
        map((res) => ({
          recomendaciones: res.recomendaciones.map((r) => ({
            ...r,
            product: this.mapProduct(r.product),
          })),
          meta: res.meta,
        })),
        catchError(() =>
          of({
            recomendaciones: [],
            meta: {
              carritoCodigos: [],
              fuentesDatos: [],
              algoritmo: 'hibrido_consulta_categoria_coocurrencia_popularidad',
              generadoEn: new Date().toISOString(),
            },
          }),
        ),
      );
  }

  private mapProduct(p: Record<string, unknown>): Product {
    const price = Number(p['price'] ?? 0);
    const rawPromo = p['promotionalPrice'] ?? p['promotional_price'];
    const promotionalPrice =
      rawPromo == null || rawPromo === '' ? null : Number(rawPromo);
    return {
      id: String(p['id'] ?? ''),
      code: String(p['code'] ?? ''),
      name: String(p['name'] ?? ''),
      price,
      promotionalPrice:
        promotionalPrice != null && Number.isFinite(promotionalPrice)
          ? promotionalPrice
          : null,
      effectivePrice:
        p['effectivePrice'] != null ? Number(p['effectivePrice']) : undefined,
      onPromotion: Boolean(p['onPromotion']),
      imageUrl: String(p['imageUrl'] ?? p['image_url'] ?? '/assets/icons/logo.png'),
      categoryId: String(p['categoryId'] ?? p['category_id'] ?? ''),
      featured: Boolean(p['featured']),
      active: p['active'] !== false,
      pendingConfig: Boolean(p['pendingConfig'] ?? p['pending_config']),
      stock: Number(p['stock'] ?? 0),
    };
  }
}
