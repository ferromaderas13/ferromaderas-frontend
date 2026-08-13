import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  effect,
  inject,
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {

  RecommendationAgentService,

  RecommendationItem,

  RecommendationTipo,

} from '../../../core/services/recommendation-agent.service';

import { CartService } from '../../../core/services/cart.service';

import { AnalyticsService } from '../../../core/services/analytics.service';

import { ProductCardComponent } from '../product-card/product-card.component';



@Component({

  selector: 'app-product-recommendations',

  standalone: true,

  imports: [CommonModule, ProductCardComponent],

  templateUrl: './product-recommendations.component.html',

  styleUrl: './product-recommendations.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,

})

export class ProductRecommendationsComponent implements OnInit, OnChanges {

  private readonly agent = inject(RecommendationAgentService);

  private readonly cart = inject(CartService);

  private readonly analytics = inject(AnalyticsService);

  private readonly cdr = inject(ChangeDetectorRef);



  @Input() title = 'Sugerencias del agente de recomendación';

  @Input() subtitle =

    'Complementos y alternativas según tu consulta, categoría y cotizaciones reales';

  @Input() categoryId?: string;

  @Input() productId?: string;

  @Input() query?: string;

  @Input() useCartContext = false;

  @Input() limit = 6;



  recommendations: RecommendationItem[] = [];

  loading = true;

  constructor() {
    effect(() => {
      if (!this.useCartContext) return;
      this.cart.items();
      this.load();
    });
  }

  ngOnInit(): void {
    if (!this.useCartContext) {
      this.load();
    }
  }



  ngOnChanges(changes: SimpleChanges): void {

    if (

      changes['categoryId'] ||

      changes['productId'] ||

      changes['query'] ||

      changes['useCartContext']

    ) {

      this.load();

    }

  }



  private load(): void {

    this.loading = true;

    const cartCodes = this.useCartContext

      ? this.cart.items().map((l) => l.product.code)

      : undefined;



    this.agent

      .suggest({

        query: this.query,

        categoryId: this.categoryId,

        productId: this.productId,

        cartCodes,

        limit: this.limit,

      })

      .subscribe({

        next: (res) => {

          this.recommendations = res.recomendaciones;

          this.loading = false;

          if (this.recommendations.length) {
            this.analytics.viewRecommendations(
              this.recommendations.length,
              this.title || 'recommendations',
            );
          }

          this.cdr.markForCheck();

        },

        error: () => {

          this.recommendations = [];

          this.loading = false;

          this.cdr.markForCheck();

        },

      });

  }



  onAdd(item: RecommendationItem['product']): void {
    const rec = this.recommendations.find((r) => r.product.id === item.id);
    this.analytics.selectRecommendation(
      item.code,
      item.name,
      rec?.tipo ?? 'relacionado',
      item.price,
    );
    this.cart.addOne(item);
  }



  tipoLabel(tipo: RecommendationTipo): string {

    const labels: Record<RecommendationTipo, string> = {

      complementario: 'Complemento',

      alternativo: 'Alternativa',

      relacionado: 'Relacionado',

    };

    return labels[tipo];

  }



  trackById(_: number, item: RecommendationItem): string {

    return item.product.id;

  }

}


