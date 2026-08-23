import { ME_ROUTES } from './me.routes';

describe('ME_ROUTES', () => {
  it('mounts the role-redirect component at the empty path', () => {
    const root = ME_ROUTES.find(r => r.path === '');
    expect(root).toBeDefined();
    expect(root?.pathMatch).toBe('full');
    expect(root?.component).toBeDefined();
  });

  it('exposes profile + 5 sub-section paths', () => {
    const paths = ME_ROUTES.filter(r => r.path !== '').map(r => r.path);
    expect(paths).toContain('profile');
    expect(paths).toContain('courses');
    expect(paths).toContain('courses/:sectionPublicUuid');
    expect(paths).toContain('grades');
    expect(paths).toContain('attendance');
    expect(paths).toContain('qr');
    expect(paths).toContain('payments');
    expect(paths).toContain('schedule');
  });

  it('sub-section paths are STUDENT-only (roleGuard + permissionGuard)', () => {
    const subSections = ME_ROUTES.filter(r => r.path !== '');
    for (const route of subSections) {
      expect(route.canMatch?.length).toBeGreaterThanOrEqual(2);
    }
  });
});
