import { AcademicYearRow, AcademicYearStatus } from '@features/academic/models';

export interface SchedulePeriodRange {
  publicUuid: string;
  startDate: Date;
  endDate: Date;
}

export type SchedulePeriodSelectionState = 'requested' | 'current' | 'upcoming' | 'none';

export interface SchedulePeriodSelection<T extends SchedulePeriodRange> {
  period: T | null;
  state: SchedulePeriodSelectionState;
}

export function schedulePeriodLabel(state: SchedulePeriodSelectionState): string {
  if (state === 'current') return ' · Vigente';
  if (state === 'upcoming') return ' · Próximo';
  return '';
}

/** Keeps a valid URL selection; otherwise defaults to the tenant's active year. */
export function selectScheduleYear(
  years: readonly AcademicYearRow[],
  preferredYearUuid?: string | null,
): AcademicYearRow | null {
  return (
    years.find((year) => year.publicUuid === preferredYearUuid) ??
    years.find((year) => year.status === AcademicYearStatus.Active) ??
    null
  );
}

/** Defaults to the period containing today, then the nearest future period. */
export function selectSchedulePeriod<T extends SchedulePeriodRange>(
  periods: readonly T[],
  preferredPeriodUuid?: string | null,
  today = new Date(),
): SchedulePeriodSelection<T> {
  const preferred = periods.find((period) => period.publicUuid === preferredPeriodUuid);
  if (preferred) return { period: preferred, state: 'requested' };

  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const current = periods
    .filter(
      (period) =>
        period.startDate.getTime() <= todayStart && period.endDate.getTime() >= todayStart,
    )
    .sort(
      (left, right) =>
        left.endDate.getTime() - right.endDate.getTime() ||
        right.startDate.getTime() - left.startDate.getTime(),
    )[0];
  if (current) return { period: current, state: 'current' };

  const upcoming = periods
    .filter((period) => period.startDate.getTime() > todayStart)
    .sort(
      (left, right) =>
        left.startDate.getTime() - right.startDate.getTime() ||
        left.endDate.getTime() - right.endDate.getTime(),
    )[0];
  if (upcoming) return { period: upcoming, state: 'upcoming' };

  return { period: null, state: 'none' };
}
