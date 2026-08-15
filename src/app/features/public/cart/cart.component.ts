import { Component, inject, computed, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { CartService, CartLine } from '../../../core/services/cart.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { NotificationService } from '../../../core/services/notification.service';
import { QuotesApiService, Quote, CreateQuoteInput } from '../../../core/services/quotes-api.service';
import { AnalyticsService } from '../../../core/services/analytics.service';
import { AuthService } from '../../../core/services/auth.service';
import { ProductRecommendationsComponent } from '../../../shared/components/product-recommendations/product-recommendations.component';
import { openWhatsAppChat } from '../../../core/constants/whatsapp';
import { exactPrice, formatQuetzales, lineAmount } from '../../../core/utils/money';

/** Payload compacto con claves mínimas (URL más corta = más fácil que WhatsApp la detecte como link). */
type CompactLine = { p: string; q: number; c?: string; n?: string; m?: string; r?: number; pr?: number };

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ProductRecommendationsComponent],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss',
})
export class CartComponent implements OnInit {
  private cart = inject(CartService);
  private catalog = inject(CatalogService);
  private notification = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private quotesApi = inject(QuotesApiService);
  private analytics = inject(AnalyticsService);
  private auth = inject(AuthService);

  items = this.cart.items;
  total = this.cart.total;
  isEmpty = computed(() => this.cart.items().length === 0);

  /** Cotización ya guardada en el backend (evita crear duplicados al reenviar). */
  private savedQuote: Quote | null = null;

  /** Vista de cotización compartida (cuando se abre un link con ?code= o ?c=) */
  readonly showQuoteView = signal(false);
  readonly loadingQuote = signal(false);
  /** Código en la URL (?code=) para no mostrar el carrito vacío mientras carga o falla. */
  readonly quoteCodeFromUrl = signal<string | null>(null);
  readonly quoteData = signal<{
    id: string;
    estado: string;
    lines: CartLine[];
    total: number;
    neto: number;
    ivaPorcentaje: number;
    ivaMonto: number;
    totalConIva: number;
    nombre: string;
    telefono: string;
    direccion: string;
    nota: string;
  } | null>(null);

  showTrackingForm = false;
  trackingData = {
    nombre: '',
    telefono: '',
    email: '',
    direccion: '',
    nota: '',
  };

  ngOnInit(): void {
    this.catalog.loadCatalog().subscribe();
    this.catalog.loadCategories().subscribe();
    this.prefillClientTrackingData();

    // Leer el código de inmediato (snapshot) para no depender solo del subscribe async.
    const snapshotCode = this.route.snapshot.queryParamMap.get('code');
    if (snapshotCode) {
      this.quoteCodeFromUrl.set(snapshotCode.trim());
      this.loadQuoteByCode(snapshotCode);
    } else {
      this.tryLoadLegacyQuote(this.route.snapshot.queryParamMap.get('c'));
    }

    this.route.queryParams.subscribe((params) => {
      const code = params['code'];
      if (code) {
        this.quoteCodeFromUrl.set(String(code).trim());
        this.loadQuoteByCode(code);
        return;
      }
      this.quoteCodeFromUrl.set(null);
      this.tryLoadLegacyQuote(params['c']);
    });
  }

  /** Carga la cotización guardada en el backend por su código público. */
  private loadQuoteByCode(code: string): void {
    const normalized = code.trim();
    if (!normalized) return;

    this.loadingQuote.set(true);
    this.showQuoteView.set(false);

    this.quotesApi.getByCodigo(normalized).subscribe({
      next: (q) => {
        const view = this.mapQuoteToView(q);
        if (!view.lines.length) {
          this.loadingQuote.set(false);
          this.notification.showMessage(
            'La cotización existe pero no tiene productos registrados.',
            'error',
          );
          return;
        }
        this.quoteData.set(view);
        this.showQuoteView.set(true);
        this.loadingQuote.set(false);
      },
      error: () => {
        this.loadingQuote.set(false);
        this.showQuoteView.set(false);
        this.quoteData.set(null);
        this.notification.showMessage(
          `No se encontró la cotización ${normalized}. Verificá el enlace o creá una nueva.`,
          'error',
        );
      },
    });
  }

