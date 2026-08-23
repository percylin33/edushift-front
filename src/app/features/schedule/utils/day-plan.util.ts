import { SuggestedPeriodItem } from '@features/academic/models';

export interface DayPlanHardInterval {
  startTime: string;
  endTime: string;
  label: string;
  kind: 'recess' | 'lunch' | 'other';
}

export type DayPlanPreviewItem =
  | { kind: 'period'; ordinal: number; startTime: string; endTime: string; label: string }
  | { kind: 'hard'; startTime: string; endTime: string; label: string };

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map((p) => Number(p));
  return (h || 0) * 60 + (m || 0);
}

function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Live preview for the jornada wizard (mirrors BE DayPlanCalculator). */
export function computeDayPlanPreview(
  dayStart: string,
  dayEnd: string,
  periodMinutes: number,
  hard: DayPlanHardInterval[],
): DayPlanPreviewItem[] {
  if (!dayStart || !dayEnd || periodMinutes < 15) return [];
  const startMin = toMinutes(dayStart);
  const endMin = toMinutes(dayEnd);
  if (endMin <= startMin) return [];

  const hardSorted = [...hard]
    .map((h) => ({
      ...h,
      s: toMinutes(h.startTime.length === 5 ? `${h.startTime}:00` : h.startTime),
      e: toMinutes(h.endTime.length === 5 ? `${h.endTime}:00` : h.endTime),
    }))
    .filter((h) => h.e > h.s)
    .sort((a, b) => a.s - b.s);

  const items: DayPlanPreviewItem[] = [];
  let cursor = startMin;
  let ordinal = 1;

  while (cursor + periodMinutes <= endMin) {
    const sliceEnd = cursor + periodMinutes;
    const blocking = hardSorted.find((h) => overlaps(cursor, sliceEnd, h.s, h.e));
    if (blocking) {
      cursor = blocking.e;
      continue;
    }
    items.push({
      kind: 'period',
      ordinal,
      startTime: fromMinutes(cursor),
      endTime: fromMinutes(sliceEnd),
      label: `Periodo ${ordinal}`,
    });
    ordinal++;
    cursor = sliceEnd;
  }

  for (const h of hardSorted) {
    items.push({
      kind: 'hard',
      startTime: fromMinutes(h.s),
      endTime: fromMinutes(h.e),
      label: h.label,
    });
  }

  return items.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
}

export function computeSuggestedPeriods(
  dayStart: string,
  dayEnd: string,
  periodMinutes: number,
  hard: { startTime: string; endTime: string }[],
): SuggestedPeriodItem[] {
  return computeDayPlanPreview(
    dayStart,
    dayEnd,
    periodMinutes,
    hard.map((h) => ({ ...h, label: '', kind: 'other' as const })),
  )
    .filter((i): i is Extract<DayPlanPreviewItem, { kind: 'period' }> => i.kind === 'period')
    .map((p) => ({
      ordinal: p.ordinal,
      startTime: p.startTime.length === 5 ? `${p.startTime}:00` : p.startTime,
      endTime: p.endTime.length === 5 ? `${p.endTime}:00` : p.endTime,
      label: p.label,
    }));
}

export function defaultsForLevel(levelCode: string): {
  dayStart: string;
  dayEnd: string;
  periodMinutes: number;
  recessStart: string;
  recessEnd: string;
  /** Suggested second recess (afternoon). Null = off by default. */
  recess2Start: string | null;
  recess2End: string | null;
  lunchStart: string;
  lunchEnd: string;
} {
  const code = (levelCode || '').toUpperCase();
  if (code === 'INICIAL') {
    return {
      dayStart: '08:00',
      dayEnd: '13:00',
      periodMinutes: 45,
      recessStart: '10:00',
      recessEnd: '10:30',
      recess2Start: null,
      recess2End: null,
      lunchStart: '12:00',
      lunchEnd: '12:45',
    };
  }
  if (code === 'SECUNDARIA') {
    return {
      dayStart: '07:30',
      dayEnd: '15:30',
      periodMinutes: 45,
      recessStart: '10:45',
      recessEnd: '11:00',
      recess2Start: '14:00',
      recess2End: '14:15',
      lunchStart: '13:00',
      lunchEnd: '13:45',
    };
  }
  return {
    dayStart: '08:00',
    dayEnd: '13:15',
    periodMinutes: 45,
    recessStart: '10:15',
    recessEnd: '10:35',
    recess2Start: null,
    recess2End: null,
    lunchStart: '12:30',
    lunchEnd: '13:15',
  };
}
