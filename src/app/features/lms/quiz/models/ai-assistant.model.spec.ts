import { AiAssistantStatus, emptyAiState } from './ai-assistant.model';

describe('ai-assistant.model', () => {
  describe('emptyAiState', () => {
    it('retorna estado inicial con Idle', () => {
      const state = emptyAiState();
      expect(state.status).toBe(AiAssistantStatus.Idle);
      expect(state.topic).toBe('');
      expect(state.suggestions).toEqual([]);
      expect(state.error).toBeNull();
    });
  });
});
