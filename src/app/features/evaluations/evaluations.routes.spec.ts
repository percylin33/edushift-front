import { EVALUATIONS_ROUTES } from './evaluations.routes';

describe('EVALUATIONS_ROUTES', () => {
  it('exposes the landing + 4 sub-routes', () => {
    expect(EVALUATIONS_ROUTES.find(r => r.path === '')).toBeDefined();
    const shell = EVALUATIONS_ROUTES.find(r => r.path === '' && r.children);
    expect(shell?.children?.find(r => r.path === 'by-assignment/:assignmentUuid')).toBeDefined();
    expect(shell?.children?.find(r => r.path === 'by-assignment/:assignmentUuid/gradebook')).toBeDefined();
    expect(EVALUATIONS_ROUTES.find(r => r.path === ':publicUuid')).toBeDefined();
    expect(EVALUATIONS_ROUTES.find(r => r.path === ':publicUuid/grades')).toBeDefined();
  });

  it('every route is gated to TENANT_ADMIN + TEACHER', () => {
    for (const route of EVALUATIONS_ROUTES) {
      expect(route.data?.['roles']).toEqual(['TENANT_ADMIN', 'TEACHER']);
    }
  });
});
