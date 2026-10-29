import { AI_ROUTES } from './ai.routes';

describe('AI_ROUTES', () => {
  it('define las rutas lazy de cada experiencia de IA', () => {
    expect(AI_ROUTES.map((route) => route.path)).toEqual([
      '', 'tutor', 'teacher', 'family', 'sources', 'chat', 'insights', 'usage',
    ]);
  });

  it('la ruta raíz carga AiHomeComponent', async () => {
    const component = await AI_ROUTES[0].loadComponent!();
    expect(component).toBeDefined();
  });

  it('todas las experiencias se autorizan por permiso antes de hacer match', () => {
    for (const route of AI_ROUTES) {
      expect(route.canMatch).toBeDefined();
    }
  });
});
