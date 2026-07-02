import { DocumentType, EnrollmentStatus, Gender } from '@core/enums';
import {
  StudentRow,
  StudentDetail,
  CreateStudentRequest,
  UpdateStudentRequest,
  StudentListFilters,
} from './student.model';

describe('StudentModel', () => {
  describe('StudentRow', () => {
    it('acepta shape mínimo', () => {
      const row: StudentRow = {
        publicUuid: 's-1',
        documentType: DocumentType.Dni,
        documentNumber: '12345678',
        firstName: 'Juan',
        lastName: 'Perez',
        fullName: 'Juan Perez',
        enrollmentStatus: EnrollmentStatus.Enrolled,
      };
      expect(row.fullName).toBe('Juan Perez');
    });

    it('campos opcionales pueden ser undefined', () => {
      const row: StudentRow = {
        publicUuid: 's-1',
        documentType: DocumentType.Ce,
        documentNumber: 'X-1',
        firstName: 'A',
        lastName: 'B',
        fullName: 'A B',
        enrollmentStatus: EnrollmentStatus.Pending,
      };
      expect(row.email).toBeUndefined();
      expect(row.enrollmentDate).toBeUndefined();
    });
  });

  describe('StudentDetail', () => {
    it('extiende StudentRow con campos extra', () => {
      const detail: StudentDetail = {
        publicUuid: 's-1',
        documentType: DocumentType.Dni,
        documentNumber: '12345678',
        firstName: 'Juan',
        lastName: 'Perez',
        fullName: 'Juan Perez',
        enrollmentStatus: EnrollmentStatus.Enrolled,
        birthDate: new Date('2010-05-15'),
        gender: Gender.Male,
      };
      expect(detail.birthDate).toBeInstanceOf(Date);
    });
  });

  describe('CreateStudentRequest', () => {
    it('requiere documentType, documentNumber, firstName, lastName', () => {
      const req: CreateStudentRequest = {
        documentType: DocumentType.Dni,
        documentNumber: '12345678',
        firstName: 'Juan',
        lastName: 'Perez',
      };
      expect(req.documentNumber).toBe('12345678');
    });
  });

  describe('UpdateStudentRequest', () => {
    it('acepta patch parcial', () => {
      const patch: UpdateStudentRequest = { firstName: 'Juan Pablo' };
      expect(patch.documentType).toBeUndefined();
      expect(patch.firstName).toBe('Juan Pablo');
    });
  });

  describe('StudentListFilters', () => {
    it('todos los campos opcionales', () => {
      const f1: StudentListFilters = {};
      const f2: StudentListFilters = {
        search: 'Juan',
        enrollmentStatus: EnrollmentStatus.Enrolled,
      };
      expect(Object.keys(f1)).toHaveSize(0);
      expect(f2.search).toBe('Juan');
    });
  });
});
