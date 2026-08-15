import { Component, OnInit, AfterViewChecked, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { QuotationsService } from '../../../core/services/quotations.service';
import { QuotesApiService } from '../../../core/services/quotes-api.service';
import { ChatbotAdminService } from '../../../core/services/chatbot-admin.service';
import { Quotation, QuotationStatus } from '../../../core/models/quotation.model';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/** Datos para reporte de productos más cotizados */
interface ProductoCotizado {
  nombre: string;
  codigo: string;
  vecesCotizado: number;
  porcentaje: number;
}

/** Datos para reporte de vendedores */
interface VendedorRanking {
  nombre: string;
  cotizacionesCompletadas: number;
  montoTotal: number;
}

/** Pregunta frecuente del chatbot */
interface PreguntaFrecuente {
  pregunta: string;
  veces: number;
}

@Component({
  selector: 'app-reports-dashboard',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, FormsModule],
  templateUrl: './reports-dashboard.component.html',
  styleUrl: './reports-dashboard.component.scss',
})
export class ReportsDashboardComponent implements OnInit, AfterViewChecked {
  @ViewChild('reportContent') reportContent!: ElementRef<HTMLElement>;

  private quotationsService = inject(QuotationsService);
  private quotesApi = inject(QuotesApiService);
  private chatbotAdmin = inject(ChatbotAdminService);
  private route = inject(ActivatedRoute);

  showPdfPreview = false;
  pdfPreviewPages: string[] = [];
  private currentPdfBlob: Blob | null = null;
  private currentPdfSectionId = '';

  private hasScrolledToHash = false;

  quotations: Quotation[] = [];

  /** Estado de cotizaciones - datos reales */
  estadoCotizaciones: { estado: QuotationStatus; count: number; label: string }[] = [];
  barChartEstadoData!: ChartData<'bar'>;
  barChartEstadoOptions!: ChartConfiguration<'bar'>['options'];

  /** Productos más cotizados (API) */
  productosMasCotizados: ProductoCotizado[] = [];

  /** Ranking de vendedores (datos reales) */
  vendedoresRanking: VendedorRanking[] = [];

  /** Conversión */
  totalNuevas = 0;
  totalEnSeguimiento = 0;
  totalConfirmadas = 0;
  totalCerradas = 0;
  totalCanceladas = 0;
  tasaConversion = 0;

  /** Ventas por período */
  ventasPorMes: { mes: string; monto: number; cantidad: number }[] = [];
  lineChartVentasData!: ChartData<'line'>;
  lineChartVentasOptions!: ChartConfiguration<'line'>['options'];

  /** Chatbot FAQ (métricas del backend) */
  preguntasFrecuentes: PreguntaFrecuente[] = [];
  ventasSinDatos = false;

  searchTerm = '';
  /** Nombre del usuario que genera el informe (para PDF) */
  reportGeneratedBy = localStorage.getItem('ferromaderas_admin_user') ?? 'Administrador';

  statusLabels: Record<QuotationStatus, string> = {
    nueva: 'Nueva',
    en_seguimiento: 'En seguimiento',
    confirmada: 'Confirmada',
    cerrada: 'Cerrada',
    cancelada: 'Cancelada',
  };

  ngOnInit(): void {
    this.quotationsService.getAll().subscribe({
      next: (list) => {
        this.quotations = list;
        this.buildReports();
      },
      error: () => {
        this.quotations = [];
        this.buildReports();
      },
    });
    this.quotesApi.getTopQuotedProducts().subscribe({
      next: (list) => {
        this.productosMasCotizados = list;
      },
      error: () => {
        this.productosMasCotizados = [];
      },
    });
    this.chatbotAdmin.getMetrics().subscribe({
      next: (m) => {
        this.preguntasFrecuentes = m.topQuestions.map((q) => ({
          pregunta: q.question,
          veces: q.count,
        }));
        if (!this.preguntasFrecuentes.length) {
          this.preguntasFrecuentes = [
            { pregunta: 'Aún no hay preguntas registradas en el chatbot.', veces: 0 },
          ];
        }
      },
      error: () => this.buildChatbotFaqFallback(),
    });
  }

  private buildReports(): void {
    this.buildEstadoCotizaciones();
    this.buildVendedoresRanking();
    this.buildConversion();
    this.buildVentasPorPeriodo();
  }

