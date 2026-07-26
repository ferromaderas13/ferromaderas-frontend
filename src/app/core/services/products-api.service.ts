import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product } from '../models/product.model';

export interface BulkImportResult {
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

@Injectable({ providedIn: 'root' })
export class ProductsApiService {
  private readonly api = `${environment.apiUrl}/products`;

  constructor(private readonly http: HttpClient) {}

  /** Catálogo público (solo activos) */
  getCatalog(): Observable<Product[]> {
    return this.http
      .get<Record<string, unknown>[]>(`${this.api}/catalog`)
      .pipe(map((list) => list.map((p) => this.mapToProduct(p))));
  }

  /** Detalle público de un producto activo (id o código). */
  getCatalogProduct(idOrCode: string): Observable<Product | null> {
    return this.http
      .get<Record<string, unknown>>(`${this.api}/catalog/${encodeURIComponent(idOrCode)}`)
      .pipe(
        map((p) => this.mapToProduct(p)),
        catchError(() => of(null)),
      );
  }

  /** Recomendaciones públicas (co-ocurrencia, categoría o más cotizados). */
  getRecommendations(params: {
    productId?: string;
    categoryId?: string;
    limit?: number;
  }): Observable<Product[]> {
    const q = new URLSearchParams();
    if (params.productId) q.set('productId', params.productId);
    if (params.categoryId) q.set('categoryId', params.categoryId);
    if (params.limit != null) q.set('limit', String(params.limit));
    const query = q.toString();
    return this.http
      .get<Record<string, unknown>[]>(
        `${this.api}/recommendations${query ? `?${query}` : ''}`,
      )
      .pipe(
        map((list) => list.map((p) => this.mapToProduct(p))),
        catchError(() => of([])),
      );
  }

  /** Admin: todos los productos */
  getAll(): Observable<Product[]> {
    return this.http
      .get<Record<string, unknown>[]>(this.api)
      .pipe(map((list) => list.map((p) => this.mapToProduct(p))));
  }

  getById(id: string): Observable<Product | null> {
    return this.http
      .get<Record<string, unknown>>(`${this.api}/${id}`)
      .pipe(
        map((p) => this.mapToProduct(p)),
        catchError(() => of(null))
      );
  }

  create(data: Omit<Product, 'id'>): Observable<Product> {
    return this.http
      .post<Record<string, unknown>>(this.api, this.toApi(data))
      .pipe(map((p) => this.mapToProduct(p)));
  }

  update(id: string, data: Partial<Product>): Observable<Product> {
    return this.http
      .put<Record<string, unknown>>(`${this.api}/${id}`, this.toApi(data))
      .pipe(map((p) => this.mapToProduct(p)));
  }

  setActive(id: string, active: boolean): Observable<Product> {
    return this.http
      .patch<Record<string, unknown>>(`${this.api}/${id}/active`, { active })
      .pipe(map((p) => this.mapToProduct(p)));
  }

  bulkImport(
    items: { code: string; name: string; stock?: number }[],
    sync: boolean
  ): Observable<BulkImportResult> {
    return this.http.post<BulkImportResult>(`${this.api}/bulk`, {
      items,
      sync,
    });
  }

  private mapToProduct(p: unknown): Product {
    if (p == null || typeof p !== 'object' || Array.isArray(p)) {
      return {
        id: '',
        code: '',
        name: '',
        price: 0,
        promotionalPrice: null,
        imageUrl: '',
        categoryId: '',
        featured: false,
        active: false,
        pendingConfig: false,
        stock: 0,
      };
    }
    const o = p as Record<string, unknown>;
    const price = Number(o['price'] ?? 0);
    const rawPromo = o['promotionalPrice'];
    const promotionalPrice =
      rawPromo == null || rawPromo === ''
        ? null
        : Number(rawPromo);
    return {
      id: String(o['id'] ?? ''),
      code: String(o['code'] ?? ''),
      name: String(o['name'] ?? ''),
      price,
      promotionalPrice:
        promotionalPrice != null && Number.isFinite(promotionalPrice)
          ? promotionalPrice
          : null,
      effectivePrice:
        o['effectivePrice'] != null ? Number(o['effectivePrice']) : undefined,
      onPromotion: Boolean(o['onPromotion']),
      imageUrl: String(o['imageUrl'] ?? ''),
      categoryId: (o['categoryId'] as string) || '',
      featured: Boolean(o['featured']),
      active: o['active'] !== false,
      pendingConfig: Boolean(o['pendingConfig']),
      stock: Number(o['stock'] ?? 0),
    };
  }

  private toApi(p: Partial<Product>): Record<string, unknown> {
    return {
      code: p.code,
      name: p.name,
      price: p.price ?? 0,
      promotionalPrice:
        p.promotionalPrice === undefined
          ? undefined
          : p.promotionalPrice == null || Number(p.promotionalPrice) <= 0
            ? null
            : Number(p.promotionalPrice),
      imageUrl: p.imageUrl,
      categoryId: p.categoryId || null,
      active: p.active,
      featured: p.featured,
      pendingConfig: p.pendingConfig,
      stock: p.stock ?? 0,
    };
  }
}
