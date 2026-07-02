import { AI_ROUTES } from './ai.routes';

describe('AI_ROUTES', () => {
  it('define ruta raíz con lazy loading', () => {
    expect(AI_ROUTES.length).toBe(1);
    expect(AI_ROUTES[0].path).toBe('');
  });

  it('la ruta raíz carga AiHomeComponent', async () => {
    const mod = await (AI_ROUTES[0].loadComponent! as () => Promise<any>)();
    expect(mod.AiHomeComponent).toBeDefined();
  });
});
