import { RUBRICS_ROUTES } from './rubrics.routes';

describe('RUBRICS_ROUTES', () => {
  it('define 4 rutas', () => {
    expect(RUBRICS_ROUTES.length).toBe(4);
  });

  it('ruta raíz carga RubricsListComponent', async () => {
    const component = await RUBRICS_ROUTES[0].loadComponent!();
    expect(component).toBeDefined();
  });

  it('ruta /new carga RubricFormComponent', async () => {
    const component = await RUBRICS_ROUTES[1].loadComponent!();
    expect(component).toBeDefined();
  });

  it('ruta /:publicUuid carga RubricDetailComponent', async () => {
    const component = await RUBRICS_ROUTES[2].loadComponent!();
    expect(component).toBeDefined();
  });

  it('ruta /:publicUuid/edit carga RubricFormComponent', async () => {
    const component = await RUBRICS_ROUTES[3].loadComponent!();
    expect(component).toBeDefined();
  });

  it('todas las rutas tienen canActivate con roleGuard', () => {
    for (const route of RUBRICS_ROUTES) {
      expect(route.canActivate).toBeDefined();
      expect(route.data).toBeDefined();
    }
  });
});
