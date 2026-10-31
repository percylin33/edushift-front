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

export interface SmartDayPlanConfig {
  dayStart: string;
  dayEnd: string;
  periodMinutes: number;
  /** Durations for each recess, in order (morning → afternoon). */
  recessMinutes: number[];
  includeLunch: boolean;
  lunchMinutes: number;
}

export interface SmartDayPlanBreakSlot {
  startTime: string;
  endTime: string;
  label: string;
}

export interface SmartDayPlanLayoutResult {
  items: DayPlanPreviewItem[];
  recesses: SmartDayPlanBreakSlot[];
  lunch: SmartDayPlanBreakSlot | null;
}

/** Class periods before inserting the next break when the day is long enough. */
const PERIODS_BETWEEN_BREAKS = 2;

export const RECESS_DURATION_OPTIONS = [15, 20, 30] as const;
export const LUNCH_DURATION_OPTIONS = [30, 45, 60] as const;
export const MAX_DAY_PLAN_RECESSES = 4;

export function addMinutesToTime(time: string, minutes: number): string {
  return fromMinutes(toMinutes(time) + minutes);
}

export function recessLabelForIndex(index: number, total: number): string {
  if (total <= 1) return 'Recreo';
  return `Recreo ${index + 1}`;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map((p) => Number(p));
  return (h || 0) * 60 + (m || 0);
}

function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function durationMinutes(start: string, end: string): number {
  return Math.max(0, toMinutes(end) - toMinutes(start));
}

/**
 * Packs the school day contiguously. Break order: first recess(es) morning,
 * optional lunch, remaining recesses afternoon. Period count before each break
 * adapts (0–2) so short days still get every requested recess.
 */
