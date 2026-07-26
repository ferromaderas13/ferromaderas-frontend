import { ChangeDetectorRef, Component, DestroyRef, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { TimeoutError, timeout, catchError, finalize, of } from 'rxjs';
import { CatalogService, FEATURED_LIMIT } from '../../../core/services/catalog.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Product } from '../../../core/models/product.model';
import { Category } from '../../../core/models/category.model';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.scss',
})
export class ProductFormComponent implements OnInit, OnDestroy {
  readonly FEATURED_LIMIT = FEATURED_LIMIT;
  private readonly destroyRef = inject(DestroyRef);

  isEditing = false;
  /** Mientras carga el producto desde la API (solo edición). */
  loadingProduct = false;
  previewImage = '';
  productForm: Partial<Product> = {
    code: '',
    name: '',
    categoryId: '',
    price: 0,
    promotionalPrice: null,
    imageUrl: '',
    featured: false,
    active: true,
  };
  categories: Category[] = [];
  /** Si estamos editando, si el producto ya estaba en destacados al cargar. */
  private originalFeatured = false;

  /** Respaldo si RxJS/HTTP no terminan (no depende de Zone ni del operador timeout). */
  private loadSafetyTimer: ReturnType<typeof setTimeout> | null = null;

  /** Id de edición resuelto una vez (evita regex en cada ciclo de detección de cambios). */
  private editRouteProductId: string | null = null;

  constructor(
    private catalogService: CatalogService,
    private router: Router,
    private route: ActivatedRoute,
    private notification: NotificationService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    this.editRouteProductId = this.getEditProductId();
  }

  ngOnDestroy(): void {
    this.clearLoadSafetyTimer();
  }

  /**
   * Id del producto a editar: primero la URL (fiable con router-outlet anidado),
   * luego recorriendo ActivatedRoute.
   */
  private getEditProductId(): string | null {
    const fromUrl = /\/admin\/productos\/editar\/([^/?#]+)/.exec(this.router.url);
    if (fromUrl?.[1]) {
      return fromUrl[1];
    }
    let r: ActivatedRoute | null = this.route;
    while (r) {
      const id = r.snapshot.paramMap.get('id');
      if (id) {
        return id;
      }
      r = r.firstChild;
    }
    return null;
  }

  private clearLoadSafetyTimer(): void {
    if (this.loadSafetyTimer != null) {
      clearTimeout(this.loadSafetyTimer);
      this.loadSafetyTimer = null;
    }
  }

  /** Temporizador del navegador: fuerza salida del estado "cargando" aunque falle RxJS/HTTP. */
  private startLoadSafetyTimer(): void {
    this.clearLoadSafetyTimer();
    this.loadSafetyTimer = setTimeout(() => {
      this.loadSafetyTimer = null;
      if (!this.loadingProduct) {
        return;
      }
      this.loadingProduct = false;
      this.notification.showMessage(
        'No se pudo cargar el producto: la solicitud tardó demasiado. Intenta de nuevo más tarde.',
        'error'
      );
      this.router.navigate(['/admin/productos']);
      this.cdr.markForCheck();
    }, 20000);
  }

  ngOnInit(): void {
    this.catalogService.loadCategories().subscribe(() => {
      this.categories = this.catalogService.getAllCategories().filter((c) => c.active !== false);
      this.cdr.markForCheck();
    });

    const id = this.editRouteProductId;
    if (!id) {
      this.catalogService.loadProducts().subscribe(() => {
        this.productForm.code = this.catalogService.getNextProductCode();
        this.cdr.markForCheck();
      });
      return;
    }

    this.loadingProduct = true;
    this.startLoadSafetyTimer();
    this.cdr.markForCheck();

    this.catalogService.loadProducts().subscribe();

    this.catalogService
      .loadProductById(id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        timeout({ first: 20000 }),
        catchError((err: unknown) => {
          if (err instanceof TimeoutError) {
            this.notification.showMessage(
              'El servidor no respondió a tiempo. Intenta de nuevo más tarde.',
              'error'
            );
          } else {
            this.notification.showMessage('Error al cargar el producto.', 'error');
          }
          return of(null);
        }),
        finalize(() => {
          this.clearLoadSafetyTimer();
          this.loadingProduct = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (product) => {
          if (product?.id) {
            this.isEditing = true;
            this.originalFeatured = product.featured === true;
            this.productForm = { ...product };
            this.previewImage = product.imageUrl || '';
            if (product.pendingConfig) {
              this.productForm.active = false;
            }
          } else {
            this.notification.showMessage('No se encontró el producto.', 'error');
            this.router.navigate(['/admin/productos']);
          }
        },
      });
  }

  /** Ruta /admin/productos/editar/:id (para título mientras carga). */
  get isEditRoute(): boolean {
    return !!this.editRouteProductId;
  }

  /** Precio, categoría e imagen listos (pendientes de carga masiva). */
  get isConfigurationComplete(): boolean {
    const price = Number(this.productForm.price ?? 0);
    const hasImage = !!(this.productForm.imageUrl?.trim() || this.previewImage?.trim());
    return !!(this.productForm.categoryId && price > 0 && hasImage);
  }

  /** Permitir marcar como destacado solo si hay cupo o ya estaba destacado al editar. */
  get canMarkAsFeatured(): boolean {
    if (this.productForm.featured) return true;
    const count = this.catalogService.getFeaturedCount();
    if (this.isEditing && this.originalFeatured) return true;
    return count < FEATURED_LIMIT;
  }

  backToList(): void {
    this.router.navigate(['/admin/productos']);
  }

  onImageSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length && input.files[0]) {
      const file = input.files[0];
      const allowedFormats = ['image/png', 'image/jpeg', 'image/jpg'];
      if (!allowedFormats.includes(file.type)) {
        this.notification.showMessage('Formato de imagen no permitido. Solo se aceptan archivos .png, .jpg o .jpeg', 'error');
        input.value = '';
        return;
      }
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        this.notification.showMessage('La imagen es demasiado grande. El tamaño máximo permitido es 5MB', 'error');
        input.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const dataUrl = e.target?.result;
        if (!dataUrl || typeof dataUrl !== 'string') {
          return;
        }
        this.ngZone.run(() => {
          this.productForm.imageUrl = dataUrl;
          this.previewImage = dataUrl;
          this.cdr.markForCheck();
        });
      };
      reader.readAsDataURL(file);
    }
  }

