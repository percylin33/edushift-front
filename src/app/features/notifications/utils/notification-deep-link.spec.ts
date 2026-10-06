import { notificationDeepLink, notificationDisplaySubject } from './notification-deep-link';
import { NotificationItem } from '../models';

describe('notificationDeepLink', () => {
  function item(partial: Partial<NotificationItem>): NotificationItem {
    return {
      id: 'n-1',
      publicUuid: 'n-1',
      templateKey: 'QUIZ_PUBLISHED',
      category: 'QUIZ',
      channel: 'IN_APP',
      status: 'SENT',
      subject: 'QUIZ_PUBLISHED · null',
      bodyHtml: '',
      sentAt: '',
      payload: {},
      ...partial,
    } as NotificationItem;
  }

  it('routes QUIZ to take when quizPublicUuid is present', () => {
    expect(
      notificationDeepLink(
        item({
          payload: { quizPublicUuid: 'q-1', quizTitle: 'Fracciones' },
        }),
      ),
    ).toBe('/lms/quizzes/q-1/take');
  });

  it('falls back QUIZ to /lms without quiz uuid', () => {
    expect(notificationDeepLink(item({ payload: { quizTitle: 'X' } }))).toBe('/lms');
  });

  it('routes TASK_RETURNED to assignment submit', () => {
    expect(
      notificationDeepLink(
        item({
          templateKey: 'TASK_RETURNED',
          category: 'TASK',
          payload: { taskPublicUuid: 't-1', taskTitle: 'Tarea' },
        }),
      ),
    ).toBe('/lms/assignments/t-1/submit');
  });

  it('routes GRADE to /me/grades', () => {
    expect(
      notificationDeepLink(
        item({
          templateKey: 'GRADE_PUBLISHED',
          category: 'GRADE',
          payload: { evaluationPublicUuid: 'e-1' },
        }),
      ),
    ).toBe('/me/grades');
  });
});

describe('notificationDisplaySubject', () => {
  it('rebuilds Spanish title from raw templateKey · null subject', () => {
    const n = {
      templateKey: 'QUIZ_PUBLISHED',
      subject: 'QUIZ_PUBLISHED · null',
      payload: { quizTitle: 'PRACTICA 2', courseName: 'Curso A' },
    } as NotificationItem;
    expect(notificationDisplaySubject(n)).toBe('Nueva práctica disponible — PRACTICA 2');
  });

  it('keeps a proper BE-rendered Spanish subject', () => {
    const n = {
      templateKey: 'GRADE_PUBLISHED',
      subject: 'Nueva calificación publicada — Examen 1',
      payload: { evaluationTitle: 'Examen 1' },
    } as NotificationItem;
    expect(notificationDisplaySubject(n)).toBe('Nueva calificación publicada — Examen 1');
  });
});
