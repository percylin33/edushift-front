import { TestBed } from '@angular/core/testing';
import { Router, Route, UrlSegment } from '@angular/router';
import { signal } from '@angular/core';
import { permissionGuard } from './permission.guard';
import { AuthService } from '@core/services';
import { Permission, UserStatus } from '@core/enums';
import { User } from '@core/models';

/**
 * Spec del `permissionGuard` (FE-7a.4).
 *
 * <p>Cubre los 6 escenarios del sprint:
 * <ol>
 *   <li>STUDENT con sólo LMS_TASK_READ no entra a ruta LMS_TASK_GRADE.</li>
 *   <li>STUDENT con sólo LMS_TASK_READ SÍ entra a ruta LMS_TASK_READ.</li>
 *   <li>TEACHER con LMS_TASK_GRADE entra a la ruta de calificar.</li>
 *   <li>Permite sintaxis con `Permission[]` (ANY_OF por defecto).</li>
 *   <li>Modo `permissionMode: 'all'` exige la conjunción.</li>
 *   <li>Sin `data.permissions` la ruta pasa (no-op).</li>
 * </ol>
 */
describe('permissionGuard', () => {
  let mockRouter: jasmine.SpyObj<Router>;
  let userSignal: ReturnType<typeof signal<User | null>>;
  let permissionsSignal: ReturnType<typeof signal<Permission[]>>;
  let authStub: Partial<AuthService>;

  function buildRoute(data: unknown): Route {
    return { path: '', data } as Route;
  }

  function userWith(perms: Permission[]): User {
    return {
      publicUuid: 'u-test',
      fullName: 'Test User',
      email: 'test@edushift.app',
      status: UserStatus.Active,
      permissions: perms,
    };
  }

  const segments: UrlSegment[] = [];

  beforeEach(() => {
    mockRouter = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);
    mockRouter.createUrlTree.and.callFake(
      (commands) => ({ commands }) as unknown as ReturnType<Router['createUrlTree']>,
    );

    userSignal = signal<User | null>(null);
    permissionsSignal = signal<Permission[]>([]);

    authStub = {
      user: userSignal.asReadonly(),
      permissions: permissionsSignal.asReadonly(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authStub },
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  function run(data: unknown): unknown {
    return TestBed.runInInjectionContext(() => permissionGuard(buildRoute(data), segments));
  }

  it('returns true when the route declares no permissions (no-op)', () => {
    userSignal.set(userWith([]));
    permissionsSignal.set([]);

    const result = run({});

    expect(result).toBeTrue();
    expect(mockRouter.createUrlTree).not.toHaveBeenCalled();
  });

  it('grants a STUDENT with LMS_TASK_READ access to a read-only LMS route', () => {
    userSignal.set(userWith([Permission.LmsTaskRead]));
    permissionsSignal.set([Permission.LmsTaskRead]);

    const result = run({ permissions: Permission.LmsTaskRead });

    expect(result).toBeTrue();
    expect(mockRouter.createUrlTree).not.toHaveBeenCalled();
  });

  it('blocks a STUDENT without LMS_TASK_GRADE from a grading route', () => {
    userSignal.set(userWith([Permission.LmsTaskRead, Permission.LmsTaskSubmit]));
    permissionsSignal.set([Permission.LmsTaskRead, Permission.LmsTaskSubmit]);

    const result = run({ permissions: Permission.LmsTaskGrade });

    expect(result).not.toBeTrue();
    expect(mockRouter.createUrlTree).toHaveBeenCalledOnceWith(['/403']);
  });

  it('grants a TEACHER with LMS_TASK_GRADE access to a grading route', () => {
    userSignal.set(
      userWith([Permission.LmsTaskRead, Permission.LmsTaskCreate, Permission.LmsTaskGrade]),
    );
    permissionsSignal.set([
      Permission.LmsTaskRead,
      Permission.LmsTaskCreate,
      Permission.LmsTaskGrade,
    ]);

    const result = run({ permissions: Permission.LmsTaskGrade });

    expect(result).toBeTrue();
    expect(mockRouter.createUrlTree).not.toHaveBeenCalled();
  });

  it('supports an array of permissions in ANY_OF mode (default)', () => {
    userSignal.set(userWith([Permission.LmsTaskSubmit]));
    permissionsSignal.set([Permission.LmsTaskSubmit]);

    const result = run({
      permissions: [Permission.LmsTaskGrade, Permission.LmsTaskSubmit],
    });

    expect(result).toBeTrue();
  });

  it('requires ALL listed permissions when permissionMode is "all"', () => {
    userSignal.set(userWith([Permission.LmsTaskRead]));
    permissionsSignal.set([Permission.LmsTaskRead]);

    const result = run({
      permissions: [Permission.LmsTaskRead, Permission.LmsTaskGrade],
      permissionMode: 'all',
    });

    expect(result).not.toBeTrue();
    expect(mockRouter.createUrlTree).toHaveBeenCalledOnceWith(['/403']);
  });

  it('passes when permissionMode is "all" and the user holds every authority', () => {
    userSignal.set(userWith([Permission.LmsTaskRead, Permission.LmsTaskGrade]));
    permissionsSignal.set([Permission.LmsTaskRead, Permission.LmsTaskGrade]);

    const result = run({
      permissions: [Permission.LmsTaskRead, Permission.LmsTaskGrade],
      permissionMode: 'all',
    });

    expect(result).toBeTrue();
  });

  it('blocks access when the user has no permissions at all (fail-closed)', () => {
    userSignal.set(userWith([]));
    permissionsSignal.set([]);

    const result = run({ permissions: Permission.LmsTaskRead });

    expect(result).not.toBeTrue();
    expect(mockRouter.createUrlTree).toHaveBeenCalledOnceWith(['/403']);
  });
});
