import {
  computeDayPlanPreview,
  computeSmartDayPlanLayout,
  previewToTimelineSegments,
} from './day-plan.util';

describe('computeSmartDayPlanLayout', () => {
  it('packs periods and recess contiguously with no gaps (Inicial)', () => {
    const layout = computeSmartDayPlanLayout({
      dayStart: '08:00',
      dayEnd: '13:00',
      periodMinutes: 45,
      recessMinutes: [30],
      includeLunch: true,
      lunchMinutes: 45,
    });

    expect(layout.recesses.length).toBe(1);
    expect(layout.recesses[0]).toEqual({
      startTime: '09:30',
      endTime: '10:00',
      label: 'Recreo',
    });
    expect(layout.items[0].kind).toBe('period');
    expect(layout.items[0].startTime).toBe('08:00');
    expect(layout.items[0].endTime).toBe('08:45');
    expect(layout.items[2].label).toBe('Recreo');

    const segments = previewToTimelineSegments(layout.items, '08:00', '13:00');
    expect(segments.every((s, i, arr) => i === 0 || s.startMin === arr[i - 1].endMin)).toBeTrue();
    expect(segments[segments.length - 1].endTime).toBe('13:00');
  });

  it('extends the last block to salida', () => {
    const layout = computeSmartDayPlanLayout({
      dayStart: '08:00',
      dayEnd: '13:00',
      periodMinutes: 45,
      recessMinutes: [30],
      includeLunch: false,
      lunchMinutes: 45,
    });
    const last = layout.items[layout.items.length - 1];
    expect(last.endTime).toBe('13:00');
  });

  it('places second recess on short Inicial day', () => {
    const layout = computeSmartDayPlanLayout({
      dayStart: '08:00',
      dayEnd: '13:00',
      periodMinutes: 45,
      recessMinutes: [30, 15],
      includeLunch: true,
      lunchMinutes: 45,
    });

    expect(layout.recesses.length).toBe(2);
    expect(layout.recesses[0].label).toBe('Recreo 1');
    expect(layout.recesses[1].label).toBe('Recreo 2');
    expect(layout.lunch).not.toBeNull();

    const lunchIdx = layout.items.findIndex((i) => i.label === 'Almuerzo');
    const r2Idx = layout.items.findIndex((i) => i.label === 'Recreo 2');
    expect(r2Idx).toBeGreaterThan(lunchIdx);
    expect(layout.items[layout.items.length - 1].endTime).toBe('13:00');
  });

  it('supports three recesses when the day is long enough', () => {
    const layout = computeSmartDayPlanLayout({
      dayStart: '07:30',
      dayEnd: '15:30',
      periodMinutes: 45,
      recessMinutes: [15, 15, 15],
      includeLunch: true,
      lunchMinutes: 45,
    });
    expect(layout.recesses.length).toBe(3);
    expect(layout.lunch?.label).toBe('Almuerzo');
  });
});

describe('computeDayPlanPreview remainder rule', () => {
  it('creates a short final period when leftover is ≥ half a period', () => {
    const preview = computeDayPlanPreview('08:00', '13:15', 45, [
      { startTime: '10:15', endTime: '10:35', label: 'Recreo', kind: 'recess' },
    ]);
    const periods = preview.filter((i) => i.kind === 'period');
    const last = periods[periods.length - 1];
    expect(last.endTime).toBe('13:15');
    expect(periods.length).toBeGreaterThanOrEqual(7);
  });

  it('merges leftover into previous period when leftover is < half a period', () => {
    const preview2 = computeDayPlanPreview('08:00', '12:55', 45, [
      { startTime: '10:15', endTime: '10:35', label: 'Recreo', kind: 'recess' },
    ]);
    const periods = preview2.filter((i) => i.kind === 'period');
    const last = periods[periods.length - 1];
    expect(last.endTime).toBe('12:55');
    const shortOnes = periods.filter((p) => {
      const [sh, sm] = p.startTime.split(':').map(Number);
      const [eh, em] = p.endTime.split(':').map(Number);
      return eh * 60 + em - (sh * 60 + sm) < 22.5;
    });
    expect(shortOnes.length).toBe(0);
  });
});

describe('previewToTimelineSegments', () => {
  it('maps preview items to proportional segments', () => {
    const preview = computeDayPlanPreview('08:00', '12:00', 45, [
      {
        startTime: '10:00',
        endTime: '10:20',
        label: 'Recreo',
        kind: 'recess',
      },
    ]);
    const segments = previewToTimelineSegments(preview, '08:00', '12:00');
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.some((s) => s.kind === 'recess')).toBeTrue();
    expect(segments.some((s) => s.kind === 'period')).toBeTrue();
  });

  it('classifies lunch blocks from label and renames Lonchera', () => {
    const segments = previewToTimelineSegments([
      { kind: 'hard', startTime: '12:30', endTime: '13:15', label: 'Lonchera' },
    ]);
    expect(segments[0].kind).toBe('lunch');
    expect(segments[0].label).toBe('Almuerzo');
  });
});
