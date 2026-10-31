import { PeriodType } from '../models';
import { SectionTeacherItem } from '@features/teachers/models';
import { ScheduleSlotItem } from '../models';
import {
  dedupeYearScheduleSlots,
  findSiblingYearSlots,
  groupSectionTeachersAsYearOptions,
  normalizeScheduleTime,
} from './schedule-assignment.util';

function teacher(
  overrides: Partial<SectionTeacherItem> &
    Pick<SectionTeacherItem, 'assignmentPublicUuid' | 'periodOrdinal'>,
): SectionTeacherItem {
  return {
    teacherPublicUuid: 't-1',
    teacherFullName: 'Ana Pérez',
    coursePublicUuid: 'c-1',
    courseCode: 'MAT',
    courseName: 'Matemática',
    academicPeriodPublicUuid: `p-${overrides.periodOrdinal}`,
    periodType: PeriodType.Bimestre,
    ...overrides,
  };
}

function slot(
  overrides: Partial<ScheduleSlotItem> &
    Pick<ScheduleSlotItem, 'slotPublicUuid' | 'assignmentPublicUuid'>,
): ScheduleSlotItem {
  return {
    dayOfWeek: 1,
    startTime: '08:00:00',
    endTime: '08:45:00',
    course: { publicUuid: 'c-1', code: 'MAT', name: 'Matemática' },
    teacher: { publicUuid: 't-1', firstName: 'Ana', lastName: 'Pérez' },
    period: {
      publicUuid: 'p-1',
      periodType: 'BIMESTRE',
      ordinal: 1,
      name: 'Bimestre 1',
    },
    ...overrides,
  };
}

describe('schedule-assignment.util', () => {
  describe('normalizeScheduleTime', () => {
    it('collapses HH:mm:ss to HH:mm', () => {
      expect(normalizeScheduleTime('08:00:00')).toBe('08:00');
      expect(normalizeScheduleTime('8:5')).toBe('08:05');
    });
  });

  describe('groupSectionTeachersAsYearOptions', () => {
    it('collapses same teacher×course across bimestres', () => {
      const options = groupSectionTeachersAsYearOptions([
        teacher({ assignmentPublicUuid: 'a-2', periodOrdinal: 2 }),
        teacher({ assignmentPublicUuid: 'a-1', periodOrdinal: 1 }),
        teacher({ assignmentPublicUuid: 'a-3', periodOrdinal: 3 }),
        teacher({
          assignmentPublicUuid: 'a-other',
          periodOrdinal: 1,
          coursePublicUuid: 'c-2',
          courseCode: 'COM',
          courseName: 'Comunicación',
        }),
      ]);

      expect(options).toHaveSize(2);
      const mat = options.find((o) => o.coursePublicUuid === 'c-1')!;
      expect(mat.publicUuid).toBe('a-1');
      expect(mat.relatedAssignmentPublicUuids).toEqual(['a-2', 'a-1', 'a-3']);
      expect(mat.label).toContain('Matemática');
    });
  });

  describe('dedupeYearScheduleSlots', () => {
    it('keeps one card per course×teacher×day×window', () => {
      const result = dedupeYearScheduleSlots([
        slot({
          slotPublicUuid: 's-2',
          assignmentPublicUuid: 'a-2',
          period: {
            publicUuid: 'p-2',
            periodType: 'BIMESTRE',
            ordinal: 2,
            name: 'Bimestre 2',
          },
        }),
        slot({
          slotPublicUuid: 's-1',
          assignmentPublicUuid: 'a-1',
          period: {
            publicUuid: 'p-1',
            periodType: 'BIMESTRE',
            ordinal: 1,
            name: 'Bimestre 1',
          },
        }),
      ]);

      expect(result).toHaveSize(1);
      expect(result[0].slotPublicUuid).toBe('s-1');
    });
  });

  describe('findSiblingYearSlots', () => {
    it('finds replicas across periods', () => {
      const pivot = slot({ slotPublicUuid: 's-1', assignmentPublicUuid: 'a-1' });
      const siblings = findSiblingYearSlots(
        [
          pivot,
          slot({
            slotPublicUuid: 's-2',
            assignmentPublicUuid: 'a-2',
            startTime: '08:00',
            period: {
              publicUuid: 'p-2',
              periodType: 'BIMESTRE',
              ordinal: 2,
              name: 'Bimestre 2',
            },
          }),
          slot({
            slotPublicUuid: 's-other',
            assignmentPublicUuid: 'a-x',
            dayOfWeek: 2,
          }),
        ],
        pivot,
      );

      expect(siblings.map((s) => s.slotPublicUuid).sort()).toEqual(['s-1', 's-2']);
    });
  });
});
