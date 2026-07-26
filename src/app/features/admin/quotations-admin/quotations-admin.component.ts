import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { QuotationsService } from '../../../core/services/quotations.service';
import { QuotesApiService, QuoteItem, SeguimientoEntry } from '../../../core/services/quotes-api.service';
import { VendedoresService, Vendedor } from '../../../core/services/vendedores.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { FollowUpAlertsService } from '../../../core/services/follow-up-alerts.service';
import {
  ApprovalState,
  Quotation,
  QuotationStatus,
} from '../../../core/models/quotation.model';

@Component({
  selector: 'app-quotations-admin',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './quotations-admin.component.html',
  styleUrl: './quotations-admin.component.scss',
})
export class QuotationsAdminComponent implements OnInit {
  quotations: Quotation[] = [];
  vendedores: Vendedor[] = [];
  /** Vendedor seleccionado por fila en la tabla (asignación rápida). */
  inlineAssign: Record<string, string> = {};
  searchId = '';
  filterEstado: QuotationStatus | '' = '';
  fechaDesde = '';
  fechaHasta = '';
  filterVendedor = '';

  loading = false;
  loadError = '';
  private loadAttempt = 0;
  private emptyListRetried = false;

  /** Modal ver detalle */
  viewModalQuotation: Quotation | null = null;
  modalItems: QuoteItem[] = [];
  seguimientoHistory: SeguimientoEntry[] = [];
  loadingDetail = false;
  statusComment = '';

  /** Vendedor seleccionado para asignar (en modal o tabla) */
  assignVendedorId: string = '';

  /** Estado del formulario de descuento dentro del modal. */
  discountPct = 0;
  discountMotivo = '';
  /** Nota opcional al aprobar/rechazar un descuento. */
  approvalNote = '';

  /** Correo destino para socializar la cotización. */
  emailToSend = '';
  sendingEmail = false;

  statusOptions: { value: QuotationStatus | ''; label: string }[] = [
    { value: '', label: 'Estado' },
    { value: 'nueva', label: 'Nueva' },
    { value: 'en_seguimiento', label: 'En seguimiento' },
    { value: 'confirmada', label: 'Confirmada' },
    { value: 'cerrada', label: 'Cerrada' },
    { value: 'cancelada', label: 'Cancelada' },
  ];

  constructor(
    private quotationsService: QuotationsService,
    private vendedoresService: VendedoresService,
    private notification: NotificationService,
    private auth: AuthService,
    private followUpAlerts: FollowUpAlertsService,
    private cdr: ChangeDetectorRef,
    private quotesApi: QuotesApiService,
  ) {}

  ngOnInit(): void {
    this.auth.refreshMe().subscribe();
    this.loadQuotations();
    if (this.canManageAssignments) {
      this.loadVendedores();
    }
  }

  private loadQuotations(): void {
    this.loading = true;
    this.loadError = '';
    this.quotationsService.getAll().subscribe({
      next: (list) => {
        this.quotations = list;
        this.syncInlineAssign();
        this.loading = false;
        this.followUpAlerts.refresh();
        this.cdr.detectChanges();

        // Si hay alertas en caché pero la lista vino vacía, reintenta una vez (race con cookie).
        if (
          list.length === 0 &&
          this.followUpAlerts.pendingCount() > 0 &&
          !this.emptyListRetried
        ) {
          this.emptyListRetried = true;
          setTimeout(() => this.loadQuotations(), 800);
        }
      },
      error: (err: { status?: number; message?: string }) => {
        this.loading = false;
        this.quotations = [];
        this.followUpAlerts.data.set(null);
        this.cdr.markForCheck();

        if (err?.status === 401) {
          this.loadError = 'Sesión expirada. Volvé a iniciar sesión.';
        } else if (err?.status === 403) {
          this.loadError = 'No tenés permiso para ver cotizaciones.';
        } else {
          this.loadError =
            'No se pudieron cargar las cotizaciones. Verificá que el backend esté en ejecución.';
        }
        this.notification.showMessage(this.loadError, 'error');

        if (this.loadAttempt < 2) {
          this.loadAttempt++;
          setTimeout(() => this.loadQuotations(), 1500);
        }
      },
    });
  }

