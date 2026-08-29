import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApprovalState, QuotationStatus } from '../models/quotation.model';

export interface QuoteItemInput {
  productoId?: string;
  codigo: string;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
}

export interface CreateQuoteInput {
  clienteNombre?: string;
  clienteTelefono?: string;
  clienteEmail?: string;
  clienteDireccion?: string;
  clienteNota?: string;
  items: QuoteItemInput[];
}

export interface QuoteItem {
  id: string;
  productoId?: string;
  codigo: string;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
}

export interface Quote {
  id: string;
  codigo: string;
  estado: QuotationStatus;
  clienteNombre?: string;
  clienteTelefono?: string;
  clienteEmail?: string;
  clienteDireccion?: string;
  clienteNota?: string;
  subtotal: number;
  descuentoPorcentaje: number;
  descuentoMonto: number;
  descuentoMotivo?: string;
  neto: number;
  ivaPorcentaje: number;
  ivaMonto: number;
  total: number;
  totalConIva: number;
  aprobacion: ApprovalState;
  aprobadoPorNombre?: string;
  aprobadoEn?: string;
  aprobacionNota?: string;
  vendedorId?: string;
  vendedorNombre?: string;
  createdAt: string;
  updatedAt: string;
  items?: QuoteItem[];
}

/** Tipos de alerta de seguimiento comercial (panel admin). */
export type FollowUpAlertType =
  | 'nueva_sin_vendedor'
  | 'descuento_pendiente'
  | 'sin_movimiento';

export interface SeguimientoEntry {
  id: string;
  tipo: string;
  estadoAnterior?: string;
  estadoNuevo?: string;
  comentario?: string;
  usuarioNombre?: string;
  createdAt: string;
}

export interface FollowUpAlertItem {
  id: string;
  codigo: string;
  tipo: FollowUpAlertType;
  prioridad: 'alta' | 'media';
  mensaje: string;
  clienteNombre?: string;
  total: number;
  createdAt: string;
  diasSinAtender: number;
}

export interface FollowUpAlertsResponse {
  resumen: {
    nuevasSinVendedor: number;
    enSeguimiento: number;
    descuentosPendientes: number;
    sinMovimiento: number;
    totalPendientes: number;
  };
  alertas: FollowUpAlertItem[];
}

@Injectable({ providedIn: 'root' })
export class QuotesApiService {
  private readonly api = `${environment.apiUrl}/quotes`;

  constructor(private readonly http: HttpClient) {}

  /** Público: crea la cotización desde el carrito. */
  create(input: CreateQuoteInput): Observable<Quote> {
    return this.http.post<Quote>(this.api, input);
  }

  /** Público: obtiene una cotización por su código (enlace compartible). */
  getByCodigo(codigo: string): Observable<Quote> {
    return this.http.get<Quote>(`${this.api}/public/${encodeURIComponent(codigo)}`);
  }

  /** Admin: listado completo para el panel. */
  list(): Observable<Quote[]> {
    return this.http.get<Quote[]>(this.api);
  }

  /** Admin: detalle con items. */
  getById(id: string): Observable<Quote> {
    return this.http.get<Quote>(`${this.api}/${id}`);
  }

  /** Admin: cambia el estado de seguimiento (con comentario opcional). */
  updateStatus(
    id: string,
    estado: QuotationStatus,
    comentario?: string,
  ): Observable<Quote> {
    return this.http.patch<Quote>(`${this.api}/${id}/status`, { estado, comentario });
  }

  /** Cliente registrado: sus cotizaciones. */
  getMisCotizaciones(): Observable<Quote[]> {
    return this.http.get<Quote[]>(`${this.api}/mis-cotizaciones`);
  }

  /** Historial de seguimiento de una cotización. */
  getSeguimientoHistorial(id: string): Observable<SeguimientoEntry[]> {
    return this.http.get<SeguimientoEntry[]>(`${this.api}/${id}/historial-seguimiento`);
  }

  /** Admin: asigna (o quita, con null) el vendedor responsable. */
  assignVendedor(
    id: string,
    vendedorId: string | null,
    vendedorNombre: string | null,
  ): Observable<Quote> {
    return this.http.patch<Quote>(`${this.api}/${id}/vendedor`, {
      vendedorId,
      vendedorNombre,
    });
  }

  /** Admin: aplica (o quita, con 0) un descuento porcentual. */
  applyDiscount(id: string, porcentaje: number, motivo?: string): Observable<Quote> {
    return this.http.patch<Quote>(`${this.api}/${id}/descuento`, {
      porcentaje,
      motivo,
    });
  }

  /** Admin (gerente): aprueba o rechaza un descuento pendiente. */
  decideApproval(
    id: string,
    decision: 'aprobada' | 'rechazada',
    nota?: string,
  ): Observable<Quote> {
    return this.http.patch<Quote>(`${this.api}/${id}/aprobacion`, {
      decision,
      nota,
    });
  }

  /** Admin: envía la cotización al cliente por correo. */
  sendByEmail(id: string, email?: string): Observable<{ ok: boolean; email: string }> {
    return this.http.post<{ ok: boolean; email: string }>(
      `${this.api}/${id}/enviar-correo`,
      { email },
    );
  }

  /** Admin: alertas de seguimiento comercial para dashboard y menú. */
  getFollowUpAlerts(): Observable<FollowUpAlertsResponse> {
    return this.http.get<FollowUpAlertsResponse>(`${this.api}/seguimiento/alertas`);
  }

  /** Admin: productos más cotizados para reportes. */
  getTopQuotedProducts(): Observable<
    { codigo: string; nombre: string; vecesCotizado: number; porcentaje: number }[]
  > {
    return this.http.get<
      { codigo: string; nombre: string; vecesCotizado: number; porcentaje: number }[]
    >(`${this.api}/reportes/productos-cotizados`);
  }
}
