import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap, of } from 'rxjs';
import { ProductsApiService } from '../../../core/services/products-api.service';
import { CartService } from '../../../core/services/cart.service';
import { AnalyticsService } from '../../../core/services/analytics.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { Product } from '../../../core/models/product.model';
import {
  productEffectivePrice,
  productIsOnPromotion,
} from '../../../core/utils/product-price';
import { ProductRecommendationsComponent } from '../../../shared/components/product-recommendations/product-recommendations.component';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, RouterLink, ProductRecommendationsComponent],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productsApi = inject(ProductsApiService);
  private readonly cart = inject(CartService);
  private readonly analytics = inject(AnalyticsService);
  private readonly catalog = inject(CatalogService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  product: Product | null = null;
  categoryName = '';
  loading = true;
  notFound = false;
  quantity = 1;

  get effectivePrice(): number {
    return this.product ? productEffectivePrice(this.product) : 0;
  }

  get onPromotion(): boolean {
    return this.product ? productIsOnPromotion(this.product) : false;
  }

  ngOnInit(): void {
    this.catalog.loadCategories().subscribe();

    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const id = params.get('id');
          if (!id) {
            void this.router.navigate(['/categorias']);
            return of(null);
          }
          this.loading = true;
          this.notFound = false;
          this.product = null;
          this.cdr.markForCheck();
          return this.productsApi.getCatalogProduct(id);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((product) => {
        this.loading = false;
        if (!product) {
          this.notFound = true;
          this.cdr.markForCheck();
          return;
        }
        this.product = product;
        this.categoryName = this.resolveCategoryName(product.categoryId);
        this.analytics.viewItem(
          product.code,
          product.name,
          productEffectivePrice(product),
          product.categoryId,
        );
        this.cdr.markForCheck();
      });
  }

  private resolveCategoryName(categoryId?: string): string {
    if (!categoryId) return '';
    return this.catalog.getCategoryById(categoryId)?.name ?? '';
  }

  increaseQuantity(): void {
    this.quantity++;
  }

  decreaseQuantity(): void {
    if (this.quantity > 1) this.quantity--;
  }

  addToCart(): void {
    if (!this.product) return;
    for (let i = 0; i < this.quantity; i++) {
      this.cart.addOne(this.product);
    }
    this.quantity = 1;
  }
}
