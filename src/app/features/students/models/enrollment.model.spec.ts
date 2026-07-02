import { StudentEnrollmentStatus } from '@core/enums';
import {
  EnrollmentRow,
  EnrollmentDetail,
  SectionStudentRosterItem,
  CreateEnrollmentRequest,
  WithdrawEnrollmentRequest,
} from './enrollment.model';

describe('EnrollmentModel', () => {
  describe('EnrollmentRow', () => {
    it('acepta shape mínimo', () => {
      const row: EnrollmentRow = {
        publicUuid: 'e-1',
        studentPublicUuid: 's-1',
        studentFullName: 'Juan',
        sectionPublicUuid: 'sec-1',
        sectionName: 'A',
        academicYearPublicUuid: 'y-1',
        academicYearName: '2026',
        status: StudentEnrollmentStatus.Active,
        active: true,
      };
      expect(row.enrolledAt).toBeUndefined();
      expect(row.withdrawnAt).toBeUndefined();
    });

    it('incluye timestamps como Date opcional', () => {
      const row: EnrollmentRow = {
        publicUuid: 'e-1',
        studentPublicUuid: 's-1',
        studentFullName: 'Juan',
        sectionPublicUuid: 'sec-1',
        sectionName: 'A',
        academicYearPublicUuid: 'y-1',
        academicYearName: '2026',
        enrolledAt: new Date('2026-01-01'),
        withdrawnAt: new Date('2026-06-30'),
        status: StudentEnrollmentStatus.Withdrawn,
        active: false,
      };
      expect(row.enrolledAt).toBeInstanceOf(Date);
      expect(row.active).toBeFalse();
    });
  });

  describe('EnrollmentDetail', () => {
    it('extiende EnrollmentRow con notas y audit', () => {
      const detail: EnrollmentDetail = {
        publicUuid: 'e-1',
        studentPublicUuid: 's-1',
        studentFullName: 'Juan',
        sectionPublicUuid: 'sec-1',
        sectionName: 'A',
        academicYearPublicUuid: 'y-1',
        academicYearName: '2026',
        status: StudentEnrollmentStatus.Active,
        active: true,
        studentDocumentNumber: '12345678',
        notes: 'cambio de domicilio',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-02-01'),
      };
      expect(detail.studentDocumentNumber).toBe('12345678');
      expect(detail.notes).toContain('cambio');
    });
  });

  describe('SectionStudentRosterItem', () => {
    it('shape lean del roster por sección', () => {
      const item: SectionStudentRosterItem = {
        enrollmentPublicUuid: 'e-1',
        studentPublicUuid: 's-1',
        studentFullName: 'Juan',
        studentDocumentNumber: '12345678',
        studentDocumentType: 'DNI',
      };
      expect(item.studentDocumentType).toBe('DNI');
    });
  });

  describe('CreateEnrollmentRequest', () => {
    it('requiere section, year y fecha', () => {
      const req: CreateEnrollmentRequest = {
        sectionPublicUuid: 'sec-1',
        academicYearPublicUuid: 'y-1',
        enrolledAt: '2026-01-15',
        notes: 'nuevo ingreso',
      };
      expect(req.enrolledAt).toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('WithdrawEnrollmentRequest', () => {
    it('status debe ser terminal y fecha válida', () => {
      const req: WithdrawEnrollmentRequest = {
        status: StudentEnrollmentStatus.Withdrawn,
        withdrawnAt: '2026-06-15',
      };
      expect(req.status).not.toBe(StudentEnrollmentStatus.Active);
    });
  });
});
