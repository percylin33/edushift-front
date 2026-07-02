import { Injectable, computed, signal } from '@angular/core';
import { AiInsight, ChatMessage } from '../models';

@Injectable({ providedIn: 'root' })
export class AiStore {
  private readonly _messages = signal<ChatMessage[]>([]);
  private readonly _insights = signal<AiInsight[]>([]);
  private readonly _streaming = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly messages = this._messages.asReadonly();
  readonly insights = this._insights.asReadonly();
  readonly streaming = this._streaming.asReadonly();
  readonly error = this._error.asReadonly();
  readonly lastMessage = computed(() => {
    const list = this._messages();
    return list.length > 0 ? list[list.length - 1] : null;
  });

  appendMessage(message: ChatMessage): void {
    this._messages.update((list) => [...list, message]);
  }
  setMessages(messages: ChatMessage[]): void {
    this._messages.set(messages);
  }
  setInsights(insights: AiInsight[]): void {
    this._insights.set(insights);
  }
  setStreaming(value: boolean): void {
    this._streaming.set(value);
  }
  setError(error: string | null): void {
    this._error.set(error);
  }

  reset(): void {
    this._messages.set([]);
    this._insights.set([]);
    this._streaming.set(false);
    this._error.set(null);
  }
}
