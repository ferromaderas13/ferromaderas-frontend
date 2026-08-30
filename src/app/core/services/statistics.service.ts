import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface VisitOrigin {
  pais: string;
  departamento: string;
  ciudad: string;
  visitas: number;
}

export interface DashboardStats {
  visitasTotales: number;
  vistasPagina: number;
  paginasSesion: number;
  rebotePorcentaje: number;
  paginasMasVisitadas: { pagina: string; vistas: number }[];
  visitasPorDia: { date: string; visits: number }[];
  dispositivos: { device: string; percentage: number }[];
  traficoMensual: { month: string; visits: number }[];
  visitasPorOrigen?: VisitOrigin[];
  dataSource?: 'ga4' | 'mock' | 'error';
}

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private readonly baseUrl = `${environment.apiUrl}/statistics`;

  constructor(private readonly http: HttpClient) {}

  getDashboard(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.baseUrl}/dashboard`);
  }
}
