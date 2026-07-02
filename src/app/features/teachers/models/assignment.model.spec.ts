import { PeriodType } from '@features/academic/models';
import {
  AssignmentRow,
  AssignmentDetail,
  SectionTeacherItem,
  CreateAssignmentRequest,
  AssignmentListFilters,
  SectionTeachersFilters,
} from './assignment.model';

describe('AssignmentModel', () => {
  describe('AssignmentRow', () => {
    it('shape mínimo', () => {
      const r: AssignmentRow = {
        publicUuid: 'a-1',
        teacherPublicUuid: 't-1',
        teacherFullName: 'Maria',
        sectionPublicUuid: 'sec-1',
        sectionName: 'A',
        coursePublicUuid: 'c-1',
        courseCode: 'MATH',
        courseName: 'Algebra',
        academicPeriodPublicUuid: 'p-1',
        periodType: PeriodType.Quarter,
        periodOrdinal: 1,
        active: true,
      };
      expect(r.assignedAt).toBeUndefined();
    });

    it('incluye timestamps opcionales', () => {
      const r: AssignmentRow = {
        publicUuid: 'a-1',
        teacherPublicUuid: 't-1',
        teacherFullName: 'Maria',
        sectionPublicUuid: 'sec-1',
        sectionName: 'A',
        coursePublicUuid: 'c-1',
        courseCode: 'MATH',
        courseName: 'Algebra',
        academicPeriodPublicUuid: 'p-1',
        periodType: PeriodType.Quarter,
        periodOrdinal: 1,
        assignedAt: new Date('2026-01-01'),
        unassignedAt: new Date('2026-06-30'),
        active: false,
      };
      expect(r.unassignedAt).toBeInstanceOf(Date);
    });
  });

  describe('AssignmentDetail', () => {
    it('extiende row con notes y academicYear', () => {
      const d: AssignmentDetail = {
        publicUuid: 'a-1',
        teacherPublicUuid: 't-1',
        teacherFullName: 'Maria',
        sectionPublicUuid: 'sec-1',
        sectionName: 'A',
        coursePublicUuid: 'c-1',
        courseCode: 'M',
        courseName: 'M',
        academicPeriodPublicUuid: 'p-1',
        periodType: PeriodType.Quarter,
        periodOrdinal: 1,
        active: true,
        periodName: 'Q1',
        academicYearPublicUuid: 'y-1',
        academicYearName: '2026',
        notes: 'cambio',
      };
      expect(d.periodName).toBe('Q1');
    });
  });

  describe('SectionTeacherItem', () => {
    it('shape reverse-view', () => {
      const item: SectionTeacherItem = {
        assignmentPublicUuid: 'a-1',
        teacherPublicUuid: 't-1',
        teacherFullName: 'Maria',
        coursePublicUuid: 'c-1',
        courseCode: 'M',
        courseName: 'M',
        academicPeriodPublicUuid: 'p-1',
        periodType: PeriodType.Quarter,
        periodOrdinal: 1,
      };
      expect(item.teacherEmail).toBeUndefined();
    });
  });

  describe('CreateAssignmentRequest', () => {
    it('requiere tres UUIDs', () => {
      const req: CreateAssignmentRequest = {
        sectionPublicUuid: 'sec-1',
        coursePublicUuid: 'c-1',
        academicPeriodPublicUuid: 'p-1',
        notes: 'opcional',
      };
      expect(req.notes).toBe('opcional');
    });
  });

  describe('AssignmentListFilters', () => {
    it('todos opcionales', () => {
      const f1: AssignmentListFilters = {};
      const f2: AssignmentListFilters = { active: false };
      expect(f1.active).toBeUndefined();
      expect(f2.active).toBeFalse();
    });
  });

  describe('SectionTeachersFilters', () => {
    it('acepta periodId', () => {
      const f: SectionTeachersFilters = { periodId: 'p-1' };
      expect(f.periodId).toBe('p-1');
    });
  });
});
