import { LMS_ROUTES } from './lms.routes';

describe('LMS_ROUTES', () => {
  it('tiene estructura correcta con shell y children', () => {
    expect(LMS_ROUTES).toHaveSize(1);
    const shell = LMS_ROUTES[0];
    expect(shell.path).toBe('');
    expect(shell.canMatch).toBeDefined();
    expect(shell.loadComponent).toBeDefined();
    expect(shell.children).toBeDefined();
  });

  it('redirige /lms a sections/assignments', () => {
    const redirect = shellRoute().children?.find((r) => r.path === '' && r.redirectTo);
    expect(redirect?.redirectTo).toBe('sections/_/assignments');
  });

  it('define ruta sections/:sectionUuid/assignments', () => {
    const r = findRoute('sections/:sectionUuid/assignments');
    expect(r).toBeDefined();
    expect(r?.canMatch).toBeDefined();
    expect(r?.loadComponent).toBeDefined();
  });

  it('define ruta assignments/:uuid con guards', () => {
    const r = findRoute('assignments/:uuid');
    expect(r).toBeDefined();
    expect(r?.data?.['permissions']).toBeDefined();
  });

  it('define rutas quiz', () => {
    expect(findRoute('sections/:sectionUuid/quizzes')).toBeDefined();
    expect(findRoute('quizzes/new')).toBeDefined();
    expect(findRoute('quizzes/:uuid')).toBeDefined();
    expect(findRoute('quizzes/:uuid/edit')).toBeDefined();
    expect(findRoute('quizzes/:uuid/take')).toBeDefined();
    expect(findRoute('quizzes/:uuid/results')).toBeDefined();
    expect(findRoute('quizzes/:uuid/grade')).toBeDefined();
  });

  function shellRoute() {
    return LMS_ROUTES[0];
  }

  function findRoute(path: string) {
    return shellRoute().children?.find((r) => r.path === path);
  }
});