  ngAfterViewChecked(): void {
    if (!this.hasScrolledToHash && this.route.snapshot.fragment) {
      this.hasScrolledToHash = true;
      const el = document.getElementById(this.route.snapshot.fragment);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  private buildEstadoCotizaciones(): void {
    const counts: Record<QuotationStatus, number> = {
      nueva: 0,
      en_seguimiento: 0,
      confirmada: 0,
      cerrada: 0,
      cancelada: 0,
    };
    this.quotations.forEach((q) => (counts[q.estado] = (counts[q.estado] ?? 0) + 1));
    this.estadoCotizaciones = (Object.keys(counts) as QuotationStatus[]).map((estado) => ({
      estado,
      count: counts[estado],
      label: this.statusLabels[estado],
    }));

    this.barChartEstadoData = {
      labels: this.estadoCotizaciones.map((e) => e.label),
      datasets: [
        {
          data: this.estadoCotizaciones.map((e) => e.count),
          label: 'Cotizaciones',
          backgroundColor: ['#3b82f6', '#8b5cf6', '#22c55e', '#06b6d4', '#ef4444'],
          borderColor: ['#2563eb', '#7c3aed', '#16a34a', '#0891b2', '#dc2626'],
          borderWidth: 1,
        },
      ],
    };
    this.barChartEstadoOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
      },
    };
  }

  private buildVendedoresRanking(): void {
    const byVendedor = new Map<string, { nombre: string; count: number; monto: number }>();
    const completadas = this.quotations.filter((q) =>
      (q.estado === 'confirmada' || q.estado === 'cerrada') && q.vendedorId
    );
    completadas.forEach((q) => {
      const id = q.vendedorId!;
      const nom = q.vendedorNombre ?? 'Sin nombre';
      if (!byVendedor.has(id)) byVendedor.set(id, { nombre: nom, count: 0, monto: 0 });
      const v = byVendedor.get(id)!;
      v.count += 1;
      v.monto += q.totalConIva ?? q.total;
    });
    this.vendedoresRanking = Array.from(byVendedor.entries())
      .map(([, v]) => ({ nombre: v.nombre, cotizacionesCompletadas: v.count, montoTotal: v.monto }))
      .sort((a, b) => b.cotizacionesCompletadas - a.cotizacionesCompletadas);
  }

  private buildConversion(): void {
    this.totalNuevas = this.quotations.filter((q) => q.estado === 'nueva').length;
    this.totalEnSeguimiento = this.quotations.filter((q) => q.estado === 'en_seguimiento').length;
    this.totalConfirmadas = this.quotations.filter((q) => q.estado === 'confirmada').length;
    this.totalCerradas = this.quotations.filter((q) => q.estado === 'cerrada').length;
    this.totalCanceladas = this.quotations.filter((q) => q.estado === 'cancelada').length;
    const completadas = this.totalConfirmadas + this.totalCerradas;
    const total = this.quotations.length;
    this.tasaConversion = total > 0 ? Math.round((completadas / total) * 100) : 0;
  }

