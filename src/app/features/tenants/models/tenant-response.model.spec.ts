import { TenantPlan, TenantStatus } from '@core/enums';
import { BrandingRaw, TenantSummaryRaw, TenantResponseRaw } from './tenant-response.model';

describe('TenantResponseModel', () => {
  describe('BrandingRaw', () => {
    it('todos los campos opcionales', () => {
      const b: BrandingRaw = {};
      expect(b.primaryColor).toBeUndefined();
    });

    it('acepta null', () => {
      const b: BrandingRaw = { primaryColor: null };
      expect(b.primaryColor).toBeNull();
    });
  });

  describe('TenantSummaryRaw', () => {
    it('shape público sin plan/settings', () => {
      const r: TenantSummaryRaw = {
        publicUuid: 't-1',
        name: 'Acme',
        slug: 'acme',
        status: TenantStatus.Active,
        branding: {},
      };
      expect((r as any).plan).toBeUndefined();
      expect((r as any).settings).toBeUndefined();
    });
  });

  describe('TenantResponseRaw', () => {
    it('shape completo con plan + settings + flags', () => {
      const r: TenantResponseRaw = {
        publicUuid: 't-1',
        name: 'Acme',
        slug: 'acme',
        status: TenantStatus.Active,
        plan: TenantPlan.Trial,
        branding: {},
        settings: {},
        featureFlags: {},
      };
      expect(r.plan).toBe(TenantPlan.Trial);
    });

    it('customDomain y maxStudents opcionales', () => {
      const r: TenantResponseRaw = {
        publicUuid: 't-1',
        name: 'Acme',
        slug: 'acme',
        status: TenantStatus.Active,
        plan: TenantPlan.Trial,
        branding: {},
        settings: {},
        featureFlags: {},
      };
      expect(r.customDomain).toBeUndefined();
    });
  });
});
