import { InvitationStatus, UserRole } from '@core/enums';
import {
  Invitation,
  CreateInvitationRequest,
  InvitationPreflight,
  AcceptInvitationRequest,
} from './invitation.model';

describe('InvitationModel', () => {
  describe('Invitation', () => {
    it('shape completo con token', () => {
      const inv: Invitation = {
        publicUuid: 'inv-1',
        email: 'a@b.com',
        firstName: 'A',
        lastName: 'B',
        fullName: 'A B',
        roles: [UserRole.Teacher],
        status: InvitationStatus.Pending,
        token: 'tok-1',
        expiresAt: new Date('2026-12-31'),
      };
      expect(inv.token).toBe('tok-1');
    });

    it('shape sin token (list response)', () => {
      const inv: Invitation = {
        publicUuid: 'inv-1',
        email: 'a@b.com',
        firstName: 'A',
        lastName: 'B',
        fullName: 'A B',
        roles: [UserRole.Teacher],
        status: InvitationStatus.Cancelled,
        cancelledAt: new Date(),
      };
      expect(inv.token).toBeUndefined();
    });
  });

  describe('CreateInvitationRequest', () => {
    it('requiere email + nombres + roles', () => {
      const req: CreateInvitationRequest = {
        email: 'a@b.com',
        firstName: 'A',
        lastName: 'B',
        roles: [UserRole.Teacher],
      };
      expect(req.roles).toContain(UserRole.Teacher);
    });
  });

  describe('InvitationPreflight', () => {
    it('shape del preflight response', () => {
      const pf: InvitationPreflight = {
        email: 'a@b.com',
        firstName: 'A',
        lastName: 'B',
        fullName: 'A B',
        tenantName: 'Acme',
      };
      expect(pf.tenantName).toBe('Acme');
    });
  });

  describe('AcceptInvitationRequest', () => {
    it('token + password', () => {
      const req: AcceptInvitationRequest = { token: 'tok', password: 'secret' };
      expect(req.password).toBe('secret');
    });
  });
});
