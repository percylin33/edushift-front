import { MeAttendanceRecord } from '../../models/me-attendance.model';
import {
  buildMonthCells,
  canSubmitJustification,
  formatDayTitle,
  formatRate,
  groupAttendanceByDay,
  localDateKey,
  summarizeMeAttendance,
  worstStatus,
} from './me-attendance.logic';

function record(
  partial: Partial<MeAttendanceRecord> & Pick<MeAttendanceRecord, 'status' | 'occurredAt'>,
): MeAttendanceRecord {
  return {
    publicUuid: partial.publicUuid ?? partial.occurredAt,
    sessionPublicUuid: partial.sessionPublicUuid ?? null,
    status: partial.status,
    occurredAt: partial.occurredAt,
    notes: partial.notes ?? null,
    justificationStatus: partial.justificationStatus ?? null,
    justificationText: partial.justificationText ?? null,
    approvedAt: partial.approvedAt ?? null,
  };
}

function at(year: number, month: number, day: number, hour = 8): string {
  return new Date(year, month - 1, day, hour, 15, 0).toISOString();
}

describe('me attendance summary', () => {
  it('keeps an empty period without a zero rate', () => {
    const summary = summarizeMeAttendance([]);
    expect(summary.total).toBe(0);
    expect(summary.ratePercent).toBeNull();
    expect(summary.attended).toBe(0);
    expect(summary.absences).toBe(0);
  });

  it('counts presence, lates and absences for the period', () => {
    const summary = summarizeMeAttendance([
      record({ status: 'PRESENT', occurredAt: at(2026, 8, 3) }),
      record({ status: 'PRESENT', occurredAt: at(2026, 8, 4) }),
      record({ status: 'LATE', occurredAt: at(2026, 8, 5) }),
      record({ status: 'LATE', occurredAt: at(2026, 8, 6), justificationStatus: 'PENDING' }),
      record({ status: 'ABSENT', occurredAt: at(2026, 8, 7) }),
      record({ status: 'ABSENT', occurredAt: at(2026, 8, 10), justificationStatus: 'APPROVED' }),
      record({ status: 'EXCUSED', occurredAt: at(2026, 8, 11) }),
      record({ status: 'ABSENT', occurredAt: at(2026, 8, 12), justificationStatus: 'REJECTED' }),
      record({ status: 'ABSENT', occurredAt: at(2026, 8, 13), justificationStatus: 'PENDING' }),
    ]);

    expect(summary.total).toBe(9);
    expect(summary.attended).toBe(4);
    expect(summary.late).toBe(2);
    expect(summary.latePending).toBe(1);
    expect(summary.lateToRegularize).toBe(1);
    expect(summary.absences).toBe(5);
    expect(summary.justifiedAbsences).toBe(2);
    expect(summary.pendingAbsences).toBe(1);
    expect(summary.rejectedAbsences).toBe(1);
    expect(summary.absencesToRegularize).toBe(1);
    // present + excused + approved absence = 2 + 1 + 1
    expect(summary.ratePercent).toBe(44.4);
  });

  it('lets a student justify only an open late or absence', () => {
    expect(canSubmitJustification(record({ status: 'ABSENT', occurredAt: at(2026, 8, 1) }))).toBe(
      true,
    );
    expect(canSubmitJustification(record({ status: 'LATE', occurredAt: at(2026, 8, 1) }))).toBe(
      true,
    );
    expect(
      canSubmitJustification(
        record({ status: 'ABSENT', occurredAt: at(2026, 8, 1), justificationStatus: 'REJECTED' }),
      ),
    ).toBe(false);
    expect(canSubmitJustification(record({ status: 'PRESENT', occurredAt: at(2026, 8, 1) }))).toBe(
      false,
    );
  });
});

describe('me attendance calendar', () => {
  it('groups several sessions on the same civil day and keeps the worst status', () => {
    const present = record({ publicUuid: 'p', status: 'PRESENT', occurredAt: at(2026, 8, 26, 8) });
    const absent = record({ publicUuid: 'a', status: 'ABSENT', occurredAt: at(2026, 8, 26, 11) });
    const other = record({ publicUuid: 'o', status: 'LATE', occurredAt: at(2026, 8, 27, 8) });
    const groups = groupAttendanceByDay([present, other, absent]);
    const day = groups.get(localDateKey(present.occurredAt));

    expect(day?.records.map((item) => item.publicUuid)).toEqual(['p', 'a']);
    expect(day?.worst).toBe('ABSENT');
    expect(
      worstStatus([present, record({ status: 'EXCUSED', occurredAt: at(2026, 8, 26, 9) })]),
    ).toBe('EXCUSED');
  });

  it('paints an approved absence as justified and leaves a late mark as late', () => {
    const approvedAbsence = record({
      status: 'ABSENT',
      occurredAt: at(2026, 8, 26, 8),
      justificationStatus: 'APPROVED',
    });
    const approvedLate = record({
      status: 'LATE',
      occurredAt: at(2026, 8, 26, 10),
      justificationStatus: 'APPROVED',
    });
    expect(worstStatus([approvedAbsence, approvedLate])).toBe('LATE');
  });

  it('builds a Monday-first grid for August 2026', () => {
    const cells = buildMonthCells(2026, 8);
    expect(cells[0]).toEqual({ dateKey: '2026-07-27', day: 27, inMonth: false });
    expect(cells[5]).toEqual({ dateKey: '2026-08-01', day: 1, inMonth: true });
    expect(cells.filter((cell) => cell.inMonth)).toHaveSize(31);
    expect(cells.length % 7).toBe(0);
    expect(formatDayTitle('2026-08-26')).toBe('Miércoles, 26 de agosto');
  });

  it('formats the rate in Spanish', () => {
    expect(formatRate(100)).toBe('100%');
    expect(formatRate(96.2)).toBe('96.2%');
  });
});