export function computeSmartDayPlanLayout(
  config: SmartDayPlanConfig,
): SmartDayPlanLayoutResult {
  const start = toMinutes(config.dayStart);
  const end = toMinutes(config.dayEnd);
  const pm = config.periodMinutes;

  if (!config.dayStart || !config.dayEnd || end <= start || pm < 15) {
    return { items: [], recesses: [], lunch: null };
  }

  type Pending = { kind: 'recess' | 'lunch'; minutes: number; label: string };
  const recessDurations = (config.recessMinutes ?? []).filter((m) => m > 0);
  const pending: Pending[] = [];
  const recessCount = recessDurations.length;

  if (recessCount > 0) {
    pending.push({
      kind: 'recess',
      minutes: recessDurations[0],
      label: recessLabelForIndex(0, recessCount),
    });
  }
  if (config.includeLunch && config.lunchMinutes > 0) {
    pending.push({ kind: 'lunch', minutes: config.lunchMinutes, label: 'Almuerzo' });
  }
  for (let i = 1; i < recessCount; i++) {
    pending.push({
      kind: 'recess',
      minutes: recessDurations[i],
      label: recessLabelForIndex(i, recessCount),
    });
  }

  const items: DayPlanPreviewItem[] = [];
  let cursor = start;
  let periodOrd = 1;
  let periodsSinceBreak = 0;
  const recesses: SmartDayPlanBreakSlot[] = [];
  let lunch: SmartDayPlanBreakSlot | null = null;
  let pendingIdx = 0;

  const canFit = (minutes: number) => cursor + minutes <= end;
  const remaining = () => end - cursor;

  const pushPeriod = (minutes: number = pm): void => {
    const used = Math.min(minutes, remaining());
    if (used < 15) return;
    items.push({
      kind: 'period',
      ordinal: periodOrd,
      startTime: fromMinutes(cursor),
      endTime: fromMinutes(cursor + used),
      label: `Periodo ${periodOrd}`,
    });
    periodOrd++;
    cursor += used;
    periodsSinceBreak++;
  };

  const pushBreak = (p: Pending): SmartDayPlanBreakSlot => {
    const slot: SmartDayPlanBreakSlot = {
      startTime: fromMinutes(cursor),
      endTime: fromMinutes(cursor + p.minutes),
      label: p.label,
    };
    items.push({
      kind: 'hard',
      startTime: slot.startTime,
      endTime: slot.endTime,
      label: slot.label,
    });
    cursor += p.minutes;
    periodsSinceBreak = 0;
    return slot;
  };

  const targetPeriodsBeforeNext = (breakMinutes: number): number => {
    const left = remaining();
    if (left < breakMinutes) return Number.POSITIVE_INFINITY;
    const rest = pending.slice(pendingIdx + 1).reduce((s, b) => s + b.minutes, 0);
    // Prefer 2 periods; drop to 1 or 0 on short remaining stretches.
    if (left >= 2 * pm + breakMinutes + rest) return PERIODS_BETWEEN_BREAKS;
    if (left >= pm + breakMinutes) return 1;
    return 0;
  };

  const tryPlaceNextBreak = (): boolean => {
    if (pendingIdx >= pending.length) return false;
    const next = pending[pendingIdx];
    if (!canFit(next.minutes)) return false;
    const target = targetPeriodsBeforeNext(next.minutes);
    if (periodsSinceBreak < target) return false;
    const slot = pushBreak(next);
    if (next.kind === 'lunch') lunch = slot;
    else recesses.push(slot);
    pendingIdx++;
    return true;
  };

  let guard = 0;
  while (guard++ < 48) {
    const roomForPeriod = canFit(pm);
    if (tryPlaceNextBreak()) continue;
    if (!roomForPeriod) {
      if (tryPlaceNextBreak()) continue;
      if (remaining() >= 15) pushPeriod(remaining());
      break;
    }
    pushPeriod();
  }

  if (cursor < end && items.length > 0) {
    const rem = end - cursor;
    const half = pm / 2;
    if (rem >= half) {
      pushPeriod(rem);
    } else if (rem > 0) {
      const lastPeriod = [...items].reverse().find((i) => i.kind === 'period');
      if (lastPeriod) lastPeriod.endTime = fromMinutes(end);
      cursor = end;
    }
  }

  return { items, recesses, lunch };
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
  const halfPeriod = periodMinutes / 2;

  const pushPeriod = (from: number, to: number): void => {
    if (to <= from) return;
    items.push({
      kind: 'period',
      ordinal,
      startTime: fromMinutes(from),
      endTime: fromMinutes(to),
      label: `Periodo ${ordinal}`,
    });
    ordinal++;
  };

  /**
   * Leftover before a hard block or salida:
   * - &lt; half period → merge into previous contiguous period
   * - ≥ half period → create a shorter period block
   */
  const consumeRemainder = (rem: number): void => {
    if (rem <= 0) return;
    if (rem < halfPeriod) {
      const lastPeriod = [...items].reverse().find((i) => i.kind === 'period');
      if (lastPeriod && toMinutes(lastPeriod.endTime) === cursor) {
        lastPeriod.endTime = fromMinutes(cursor + rem);
        cursor += rem;
        return;
      }
      // Nothing to merge into: only keep a tiny block if ≥ 15 min.
      if (rem >= 15) {
        pushPeriod(cursor, cursor + rem);
        cursor += rem;
      } else {
        cursor += rem;
      }
      return;
    }
    pushPeriod(cursor, cursor + rem);
    cursor += rem;
  };

  let guard = 0;
  while (cursor < endMin && guard++ < 64) {
    const covering = hardSorted.find((h) => cursor >= h.s && cursor < h.e);
    if (covering) {
      cursor = covering.e;
      continue;
    }

    const nextHard = hardSorted.find((h) => h.s >= cursor);
    const limit = nextHard ? Math.min(nextHard.s, endMin) : endMin;
    const available = limit - cursor;
    if (available <= 0) {
      if (nextHard) cursor = Math.max(cursor, nextHard.e);
      else break;
      continue;
    }

    if (available >= periodMinutes) {
      while (cursor + periodMinutes <= limit) {
        pushPeriod(cursor, cursor + periodMinutes);
        cursor += periodMinutes;
      }
      consumeRemainder(limit - cursor);
    } else {
      consumeRemainder(available);
    }
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

export function defaultBreakDurationsForLevel(levelCode: string): {
  recessMinutes: number[];
  lunchMinutes: number;
} {
  const code = (levelCode || '').toUpperCase();
  if (code === 'SECUNDARIA') {
    return { recessMinutes: [15, 15], lunchMinutes: 45 };
  }
  return { recessMinutes: [30], lunchMinutes: 45 };
}

export function defaultsForLevel(levelCode: string): {
  dayStart: string;
  dayEnd: string;
  periodMinutes: number;
  recessMinutes: number[];
  lunchMinutes: number;
  includeLunch: boolean;
} {
  const code = (levelCode || '').toUpperCase();
  const breaks = defaultBreakDurationsForLevel(code);
  if (code === 'INICIAL') {
    return {
      dayStart: '08:00',
      dayEnd: '13:00',
      periodMinutes: 45,
      ...breaks,
      includeLunch: false,
    };
  }
  if (code === 'SECUNDARIA') {
    return {
      dayStart: '07:30',
      dayEnd: '15:30',
      periodMinutes: 45,
      ...breaks,
      includeLunch: false,
    };
  }
  return {
    dayStart: '08:00',
    dayEnd: '13:15',
    periodMinutes: 45,
    ...breaks,
    includeLunch: false,
  };
}

export type DayPlanTimelineSegmentKind = 'period' | 'recess' | 'lunch' | 'other';

export interface DayPlanTimelineSegment {
  kind: DayPlanTimelineSegmentKind;
  label: string;
  startTime: string;
  endTime: string;
  startMin: number;
  endMin: number;
  leftPct: number;
  widthPct: number;
}

function inferHardKind(label: string): DayPlanTimelineSegmentKind {
  const lower = label.toLowerCase();
  if (lower.includes('recreo')) return 'recess';
  if (lower.includes('almuerzo') || lower.includes('lonchera')) return 'lunch';
  return 'other';
}

function displayBlockLabel(label: string): string {
  if (/^lonchera$/i.test(label.trim())) return 'Almuerzo';
  return label;
}

/** Maps a contiguous day preview into proportional timeline segments. */
export function previewToTimelineSegments(
  preview: DayPlanPreviewItem[],
  dayStart?: string,
  dayEnd?: string,
): DayPlanTimelineSegment[] {
  if (!preview.length) return [];

  const raw = preview.map((item) => {
    const startMin = toMinutes(item.startTime);
    const endMin = toMinutes(item.endTime);
    const kind = item.kind === 'period' ? 'period' : inferHardKind(item.label);
    return {
      kind,
      label: displayBlockLabel(item.label),
      startTime: item.startTime,
      endTime: item.endTime,
      startMin,
      endMin,
      leftPct: 0,
      widthPct: 0,
    };
  });

  const spanStart = dayStart ? toMinutes(dayStart) : Math.min(...raw.map((s) => s.startMin));
  const spanEnd = dayEnd ? toMinutes(dayEnd) : Math.max(...raw.map((s) => s.endMin));
  const span = Math.max(spanEnd - spanStart, 1);

  return raw
    .sort((a, b) => a.startMin - b.startMin)
    .map((s) => ({
      ...s,
      leftPct: ((s.startMin - spanStart) / span) * 100,
      widthPct: Math.max(((s.endMin - s.startMin) / span) * 100, 1.5),
    }));
}

/** Infer break duration in minutes from saved block times. */
export function inferBreakDurationMinutes(
  start: string | null | undefined,
  end: string | null | undefined,
  fallback: number,
): number {
  if (!start || !end) return fallback;
  const mins = durationMinutes(
    start.length >= 5 ? start.slice(0, 5) : start,
    end.length >= 5 ? end.slice(0, 5) : end,
  );
  return mins > 0 ? mins : fallback;
}
