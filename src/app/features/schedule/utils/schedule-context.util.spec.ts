import {
  AcademicPeriodRow,
  AcademicYearRow,
  AcademicYearStatus,
  PeriodType,
} from '@features/academic/models';
import { selectSchedulePeriod, selectScheduleYear } from './schedule-context.util';

function period(publicUuid: string, startDate: string, endDate: string): AcademicPeriodRow {
  return {
    publicUuid,
    academicYearPublicUuid: 'year-1',
    periodType: PeriodType.Bimestre,
    ordinal: 1,
    name: publicUuid,
    startDate: new Date(`${startDate}T00:00:00`),
    endDate: new Date(`${endDate}T00:00:00`),
  };
}

function year(publicUuid: string, status: AcademicYearStatus): AcademicYearRow {
  return {
    publicUuid,
    name: publicUuid,
    status,
    startDate: new Date('2026-01-01T00:00:00'),
    endDate: new Date('2026-12-31T00:00:00'),
  };
}

describe('schedule context defaults', () => {
  it('keeps a valid requested year, otherwise uses only the active year', () => {
    const years = [
      year('closed-year', AcademicYearStatus.Closed),
      year('active-year', AcademicYearStatus.Active),
    ];

    expect(selectScheduleYear(years, 'closed-year')?.publicUuid).toBe('closed-year');
    expect(selectScheduleYear(years)?.publicUuid).toBe('active-year');
    expect(selectScheduleYear([years[0]])).toBeNull();
  });

  it('selects a period that includes today, including its end date', () => {
    const periods = [
      period('future', '2026-10-24', '2026-11-10'),
      period('current', '2026-10-01', '2026-10-22'),
    ];

    expect(selectSchedulePeriod(periods, null, new Date(2026, 9, 22))).toEqual({
      period: periods[1],
      state: 'current',
    });
  });

  it('uses the nearest upcoming period when no period is current', () => {
    const periods = [
      period('later', '2026-11-01', '2026-11-30'),
      period('soon', '2026-10-24', '2026-10-31'),
    ];

    expect(selectSchedulePeriod(periods, null, new Date(2026, 9, 22))).toEqual({
      period: periods[1],
      state: 'upcoming',
    });
  });

  it('does not silently select a past period, and preserves a requested period', () => {
    const periods = [period('past', '2026-01-01', '2026-02-01')];

    expect(selectSchedulePeriod(periods, null, new Date(2026, 9, 22))).toEqual({
      period: null,
      state: 'none',
    });
    expect(selectSchedulePeriod(periods, 'past', new Date(2026, 9, 22))).toEqual({
      period: periods[0],
      state: 'requested',
    });
  });
});