  /** Compatibilidad con enlaces antiguos ?c=base64 */
  private tryLoadLegacyQuote(c: string | null | undefined): void {
    if (!c) return;
    try {
      const data = JSON.parse(atob(c));
      const id = data.i ?? data.id;
      const rawLines = data.l ?? data.lines;
      if (id && rawLines?.length) {
        const lines = this.normalizeQuoteLines(rawLines);
        if (lines.length > 0) {
          const total =
            data.t ?? data.total ?? lines.reduce((acc, l) => acc + l.product.price * l.qty, 0);
          const divisor = 1.12;
          const neto = Math.round((total / divisor) * 100) / 100;
          const ivaMonto = Math.round((total - neto) * 100) / 100;
          this.quoteData.set({
            id,
            estado: 'nueva',
            lines,
            total,
            neto,
            ivaPorcentaje: 12,
            ivaMonto,
            totalConIva: total,
            nombre: data.o ?? data.nombre ?? '',
            telefono: data.tel ?? data.telefono ?? '',
            direccion: data.d ?? data.direccion ?? '',
            nota: data.x ?? data.nota ?? '',
          });
          this.showQuoteView.set(true);
          this.loadingQuote.set(false);
        }
      }
    } catch {
      /* ignored */
    }
  }

  /** Convierte los items de una cotización del backend al formato de la vista. */
  private mapQuoteToView(q: Quote): {
    id: string;
    estado: string;
    lines: CartLine[];
    total: number;
    neto: number;
    ivaPorcentaje: number;
    ivaMonto: number;
    totalConIva: number;
    nombre: string;
    telefono: string;
    direccion: string;
    nota: string;
  } {
    const lines: CartLine[] = (q.items ?? []).map((it) => {
      const existing = it.productoId ? this.catalog.getProductById(it.productoId) : undefined;
      return {
        product: {
          id: it.productoId ?? it.codigo,
          code: it.codigo,
          name: it.nombre,
          price: exactPrice(it.precioUnitario),
          imageUrl: existing?.imageUrl ?? '/assets/icons/logo.png',
          categoryId: existing?.categoryId ?? '',
        },
        qty: it.cantidad,
      };
    });
    return {
      id: q.codigo,
      estado: q.estado,
      lines,
      total: q.total,
      neto: q.neto ?? q.total,
      ivaPorcentaje: q.ivaPorcentaje ?? 12,
      ivaMonto: q.ivaMonto ?? 0,
      totalConIva: q.totalConIva ?? q.total,
      nombre: q.clienteNombre ?? '',
      telefono: q.clienteTelefono ?? '',
      direccion: q.clienteDireccion ?? '',
      nota: q.clienteNota ?? '',
    };
  }

  /** Convierte payload (compacto o legacy) a CartLine[]. */
  private normalizeQuoteLines(raw: unknown[]): CartLine[] {
    const first = raw[0];
    if (typeof first === 'object' && first !== null && 'product' in first && 'qty' in first) {
      return raw
        .filter((x): x is CartLine => typeof x === 'object' && x !== null && 'product' in x && typeof (x as CartLine).product?.id === 'string')
        .map((x) => ({ product: (x as CartLine).product, qty: (x as CartLine).qty }));
    }
    return this.resolveLinesFromCompact(raw as CompactLine[]);
  }

  private resolveLinesFromCompact(compactLines: CompactLine[]): CartLine[] {
    const result: CartLine[] = [];
    for (const cl of compactLines) {
      if (cl.q <= 0) continue;
      let product = this.catalog.getProductById(cl.p);
      const name = cl.m ?? cl.n;
      const price = cl.r ?? cl.pr;
      if (!product && cl.c != null && name != null && price != null) {
        product = {
          id: cl.p,
          code: cl.c,
          name: String(name),
          price: Number(price),
          imageUrl: '/assets/icons/logo.png',
          categoryId: '',
        };
      }
      if (product) result.push({ product, qty: cl.q });
    }
    return result;
  }

