import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AdminFaq {
  id: string;
  question: string;
  answer: string;
  keywords: string | null;
  order: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertFaqPayload {
  question: string;
  answer: string;
  keywords?: string;
  order?: number;
  active?: boolean;
}

export interface ChatbotMetrics {
  totalConversations: number;
  totalUserMessages: number;
  totalBotMessages: number;
  bySource: { source: string; count: number }[];
  topQuestions: { question: string; count: number }[];
  tokens: { prompt: number; completion: number; total: number };
  dailyAi?: {
    usedTokens: number;
    limitTokens: number;
    remainingTokens: number;
    reached: boolean;
    enabled: boolean;
  };
  cost: {
    model: string;
    currency: string;
    estimated: number;
    priceInputPer1M: number;
    priceOutputPer1M: number;
  };
}

export interface ChatbotUsageDay {
  day: string;
  messages: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface ConversationListItem {
  id: string;
  sessionId: string;
  visitorName: string | null;
  startedAt: string;
  lastAt: string;
  ip: string | null;
  messageCount: number;
}

export interface ConversationList {
  total: number;
  page: number;
  pageSize: number;
  items: ConversationListItem[];
}

export interface ConversationMessage {
  id: string;
  role: string;
  content: string;
  source: string | null;
  promptTokens: number;
  completionTokens: number;
  createdAt: string;
}

export interface ConversationDetail {
  id: string;
  sessionId: string;
  visitorName: string | null;
  startedAt: string;
  lastAt: string;
  ip: string | null;
  messages: ConversationMessage[];
}

@Injectable({ providedIn: 'root' })
export class ChatbotAdminService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/chatbot/admin`;

  // FAQs
  listFaqs(): Observable<AdminFaq[]> {
    return this.http.get<AdminFaq[]>(`${this.api}/faqs`);
  }

  createFaq(payload: UpsertFaqPayload): Observable<AdminFaq> {
    return this.http.post<AdminFaq>(`${this.api}/faqs`, payload);
  }

  updateFaq(id: string, payload: UpsertFaqPayload): Observable<AdminFaq> {
    return this.http.put<AdminFaq>(`${this.api}/faqs/${id}`, payload);
  }

  deleteFaq(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.api}/faqs/${id}`);
  }

  // Métricas y consumo
  getMetrics(): Observable<ChatbotMetrics> {
    return this.http.get<ChatbotMetrics>(`${this.api}/metrics`);
  }

  getUsage(): Observable<ChatbotUsageDay[]> {
    return this.http.get<ChatbotUsageDay[]>(`${this.api}/usage`);
  }

  // Historial de conversaciones
  listConversations(page = 1, pageSize = 20): Observable<ConversationList> {
    return this.http.get<ConversationList>(
      `${this.api}/conversations?page=${page}&pageSize=${pageSize}`,
    );
  }

  getConversation(id: string): Observable<ConversationDetail> {
    return this.http.get<ConversationDetail>(
      `${this.api}/conversations/${id}`,
    );
  }
}
