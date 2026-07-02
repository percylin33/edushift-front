import { ChatMessage, ChatSession, AiInsight } from './chat.model';

describe('ChatMessage', () => {
  it('crea un mensaje con role user', () => {
    const msg: ChatMessage = { id: '1', role: 'user', content: 'Hola', createdAt: '2026-01-01' };
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hola');
  });

  it('crea un mensaje con role assistant', () => {
    const msg: ChatMessage = {
      id: '2',
      role: 'assistant',
      content: 'Respuesta',
      createdAt: '2026-01-01',
    };
    expect(msg.role).toBe('assistant');
  });
});

describe('ChatSession', () => {
  it('crea una sesión con mensajes', () => {
    const session: ChatSession = { id: 's1', title: 'Test', messages: [], updatedAt: '2026-01-01' };
    expect(session.title).toBe('Test');
    expect(session.messages).toEqual([]);
  });
});

describe('AiInsight', () => {
  it('crea un insight de tipo risk', () => {
    const insight: AiInsight = {
      id: 'i1',
      category: 'risk',
      title: 'Alerta',
      summary: 'Detalle',
      generatedAt: '2026-01-01',
    };
    expect(insight.category).toBe('risk');
  });
});