  closeQuoteView(): void {
    this.showQuoteView.set(false);
    this.quoteData.set(null);
  }

  linePrice(line: CartLine): number {
    return exactPrice(line.product.price);
  }

  lineSubtotal(line: CartLine): number {
    return lineAmount(line.product.price, line.qty);
  }

  addQty(productId: string): void {
    this.savedQuote = null;
    this.cart.addQty(productId);
  }

  subtractQty(productId: string): void {
    this.savedQuote = null;
    this.cart.subtractQty(productId);
  }

  remove(productId: string): void {
    this.savedQuote = null;
    this.cart.remove(productId);
  }

  openTrackingForm(): void {
    this.prefillClientTrackingData();
    this.showTrackingForm = true;
    this.analytics.beginCheckout(this.cart.total(), this.cart.items().length);
  }

  /** Si el visitante es cliente registrado, pre-llena el formulario de seguimiento. */
  private prefillClientTrackingData(): void {
    const user = this.auth.currentUser();
    if (!user || user.role !== 'cliente') return;
    if (!this.trackingData.nombre.trim()) {
      this.trackingData.nombre = user.name?.trim() || '';
    }
    if (!this.trackingData.email.trim()) {
      this.trackingData.email = user.email?.trim() || '';
    }
  }

  closeTrackingForm(): void {
    this.showTrackingForm = false;
  }

  /** Datos para crear la cotización en el backend a partir del carrito actual. */
  private buildCreateInput(): CreateQuoteInput {
    return {
      clienteNombre: this.trackingData.nombre || undefined,
      clienteTelefono: this.trackingData.telefono || undefined,
      clienteEmail: this.trackingData.email?.trim() || undefined,
      clienteDireccion: this.trackingData.direccion || undefined,
      clienteNota: this.trackingData.nota || undefined,
      items: this.cart.items().map((l) => ({
        productoId: l.product.id,
        codigo: l.product.code,
        nombre: l.product.name,
        precioUnitario: exactPrice(l.product.price),
        cantidad: l.qty,
      })),
    };
  }

  /**
   * Guarda la cotización en el backend una sola vez. Si el API falla, avisa al
   * usuario: sin registro en BD el enlace compartido no funcionará para el admin.
   */
  private ensureQuoteSaved(): Observable<Quote | null> {
    if (this.savedQuote) return of(this.savedQuote);
    if (this.cart.items().length === 0) return of(null);
    return this.quotesApi.create(this.buildCreateInput()).pipe(
      tap((q) => {
        this.savedQuote = q;
        this.analytics.generateQuote(q.codigo, this.cart.total(), this.cart.items().length);
      }),
      catchError((err) => {
        const msg =
          err?.error?.message ??
          'No se pudo guardar la cotización. Verificá que el backend esté en ejecución.';
        this.notification.showMessage(msg, 'error');
        return of(null);
      }),
    );
  }

  /** Enlace de la cotización: usa el código del backend si existe, si no, el legacy base64. */
  private quoteLinkFor(q: Quote | null): { id: string; url: string } {
    const base = window.location.origin + window.location.pathname;
    if (q) {
      return { id: q.codigo, url: `${base}?code=${encodeURIComponent(q.codigo)}` };
    }
    return this.buildLegacyQuoteUrl();
  }

