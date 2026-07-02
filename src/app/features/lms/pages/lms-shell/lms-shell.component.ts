import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Shell del feature LMS (FE-7a.1).
 *
 * <p>Renderiza el {@code <router-outlet/>} donde las pages de
 * {@code /lms/*} se montan. La barra de acciones (Nueva tarea, etc.)
 * vive en la page {@code TasksListComponent}, no aquí, porque es
 * contextual a la sección abierta. Eso evita duplicar CTAs cuando
 * el usuario navega entre "Mis tareas" y "Tareas del docente" sin
 * salir del shell.
 */
@Component({
  selector: 'app-lms-shell',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl p-6">
      <router-outlet />
    </section>
  `,
})
export class LmsShellComponent {}
