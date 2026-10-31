import { ANNOUNCEMENTS_ROUTES } from './announcements.routes';

describe('ANNOUNCEMENTS_ROUTES', () => {
  it('has a root path that loads the list page', () => {
    const root = ANNOUNCEMENTS_ROUTES.find(r => r.path === '');
    expect(root).toBeDefined();
    expect(root?.loadComponent).toBeDefined();
  });

  it('has a /new path that loads the composer page', () => {
    const composer = ANNOUNCEMENTS_ROUTES.find(r => r.path === 'new');
    expect(composer).toBeDefined();
    expect(composer?.loadComponent).toBeDefined();
    expect(composer?.canActivate?.length).toBeGreaterThan(0);
  });

  it('guards the edit path so students cannot open the composer by URL', () => {
    const edit = ANNOUNCEMENTS_ROUTES.find(r => r.path === ':publicUuid/edit');
    expect(edit).toBeDefined();
    expect(edit?.canActivate?.length).toBeGreaterThan(0);
  });
});
