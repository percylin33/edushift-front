import {
  AttendanceRecord,
  AttendanceRecordResponseRaw,
  AttendanceRecordStatus,
  UpdateRecordRequest,
} from './attendance-record.model';

describe('AttendanceRecordModel', () => {
  describe('AttendanceRecordStatus union', () => {
    it('valores esperados', () => {
      const v: AttendanceRecordStatus[] = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];
      expect(v).toHaveSize(4);
    });
  });

  describe('AttendanceRecordResponseRaw', () => {
    it('shape con nullable', () => {
      const raw: AttendanceRecordResponseRaw = {
        publicUuid: 'rec-1',
        sessionPublicUuid: 'sess-1',
        studentPublicUuid: 'stu-1',
        studentFullName: null,
        studentDocumentNumber: null,
        status: 'PRESENT',
        occurredAt: '2026-06-15',
        scannedByUserId: null,
        editedByUserId: null,
        editedAt: null,
        notes: null,
        createdAt: '2026-06-15',
        updatedAt: '2026-06-15',
      };
      expect(raw.status).toBe('PRESENT');
    });
  });

  describe('AttendanceRecord', () => {
    it('shape UI con Date', () => {
      const r: AttendanceRecord = {
        publicUuid: 'rec-1',
        sessionPublicUuid: 'sess-1',
        studentPublicUuid: 'stu-1',
        status: 'LATE',
        occurredAt: new Date('2026-06-15'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(r.occurredAt).toBeInstanceOf(Date);
    });
  });

  describe('UpdateRecordRequest', () => {
    it('requiere status', () => {
      const u: UpdateRecordRequest = { status: 'PRESENT', notes: 'llegó tarde' };
      expect(u.notes).toBe('llegó tarde');
    });
  });
});
