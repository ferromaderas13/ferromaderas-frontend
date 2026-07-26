import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  BitacoraApiService,
  BitacoraListParams,
  BitacoraListResponse,
  BitacoraRow,
} from '../../../core/services/bitacora-api.service';
import { NotificationService } from '../../../core/services/notification.service';

interface ModuleFilterOption {
  id: string;
  label: string;
}

@Component({
  selector: 'app-bitacora-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './bitacora-admin.component.html',
  styleUrl: './bitacora-admin.component.scss',
})
export class BitacoraAdminComponent implements OnInit {
  readonly moduleOptions: ModuleFilterOption[] = [
    { id: 'errores', label: 'Errores del sistema' },
    { id: 'cotizaciones', label: 'Cotizaciones' },
    { id: 'auth', label: 'Autenticación' },
    { id: 'productos', label: 'Productos' },
    { id: 'inventario_sync', label: 'Inventario (sync)' },
  ];

  rows: BitacoraRow[] = [];
  total = 0;
  page = 1;
  pageSize = 25;
  loading = false;
  exporting = false;

  selectedModules: Record<string, boolean> = {};
  filterModulo = '';
  filterDesde = '';
  filterHasta = '';

  detalleExpandido: Record<string, boolean> = {};

  constructor(
    private readonly bitacoraApi: BitacoraApiService,
    private readonly notification: NotificationService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.bitacoraApi.list(this.buildListParams()).subscribe({
      next: (res: BitacoraListResponse) => {
        this.rows = res.items;
        this.total = res.total;
        this.page = res.page;
        this.pageSize = res.pageSize;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: { status?: number }) => {
        this.loading = false;
        this.cdr.detectChanges();
        if (err?.status === 403) {
          this.notification.showMessage(
            'No tenés permiso para ver la bitácora. Pedí el permiso «Ver bitácora» al administrador.',
            'error',
          );
        } else {
          this.notification.showMessage('No se pudo cargar la bitácora.', 'error');
        }
      },
    });
  }

  aplicarFiltros(): void {
    this.page = 1;
    this.load();
  }

  onModuleCheckboxChange(): void {
    if (this.getSelectedModules().length > 0) {
      this.filterModulo = '';
    }
  }

  onModuloTextInput(): void {
    if (this.filterModulo.trim()) {
      this.selectedModules = {};
    }
  }

  prevPage(): void {
    if (this.page > 1) {
      this.page--;
      this.load();
    }
  }

  nextPage(): void {
    if (this.page * this.pageSize < this.total) {
      this.page++;
      this.load();
    }
  }

  exportCsv(): void {
    this.exporting = true;
    this.bitacoraApi
      .list({
        ...this.buildListParams(),
        page: 1,
        pageSize: Math.min(this.total || 1000, 5000),
      })
      .subscribe({
        next: (res) => {
          this.exporting = false;
          if (!res.items.length) {
            this.notification.showMessage('No hay registros para exportar.', 'error');
            this.cdr.detectChanges();
            return;
          }
          this.downloadCsv(res.items);
          this.notification.showMessage(
            `Exportados ${res.items.length} registro(s) en CSV.`,
            'success',
          );
          this.cdr.detectChanges();
        },
        error: () => {
          this.exporting = false;
          this.cdr.detectChanges();
          this.notification.showMessage('No se pudo exportar la bitácora.', 'error');
        },
      });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get hasModuleFilters(): boolean {
    return this.getSelectedModules().length > 0 || !!this.filterModulo.trim();
  }

  toggleDetalle(id: string): void {
    this.detalleExpandido[id] = !this.detalleExpandido[id];
  }

  detallesJson(d: Record<string, unknown> | null): string {
    if (!d || Object.keys(d).length === 0) return '—';
    try {
      return JSON.stringify(d, null, 2);
    } catch {
      return '—';
    }
  }

  formatFecha(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleString('es-GT', {
        dateStyle: 'short',
        timeStyle: 'medium',
      });
    } catch {
      return iso;
    }
  }

  private buildListParams(): BitacoraListParams {
    const moduloText = this.filterModulo.trim();
    const params: BitacoraListParams = {
      page: this.page,
      pageSize: this.pageSize,
      desde: this.filterDesde || undefined,
      hasta: this.filterHasta || undefined,
    };

    if (moduloText) {
      params.modulo = moduloText;
    } else {
      const modulos = this.getSelectedModules();
      if (modulos.length) {
        params.modulos = modulos;
      }
    }

    return params;
  }

  private getSelectedModules(): string[] {
    return this.moduleOptions
      .map((m) => m.id)
      .filter((id) => !!this.selectedModules[id]);
  }

  private downloadCsv(items: BitacoraRow[]): void {
    const headers = ['Fecha', 'Módulo', 'Acción', 'Usuario', 'Usuario (id)', 'IP', 'Detalles'];
    const lines = [
      headers.join(','),
      ...items.map((row) =>
        [
          this.csvCell(this.formatFecha(row.fecha)),
          this.csvCell(row.modulo),
          this.csvCell(row.accion),
          this.csvCell(row.usuarioNombre ?? ''),
          this.csvCell(row.usuarioId ?? ''),
          this.csvCell(row.ip ?? ''),
          this.csvCell(this.detallesJson(row.detalles)),
        ].join(','),
      ),
    ];

    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `bitacora-${stamp}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private csvCell(value: string): string {
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }
}
