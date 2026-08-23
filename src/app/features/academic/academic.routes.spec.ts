import { ACADEMIC_ROUTES } from './academic.routes';

describe('ACADEMIC_ROUTES', () => {
  const root = ACADEMIC_ROUTES[0];
  const children = root.children || [];

  it('mounts the academic shell under TENANT_ADMIN guard', () => {
    expect(root.canActivate).toBeDefined();
    expect(root.data?.['roles']).toContain('TENANT_ADMIN');
  });

  it('redirects the empty path to years', () => {
    const empty = children.find(r => r.path === '');
    expect(empty?.redirectTo).toBe('years');
    expect(empty?.pathMatch).toBe('full');
  });

  it('exposes years (list + new + edit) routes', () => {
    expect(children.find(r => r.path === 'years')).toBeDefined();
    expect(children.find(r => r.path === 'years/new')).toBeDefined();
    expect(children.find(r => r.path === 'years/:id/edit')).toBeDefined();
  });

  it('exposes levels, sections, courses, periods, classrooms', () => {
    expect(children.find(r => r.path === 'levels')).toBeDefined();
    expect(children.find(r => r.path === 'sections')).toBeDefined();
    expect(children.find(r => r.path === 'sections/:id')).toBeDefined();
    expect(children.find(r => r.path === 'courses')).toBeDefined();
    expect(children.find(r => r.path === 'courses/:id')).toBeDefined();
    expect(children.find(r => r.path === 'periods')).toBeDefined();
    expect(children.find(r => r.path === 'classrooms')).toBeDefined();
  });

  it('every child route is TENANT_ADMIN-only', () => {
    for (const r of children) {
      if (r.path === '') continue;
      expect(r.data?.['roles']).toContain('TENANT_ADMIN');
    }
  });
});
