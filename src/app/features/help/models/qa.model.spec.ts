import { CapabilityStatus, RoleKey, CapabilityGroup, BugReportSeverity, BugReportStatus, StepStatus } from './qa.model';

describe('qa.model', () => {
  describe('CapabilityStatus', () => {
    it('has 4 values', () => {
      const values: CapabilityStatus[] = ['live', 'partial', 'planned', 'broken'];
      expect(values).toHaveSize(4);
    });
  });

  describe('RoleKey', () => {
    it('has 6 role keys', () => {
      const values: RoleKey[] = ['super-admin', 'tenant-admin', 'teacher', 'student', 'parent', 'staff'];
      expect(values).toHaveSize(6);
    });
  });

  describe('CapabilityGroup', () => {
    it('groups by module', () => {
      const values: CapabilityGroup[] = ['auth', 'academic', 'attendance', 'evaluations', 'lms', 'finance', 'system'];
      expect(values).toHaveSize(7);
    });
  });

  describe('Severity', () => {
    it('has BLOCKER/MAJOR/MINOR/COSMETIC', () => {
      const values: BugReportSeverity[] = ['BLOCKER', 'MAJOR', 'MINOR', 'COSMETIC'];
      expect(values).toHaveSize(4);
    });
  });

  describe('BugReportStatus', () => {
    it('has 3 lifecycle states', () => {
      const values: BugReportStatus[] = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'];
      expect(values).toHaveSize(3);
    });
  });

  describe('StepStatus', () => {
    it('has 6 states', () => {
      const values: StepStatus[] = ['idle', 'running', 'passed', 'failed', 'broken', 'skipped'];
      expect(values).toHaveSize(6);
    });
  });
});