  refreshQuotations(): void {
    this.emptyListRetried = false;
    this.loadAttempt = 0;
    this.loadQuotations();
  }

  get pendingAlertsCount(): number {
    return this.followUpAlerts.pendingCount();
  }

  /** Vista restringida para el rol vendedor (solo sus asignaciones). */
  get isVendedorView(): boolean {
    return this.auth.hasRole('vendedor');
  }

  /** Admin/gerente pueden asignar vendedores. */
  get canManageAssignments(): boolean {
    return !this.isVendedorView;
  }

  get pageTitle(): string {
    return this.isVendedorView ? 'Mis cotizaciones asignadas' : 'Listado de cotizaciones';
  }

  get emptyListMessage(): string {
    return this.isVendedorView
      ? 'Aún no tenés cotizaciones asignadas. Pedile a un administrador que te asigne una.'
      : 'Aún no hay cotizaciones registradas.';
  }

  private syncInlineAssign(): void {
    const map: Record<string, string> = {};
    for (const q of this.quotations) {
      map[q.id] = q.vendedorId ?? '';
    }
    this.inlineAssign = map;
  }

  onInlineAssignChange(q: Quotation): void {
    const vendedorId = this.inlineAssign[q.id];
    if (!vendedorId) {
      if (q.vendedorId) this.unassignVendedor(q);
      return;
    }
    if (vendedorId === q.vendedorId) return;
    this.assignVendedor(q, vendedorId);
  }

  private loadVendedores(): void {
    this.vendedoresService.getAll().subscribe({
      next: (list) => (this.vendedores = list),
      error: () =>
        this.notification.showMessage('No se pudieron cargar los vendedores.', 'error'),
    });
  }

  get filteredQuotations(): Quotation[] {
    return this.quotations.filter((q) => {
      const matchId = !this.searchId || q.codigo.toLowerCase().includes(this.searchId.toLowerCase());
      const matchEstado = !this.filterEstado || q.estado === this.filterEstado;
      const matchVendedor = !this.filterVendedor || (q.vendedorId === this.filterVendedor);
      let matchFecha = true;
      if (this.fechaDesde || this.fechaHasta) {
        const d = this.parseFecha(q.fechaHora);
        if (this.fechaDesde && d < this.parseFecha(this.fechaDesde)) matchFecha = false;
        if (this.fechaHasta && d > this.parseFecha(this.fechaHasta)) matchFecha = false;
      }
      return matchId && matchEstado && matchVendedor && matchFecha;
    });
  }

  assignVendedor(q: Quotation, vendedorId: string): void {
    if (!vendedorId) return;
    const v = this.vendedores.find((x) => x.id === vendedorId);
    if (!v) return;
    this.quotationsService.assignVendedor(q.id, v.id, v.nombre).subscribe({
      next: (updated) => {
        this.replaceInList(updated);
        this.viewModalQuotation = updated;
        this.followUpAlerts.refresh();
        this.notification.showMessage(`Vendedor ${v.nombre} asignado a cotización ${updated.codigo}.`, 'success');
      },
      error: () => this.notification.showMessage('No se pudo asignar el vendedor.', 'error'),
    });
  }

  unassignVendedor(q: Quotation): void {
    this.quotationsService.unassignVendedor(q.id).subscribe({
      next: (updated) => {
        this.replaceInList(updated);
        this.viewModalQuotation = updated;
        this.followUpAlerts.refresh();
        this.notification.showMessage(`Vendedor desasignado de cotización ${updated.codigo}.`, 'success');
      },
      error: () => this.notification.showMessage('No se pudo desasignar el vendedor.', 'error'),
    });
  }

