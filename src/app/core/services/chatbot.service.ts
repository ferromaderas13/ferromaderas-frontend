import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, throwError, timeout, TimeoutError } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Opción de pregunta rápida (compatibilidad con el flujo anterior por botones). */
export interface ChatOption {
  id: string;
  text: string;
  response?: string;
  nextOptions?: ChatOption[];
}

/** Pregunta frecuente (FAQ) que viene del backend. */
export interface ChatFaq {
  id: string;
  question: string;
  answer: string;
}

/** Respuesta del backend al enviar un mensaje. */
export interface ChatResponse {
  conversationId: string;
  answer: string;
  source: 'faq' | 'catalogo' | 'ia' | 'fallback' | 'limite_diario';
  suggestions: ChatFaq[];
}

const STORAGE_FAQ_KEY = 'ferromaderas_chatbot_faq_clicks';
const STORAGE_SESSION_KEY = 'ferromaderas_chatbot_session';
const STORAGE_NAME_KEY = 'ferromaderas_chatbot_name';

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/chatbot`;

  /** Mensaje de bienvenida del asistente. */
  readonly welcomeMessage =
    '¡Hola! Soy el asistente de Ferromaderas. Elegí una pregunta o escribime tu consulta.';

  /**
   * Opciones locales de respaldo: se usan solo si el backend no devuelve FAQs
   * (por ejemplo, sin conexión). Lo normal es cargar las FAQs desde la API.
   */
  /**
   * Opciones locales de respaldo: se usan si el backend no responde.
   * Incluyen respuesta para que el chat funcione aunque falle POST /chatbot/message.
   */
  readonly initialOptions: ChatOption[] = [
    {
      id: 'ubicacion',
      text: '¿Cuál es la ubicación?',
      response:
        'Estamos en Amatitlán, Guatemala. En el sitio podés ver el mapa y la dirección en la sección Ubicación.',
    },
    {
      id: 'horarios',
      text: '¿Cuáles son los horarios?',
      response:
        'Atendemos en horario comercial de ferretería. Para confirmar el horario del día, escribinos por WhatsApp desde el sitio o visitá la sección Ubicación.',
    },
    {
      id: 'envios',
      text: '¿Hacen envíos a domicilio?',
      response:
        'Sí, hacemos envíos. El flete se confirma con un vendedor según zona, tipo de material y cantidad. Armá tu cotización en el carrito y enviala por WhatsApp.',
    },
    {
      id: 'pago',
      text: '¿Qué métodos de pago aceptan?',
      response:
        'El cierre de la compra lo confirma un vendedor. El pago se gestiona en tienda (efectivo u otros medios que indique el personal). La plataforma no cobra en línea.',
    },
    {
      id: 'cotizacion',
      text: '¿Cómo obtengo una cotización?',
      response:
        'Agregá productos al carrito, completá tus datos y generá la cotización. Podés copiar el enlace o enviarla por WhatsApp para seguimiento.',
    },
  ];

  // ---------------------------------------------------------------------------
  // Backend
  // ---------------------------------------------------------------------------

  /** Carga las preguntas prelistadas (FAQs activas) desde la API. */
  getFaqs(): Observable<ChatFaq[]> {
    return this.http
      .get<ChatFaq[]>(`${this.api}/faqs`)
      .pipe(catchError(() => of([])));
  }

  /** Envía el mensaje del usuario y devuelve la respuesta del asistente. */
  sendMessage(message: string): Observable<ChatResponse> {
    return this.http
      .post<ChatResponse>(`${this.api}/message`, {
        message,
        sessionId: this.getSessionId(),
        name: this.getName() || undefined,
      })
      .pipe(
        timeout(30000),
        catchError((err) => {
          if (err instanceof TimeoutError) {
            return of({
              conversationId: '',
              answer:
                'La respuesta está tardando más de lo normal. Probá de nuevo o escribinos por WhatsApp.',
              source: 'fallback' as const,
              suggestions: [],
            });
          }
          return throwError(() => err);
        }),
      );
  }

  /** Nombre del visitante guardado (vacío si aún no lo dio). */
  getName(): string {
    return localStorage.getItem(STORAGE_NAME_KEY) ?? '';
  }

  /** Guarda el nombre del visitante para personalizar el trato. */
  setName(name: string): void {
    const clean = name.trim().slice(0, 40);
    if (clean) localStorage.setItem(STORAGE_NAME_KEY, clean);
  }

  /** ID de sesión persistente para agrupar el historial de la conversación. */
  private getSessionId(): string {
    let id = localStorage.getItem(STORAGE_SESSION_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(STORAGE_SESSION_KEY, id);
    }
    return id;
  }

  // ---------------------------------------------------------------------------
  // Compatibilidad: reporte local de preguntas más usadas (panel de reportes)
  // ---------------------------------------------------------------------------

  /** Registra un clic en una pregunta (para el reporte local de FAQ). */
  recordClick(optionId: string, text: string): void {
    const raw = localStorage.getItem(STORAGE_FAQ_KEY);
    let clicks: { id: string; text: string; count: number }[] = [];
    if (raw) {
      try {
        clicks = JSON.parse(raw);
      } catch {
        clicks = [];
      }
    }
    const existing = clicks.find((c) => c.id === optionId);
    if (existing) {
      existing.count += 1;
    } else {
      clicks.push({ id: optionId, text, count: 1 });
    }
    localStorage.setItem(STORAGE_FAQ_KEY, JSON.stringify(clicks));
  }

  /** Devuelve las preguntas más frecuentes registradas localmente. */
  getPreguntasFrecuentes(): { pregunta: string; veces: number }[] {
    const raw = localStorage.getItem(STORAGE_FAQ_KEY);
    if (!raw) return [];
    try {
      const clicks: { id: string; text: string; count: number }[] =
        JSON.parse(raw);
      return clicks
        .map((c) => ({ pregunta: c.text, veces: c.count }))
        .sort((a, b) => b.veces - a.veces)
        .slice(0, 10);
    } catch {
      return [];
    }
  }
}
