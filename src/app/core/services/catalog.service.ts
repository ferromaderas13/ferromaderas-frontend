import { Injectable } from '@angular/core';
import { Observable, tap, map, of, timeout, catchError } from 'rxjs';
import { ProductsApiService } from './products-api.service';
import { CategoriesApiService } from './categories-api.service';
import { Category } from '../models/category.model';
import { Product } from '../models/product.model';

/** Máximo de productos que pueden estar en destacados. */
export const FEATURED_LIMIT = 9;

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private products: Product[] = [];
  private categories: Category[] = [];
  /** Indica si el último intento de loadCategories() falló (red, timeout, respuesta inválida). */
  private lastCategoriesLoadFailed = false;

  constructor(
    private readonly productsApi: ProductsApiService,
    private readonly categoriesApi: CategoriesApiService
  ) {}

  /** Carga productos desde la API (admin - todos). */
  loadProducts(): Observable<Product[]> {
    return this.productsApi.getAll().pipe(
      tap((list) => {
        this.products = list.map((p) => ({ ...p, active: p.active !== false }));
      })
    );
  }

  /** Carga catálogo público (solo activos, para home/categorías). */
  loadCatalog(): Observable<Product[]> {
    return this.productsApi.getCatalog().pipe(
      tap((list) => {
        this.products = list.map((p) => ({ ...p, active: p.active !== false }));
      })
    );
  }

  /** Carga un producto por ID (para formulario de edición). */
  loadProductById(id: string): Observable<Product | null> {
    return this.productsApi.getById(id).pipe(
      tap((p) => {
        if (p) {
          const idx = this.products.findIndex((x) => x.id === id);
          if (idx >= 0) this.products[idx] = p;
          else this.products.push(p);
        }
      })
    );
  }

  /** Carga categorías desde la API. */
  loadCategories(): Observable<Category[]> {
    return this.categoriesApi.getAll().pipe(
      timeout(20000),
      tap((list) => {
        this.categories = list;
        this.lastCategoriesLoadFailed = false;
      }),
      catchError(() => {
        this.categories = [];
        this.lastCategoriesLoadFailed = true;
        return of([]);
      })
    );
  }

  /** True si la última llamada a loadCategories() terminó en error (p. ej. API caída o timeout). */
  didLastCategoriesLoadFail(): boolean {
    return this.lastCategoriesLoadFailed;
  }

  // Métodos de Categorías (sincrónicos sobre cache)
  getCategories(): Category[] {
    return this.categories.filter((c) => c.active !== false);
  }

  getAllCategories(): Category[] {
    return this.categories;
  }

  getCategoryById(id: string): Category | undefined {
    return this.categories.find((c) => c.id === id);
  }

  getCategoryBySlug(slug: string): Category | undefined {
    const s = slug.trim().toLowerCase();
    return this.categories.find((c) => (c.slug || '').toLowerCase() === s);
  }

  addCategory(category: Omit<Category, 'id'>): Observable<Category> {
    const slug =
      (category as { slug?: string }).slug ||
      this.generateSlug(category.name);
    return this.categoriesApi
      .create({
        name: category.name,
        slug,
        imageUrl: category.imageUrl,
        description: category.description,
        active: category.active,
      })
      .pipe(tap((c) => this.categories.push(c)));
  }

  updateCategory(id: string, updates: Partial<Category>): Observable<Category | null> {
    return this.categoriesApi.update(id, updates).pipe(
      tap((c) => {
        if (c) {
          const idx = this.categories.findIndex((x) => x.id === id);
          if (idx >= 0) this.categories[idx] = c;
        }
      })
    );
  }

  deleteCategory(id: string): Observable<boolean> {
    return this.categoriesApi.delete(id).pipe(
      tap((ok) => {
        if (ok) this.categories = this.categories.filter((c) => c.id !== id);
      })
    );
  }

  // Métodos de Productos (sincrónicos sobre cache)
  getProducts(): Product[] {
    return this.products;
  }

  getProductsByCategory(categoryId: string, activeOnly = true): Product[] {
    return this.products.filter(
      (p) =>
        p.categoryId === categoryId &&
        (activeOnly ? p.active !== false : true)
    );
  }

  getProductsByCategorySlug(slug: string): Product[] {
    const cat = this.getCategoryBySlug(slug);
    if (!cat) return [];
    return this.getProductsByCategory(cat.id);
  }

  getProductById(id: string): Product | undefined {
    return this.products.find((p) => p.id === id);
  }

  getFeaturedProducts(limit = FEATURED_LIMIT): Product[] {
    return this.products
      .filter((p) => p.featured && p.active !== false)
      .slice(0, limit);
  }

  getFeaturedCount(): number {
    return this.products.filter(
      (p) => p.featured && p.active !== false
    ).length;
  }

  getNonFeaturedProducts(): Product[] {
    return this.products.filter(
      (p) => p.active !== false && !p.featured
    );
  }

  getPendingProducts(): Product[] {
    return this.products.filter((p) => p.pendingConfig === true);
  }

  addProduct(product: Omit<Product, 'id'>): Observable<Product> {
    return this.productsApi.create(product).pipe(
      tap((p) => this.products.push(p))
    );
  }

  updateProduct(id: string, updates: Partial<Product>): Observable<Product | null> {
    return this.productsApi.update(id, updates).pipe(
      tap((p) => {
        if (p) {
          const idx = this.products.findIndex((x) => x.id === id);
          if (idx >= 0) this.products[idx] = p;
        }
      })
    );
  }

  setProductActive(id: string, active: boolean): Observable<Product | null> {
    return this.productsApi.setActive(id, active).pipe(
      tap((p) => {
        if (p) {
          const idx = this.products.findIndex((x) => x.id === id);
          if (idx >= 0) this.products[idx] = p;
        }
      })
    );
  }

  deleteProduct(id: string): Observable<boolean> {
    return this.productsApi.delete(id).pipe(
      tap(() => {
        this.products = this.products.filter((x) => x.id !== id);
      }),
      map(() => true),
      catchError(() => of(false)),
    );
  }

  addProductsFromBulkImport(
    items: { code: string; name: string; stock?: number }[],
    sync: boolean
  ): Observable<{ created: number; updated: number; deleted: number; errors: string[] }> {
    return this.productsApi.bulkImport(items, sync);
  }

  removeProductsNotInExcel(_excelCodes: string[]): number {
    return 0;
  }

  getNextProductCode(): string {
    const codes = this.products
      .map((p) => parseInt(p.code, 10))
      .filter((n) => !isNaN(n));
    const next = codes.length ? Math.max(...codes) + 1 : 1;
    return String(next).padStart(3, '0');
  }

  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
