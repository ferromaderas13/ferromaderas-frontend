import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';

import {
  StatisticsService,
  DashboardStats,
} from '../../../core/services/statistics.service';
import { FollowUpAlertsService } from '../../../core/services/follow-up-alerts.service';
import { FollowUpAlertItem } from '../../../core/services/quotes-api.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  MAP_H,
  MAP_W,
  MapMarker,
  SUCURSAL,
  guatemalaPath,
  markersFromOrigins,
  rankExtranjero,
  rankGuatemala,
} from './dashboard-geo';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, BaseChartDirective],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  visitasTotales = 0;
  vistasPagina = 0;
  paginasSesion = 0;
  rebotePorcentaje = 0;
  paginasMasVisitadas: { pagina: string; vistas: number }[] = [];
  maxPaginasVistas = 0;

  loading = true;
  error: string | null = null;
  dataSource: 'ga4' | 'mock' | 'error' = 'mock';

  readonly mapW = MAP_W;
  readonly mapH = MAP_H;
  readonly mapaPath = guatemalaPath();
  readonly sucursal = SUCURSAL;
  mapaMarcadores: MapMarker[] = [];
  rankingGt: { label: string; visitas: number }[] = [];
  rankingExt: { label: string; visitas: number }[] = [];
  hovered: MapMarker | null = null;

  private readonly followUpAlerts = inject(FollowUpAlertsService);
  private readonly auth = inject(AuthService);

  readonly canViewQuotes = () => this.auth.hasPermission('view_quotes');
  readonly alertsLoading = this.followUpAlerts.loading;
  readonly alertsData = this.followUpAlerts.data;

  public barChartType: ChartType = 'bar';
  public barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Visitas',
        backgroundColor: '#1e3a8a',
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };

  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, grid: { color: '#eef2ff' }, ticks: { precision: 0 } },
    },
  };

  public doughnutChartType: ChartType = 'doughnut';
  public doughnutChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [
      {
        data: [],
        backgroundColor: ['#1e3a8a', '#f59e0b', '#93c5fd'],
        borderWidth: 3,
        borderColor: '#ffffff',
      },
    ],
  };

  public doughnutChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: {
        display: true,
        position: 'right',
        labels: { usePointStyle: true, padding: 16, font: { size: 12 } },
      },
      title: { display: false },
    },
  };

  public lineChartType: ChartType = 'line';
  public lineChartData: ChartData<'line'> = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Visitas',
        borderColor: '#1e3a8a',
        backgroundColor: 'rgba(30, 58, 138, 0.12)',
        pointBackgroundColor: '#f59e0b',
        pointBorderColor: '#fff',
        pointRadius: 4,
        tension: 0.4,
        fill: true,
      },
    ],
  };

  public lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, grid: { color: '#eef2ff' }, ticks: { precision: 0 } },
    },
  };

  constructor(private readonly statistics: StatisticsService) {}

  ngOnInit(): void {
    if (this.canViewQuotes()) {
      this.followUpAlerts.refresh();
    }
    this.statistics.getDashboard().subscribe({
      next: (data) => this.applyDashboardData(data),
      error: () => {
        this.error = 'No se pudieron cargar las estadísticas.';
        this.loading = false;
      },
    });
  }

  pageBarWidth(vistas: number): string {
    if (!this.maxPaginasVistas) return '0%';
    return `${Math.max(10, (vistas / this.maxPaginasVistas) * 100)}%`;
  }

  rankShare(visitas: number): string {
    const max = this.rankingGt[0]?.visitas ?? 0;
    if (!max) return '0%';
    return `${Math.max(8, (visitas / max) * 100)}%`;
  }

  private applyDashboardData(data: DashboardStats): void {
    this.dataSource = data.dataSource ?? 'mock';
    this.visitasTotales = data.visitasTotales;
    this.vistasPagina = data.vistasPagina;
    this.paginasSesion = data.paginasSesion;
    this.rebotePorcentaje = data.rebotePorcentaje;
    this.paginasMasVisitadas = data.paginasMasVisitadas;
    this.maxPaginasVistas = Math.max(0, ...data.paginasMasVisitadas.map((p) => p.vistas));

    const origen = data.visitasPorOrigen ?? [];
    this.mapaMarcadores = markersFromOrigins(origen);
    this.rankingGt = rankGuatemala(origen).slice(0, 8);
    this.rankingExt = rankExtranjero(origen).slice(0, 4);

    this.barChartData = {
      ...this.barChartData,
      labels: data.visitasPorDia.map((d) =>
        /^\d{8}$/.test(d.date) ? this.formatDateLabel(d.date) : d.date,
      ),
      datasets: [
        {
          ...this.barChartData.datasets[0],
          data: data.visitasPorDia.map((d) => d.visits),
        },
      ],
    };

    this.doughnutChartData = {
      ...this.doughnutChartData,
      labels: data.dispositivos.map((d) => d.device),
      datasets: [
        {
          ...this.doughnutChartData.datasets[0],
          data: data.dispositivos.map((d) => d.percentage),
        },
      ],
    };

    this.lineChartData = {
      ...this.lineChartData,
      labels: data.traficoMensual.map((d) => d.month),
      datasets: [
        {
          ...this.lineChartData.datasets[0],
          data: data.traficoMensual.map((d) => d.visits),
        },
      ],
    };

    this.loading = false;
  }

  private formatDateLabel(yyyymmdd: string): string {
    const y = parseInt(yyyymmdd.slice(0, 4), 10);
    const m = parseInt(yyyymmdd.slice(4, 6), 10) - 1;
    const d = parseInt(yyyymmdd.slice(6, 8), 10);
    const date = new Date(y, m, d);
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return `${days[date.getDay()]} ${d}`;
  }

  alertLabel(tipo: FollowUpAlertItem['tipo']): string {
    if (tipo === 'nueva_sin_vendedor') return 'Sin vendedor';
    if (tipo === 'descuento_pendiente') return 'Descuento pendiente';
    return 'Sin movimiento';
  }

  formatAlertFecha(iso: string): string {
    try {
      return new Date(iso).toLocaleString('es-GT', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
    } catch {
      return iso;
    }
  }
}
