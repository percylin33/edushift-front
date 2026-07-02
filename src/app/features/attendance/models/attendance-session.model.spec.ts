import {
  AttendanceSession,
  AttendanceSessionListItem,
  AttendanceSessionListItemRaw,
  AttendanceSessionResponseRaw,
  AttendanceSessionSlot,
  AttendanceSessionStatus,
  CreateSessionRequest,
} from './attendance-session.model';

describe('AttendanceSessionModel', () => {
  describe('AttendanceSessionSlot', () => {
    it('3 valores', () => {
      const v: AttendanceSessionSlot[] = ['MORNING', 'AFTERNOON', 'EVENING'];
      expect(v).toHaveSize(3);
    });
  });

  describe('AttendanceSessionStatus', () => {
    it('2 valores', () => {
      const v: AttendanceSessionStatus[] = ['ACTIVE', 'CLOSED'];
      expect(v).toHaveSize(2);
    });
  });

  describe('AttendanceSessionResponseRaw', () => {
    it('shape wire con timestamps string', () => {
      const raw: AttendanceSessionResponseRaw = {
        publicUuid: 'sess-1',
        sectionPublicUuid: 'sec-1',
        occurredOn: '2026-06-15',
        slot: 'MORNING',
        startsAt: '2026-06-15',
        status: 'ACTIVE',
        createdAt: '2026-06-15',
        updatedAt: '2026-06-15',
      };
      expect(raw.startsAt).toBe('2026-06-15');
    });
  });

  describe('AttendanceSession', () => {
    it('shape UI con Date', () => {
      const s: AttendanceSession = {
        publicUuid: 'sess-1',
        sectionPublicUuid: 'sec-1',
        occurredOn: new Date('2026-06-15'),
        slot: 'MORNING',
        startsAt: new Date('2026-06-15'),
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(s.slot).toBe('MORNING');
    });
  });

  describe('CreateSessionRequest', () => {
    it('requiere section + slot + occurredOn', () => {
      const r: CreateSessionRequest = {
        sectionPublicUuid: 'sec-1',
        slot: 'MORNING',
        occurredOn: '2026-06-15',
      };
      expect(r.occurredOn).toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('AttendanceSessionListItemRaw', () => {
    it('shape lean con contadores opcionales', () => {
      const raw: AttendanceSessionListItemRaw = {
        publicUuid: 'sess-1',
        sectionPublicUuid: 'sec-1',
        occurredOn: '2026-06-15',
        slot: 'MORNING',
        status: 'CLOSED',
        startsAt: '2026-06-15',
        presentCount: 10,
        lateCount: 1,
        absentCount: 2,
        excusedCount: 0,
        createdAt: '2026-06-15',
        updatedAt: '2026-06-15',
      };
      expect(raw.presentCount).toBe(10);
    });
  });

  describe('AttendanceSessionListItem', () => {
    it('sectionLabel precomputado', () => {
      const item: AttendanceSessionListItem = {
        publicUuid: 'sess-1',
        sectionPublicUuid: 'sec-1',
        sectionName: 'A',
        sectionGradeName: '1°',
        sectionLabel: '1° · A',
        occurredOn: new Date(),
        slot: 'MORNING',
        status: 'ACTIVE',
        startsAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(item.sectionLabel).toBe('1° · A');
    });
  });
});
