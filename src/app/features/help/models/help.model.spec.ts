import { ManualIndexEntry, ManualChapter, MANUAL_ROLES, MANUAL_CHAPTER_FILES, HelpProgressItem, HelpFeedback, CreateFeedbackRequest } from './help.model';

describe('HelpModel', () => {
  describe('MANUAL_ROLES', () => {
    it('includes the six canonical roles in display order', () => {
      expect(MANUAL_ROLES).toEqual([
        'SUPER_ADMIN', 'TENANT_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF',
      ]);
    });
  });

  describe('MANUAL_CHAPTER_FILES', () => {
    it('includes README + 3 chapters', () => {
      expect(MANUAL_CHAPTER_FILES).toHaveSize(4);
      expect(MANUAL_CHAPTER_FILES[0]).toBe('README.md');
    });
  });

  describe('ManualIndexEntry', () => {
    it('accepts a live status', () => {
      const e: ManualIndexEntry = {
        role: 'TENANT_ADMIN',
        title: 'Manual del admin',
        summary: 'Resumen',
        url: '/manuales/tenant-admin/README.md',
        updatedAt: '2026-08-10',
        status: 'live',
      };
      expect(e.status).toBe('live');
    });

    it('accepts a partial status', () => {
      const e: ManualIndexEntry = {
        role: 'STUDENT',
        title: 'Manual del estudiante',
        summary: 'Resumen',
        url: '/manuales/student/README.md',
        updatedAt: '2026-08-10',
        status: 'partial',
      };
      expect(e.status).toBe('partial');
    });
  });

  describe('ManualChapter', () => {
    it('round-trips a chapter', () => {
      const c: ManualChapter = {
        role: 'TEACHER',
        path: 'teacher/01-onboarding-y-acceso.md',
        title: 'Acceso',
        content: '# Hola',
        updatedAt: '2026-08-10',
      };
      expect(c.content).toContain('# Hola');
    });
  });

  describe('HelpProgressItem', () => {
    it('round-trips a checked item', () => {
      const i: HelpProgressItem = { itemId: 'a', checked: true, updatedAt: '2026-08-10' };
      expect(i.checked).toBeTrue();
    });
  });

  describe('HelpFeedback', () => {
    it('has three status options', () => {
      const values: Array<HelpFeedback['status']> = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'];
      expect(values).toHaveSize(3);
    });
  });

  describe('CreateFeedbackRequest', () => {
    it('requires role and body', () => {
      const r: CreateFeedbackRequest = { role: 'TEACHER', chapterFile: null, body: 'Excelente' };
      expect(r.body).toBe('Excelente');
    });
  });
});