  /** Enlace embebido (base64) usado como respaldo cuando no hay conexión con el backend. */
  private buildLegacyQuoteUrl(): { id: string; url: string } {
    const lines = this.cart.items();
    const year = new Date().getFullYear();
    const id = `FM-${year}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
    const compactLines: CompactLine[] = lines.map((l) => ({
      p: l.product.id,
      q: l.qty,
      c: l.product.code,
      m: l.product.name,
      r: l.product.price,
    }));
    const payload = {
      i: id,
      l: compactLines,
      t: this.cart.total(),
      o: this.trackingData.nombre,
      tel: this.trackingData.telefono,
      d: this.trackingData.direccion,
      x: this.trackingData.nota,
    };
    const base = window.location.origin + window.location.pathname;
    const url = `${base}?c=${btoa(JSON.stringify(payload))}`;
    return { id, url };
  }

  copyLink(): void {
    this.ensureQuoteSaved().subscribe((q) => {
      if (!q) return;
      const { url } = this.quoteLinkFor(q);
      navigator.clipboard.writeText(url).then(() => {
        this.notification.showMessage(`Link de la cotización ${q.codigo} copiado.`, 'success');
        this.analytics.generateLead(q.codigo, this.cart.total(), 'share');
      });
    });
  }

  sendToWhatsApp(): void {
    this.ensureQuoteSaved().subscribe((q) => {
      if (!q) return;
      const full = this.buildWhatsAppMessage(q);
      const { url: quoteUrl } = this.quoteLinkFor(q);
      const short = `Buen día, Ferromaderas. Cotización ${q.codigo}. Ver: ${quoteUrl}`;
      const message = full.length > 1600 ? short : full;
      openWhatsAppChat(message);
      const emailNote = this.trackingData.email?.trim()
        ? ' También enviamos una copia a tu correo.'
        : '';
      this.notification.showMessage(
        `Cotización ${q.codigo} registrada.${emailNote} Se abrió WhatsApp con el mensaje listo; dale Enviar.`,
        'success',
      );
      this.analytics.generateLead(q.codigo, this.cart.total(), 'whatsapp');
      if (this.trackingData.email?.trim()) {
        this.analytics.generateLead(q.codigo, this.cart.total(), 'email');
      }
      this.closeTrackingForm();
    });
  }

  /** Formatea un monto en quetzales exactos (Q100, no Q99.99). */
  private fmtQ(n: number): string {
    return formatQuetzales(n);
  }

  private buildWhatsAppMessage(q: Quote | null): string {
    const lines = this.cart.items();
    const { id, url } = this.quoteLinkFor(q);
    const t = this.trackingData;

    const partes: string[] = [];
    partes.push('Buen día, estimado Ferromaderas.');
    partes.push('Le comparto una cotización generada desde su sitio web:');
    partes.push(`*Cotización ${id}*`);

    const productos = ['*Productos*'];
    lines.forEach((l) => {
      const sub = lineAmount(l.product.price, l.qty);
      productos.push(
        `• ${l.product.code} - ${l.product.name}\n   ${l.qty} x ${this.fmtQ(l.product.price)} = ${this.fmtQ(sub)}`,
      );
    });
    partes.push(productos.join('\n'));

    partes.push(`*Total: ${this.fmtQ(this.cart.total())}*`);

    if (t.nombre || t.telefono || t.email || t.direccion || t.nota) {
      const datos = ['*Mis datos*'];
      if (t.nombre) datos.push(`Nombre: ${t.nombre}`);
      if (t.telefono) datos.push(`Teléfono/WhatsApp: +502 ${t.telefono}`);
      if (t.email) datos.push(`Correo: ${t.email}`);
      if (t.direccion) datos.push(`Dirección: ${t.direccion}`);
      if (t.nota) datos.push(`Nota: ${t.nota}`);
      partes.push(datos.join('\n'));
    }

    partes.push(`Ver la cotización en línea:\n${url}`);
    partes.push('Quedo atento(a) a su confirmación. ¡Gracias!');

    return partes.join('\n\n');
  }

  trackById(_index: number, line: CartLine): string {
    return line.product.id;
  }

  quoteStatusLabel(estado: string): string {
    const map: Record<string, string> = {
      nueva: 'Nueva — en revisión',
      en_seguimiento: 'En seguimiento',
      confirmada: 'Confirmada',
      cerrada: 'Cerrada',
      cancelada: 'Cancelada',
    };
    return map[estado] ?? estado;
  }
}
