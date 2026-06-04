export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title?: string;
  messages: ChatMessage[];
  updatedAt: string;
}

export interface AiInsight {
  id: string;
  category: 'risk' | 'opportunity' | 'trend' | 'alert';
  title: string;
  summary: string;
  score?: number;
  generatedAt: string;
}
