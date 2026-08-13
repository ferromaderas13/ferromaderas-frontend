import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  ChatbotService,
  ChatFaq,
} from '../../../core/services/chatbot.service';
import { AnalyticsService } from '../../../core/services/analytics.service';

interface ChatMessage {
  type: 'bot' | 'user';
  text: string;
  /** Preguntas rápidas a mostrar debajo de un mensaje del bot. */
  suggestions?: ChatFaq[];
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrl: './chatbot.component.scss',
})
export class ChatbotComponent implements OnInit {
  isOpen = false;
  messages: ChatMessage[] = [];
  customInput = '';
  /** true mientras esperamos la respuesta del backend (muestra "escribiendo..."). */
  loading = false;
  /** true cuando todavía no conocemos el nombre del visitante (muestra el paso de nombre). */
  askingName = false;
  nameInput = '';

  private faqs: ChatFaq[] = [];

  constructor(
    private readonly chatbot: ChatbotService,
    private readonly analytics: AnalyticsService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.resetConversation();
    // Cargar las preguntas prelistadas desde el backend.
    this.chatbot.getFaqs().subscribe((faqs) => {
      this.faqs = faqs.length
        ? faqs
        : this.chatbot.initialOptions.map((o) => ({
            id: o.id,
            question: o.text,
            answer: o.response ?? '',
          }));
      // Refrescar las sugerencias del mensaje de bienvenida (salvo si estamos pidiendo el nombre).
      if (!this.askingName && this.messages.length && this.messages[0].type === 'bot') {
        this.messages[0].suggestions = this.faqs.slice(0, 6);
      }
      this.cdr.detectChanges();
    });
  }

  toggle(): void {
    const opening = !this.isOpen;
    this.isOpen = opening;
    if (opening) {
      this.analytics.chatbotOpen();
      if (this.messages.length === 0) {
        this.resetConversation();
      }
    }
  }

  resetConversation(): void {
    const name = this.chatbot.getName();
    // Si todavía no sabemos el nombre, mostramos el paso para pedirlo (sin costo de IA).
    this.askingName = !name;

    const greeting = name
      ? `¡Hola, ${name}! Soy el asistente de Ferromaderas. Elegí una pregunta o escribime tu consulta.`
      : this.chatbot.welcomeMessage;

    this.messages = [
      {
        type: 'bot',
        text: greeting,
        suggestions: this.askingName ? undefined : this.faqs.slice(0, 6),
      },
    ];
  }

  /** Guarda el nombre ingresado (o lo omite) y continúa la conversación. */
  submitName(skip = false): void {
    if (!skip) {
      const name = this.nameInput.trim();
      if (name) this.chatbot.setName(name);
    }
    this.nameInput = '';
    this.askingName = false;

    const name = this.chatbot.getName();
    const text = name
      ? `¡Gusto en conocerte, ${name}! ¿En qué puedo ayudarte?`
      : 'Perfecto. ¿En qué puedo ayudarte?';
    this.messages.push({
      type: 'bot',
      text,
      suggestions: this.faqs.slice(0, 6),
    });
    this.cdr.detectChanges();
  }

  /** Clic en una pregunta prelistada: usa la FAQ local si hay respuesta. */
  selectFaq(faq: ChatFaq): void {
    this.chatbot.recordClick(faq.id, faq.question);
    const local = this.findLocalAnswer(faq.question, faq.id) || faq.answer?.trim();
    if (local) {
      this.replyLocal(faq.question, faq.id, local);
      return;
    }
    this.send(faq.question, faq.id);
  }

  /** Envío de texto libre. */
  sendCustom(): void {
    const text = this.customInput.trim();
    if (!text) return;
    this.customInput = '';
    this.send(text);
  }

  private send(text: string, questionId = 'custom'): void {
    if (this.loading) return;
    const local = this.findLocalAnswer(text, questionId);
    if (local) {
      this.replyLocal(text, questionId, local);
      return;
    }

    this.analytics.chatbotQuestion(questionId, text);
    this.messages.push({ type: 'user', text });
    this.loading = true;

    this.cdr.detectChanges();
    this.chatbot
      .sendMessage(text)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (res) => {
          this.messages.push({
            type: 'bot',
            text: res.answer,
            suggestions: res.suggestions?.length
              ? res.suggestions
              : this.faqs.slice(0, 6),
          });
          this.cdr.detectChanges();
        },
        error: () => {
          this.messages.push({
            type: 'bot',
            text: 'No pude consultar el servidor ahora. Elegí una pregunta de la lista o escribinos por WhatsApp.',
            suggestions: this.faqs.slice(0, 6),
          });
          this.cdr.detectChanges();
        },
      });
  }

  private replyLocal(userText: string, questionId: string, answer: string): void {
    this.analytics.chatbotQuestion(questionId, userText);
    this.messages.push({ type: 'user', text: userText });
    this.messages.push({
      type: 'bot',
      text: answer,
      suggestions: this.faqs.slice(0, 6),
    });
    this.cdr.detectChanges();
  }

  private findLocalAnswer(text: string, questionId?: string): string | null {
    const norm = this.normalize(text);
    const fromFaqs = this.faqs.find(
      (f) =>
        (questionId && f.id === questionId && f.answer?.trim()) ||
        this.normalize(f.question) === norm,
    );
    if (fromFaqs?.answer?.trim()) return fromFaqs.answer.trim();

    const fromOptions = this.chatbot.initialOptions.find(
      (o) => o.id === questionId || this.normalize(o.text) === norm,
    );
    return fromOptions?.response?.trim() || null;
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[¿?¡!]/g, '')
      .trim();
  }
}
