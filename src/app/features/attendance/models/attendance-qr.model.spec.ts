import {
  AttendanceQrInfo,
  AttendanceQrInfoResponseRaw,
  CheckInRequest,
  QrRevokedReason,
} from './attendance-qr.model';

describe('AttendanceQrModel', () => {
  describe('QrRevokedReason', () => {
    it('incluye 3 valores', () => {
      const values: QrRevokedReason[] = ['ROTATED', 'LOST', 'ADMIN_REVOKE'];
      expect(values).toHaveSize(3);
    });
  });

  describe('AttendanceQrInfoResponseRaw', () => {
    it('shape wire', () => {
      const raw: AttendanceQrInfoResponseRaw = {
        studentPublicUuid: 's-1',
        issuedAt: '2026-06-15',
        previousRevokedAt: null,
        previousRevokedReason: null,
      };
      expect(raw.previousRevokedAt).toBeNull();
    });
  });

  describe('AttendanceQrInfo', () => {
    it('issuedAt es Date', () => {
      const info: AttendanceQrInfo = {
        studentPublicUuid: 's-1',
        issuedAt: new Date('2026-06-15'),
      };
      expect(info.issuedAt).toBeInstanceOf(Date);
    });

    it('previousRevokedAt opcional', () => {
      const info: AttendanceQrInfo = {
        studentPublicUuid: 's-1',
        issuedAt: new Date(),
        previousRevokedAt: new Date(),
        previousRevokedReason: 'ROTATED',
      };
      expect(info.previousRevokedReason).toBe('ROTATED');
    });
  });

  describe('CheckInRequest', () => {
    it('requiere qrToken + sessionPublicUuid', () => {
      const r: CheckInRequest = { qrToken: 'tok', sessionPublicUuid: 'sess-1' };
      expect(r.qrToken).toBe('tok');
    });
  });
});
