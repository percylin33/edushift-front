import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { AiInsight, ChatMessage } from '../models';

@Injectable({ providedIn: 'root' })
export class AiApiService {
  private readonly api = inject(ApiService);

  sendMessage(sessionId: string | null, content: string): Observable<ChatMessage> {
    return this.api.post<ChatMessage>(API.AI.CHAT, { sessionId, content });
  }

  insights(): Observable<AiInsight[]> {
    return this.api.get<AiInsight[]>(API.AI.INSIGHTS);
  }
}
