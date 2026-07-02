import {
  TaskLifecycle,
  SubmissionStatus,
  TaskSummaryRaw,
  TaskResponseRaw,
  toTaskRow,
  toTaskDetail,
  isTaskEditable,
  isTaskTerminal,
  ALL_TASK_LIFECYCLES,
} from './task.model';

describe('task.model', () => {
  describe('toTaskRow', () => {
    it('parsea ISO strings a Date', () => {
      const raw: TaskSummaryRaw = {
        publicUuid: 't-1',
        title: 'Tarea 1',
        dueAt: '2030-01-15T00:00:00.000Z',
        maxScore: 20,
        lifecycle: TaskLifecycle.Published,
        submissionsCount: 3,
        sectionLabel: 'Sección A',
        courseLabel: 'Matemáticas',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const row = toTaskRow(raw);
      expect(row.dueAt).toBeInstanceOf(Date);
      expect(row.dueAt?.toISOString()).toBe('2030-01-15T00:00:00.000Z');
      expect(row.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(row.lifecycle).toBe(TaskLifecycle.Published);
    });

    it('maneja dueAt null', () => {
      const raw: TaskSummaryRaw = {
        publicUuid: 't-2',
        title: 'Sin fecha',
        dueAt: null,
        maxScore: 10,
        lifecycle: TaskLifecycle.Draft,
        submissionsCount: 0,
        sectionLabel: null,
        courseLabel: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const row = toTaskRow(raw);
      expect(row.dueAt).toBeNull();
      expect(row.sectionLabel).toBeNull();
    });
  });

  describe('toTaskDetail', () => {
    it('mapea todos los campos y normaliza fechas', () => {
      const raw: TaskResponseRaw = {
        publicUuid: 't-1',
        sectionPublicUuid: 's-1',
        coursePublicUuid: 'c-1',
        periodPublicUuid: 'p-1',
        title: 'Tarea 1',
        description: 'Descripción',
        dueAt: '2030-01-15T00:00:00.000Z',
        maxScore: 20,
        allowResubmissions: true,
        requiresAttachment: false,
        lifecycle: TaskLifecycle.Published,
        createdByTeacherPublicUuid: 'tch-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: null,
      };
      const detail = toTaskDetail(raw);
      expect(detail.publicUuid).toBe('t-1');
      expect(detail.createdAt).toBeInstanceOf(Date);
      expect(detail.updatedAt).toBeNull();
      expect(detail.description).toBe('Descripción');
    });

    it('usa default 0 para submissionsCount ausente', () => {
      const raw = {
        publicUuid: 't-1',
        sectionPublicUuid: 's-1',
        coursePublicUuid: 'c-1',
        periodPublicUuid: 'p-1',
        title: 'T',
        description: null,
        dueAt: null,
        maxScore: 10,
        allowResubmissions: false,
        requiresAttachment: false,
        lifecycle: TaskLifecycle.Draft,
        createdByTeacherPublicUuid: 'tch-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: null,
      } as TaskResponseRaw;
      const detail = toTaskDetail(raw);
      expect(detail.submissionsCount).toBe(0);
    });
  });

  describe('pure helpers', () => {
    it('isTaskEditable true en Draft siempre', () => {
      expect(isTaskEditable({ lifecycle: TaskLifecycle.Draft, dueAt: null })).toBeTrue();
    });

    it('isTaskEditable false en Closed', () => {
      expect(isTaskEditable({ lifecycle: TaskLifecycle.Closed, dueAt: null })).toBeFalse();
    });

    it('isTaskEditable true en Published si dueAt es futuro', () => {
      const future = new Date(Date.now() + 86_400_000);
      expect(isTaskEditable({ lifecycle: TaskLifecycle.Published, dueAt: future })).toBeTrue();
    });

    it('isTaskEditable false en Published si dueAt es pasado', () => {
      const past = new Date(Date.now() - 86_400_000);
      expect(isTaskEditable({ lifecycle: TaskLifecycle.Published, dueAt: past })).toBeFalse();
    });

    it('isTaskTerminal true solo para Closed', () => {
      expect(isTaskTerminal(TaskLifecycle.Closed)).toBeTrue();
      expect(isTaskTerminal(TaskLifecycle.Draft)).toBeFalse();
      expect(isTaskTerminal(TaskLifecycle.Published)).toBeFalse();
    });

    it('ALL_TASK_LIFECYCLES tiene el orden display correcto', () => {
      expect(ALL_TASK_LIFECYCLES).toEqual([
        TaskLifecycle.Draft,
        TaskLifecycle.Published,
        TaskLifecycle.Closed,
      ]);
    });
  });
});