  /** Reemplaza una cotización en la lista local tras actualizarla en el backend. */
  private replaceInList(updated: Quotation): void {
    this.quotations = this.quotations.map((x) => (x.id === updated.id ? updated : x));
    this.inlineAssign[updated.id] = updated.vendedorId ?? '';
  }

  onAssignInModal(): void {
    if (!this.viewModalQuotation || !this.assignVendedorId) return;
    this.assignVendedor(this.viewModalQuotation, this.assignVendedorId);
    this.assignVendedorId = '';
  }

  /** Acepta DD/MM/YYYY HH:mm (lista) o YYYY-MM-DD (input type="date"). */
  private parseFecha(s: string): number {
    if (!s?.trim()) return 0;
    const datePart = s.trim().split(/\s+/)[0];
    const sep = datePart.includes('-') ? '-' : '/';
    const parts = datePart.split(sep).map(Number);
    if (parts.length < 3) return 0;
    const [a, b, c] = parts;
    const isIso = sep === '-';
    const y = isIso ? a : c;
    const m = isIso ? b : b;
    const d = isIso ? c : a;
    return new Date(y, m - 1, d).getTime();
  }

  statusLabel(estado: QuotationStatus): string {
    const map: Record<QuotationStatus, string> = {
      nueva: 'Nueva',
      en_seguimiento: 'En seguimiento',
      confirmada: 'Confirmada',
      cerrada: 'Cerrada',
      cancelada: 'Cancelada',
    };
    return map[estado] ?? estado;
  }

  viewQuotation(q: Quotation): void {
    this.viewModalQuotation = q;
    this.assignVendedorId = q.vendedorId ?? '';
    this.discountPct = q.descuentoPorcentaje ?? 0;
    this.discountMotivo = q.descuentoMotivo ?? '';
    this.approvalNote = '';
    this.emailToSend = q.email ?? '';
    this.statusComment = '';
    this.modalItems = [];
    this.seguimientoHistory = [];
    this.loadingDetail = true;

    this.quotationsService.getById(q.id).subscribe({
      next: (detail) => {
        this.viewModalQuotation = detail;
        this.loadingDetail = false;
      },
      error: () => {
        this.loadingDetail = false;
      },
    });

    this.quotesApi.getById(q.id).subscribe({
      next: (full) => {
        this.modalItems = full.items ?? [];
      },
    });

    this.quotesApi.getSeguimientoHistorial(q.id).subscribe({
      next: (hist) => {
        this.seguimientoHistory = hist;
      },
    });
  }

  closeViewModal(): void {
    this.viewModalQuotation = null;
    this.modalItems = [];
    this.seguimientoHistory = [];
  }

  seguimientoLabel(entry: SeguimientoEntry): string {
    if (entry.tipo === 'asignacion_vendedor') return 'Asignación de vendedor';
    if (entry.tipo === 'desasignacion_vendedor') return 'Desasignación de vendedor';
    if (entry.tipo === 'creacion') return 'Cotización creada';
    if (entry.estadoAnterior && entry.estadoNuevo) {
      return `${this.statusLabel(entry.estadoAnterior as QuotationStatus)} → ${this.statusLabel(entry.estadoNuevo as QuotationStatus)}`;
    }
    return 'Seguimiento';
  }

  /** ¿El usuario actual puede aprobar/rechazar descuentos? */
  canApprove(): boolean {
    return this.auth.hasPermission('approve_quotes');
  }

