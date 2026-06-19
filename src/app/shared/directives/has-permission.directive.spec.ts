import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '@core/services';
import { Permission } from '@core/enums';
import { HasPermissionDirective } from './has-permission.directive';

/**
 * Spec de la directiva estructural `*hasPermission` (FE-7a.4).
 *
 * <p>Cubre los escenarios de aceptación del sprint:
 * <ol>
 *   <li>STUDENT sin LMS_TASK_GRADE → el botón "Calificar" no se renderiza.</li>
 *   <li>STUDENT con LMS_TASK_SUBMIT → el botón "Entregar" sí se renderiza.</li>
 *   <li>TEACHER con LMS_TASK_GRADE → el botón "Calificar" sí se renderiza.</li>
 *   <li>Sintaxis con `Permission[]` (ANY_OF).</li>
 *   <li>Modo `hasPermissionMode="all"` exige la conjunción.</li>
 *   <li>Cambio reactivo en `AuthService.user()` actualiza la vista
 *       (login, role bump, silent refresh).</li>
 * </ol>
 */
describe('HasPermissionDirective', () => {
  let permissionsSignal: ReturnType<typeof signal<Permission[]>>;
  let userSignal: ReturnType<typeof signal<{ email: string } | null>>;
  let fixture: ComponentFixture<HostComponent>;
  let component: HostComponent;

  function recompile(): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        {
          provide: AuthService,
          useValue: {
            user: userSignal.asReadonly(),
            permissions: permissionsSignal.asReadonly()
          }
        }
      ]
    });
    fixture = TestBed.createComponent(HostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    userSignal = signal<{ email: string } | null>({ email: 'test@edushift.app' });
    permissionsSignal = signal<Permission[]>([]);
  });

  it('hides the host element when the user does not own the required authority', () => {
    permissionsSignal.set([Permission.LmsTaskRead]);

    recompile();

    expect(fixture.nativeElement.querySelector('[data-test="grade"]')).toBeNull();
  });

  it('shows the host element when the user owns the required authority', () => {
    permissionsSignal.set([Permission.LmsTaskGrade]);

    recompile();

    expect(fixture.nativeElement.querySelector('[data-test="grade"]')).not.toBeNull();
  });

  it('supports an array of authorities in ANY_OF mode (default)', () => {
    permissionsSignal.set([Permission.LmsTaskSubmit]);

    recompile();

    expect(fixture.nativeElement.querySelector('[data-test="submit"]')).not.toBeNull();
  });

  it('requires ALL listed authorities when mode is "all"', () => {
    permissionsSignal.set([Permission.LmsTaskRead]);

    recompile();

    expect(fixture.nativeElement.querySelector('[data-test="rubric"]')).toBeNull();
  });

  it('renders when the user holds all the authorities in mode "all"', () => {
    permissionsSignal.set([Permission.LmsTaskRead, Permission.LmsTaskGrade]);

    recompile();

    expect(fixture.nativeElement.querySelector('[data-test="rubric"]')).not.toBeNull();
  });

  it('reacts to a runtime change in the auth state (login, role bump, silent refresh)', () => {
    permissionsSignal.set([Permission.LmsTaskRead]);
    recompile();

    expect(fixture.nativeElement.querySelector('[data-test="grade"]')).toBeNull();

    /* Simulate a role bump (e.g., student promoted to teacher with grading rights). */
    permissionsSignal.set([Permission.LmsTaskRead, Permission.LmsTaskGrade]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test="grade"]')).not.toBeNull();

    /* And the reverse: a logout tears the view down. */
    permissionsSignal.set([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test="grade"]')).toBeNull();
  });
});

/**
 * Host de pruebas con tres botones gobernados por la directiva.
 * - "grade"   → LMS_TASK_GRADE  (TEACHER / ADMIN)
 * - "submit"  → LMS_TASK_SUBMIT (STUDENT / PARENT)
 * - "rubric"  → LMS_TASK_READ + LMS_TASK_GRADE (ALL_OF, TEACHER)
 */
@Component({
  selector: 'app-host',
  standalone: true,
  imports: [HasPermissionDirective],
  template: `
    <button *appHasPermission="permission.LmsTaskGrade" data-test="grade">Calificar</button>
    <button
      *appHasPermission="[permission.LmsTaskSubmit, permission.LmsTaskGrade]"
      data-test="submit"
    >
      Entregar
    </button>
    <button
      *appHasPermission="[permission.LmsTaskRead, permission.LmsTaskGrade]; mode: 'all'"
      data-test="rubric"
    >
      Ver rúbrica
    </button>
  `
})
class HostComponent {
  protected readonly permission = Permission;
}
