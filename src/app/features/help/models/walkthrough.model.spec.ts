import { WALKTHROUGH_FILES, WALKTHROUGH_PROGRESS_STORAGE_KEY } from './walkthrough.model';

describe('walkthrough.model', () => {
  describe('WALKTHROUGH_FILES', () => {
    it('has a roadmap for every role', () => {
      expect(WALKTHROUGH_FILES).toHaveSize(6);
      const roles = WALKTHROUGH_FILES.map(f => f.roleKey);
      expect(roles).toContain('super-admin');
      expect(roles).toContain('tenant-admin');
      expect(roles).toContain('teacher');
      expect(roles).toContain('student');
      expect(roles).toContain('parent');
      expect(roles).toContain('staff');
    });

    it('slug mirrors roleKey', () => {
      for (const f of WALKTHROUGH_FILES) {
        expect(f.slug).toBe(f.roleKey);
      }
    });
  });

  describe('WALKTHROUGH_PROGRESS_STORAGE_KEY', () => {
    it('is namespaced to edushift.qa', () => {
      expect(WALKTHROUGH_PROGRESS_STORAGE_KEY).toContain('edushift.qa');
    });
  });
});
