import { DocumentType, EmploymentStatus, Gender } from '@core/enums';
import {
  TeacherRow,
  TeacherDetail,
  TeacherInvitationResult,
  CreateTeacherRequest,
  UpdateTeacherRequest,
  TeacherListFilters,
  SPECIALIZATION_CATALOG,
  EMPLOYMENT_STATUS_LABELS,
  computeTeacherFullName,
} from './teacher.model';

describe('TeacherModel', () => {
  describe('TeacherRow', () => {
    it('shape mínimo', () => {
      const r: TeacherRow = {
        publicUuid: 't-1',
        documentType: DocumentType.Dni,
        documentNumber: '1',
        firstName: 'A',
        lastName: 'B',
        fullName: 'A B',
        specializations: [],
        employmentStatus: EmploymentStatus.Active,
        hasUserAccount: false,
      };
      expect(r.specializations).toEqual([]);
    });
  });

  describe('TeacherDetail', () => {
    it('extiende row con birthDate y demás', () => {
      const d: TeacherDetail = {
        publicUuid: 't-1',
        documentType: DocumentType.Dni,
        documentNumber: '1',
        firstName: 'A',
        lastName: 'B',
        fullName: 'A B',
        specializations: [],
        employmentStatus: EmploymentStatus.Active,
        hasUserAccount: false,
        birthDate: new Date('1990-01-01'),
        gender: Gender.Male,
      };
      expect(d.birthDate).toBeInstanceOf(Date);
    });
  });

  describe('TeacherInvitationResult', () => {
    it('acepta token y expiración', () => {
      const inv: TeacherInvitationResult = {
        invitationPublicUuid: 'inv-1',
        invitationToken: 'tok',
        expiresAt: new Date('2026-12-31'),
        teacherPublicUuid: 't-1',
        email: 't@s.com',
      };
      expect(inv.invitationToken).toBe('tok');
    });
  });

  describe('CreateTeacherRequest', () => {
    it('requiere doc + nombres', () => {
      const req: CreateTeacherRequest = {
        documentType: DocumentType.Dni,
        documentNumber: '1',
        firstName: 'A',
        lastName: 'B',
      };
      expect(req.specializations).toBeUndefined();
    });
  });

  describe('UpdateTeacherRequest', () => {
    it('acepta patch parcial', () => {
      const u: UpdateTeacherRequest = { title: 'Mg.' };
      expect(u.documentType).toBeUndefined();
    });
  });

  describe('TeacherListFilters', () => {
    it('todos opcionales', () => {
      const f: TeacherListFilters = { search: 'X', hasUserAccount: true };
      expect(f.employmentStatus).toBeUndefined();
    });
  });

  describe('computeTeacherFullName', () => {
    it('combina first + last', () => {
      expect(computeTeacherFullName('Maria', 'Gomez')).toBe('Maria Gomez');
    });
    it('incluye secondLastName cuando viene', () => {
      expect(computeTeacherFullName('Maria', 'Gomez', 'Perez')).toBe('Maria Gomez Perez');
    });
    it('ignora secondLastName vacío', () => {
      expect(computeTeacherFullName('Maria', 'Gomez', ' ')).toBe('Maria Gomez');
    });
    it('normaliza dobles espacios', () => {
      expect(computeTeacherFullName('Maria ', ' Gomez')).toBe('Maria Gomez');
    });
    it('maneja null', () => {
      expect(computeTeacherFullName('Maria', 'Gomez', null as any)).toBe('Maria Gomez');
    });
  });

  describe('SPECIALIZATION_CATALOG', () => {
    it('incluye sugerencias comunes', () => {
      expect(SPECIALIZATION_CATALOG).toContain('Matemática');
      expect(SPECIALIZATION_CATALOG).toContain('Comunicación');
    });
  });

  describe('EMPLOYMENT_STATUS_LABELS', () => {
    it('etiquetas en español para cada status', () => {
      expect(EMPLOYMENT_STATUS_LABELS[EmploymentStatus.Active]).toBe('Activo');
      expect(EMPLOYMENT_STATUS_LABELS[EmploymentStatus.OnLeave]).toBe('En licencia');
      expect(EMPLOYMENT_STATUS_LABELS[EmploymentStatus.Resigned]).toBe('Renunció');
      expect(EMPLOYMENT_STATUS_LABELS[EmploymentStatus.Retired]).toBe('Jubilado');
      expect(EMPLOYMENT_STATUS_LABELS[EmploymentStatus.Suspended]).toBe('Suspendido');
    });
  });
});