  private buildVentasPorPeriodo(): void {
    const byMes = new Map<string, { monto: number; cantidad: number }>();
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    this.quotations.forEach((q) => {
      const fecha = this.parseFecha(q.fechaHora);
      if (fecha) {
        const d = new Date(fecha);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = `${meses[d.getMonth()]} ${d.getFullYear()}`;
        if (!byMes.has(key)) byMes.set(key, { monto: 0, cantidad: 0 });
        const entry = byMes.get(key)!;
        if (q.estado === 'confirmada' || q.estado === 'cerrada') {
          entry.monto += q.total;
        }
        entry.cantidad += 1;
      }
    });
    this.ventasPorMes = Array.from(byMes.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const [y, m] = key.split('-');
        const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1);
        return { mes: `${meses[d.getMonth()]} ${d.getFullYear()}`, monto: v.monto, cantidad: v.cantidad };
      })
      .slice(-6);

    this.ventasSinDatos = this.ventasPorMes.length === 0;

    this.lineChartVentasData = {
      labels: this.ventasSinDatos ? ['Sin datos'] : this.ventasPorMes.map((v) => v.mes),
      datasets: [
        {
          data: this.ventasSinDatos ? [0] : this.ventasPorMes.map((v) => v.monto),
          label: 'Ventas (Q)',
          borderColor: '#1e3a8a',
          backgroundColor: 'rgba(30, 58, 138, 0.1)',
          tension: 0.4,
          fill: true,
        },
      ],
    };
    this.lineChartVentasOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true },
      },
    };
  }

  private buildChatbotFaqFallback(): void {
    this.preguntasFrecuentes = [
      { pregunta: 'No se pudieron cargar las métricas del chatbot.', veces: 0 },
    ];
  }

  sectionTitles: { id: string; title: string }[] = [
    { id: 'estado-cotizaciones', title: 'Estado de cotizaciones' },
    { id: 'productos-cotizados', title: 'Productos más cotizados' },
    { id: 'vendedores', title: 'Vendedores con más cotizaciones completadas' },
    { id: 'conversion', title: 'Conversión de cotizaciones' },
    { id: 'ventas-periodo', title: 'Ventas por período' },
    { id: 'chatbot-faq', title: 'Chatbot - Preguntas más frecuentes' },
  ];

  onSearchChange(): void {
    const term = this.searchTerm.trim().toLowerCase();
    this.sectionTitles.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) el.style.display = term ? (s.title.toLowerCase().includes(term) ? 'block' : 'none') : 'block';
    });
  }

  scrollToFirstMatch(): void {
    const term = this.searchTerm.trim().toLowerCase();
    const first = this.sectionTitles.find((s) => s.title.toLowerCase().includes(term));
    if (first) document.getElementById(first.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private parseFecha(s: string): number | null {
    if (!s?.trim()) return null;
    const sep = s.includes('-') ? '-' : '/';
    const parts = s.split(sep).map(Number);
    if (parts.length < 3) return null;
    const [a, b, c] = parts;
    const isIso = sep === '-';
    const y = isIso ? a : c;
    const m = isIso ? b : a;
    const d = isIso ? c : b;
    return new Date(y, m - 1, d).getTime();
  }

  private getSectionTitle(sectionId: string): string {
    return this.sectionTitles.find((s) => s.id === sectionId)?.title ?? sectionId;
  }

  async openPdfPreview(sectionId: string): Promise<void> {
    const result = await this.generatePdfBlob(sectionId);
    if (!result) return;
    this.currentPdfBlob = result.blob;
    this.currentPdfSectionId = sectionId;
    this.pdfPreviewPages = result.pages;
    this.showPdfPreview = true;
  }

  closePdfPreview(): void {
    this.showPdfPreview = false;
    this.pdfPreviewPages = [];
    this.currentPdfBlob = null;
  }

  printPdf(): void {
    if (!this.currentPdfBlob) return;
    const url = URL.createObjectURL(this.currentPdfBlob);
    const win = window.open(url, '_blank', 'noopener');
    if (!win) {
      this.savePdf();
    }
  }

  savePdf(): void {
    if (!this.currentPdfBlob) return;
    const url = URL.createObjectURL(this.currentPdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-${this.currentPdfSectionId}-${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private async generatePdfBlob(
    sectionId: string,
  ): Promise<{ blob: Blob; pages: string[] } | null> {
    const el = document.getElementById(sectionId);
    if (!el) return null;
    const excludeEls = el.querySelectorAll('.exclude-from-pdf');
    excludeEls.forEach((e) => ((e as HTMLElement).style.visibility = 'hidden'));
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const doc = new jsPDF('p', 'mm', 'a4');
      const pdfW = doc.internal.pageSize.getWidth();
      const pdfH = doc.internal.pageSize.getHeight();
      const marginTop = 22;
      const marginBottom = 22;
      const contentTop = marginTop;
      const contentBottom = pdfH - marginBottom;
      const imgW = pdfW - 30;
      const imgH = (canvas.height * imgW) / canvas.width;
      const title = this.getSectionTitle(sectionId);
      const fecha = new Date().toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' });

      const blueColor = [30, 58, 138] as [number, number, number];
      const addHeaderFooter = (pageNum?: number, totalPages?: number) => {
        doc.setFontSize(10);
        doc.setTextColor(...blueColor);
        doc.setFont('helvetica', 'bold');
        doc.text('Ferromaderas - Materiales de Construcción', 15, 8);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(title, pdfW - 15, 8, { align: 'right' });
        doc.setDrawColor(229, 231, 235);
        doc.line(15, 12, pdfW - 15, 12);
        doc.setFontSize(7);
        doc.setTextColor(...blueColor);
        doc.text(`Generado por: ${this.reportGeneratedBy} | ${fecha}`, 15, pdfH - 8);
        doc.text(totalPages && totalPages > 1 && pageNum != null ? `Pág. ${pageNum}/${totalPages}` : 'Reporte confidencial - Ferromaderas', pdfW - 15, pdfH - 8, { align: 'right' });
        doc.line(15, pdfH - 12, pdfW - 15, pdfH - 12);
      };

      const maxImgPerPage = contentBottom - contentTop;
      let yPos = contentTop;
      let remainingImgH = imgH;
      let srcY = 0;
      let pageNum = 1;
      const pages: string[] = [];

      addHeaderFooter(1, imgH > maxImgPerPage ? Math.ceil(imgH / maxImgPerPage) : 1);

      while (remainingImgH > 0) {
        const drawH = Math.min(remainingImgH, maxImgPerPage);
        const srcH = (drawH * canvas.height) / imgH;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = Math.ceil(srcH);
        const ctx = tempCanvas.getContext('2d')!;
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
        const chunkData = tempCanvas.toDataURL('image/png');
        pages.push(chunkData);
        doc.addImage(chunkData, 'PNG', 15, yPos, imgW, drawH);
        remainingImgH -= drawH;
        srcY += srcH;
        if (remainingImgH > 0) {
          doc.addPage();
          pageNum++;
          addHeaderFooter(pageNum, Math.ceil(imgH / maxImgPerPage));
          yPos = contentTop;
        }
      }

      return { blob: doc.output('blob'), pages };
    } catch {
      return null;
    } finally {
      excludeEls.forEach((e) => ((e as HTMLElement).style.visibility = ''));
    }
  }
}
