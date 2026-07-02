import { TestBed } from '@angular/core/testing';
import { AiStore } from './ai.store';
import { ChatMessage, AiInsight } from '../models';

describe('AiStore', () => {
  let store: AiStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AiStore] });
    store = TestBed.inject(AiStore);
  });

  it('inicia con estado vacío', () => {
    expect(store.messages()).toEqual([]);
    expect(store.insights()).toEqual([]);
    expect(store.streaming()).toBeFalse();
    expect(store.error()).toBeNull();
    expect(store.lastMessage()).toBeNull();
  });

  describe('appendMessage', () => {
    it('agrega mensaje al final', () => {
      const msg: ChatMessage = { id: '1', role: 'user', content: 'Hola', createdAt: '' };
      store.appendMessage(msg);
      expect(store.messages().length).toBe(1);
      expect(store.lastMessage()?.content).toBe('Hola');
    });
  });

  describe('setMessages', () => {
    it('reemplaza mensajes', () => {
      const msgs: ChatMessage[] = [
        { id: '1', role: 'user', content: 'A', createdAt: '' },
        { id: '2', role: 'assistant', content: 'B', createdAt: '' },
      ];
      store.setMessages(msgs);
      expect(store.messages().length).toBe(2);
    });
  });

  describe('setInsights', () => {
    it('establece insights', () => {
      const insights: AiInsight[] = [
        { id: 'i1', category: 'alert', title: 'Alerta', summary: 'Detalle', generatedAt: '' },
      ];
      store.setInsights(insights);
      expect(store.insights().length).toBe(1);
    });
  });

  describe('setStreaming', () => {
    it('cambia estado streaming', () => {
      store.setStreaming(true);
      expect(store.streaming()).toBeTrue();
      store.setStreaming(false);
      expect(store.streaming()).toBeFalse();
    });
  });

  describe('setError', () => {
    it('establece y limpia error', () => {
      store.setError('Error test');
      expect(store.error()).toBe('Error test');
      store.setError(null);
      expect(store.error()).toBeNull();
    });
  });

  describe('reset', () => {
    it('reinicia todo el estado', () => {
      store.appendMessage({ id: '1', role: 'user', content: 'Test', createdAt: '' });
      store.setStreaming(true);
      store.setError('Err');
      store.reset();
      expect(store.messages()).toEqual([]);
      expect(store.streaming()).toBeFalse();
      expect(store.error()).toBeNull();
    });
  });
});
