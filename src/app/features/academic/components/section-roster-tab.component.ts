import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { StudentsApiService } from '@features/students/services';
import { SectionStudentRosterItem } from '@features/students/models';

/**
 * Sub-componente del tab "Roster" en {@code section-detail}
 * (FE-4.7 / BE-4.8).
 *
 * <p>Lista los estudiantes con matrícula
 * <strong>ACTIVE</strong> en la sección. Las matrículas terminales
 * (transferred / graduated / withdrawn) son parte del histórico del
 * student y no aparecen aquí.</p>
 */
@Component({
  selector: 'app-section-roster-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, IconComponent, SpinnerComponent],
  template: `
    <section class="card">
      <header class="card-header">
        <div>
          <h3 class="card-title">Roster activo</h3>
          <p class="card-description">
            Estudiantes con matrícula <strong>activa</strong> en esta sección. Para matricular o
            cambiar de sección, ve al detalle del estudiante.
          </p>
        </div>
        <span class="badge badge-secondary">
          {{ rows().length }}
          {{ rows().length === 1 ? 'estudiante' : 'estudiantes' }}
        </span>
      </header>

      <div class="card-body">
        @if (loading()) {
          <div class="flex items-center justify-center py-10">
            <app-spinner [size]="24" label="Cargando roster…" />
          </div>
        } @else if (errorMessage()) {
          <div class="alert alert-danger">
            <app-icon name="alert-circle" [size]="18" />
            <p class="flex-1 text-sm">{{ errorMessage() }}</p>
            <button type="button" class="btn btn-ghost btn-sm" (click)="reload()">
              Reintentar
            </button>
          </div>
        } @else if (rows().length === 0) {
          <div class="py-10 text-center">
            <app-icon name="users" [size]="32" class="mx-auto mb-3 text-content-subtle" />
            <p class="text-sm font-medium text-content">Sin estudiantes matriculados todavía</p>
            <p class="mx-auto mt-1 max-w-md text-xs text-content-muted">
              Las matrículas se crean desde la lista de estudiantes o al editar el detalle de un
              estudiante.
            </p>
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col">Estudiante</th>
                  <th scope="col">Documento</th>
                  <th scope="col">Email</th>
                  <th scope="col">Matriculado el</th>
                </tr>
              </thead>
              <tbody>
                @for (s of rows(); track s.enrollmentPublicUuid) {
                  <tr>
                    <td>
                      <a
                        [routerLink]="studentRoute(s.studentPublicUuid)"
                        class="-mx-2 -my-1 block rounded px-2 py-1 font-medium text-content hover:bg-surface-muted"
                      >
                        {{ s.studentFullName }}
                      </a>
                    </td>
                    <td>
                      <span class="font-mono text-xs">
                        {{ s.studentDocumentType }} · {{ s.studentDocumentNumber }}
                      </span>
                    </td>
                    <td>
                      <span class="text-xs text-content-muted">
                        {{ s.studentEmail || '—' }}
                      </span>
                    </td>
                    <td>
                      <span class="text-xs text-content-muted">
                        {{ s.enrolledAt ? (s.enrolledAt | date: 'mediumDate') : '—' }}
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </section>
  `,
})
export class SectionRosterTabComponent implements OnInit {
  private readonly studentsApi = inject(StudentsApiService);

  readonly sectionPublicUuid = input.required<string>();

  protected readonly rows = signal<SectionStudentRosterItem[]>([]);
  protected readonly loading = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.fetchRoster();
  }

  protected studentRoute(publicUuid: string): string {
    return ROUTES.STUDENTS.detail(publicUuid);
  }

  protected async reload(): Promise<void> {
    this.errorMessage.set(null);
    await this.fetchRoster();
  }

  private async fetchRoster(): Promise<void> {
    this.loading.set(true);
    try {
      const list = await firstValueFrom(
        this.studentsApi.listSectionRoster(this.sectionPublicUuid()),
      );
      this.rows.set(list);
    } catch (err: unknown) {
      this.errorMessage.set(this.extractMessage(err));
      this.rows.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private extractMessage(err: unknown): string {
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      const anyErr = err as {
        message?: unknown;
        error?: { message?: unknown };
      };
      if (typeof anyErr.error?.message === 'string') return anyErr.error.message;
      if (typeof anyErr.message === 'string') return anyErr.message;
    }
    return 'No pudimos cargar el roster.';
  }
}