  applyDiscount(): void {
    if (!this.viewModalQuotation) return;
    const pct = Number(this.discountPct);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      this.notification.showMessage('El descuento debe estar entre 0 y 100%.', 'error');
      return;
    }
    this.quotationsService
      .applyDiscount(this.viewModalQuotation.id, pct, this.discountMotivo.trim() || undefined)
      .subscribe({
        next: (updated) => {
          this.replaceInList(updated);
          this.viewModalQuotation = updated;
          this.followUpAlerts.refresh();
          const msg =
            pct === 0
              ? 'Descuento eliminado.'
              : `Descuento de ${pct}% registrado. Requiere aprobación de un gerente.`;
          this.notification.showMessage(msg, 'success');
        },
        error: () => this.notification.showMessage('No se pudo aplicar el descuento.', 'error'),
      });
  }

  decideApproval(decision: 'aprobada' | 'rechazada'): void {
    if (!this.viewModalQuotation) return;
    this.quotationsService
      .decideApproval(this.viewModalQuotation.id, decision, this.approvalNote.trim() || undefined)
      .subscribe({
        next: (updated) => {
          this.replaceInList(updated);
          this.viewModalQuotation = updated;
          this.approvalNote = '';
          this.followUpAlerts.refresh();
          this.notification.showMessage(
            decision === 'aprobada' ? 'Descuento aprobado.' : 'Descuento rechazado.',
            'success'
          );
        },
        error: (err) =>
          this.notification.showMessage(
            err?.error?.message ?? 'No se pudo procesar la aprobación.',
            'error'
          ),
      });
  }

  sendByEmail(): void {
    if (!this.viewModalQuotation) return;
    const email = this.emailToSend.trim();
    if (!email) {
      this.notification.showMessage('Ingresa un correo para enviar la cotización.', 'error');
      return;
    }
    this.sendingEmail = true;
    this.quotationsService.sendByEmail(this.viewModalQuotation.id, email).subscribe({
      next: (res) => {
        this.sendingEmail = false;
        this.notification.showMessage(`Cotización enviada a ${res.email}.`, 'success');
      },
      error: (err) => {
        this.sendingEmail = false;
        this.notification.showMessage(
          err?.error?.message ?? 'No se pudo enviar el correo.',
          'error'
        );
      },
    });
  }

  /**
   * Enlace wa.me preformateado (alcance: socialización WhatsApp desde admin).
   * Sin API Business: abre WhatsApp Web/App con mensaje listo.
   */
  whatsappUrl(q: Quotation | null): string | null {
    if (!q?.telefono?.trim()) return null;
    let digits = q.telefono.replace(/\D/g, '');
    if (!digits) return null;
    if (digits.length === 8) digits = `502${digits}`;
    if (digits.length < 8) return null;
    const text = encodeURIComponent(
      `Hola${q.cliente ? ` ${q.cliente}` : ''}, te contactamos de Ferromaderas sobre tu cotización ${q.codigo}.`,
    );
    return `https://wa.me/${digits}?text=${text}`;
  }

  aprobacionLabel(estado: ApprovalState): string {
    const map: Record<ApprovalState, string> = {
      no_requiere: 'Sin aprobación requerida',
      pendiente: 'Pendiente de aprobación',
      aprobada: 'Descuento aprobado',
      rechazada: 'Descuento rechazado',
    };
    return map[estado] ?? estado;
  }

  changeStatus(q: Quotation): void {
    const next = this.getNextStatus(q.estado);
    if (!next) return;
    this.quotationsService.updateStatus(q.id, next, this.statusComment.trim() || undefined).subscribe({
      next: (updated) => {
        this.replaceInList(updated);
        this.viewModalQuotation = updated;
        this.statusComment = '';
        this.quotesApi.getSeguimientoHistorial(q.id).subscribe({
          next: (hist) => (this.seguimientoHistory = hist),
        });
        this.notification.showMessage(`Cotización ${updated.codigo} actualizada a ${this.statusLabel(next)}.`, 'success');
      },
      error: () => this.notification.showMessage('No se pudo actualizar el estado.', 'error'),
    });
  }

  canChangeStatus(q: Quotation): boolean {
    return this.getNextStatus(q.estado) !== null;
  }

  private getNextStatus(estado: QuotationStatus): QuotationStatus | null {
    const flow: QuotationStatus[] = ['nueva', 'en_seguimiento', 'confirmada', 'cerrada'];
    const idx = flow.indexOf(estado);
    if (idx >= 0 && idx < flow.length - 1) return flow[idx + 1];
    if (estado === 'cancelada') return 'nueva';
    return null;
  }

  trackById(_i: number, q: Quotation): string {
    return q.id;
  }
}
