import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Policy {
  id?: string;
  title: string;
  content: string[];
  icon: string;
}

export interface PolicyPage {
  title: string;
  subtitle: string;
  policies: Policy[];
}

const POLICY_COUNT = 6;

@Injectable({
  providedIn: 'root',
})
export class PolicyService {
  private readonly api = `${environment.apiUrl}/policies`;
  private policyPage$ = new BehaviorSubject<PolicyPage | null>(null);

  constructor(private readonly http: HttpClient) {}

  /** Obtiene las políticas (público o admin). Emite desde cache si ya se cargaron. */
  getPolicyPage(): Observable<PolicyPage> {
    if (this.policyPage$.value) {
      return of(this.policyPage$.value);
    }
    return this.http.get<PolicyPage>(this.api).pipe(
      tap((page) => this.policyPage$.next(this.normalizePage(page))),
      catchError(() => {
        const fallback = this.getDefaultPolicyPage();
        this.policyPage$.next(fallback);
        return of(fallback);
      })
    );
  }

  /** Carga las políticas desde la API (siempre hace request). */
  loadPolicyPage(): Observable<PolicyPage> {
    return this.http.get<PolicyPage>(this.api).pipe(
      tap((page) => this.policyPage$.next(this.normalizePage(page)))
    );
  }

  /** Valor actual en cache (puede ser null si no se ha cargado). */
  getPolicyPageSnapshot(): PolicyPage {
    const current = this.policyPage$.getValue();
    if (current) return JSON.parse(JSON.stringify(current));
    return this.getDefaultPolicyPage();
  }

  /** Página por defecto (6 políticas). */
  getDefaultPolicyPage(): PolicyPage {
    return JSON.parse(JSON.stringify({
      title: 'Políticas de compra',
      subtitle: 'Leé estas condiciones antes de confirmar tu pedido por WhatsApp.',
      policies: [
        { title: 'Precios y vigencia', icon: '', content: ['Los precios pueden variar sin previo aviso.', 'La cotización se confirma al finalizar por WhatsApp.'] },
        { title: 'Envío y flete', icon: '', content: ['El flete depende de zona/distancia/productos.', 'Se confirma antes de cerrar el pedido.'] },
        { title: 'Cambios y devoluciones', icon: '', content: ['No se aceptan cambios ni devoluciones tras la entrega.', 'Aplica revisión al recibir.'] },
        { title: 'Disponibilidad', icon: '', content: ['Productos sujetos a stock.', 'Si se agota el producto, el vendedor por vía Whatsapp te ofrecerá la mejor alternativa.'] },
        { title: 'Métodos de pago', icon: '', content: ['Los métodos de pago son únicamente los siguientes:', 'Efectivo.', 'Transferencia'] },
        { title: 'Horarios', icon: '', content: ['Lunes a sábado 7:30 am – 5:30 pm.', 'Fuera de horario se atiende el siguiente día hábil.'] },
      ],
    }));
  }

  /** Actualiza las políticas en el servidor. */
  updatePolicyPage(page: PolicyPage): Observable<PolicyPage> {
    const copy = this.normalizePage(page);
    return this.http.put<PolicyPage>(this.api, copy).pipe(
      tap((updated) => this.policyPage$.next(this.normalizePage(updated)))
    );
  }

  /** Asegura siempre 6 políticas con estructura válida. */
  private normalizePage(page: PolicyPage): PolicyPage {
    const def = this.getDefaultPolicyPage();
    const policies = (page?.policies ?? []).slice(0, POLICY_COUNT);
    const result: Policy[] = [];
    for (let i = 0; i < POLICY_COUNT; i++) {
      const p = policies[i] ?? def.policies[i];
      result.push({
        id: p?.id,
        title: p?.title ?? `Política ${i + 1}`,
        content: Array.isArray(p?.content) ? [...p.content] : [],
        icon: p?.icon ?? '',
      });
    }
    return {
      title: page?.title ?? def.title,
      subtitle: page?.subtitle ?? def.subtitle,
      policies: result,
    };
  }
}
