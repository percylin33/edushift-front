import { FAMILY_ROUTES } from './family.routes';
import { Permission } from '@core/enums';

describe('FAMILY_ROUTES', () => {
  it('gates every family route with LMS_FAMILY_READ', () => {
    expect(FAMILY_ROUTES.length).toBeGreaterThan(0);
    for (const route of FAMILY_ROUTES) {
      expect(route.canMatch).toBeDefined();
      expect(route.data?.['permissions']).toBe(Permission.LmsFamilyRead);
    }
  });

  it('lazy loads the children list and nested child pages', () => {
    const paths = FAMILY_ROUTES.map((route) => route.path);
    expect(paths).toContain('');
    expect(paths).toContain('children/:studentPublicUuid');
    const child = FAMILY_ROUTES.find((route) => route.path === 'children/:studentPublicUuid');
    const nested = (child?.children ?? []).map((route) => route.path);
    expect(nested).toContain('attendance');
    expect(nested).toContain('grades');
    expect(nested).toContain('activities');
    expect(nested).toContain('payments');
    expect(nested).toContain('schedule');
  });
});
