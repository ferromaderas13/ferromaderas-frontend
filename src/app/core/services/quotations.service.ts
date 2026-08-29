import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Quotation } from '../models/quotation.model';
import { QuotesApiService, Quote } from './quotes-api.service';

/**
 * Servicio de cotizaciones del panel administrativo.
 * Consume el API real (`/api/quotes`) y adapta la respuesta al modelo Quotation
 * que utiliza la vista.
 */
@Injectable({ providedIn: 'root' })
export class QuotationsService {
  private readonly api = inject(QuotesApiService);

  private toQuotation(q: Quote): Quotation {
    return {
      id: q.id,
      codigo: q.codigo,
      fechaHora: this.formatFecha(q.createdAt),
      cliente: q.clienteNombre?.trim() || '—',
      telefono: q.clienteTelefono ?? '',
      email: q.clienteEmail,
      subtotal: q.subtotal ?? q.total,
      descuentoPorcentaje: q.descuentoPorcentaje ?? 0,
      descuentoMonto: q.descuentoMonto ?? 0,
      descuentoMotivo: q.descuentoMotivo,
      neto: q.neto ?? q.total,
      ivaPorcentaje: q.ivaPorcentaje ?? 12,
      ivaMonto: q.ivaMonto ?? 0,
      total: q.total,
      totalConIva: q.totalConIva ?? q.total,
      direccion: q.clienteDireccion ?? '',
      estado: q.estado,
      aprobacion: q.aprobacion ?? 'no_requiere',
      aprobadoPorNombre: q.aprobadoPorNombre,
      aprobadoEn: q.aprobadoEn,
      aprobacionNota: q.aprobacionNota,
      vendedorId: q.vendedorId,
      vendedorNombre: q.vendedorNombre,
      createdAt: q.createdAt,
      items: q.items?.map((it) => ({
        codigo: it.codigo,
        nombre: it.nombre,
        cantidad: it.cantidad,
      })),
    };
  }

  private formatFecha(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  }

  getAll(): Observable<Quotation[]> {
    return this.api.list().pipe(
      map((list) => {
        if (!Array.isArray(list)) {
          throw new Error('El servidor no devolvió un listado válido de cotizaciones.');
        }
        return list.map((q) => this.toQuotation(q));
      }),
    );
  }

  getById(id: string): Observable<Quotation> {
    return this.api.getById(id).pipe(map((q) => this.toQuotation(q)));
  }

  updateStatus(id: string, estado: Quotation['estado'], comentario?: string): Observable<Quotation> {
    return this.api.updateStatus(id, estado, comentario).pipe(map((q) => this.toQuotation(q)));
  }

  assignVendedor(id: string, vendedorId: string, vendedorNombre: string): Observable<Quotation> {
    return this.api
      .assignVendedor(id, vendedorId, vendedorNombre)
      .pipe(map((q) => this.toQuotation(q)));
  }

  unassignVendedor(id: string): Observable<Quotation> {
    return this.api.assignVendedor(id, null, null).pipe(map((q) => this.toQuotation(q)));
  }

  applyDiscount(id: string, porcentaje: number, motivo?: string): Observable<Quotation> {
    return this.api
      .applyDiscount(id, porcentaje, motivo)
      .pipe(map((q) => this.toQuotation(q)));
  }

  decideApproval(
    id: string,
    decision: 'aprobada' | 'rechazada',
    nota?: string,
  ): Observable<Quotation> {
    return this.api
      .decideApproval(id, decision, nota)
      .pipe(map((q) => this.toQuotation(q)));
  }

  sendByEmail(id: string, email?: string): Observable<{ ok: boolean; email: string }> {
    return this.api.sendByEmail(id, email);
  }
}
