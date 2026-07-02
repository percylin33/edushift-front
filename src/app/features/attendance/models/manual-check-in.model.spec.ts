import { ManualCheckInRequest } from './manual-check-in.model';

describe('ManualCheckInModel', () => {
  it('requiere studentPublicUuid', () => {
    const r: ManualCheckInRequest = { studentPublicUuid: 'stu-1' };
    expect(r.studentPublicUuid).toBe('stu-1');
    expect(r.slot).toBeUndefined();
  });

  it('overrides opcionales', () => {
    const r: ManualCheckInRequest = {
      studentPublicUuid: 'stu-1',
      slot: 'AFTERNOON',
      occurredOn: '2026-06-15',
      occurredAt: '2026-06-15T15:00:00Z',
      forcedStatus: 'LATE',
    };
    expect(r.slot).toBe('AFTERNOON');
    expect(r.forcedStatus).toBe('LATE');
  });
});
