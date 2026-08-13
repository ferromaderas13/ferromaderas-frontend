import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import * as XLSX from 'xlsx';
import { forkJoin, of, catchError } from 'rxjs';
import { CatalogService } from '../../../core/services/catalog.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Product } from '../../../core/models/product.model';

@Component({
  selector: 'app-products-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './products-admin.component.html',
  styleUrl: './products-admin.component.scss',
})
export class ProductsAdminComponent implements OnInit {
  products: Product[] = [];
  searchTerm = '';
  filterEstado: 'todos' | 'activo' | 'inactivo' = 'todos';
  viewMode: 'todos' | 'pendientes' = 'todos';

  /** Paginación: con catálogos grandes (miles de productos) renderizar todo congela el navegador. */
  pageSize = 50;
  currentPage = 1;

  /** Memoización del filtrado para no recalcular sobre miles de productos en cada ciclo de detección. */
  private filterCacheKey = '';
  private filteredCache: Product[] = [];
  private dataVersion = 0;

  showBulkImport = false;
  bulkFile: File | null = null;
  bulkPreview: { code: string; name: string; stock: number; status: 'nuevo' | 'actualizado' | 'sin_cambios' }[] = [];
  bulkDeleted: { id: string; code: string; name: string; stock: number }[] = [];
  bulkPreviewFilter: 'todos' | 'nuevos' | 'actualizados' | 'sin_cambios' | 'eliminados' = 'todos';
  bulkSyncMode = false;
  bulkLoading = false;
  bulkParsing = false;
  /** Porcentaje 0-100 para la barra de progreso (simulado durante importación). */
  bulkProgressPercent = 0;
  private bulkProgressInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private catalogService: CatalogService,
    private router: Router,
    private notification: NotificationService
  ) {}

  ngOnInit(): void {
    forkJoin({
      products: this.catalogService.loadProducts().pipe(
        catchError(() => {
          this.notification.showMessage(
            'No se pudieron cargar los productos. Intenta más tarde.',
            'error'
          );
          return of([]);
        })
      ),
      categories: this.catalogService.loadCategories(),
    }).subscribe({
      next: ({ products }) => {
        this.products = products;
        this.dataVersion++;
      },
    });
  }

  loadProducts(): void {
    this.catalogService.loadProducts().subscribe({
      next: (list) => {
        this.products = list;
        this.dataVersion++;
      },
      error: () => {
        this.notification.showMessage('No se pudieron cargar los productos. Intenta más tarde.', 'error');
      },
    });
  }

  get pendingCount(): number {
    return this.catalogService.getPendingProducts().length;
  }

  get baseProducts(): Product[] {
    if (this.viewMode === 'pendientes') {
      return this.catalogService.getPendingProducts();
    }
    return this.products;
  }

  get filteredProducts(): Product[] {
    const term = this.searchTerm?.toLowerCase().trim() || '';
    const key = `${this.viewMode}|${this.filterEstado}|${term}|${this.dataVersion}`;
    if (key === this.filterCacheKey) return this.filteredCache;

    let list = this.baseProducts;
    if (this.viewMode === 'todos') {
      if (this.filterEstado === 'activo') list = list.filter((p) => p.active !== false);
      if (this.filterEstado === 'inactivo') list = list.filter((p) => p.active === false);
    }
    if (term) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.code.toLowerCase().includes(term)
      );
    }

    this.filterCacheKey = key;
    this.filteredCache = list;
    return list;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredProducts.length / this.pageSize));
  }

  /** Productos de la página actual (lo único que se renderiza en la tabla). */
  get pagedProducts(): Product[] {
    const page = Math.min(this.currentPage, this.totalPages);
    const start = (page - 1) * this.pageSize;
    return this.filteredProducts.slice(start, start + this.pageSize);
  }

  /** Rango mostrado ("1–50 de 3364") para el pie de la tabla. */
  get pageRangeStart(): number {
    if (this.filteredProducts.length === 0) return 0;
    return (Math.min(this.currentPage, this.totalPages) - 1) * this.pageSize + 1;
  }

  get pageRangeEnd(): number {
    return Math.min(this.pageRangeStart + this.pageSize - 1, this.filteredProducts.length);
  }

  goToPage(page: number): void {
    this.currentPage = Math.min(Math.max(1, page), this.totalPages);
  }

  prevPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  /** Al cambiar de pestaña, búsqueda o filtro volvemos a la primera página. */
  onFilterChange(): void {
    this.currentPage = 1;
  }

  setViewMode(mode: 'todos' | 'pendientes'): void {
    this.viewMode = mode;
    this.onFilterChange();
  }

  getCategoryName(categoryId: string): string {
    const cat = this.catalogService.getCategoryById(categoryId);
    return cat?.name ?? '—';
  }

  editProduct(product: Product): void {
    this.router.navigate(['/admin/productos/editar', product.id]);
  }

  setProductActive(product: Product, active: boolean): void {
    if (active && product.pendingConfig) {
      this.notification.showMessage(
        'Primero configura precio, categoría e imagen desde Editar. No puedes activar un producto pendiente sin esos datos.',
        'error'
      );
      return;
    }
    const action = active ? 'activar' : 'desactivar';
    this.notification.confirm('Confirmar', `¿Deseas ${action} el producto "${product.name}"?`).then((ok) => {
      if (ok) {
        this.catalogService.setProductActive(product.id, active).subscribe({
          next: () => {
            this.loadProducts();
            this.notification.showMessage(`Producto "${product.name}" ${active ? 'activado' : 'desactivado'}.`, 'success');
          },
          error: () => this.notification.showMessage('Error al actualizar el producto.', 'error'),
        });
      }
    });
  }

  deleteProduct(product: Product): void {
    this.notification
      .confirm('Eliminar producto', `¿Borrar "${product.name}" (${product.code})? Esta acción no se deshace.`)
      .then((ok) => {
        if (!ok) return;
        this.catalogService.deleteProduct(product.id).subscribe({
          next: (done) => {
            if (!done) {
              this.notification.showMessage('No se pudo eliminar el producto.', 'error');
              return;
            }
            this.loadProducts();
            this.notification.showMessage(`Producto "${product.name}" eliminado.`, 'success');
          },
          error: () => this.notification.showMessage('No se pudo eliminar el producto.', 'error'),
        });
      });
  }

  trackById(_index: number, product: Product): string {
    return product.id;
  }

  get bulkStats(): { nuevos: number; actualizados: number; sinCambios: number; eliminados: number } {
    return {
      nuevos: this.bulkPreview.filter((i) => i.status === 'nuevo').length,
      actualizados: this.bulkPreview.filter((i) => i.status === 'actualizado').length,
      sinCambios: this.bulkPreview.filter((i) => i.status === 'sin_cambios').length,
      eliminados: this.bulkDeleted.length,
    };
  }

  /** Cantidad de items que se enviarán a la API (nuevos + actualizados; sin_cambios se excluyen). */
  get bulkToImportCount(): number {
    return this.bulkPreview.filter((i) => i.status === 'nuevo' || i.status === 'actualizado').length;
  }

  get filteredBulkItems(): { code: string; name: string; stock: number; status: 'nuevo' | 'actualizado' | 'sin_cambios' }[] {
    if (this.bulkPreviewFilter === 'nuevos') return this.bulkPreview.filter((i) => i.status === 'nuevo');
    if (this.bulkPreviewFilter === 'actualizados') return this.bulkPreview.filter((i) => i.status === 'actualizado');
    if (this.bulkPreviewFilter === 'sin_cambios') return this.bulkPreview.filter((i) => i.status === 'sin_cambios');
    if (this.bulkPreviewFilter === 'eliminados') return [];
    return this.bulkPreview;
  }

  /** Items a mostrar en la tabla: del Excel (nuevos/actualizados/sin_cambios) o eliminados (no están en Excel). */
  get bulkTableRows(): { code: string; name: string; stock: number; status?: 'nuevo' | 'actualizado' | 'sin_cambios' | 'eliminado' }[] {
    if (this.bulkPreviewFilter === 'eliminados') {
      return this.bulkDeleted.map((d) => ({ ...d, status: 'eliminado' as const }));
    }
    return this.filteredBulkItems;
  }

  openBulkImport(): void {
    this.showBulkImport = true;
    this.bulkFile = null;
    this.bulkPreview = [];
    this.bulkDeleted = [];
    this.bulkPreviewFilter = 'todos';
    this.bulkSyncMode = false;
    this.bulkLoading = false;
    this.bulkParsing = false;
    this.bulkProgressPercent = 0;
    this.stopBulkProgressSimulation();
    this.bulkParseError = '';
  }

  closeBulkImport(): void {
    this.showBulkImport = false;
    this.bulkFile = null;
    this.bulkPreview = [];
    this.bulkDeleted = [];
    this.bulkParsing = false;
    this.stopBulkProgressSimulation();
    this.bulkParseError = '';
  }

  private stopBulkProgressSimulation(): void {
    if (this.bulkProgressInterval) {
      clearInterval(this.bulkProgressInterval);
      this.bulkProgressInterval = null;
    }
  }

  private startBulkProgressSimulation(isParsing: boolean): void {
    this.bulkProgressPercent = 0;
    this.stopBulkProgressSimulation();
    const target = isParsing ? 100 : 90;
    const step = isParsing ? 15 : 3;
    const intervalMs = isParsing ? 80 : 200;
    this.bulkProgressInterval = setInterval(() => {
      this.bulkProgressPercent = Math.min(this.bulkProgressPercent + step, target);
      if (this.bulkProgressPercent >= target) this.stopBulkProgressSimulation();
    }, intervalMs);
  }

  bulkParseError = '';

  onBulkFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'csv') {
      this.notification.showMessage('Formato no válido. Usa Excel (.xlsx, .xls) o CSV.', 'error');
      input.value = '';
      return;
    }
    this.bulkFile = file;
    this.bulkPreview = [];
    this.bulkParseError = '';
    this.bulkParsing = true;
    this.startBulkProgressSimulation(true);
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      this.bulkParsing = false;
      this.bulkProgressPercent = 100;
      this.stopBulkProgressSimulation();
      try {
        const data = e.target?.result;
        if (!data) {
          this.bulkParseError = 'No se pudo leer el archivo.';
          return;
        }
        const wb = XLSX.read(data, { type: 'binary' });
        const firstSheet = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheet];
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as (string | number)[][];
        const items = this.parseExcelRows(rows);
        this.classifyBulkItems(items);
        if (items.length === 0) {
          this.bulkParseError = 'No se encontraron productos. Verifica que el Excel tenga columnas "Código" y "Descripción".';
        } else {
          this.notification.showMessage(`Se detectaron ${items.length} producto(s) en el archivo.`, 'success');
        }
      } catch (err) {
        this.bulkParseError = 'No se pudo leer el archivo. Revisa que sea un Excel válido.';
        this.notification.showMessage(this.bulkParseError, 'error');
        this.bulkFile = null;
      }
    };
    reader.readAsBinaryString(file);
    input.value = '';
  }

  /** Compatible con Dichara: busca la fila con Código y Descripción (puede no ser la primera). Incluye Teórico (existencia). */
  private parseExcelRows(rows: (string | number)[][]): { code: string; name: string; stock: number }[] {
    if (!rows?.length) return [];

    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(15, rows.length); i++) {
      const row = rows[i] ?? [];
      const str = row.map((c) => String(c ?? '').toLowerCase()).join(' ');
      if (/c[oó]digo/.test(str) && /descripci[oó]n/.test(str)) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx < 0) return [];

    const header = (rows[headerRowIdx] ?? []).map((c) => String(c ?? '').toLowerCase().trim());
    const codeIdx = header.findIndex((h) => /c[oó]digo|code/.test(h));
    const descIdx = header.findIndex((h) => /descripci[oó]n|nombre|name|producto/.test(h));
    const stockIdx = header.findIndex((h) => /te[oó]rico|existencia|inventario|stock/.test(h));
    const fallbackCode = codeIdx >= 0 ? codeIdx : 0;
    const fallbackDesc = descIdx >= 0 ? descIdx : 1;

    const items: { code: string; name: string; stock: number }[] = [];
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((c) => c === '' || c == null)) continue;
      const code = String(row[codeIdx] ?? row[fallbackCode] ?? '').trim();
      const name = String(row[descIdx] ?? row[fallbackDesc] ?? row[0] ?? '').trim();
      const rawStock = row[stockIdx] ?? row[stockIdx >= 0 ? stockIdx : -1];
      const stock = typeof rawStock === 'number' ? Math.max(0, rawStock) : parseInt(String(rawStock ?? '0'), 10) || 0;
      if (code || name) items.push({ code: code || `item-${i + 1}`, name: name || code, stock });
    }
    return items;
  }

  /** Clasifica items del Excel: nuevos (crear), actualizados (cambió nombre o existencia), sin_cambios (existe y no cambió nada). */
  private classifyBulkItems(items: { code: string; name: string; stock: number }[]): void {
    const existingByCode = new Map(this.products.map((p) => [p.code.trim().toLowerCase(), p]));
    const excelCodes = new Set(items.map((i) => i.code.trim().toLowerCase()));

    this.bulkPreview = items.map((item) => {
      const key = item.code.trim().toLowerCase();
      const existing = existingByCode.get(key);
      if (!existing) return { ...item, status: 'nuevo' as const };
      const nameChanged = existing.name.trim() !== item.name.trim();
      const stockChanged = (existing.stock ?? 0) !== item.stock;
      const status = nameChanged || stockChanged ? 'actualizado' : 'sin_cambios';
      return { ...item, status };
    });

    this.bulkDeleted = this.products
      .filter((p) => !excelCodes.has(p.code.trim().toLowerCase()))
      .map((p) => ({ id: p.id, code: p.code, name: p.name, stock: p.stock ?? 0 }));
    // Por defecto sincronizar: eliminar los que no están en el archivo
    this.bulkSyncMode = this.bulkDeleted.length > 0;
  }

  async confirmBulkImport(): Promise<void> {
    const toImport = this.bulkPreview.filter((i) => i.status === 'nuevo' || i.status === 'actualizado');
    if (toImport.length === 0) {
      this.notification.showMessage(
        this.bulkStats.sinCambios > 0
          ? 'No hay productos nuevos ni con cambios. Todos están sin modificar.'
          : 'No hay datos para importar.',
        'error'
      );
      return;
    }
    if (this.bulkSyncMode && this.bulkDeleted.length > 0) {
      const ok = await this.notification.confirm(
        'Sincronizar',
        `Se desactivarán ${this.bulkDeleted.length} producto(s) que no están en el archivo. ¿Continuar?`
      );
      if (!ok) return;
    }
    this.bulkLoading = true;
    this.bulkProgressPercent = 0;
    this.startBulkProgressSimulation(false);
    this.catalogService
      .addProductsFromBulkImport(
        toImport.map((i) => ({ code: i.code, name: i.name, stock: i.stock })),
        this.bulkSyncMode
      )
      .subscribe({
        next: (result) => {
          this.bulkLoading = false;
          this.bulkProgressPercent = 100;
          this.stopBulkProgressSimulation();
          this.loadProducts();
          this.closeBulkImport();
          let msg = `Se crearon ${result.created} producto(s) pendientes de configurar.`;
          if (result.updated) msg += ` Se actualizó existencia de ${result.updated} producto(s).`;
          if (result.deleted) msg += ` Se desactivaron ${result.deleted} producto(s) que no estaban en el archivo.`;
          if (result.errors.length) msg += ` Advertencias: ${result.errors.slice(0, 3).join('; ')}`;
          this.notification.showMessage(msg, result.created > 0 || result.deleted > 0 ? 'success' : 'info');
          if (result.created > 0) this.viewMode = 'pendientes';
        },
        error: () => {
          this.bulkLoading = false;
          this.stopBulkProgressSimulation();
          this.notification.showMessage('No se pudo completar la importación. Intenta más tarde.', 'error');
        },
      });
  }
}