  saveProduct(): void {
    if (!this.isEditing) {
      this.productForm.code = this.catalogService.getNextProductCode();
    }
    if (!this.productForm.code?.trim()) {
      this.notification.showMessage('El código del producto es requerido', 'error');
      return;
    }
    if (!this.productForm.name?.trim()) {
      this.notification.showMessage('El nombre del producto es requerido', 'error');
      return;
    }
    if (!this.productForm.categoryId) {
      this.notification.showMessage('Debes seleccionar una categoría', 'error');
      return;
    }
    if (this.productForm.price == null || this.productForm.price <= 0) {
      this.notification.showMessage('El precio debe ser mayor a 0.', 'error');
      return;
    }
    const listPrice = Number(this.productForm.price);
    const rawPromo = this.productForm.promotionalPrice;
    const promoNum = Number(rawPromo);
    const promo =
      rawPromo == null || rawPromo === undefined || !Number.isFinite(promoNum) || promoNum <= 0
        ? null
        : promoNum;
    if (promo != null && promo >= listPrice) {
      this.notification.showMessage(
        'El precio promocional debe ser menor al precio de lista.',
        'error',
      );
      return;
    }
    if (!this.productForm.imageUrl?.trim()) {
      this.notification.showMessage('La imagen del producto es requerida', 'error');
      return;
    }
    if (this.productForm.featured) {
      const featuredCount = this.catalogService.getFeaturedCount();
      const wouldExceedLimit = featuredCount >= FEATURED_LIMIT && !(this.isEditing && this.originalFeatured);
      if (wouldExceedLimit) {
        this.notification.showMessage(
          `Ya hay ${FEATURED_LIMIT} productos destacados. Quita uno desde la página Destacados o desmarca este para poder guardar.`,
          'error'
        );
        return;
      }
    }
    if (this.isEditing && this.productForm.id) {
      const updates: Partial<Product> = {
        code: this.productForm.code,
        name: this.productForm.name,
        categoryId: this.productForm.categoryId,
        price: listPrice,
        promotionalPrice: promo,
        imageUrl: this.productForm.imageUrl,
        featured: this.productForm.featured,
        active: this.productForm.active,
      };
      if (this.productForm.pendingConfig) {
        updates.pendingConfig = false;
      }
      this.catalogService.updateProduct(this.productForm.id, updates).subscribe({
        next: () => {
          this.notification.showMessage('Producto actualizado.', 'success');
          this.router.navigate(['/admin/productos']);
        },
        error: (err: { error?: { message?: string } }) =>
          this.notification.showMessage(
            err?.error?.message || 'Error al actualizar.',
            'error',
          ),
      });
    } else {
      this.catalogService.addProduct({
        code: this.productForm.code!,
        name: this.productForm.name!,
        categoryId: this.productForm.categoryId!,
        price: listPrice,
        promotionalPrice: promo,
        imageUrl: this.productForm.imageUrl!,
        featured: this.productForm.featured ?? false,
        active: this.productForm.active !== false,
      }).subscribe({
        next: () => {
          this.notification.showMessage('Producto creado.', 'success');
          this.router.navigate(['/admin/productos']);
        },
        error: (err: { error?: { message?: string } }) =>
          this.notification.showMessage(
            err?.error?.message || 'Error al crear.',
            'error',
          ),
      });
    }
  }
}
