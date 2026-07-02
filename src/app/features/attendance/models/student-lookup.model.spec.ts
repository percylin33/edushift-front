import {
  AttendanceStudentLookupItem,
  AttendanceStudentLookupPage,
  StudentLookupFilters,
} from './student-lookup.model';

describe('StudentLookupModel', () => {
  describe('AttendanceStudentLookupItem', () => {
    it('shape lean sin PII', () => {
      const item: AttendanceStudentLookupItem = {
        studentPublicUuid: 'stu-1',
        firstName: 'Juan',
        lastName: 'Perez',
        fullName: 'Juan Perez',
        documentNumber: '12345678',
        sectionPublicUuid: 'sec-1',
        sectionName: 'A',
        gradeName: '1°',
        levelName: 'Primaria',
      };
      expect((item as any).email).toBeUndefined();
    });
  });

  describe('StudentLookupFilters', () => {
    it('todos opcionales', () => {
      const f: StudentLookupFilters = { q: 'juan', gradePublicUuid: 'g-1' };
      expect(f.levelPublicUuid).toBeUndefined();
    });
  });

  describe('AttendanceStudentLookupPage', () => {
    it('envelope Spring Data', () => {
      const page: AttendanceStudentLookupPage = {
        content: [],
        totalElements: 0,
        totalPages: 0,
        number: 0,
        size: 20,
        first: true,
        last: true,
        empty: true,
      };
      expect(page.empty).toBeTrue();
    });
  });
});
