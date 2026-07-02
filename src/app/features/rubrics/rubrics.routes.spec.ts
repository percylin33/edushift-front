import { RUBRICS_ROUTES } from './rubrics.routes';

describe('RUBRICS_ROUTES', () => {
  it('define 4 rutas', () => {
    expect(RUBRICS_ROUTES.length).toBe(4);
  });

  it('ruta raíz carga RubricsListComponent', async () => {
    const mod = await (RUBRICS_ROUTES[0].loadComponent! as () => Promise<any>)();
    expect(mod.RubricsListComponent).toBeDefined();
  });

  it('ruta /new carga RubricFormComponent', async () => {
    const mod = await (RUBRICS_ROUTES[1].loadComponent! as () => Promise<any>)();
    expect(mod.RubricFormComponent).toBeDefined();
  });

  it('ruta /:publicUuid carga RubricDetailComponent', async () => {
    const mod = await (RUBRICS_ROUTES[2].loadComponent! as () => Promise<any>)();
    expect(mod.RubricDetailComponent).toBeDefined();
  });

  it('ruta /:publicUuid/edit carga RubricFormComponent', async () => {
    const mod = await (RUBRICS_ROUTES[3].loadComponent! as () => Promise<any>)();
    expect(mod.RubricFormComponent).toBeDefined();
  });

  it('todas las rutas tienen canActivate con roleGuard', () => {
    for (const route of RUBRICS_ROUTES) {
      expect(route.canActivate).toBeDefined();
      expect(route.data).toBeDefined();
    }
  });
});
