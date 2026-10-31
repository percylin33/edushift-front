import { LMS_ROUTES } from './lms.routes';

describe('LMS_ROUTES', () => {
  it('tiene landing, funnel de cursos y shell', () => {
    expect(LMS_ROUTES.length).toBeGreaterThanOrEqual(3);
    expect(LMS_ROUTES.some((r) => r.path === 'courses')).toBeTrue();
    expect(LMS_ROUTES.some((r) => r.path === 'courses/:courseUuid/sections')).toBeTrue();
  });

  it('define ruta sections/:sectionUuid/assignments en el shell', () => {
    const r = findShellChild('sections/:sectionUuid/assignments');
    expect(r).toBeDefined();
    expect(r?.canMatch).toBeDefined();
    expect(r?.loadComponent).toBeDefined();
  });

  it('define ruta assignments/:uuid con guards', () => {
    const r = findShellChild('assignments/:uuid');
    expect(r).toBeDefined();
    expect(r?.data?.['permissions']).toBeDefined();
  });

  it('define rutas quiz', () => {
    expect(findShellChild('sections/:sectionUuid/quizzes')).toBeDefined();
    expect(findShellChild('quizzes/new')).toBeDefined();
    expect(findShellChild('quizzes/:uuid')).toBeDefined();
    expect(findShellChild('quizzes/:uuid/edit')).toBeDefined();
    expect(findShellChild('quizzes/:uuid/take')).toBeDefined();
    expect(findShellChild('quizzes/:uuid/results')).toBeDefined();
    expect(findShellChild('quizzes/:uuid/grade')).toBeDefined();
  });

  function shellRoute() {
    return LMS_ROUTES.find((r) => Array.isArray(r.children))!;
  }

  function findShellChild(path: string) {
    return shellRoute().children?.find((r) => r.path === path);
  }
});
