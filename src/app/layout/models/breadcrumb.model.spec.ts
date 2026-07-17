import { Breadcrumb } from './breadcrumb.model';

describe('Breadcrumb', () => {
  it('crea una miga con label y url', () => {
    const crumb: Breadcrumb = { label: 'Inicio', url: '/' };
    expect(crumb.label).toBe('Inicio');
    expect(crumb.url).toBe('/');
  });

  it('url puede ser null para la página actual', () => {
    const crumb: Breadcrumb = { label: 'Panel', url: null };
    expect(crumb.url).toBeNull();
  });
});
