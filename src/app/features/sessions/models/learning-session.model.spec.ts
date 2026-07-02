import {
  SessionStatus,
  SESSION_STATUS_LABELS,
  SESSION_STATUS_BADGE_CLASS,
} from './learning-session.model';

describe('LearningSessionModel', () => {
  describe('SessionStatus enum', () => {
    it('expone los 4 valores esperados', () => {
      expect(SessionStatus.PLANNED).toBe('PLANNED');
      expect(SessionStatus.IN_PROGRESS).toBe('IN_PROGRESS');
      expect(SessionStatus.COMPLETED).toBe('COMPLETED');
      expect(SessionStatus.CANCELLED).toBe('CANCELLED');
    });
  });

  describe('SESSION_STATUS_LABELS', () => {
    it('etiquetas en español para cada status', () => {
      expect(SESSION_STATUS_LABELS[SessionStatus.PLANNED]).toBe('Planificada');
      expect(SESSION_STATUS_LABELS[SessionStatus.IN_PROGRESS]).toBe('En Progreso');
      expect(SESSION_STATUS_LABELS[SessionStatus.COMPLETED]).toBe('Completada');
      expect(SESSION_STATUS_LABELS[SessionStatus.CANCELLED]).toBe('Cancelada');
    });
  });

  describe('SESSION_STATUS_BADGE_CLASS', () => {
    it('clases de badge por status', () => {
      expect(SESSION_STATUS_BADGE_CLASS[SessionStatus.PLANNED]).toContain('neutral');
      expect(SESSION_STATUS_BADGE_CLASS[SessionStatus.IN_PROGRESS]).toContain('primary');
      expect(SESSION_STATUS_BADGE_CLASS[SessionStatus.COMPLETED]).toContain('success');
      expect(SESSION_STATUS_BADGE_CLASS[SessionStatus.CANCELLED]).toContain('danger');
    });
  });
});
