import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Eventos GTM/GA4 alineados al tablero de indicadores del PG. */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private funnelStartedAt: number | null = null;
  private lastQuoteCode: string | null = null;

  private push(event: string, params: Record<string, unknown> = {}): void {
    if (environment.production === false && !environment.gtmId?.trim()) return;
    if (typeof window === 'undefined') return;
    const w = window as Window & { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event, ...params });
  }

  /** Marca el inicio del embudo (consulta → cotización). */
  markFunnelStart(): void {
    if (this.funnelStartedAt == null) {
      this.funnelStartedAt = Date.now();
    }
  }

  private secondsSinceFunnelStart(): number | undefined {
    if (this.funnelStartedAt == null) return undefined;
    return Math.max(1, Math.round((Date.now() - this.funnelStartedAt) / 1000));
  }

  addToCart(productCode: string, productName: string, qty: number, value: number): void {
    this.markFunnelStart();
    this.selectItem(productCode, productName, value, qty);
    this.push('add_to_cart', {
      currency: 'GTQ',
      value,
      items: [{ item_id: productCode, item_name: productName, quantity: qty, price: value }],
    });
  }

  /** Evento GA4 estándar al elegir un producto del catálogo. */
  selectItem(
    productCode: string,
    productName: string,
    price: number,
    quantity = 1,
    categoryId?: string,
  ): void {
    this.markFunnelStart();
    this.push('select_item', {
      currency: 'GTQ',
      value: price * quantity,
      items: [
        {
          item_id: productCode,
          item_name: productName,
          price,
          quantity,
          ...(categoryId ? { item_category: categoryId } : {}),
        },
      ],
    });
  }

  search(searchTerm: string, resultsCount?: number): void {
    this.markFunnelStart();
    this.push('search', {
      search_term: searchTerm,
      ...(resultsCount != null ? { results_count: resultsCount } : {}),
    });
  }

  /**
   * Cotización registrada en el sistema (indicador PG: cantidad de cotizaciones).
   * Se dispara una sola vez por código.
   */
  generateQuote(quoteCode: string, value: number, itemCount: number): void {
    if (this.lastQuoteCode === quoteCode) return;
    this.lastQuoteCode = quoteCode;
    const duration = this.secondsSinceFunnelStart();
    this.push('generate_lead', {
      currency: 'GTQ',
      value,
      quote_code: quoteCode,
      item_count: itemCount,
      lead_source: 'quote_created',
      ...(duration != null ? { quote_duration_seconds: duration } : {}),
    });
  }

  generateLead(quoteCode: string, value: number, source: 'whatsapp' | 'email' | 'share'): void {
    this.push('share_quote', {
      currency: 'GTQ',
      value,
      quote_code: quoteCode,
      method: source,
      lead_source: source,
    });
  }

  chatbotOpen(): void {
    this.push('chatbot_open');
  }

  chatbotQuestion(questionId: string, questionText: string): void {
    this.push('chatbot_question', {
      question_id: questionId,
      question_text: questionText,
    });
  }

  beginCheckout(value: number, itemCount: number): void {
    this.markFunnelStart();
    this.push('begin_checkout', {
      currency: 'GTQ',
      value,
      item_count: itemCount,
    });
  }

  pageView(path: string, title: string): void {
    this.push('page_view', { page_path: path, page_title: title });
  }

  /** Evento GA4 al ver la ficha de un producto. */
  viewItem(
    productCode: string,
    productName: string,
    price: number,
    categoryId?: string,
  ): void {
    this.markFunnelStart();
    this.push('view_item', {
      currency: 'GTQ',
      value: price,
      items: [
        {
          item_id: productCode,
          item_name: productName,
          price,
          ...(categoryId ? { item_category: categoryId } : {}),
        },
      ],
    });
  }

  viewRecommendations(count: number, context: string): void {
    this.push('view_item_list', {
      item_list_id: 'recommendations',
      item_list_name: context,
      item_count: count,
    });
  }

  selectRecommendation(
    productCode: string,
    productName: string,
    tipo: string,
    price: number,
  ): void {
    this.push('select_recommendation', {
      item_id: productCode,
      item_name: productName,
      recommendation_type: tipo,
      currency: 'GTQ',
      value: price,
    });
  }
}
