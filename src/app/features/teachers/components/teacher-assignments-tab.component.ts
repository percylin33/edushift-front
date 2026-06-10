import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { PERIOD_TYPE_LABELS } from '@features/academic/models';
import { TeacherDetail } from '../models';
import { TeacherAssignmentsStore } from '../store';
import { CreateAssignmentModalComponent } from './create-assignment-modal.component';

/**
 * Sub-componente del tab "Asignaciones" en
 * {@code teacher-detail}. Aísla el slice {@link TeacherAssignmentsStore}
 * para que el padre solo se preocupe del shell del detail.
 *
 * <h3>Responsabilidades</h3>
 * <ul>
 *   <li>Carga el listado al inicializarse + permite alternar entre
 *       <em>Activas</em> e <em>Histórico</em>.</li>
 *   <li>Renderiza la tabla con los chips de curso y periodo, y la
 *       fecha de cierre (cuando aplica).</li>
 *   <li>Acciones: <em>Nueva asignación</em> (abre modal de creación)
 *       y <em>Finalizar</em> con confirm (soft-end).</li>
 * </ul>
 */
@Component({
  selector: 'app-teacher-assignments-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    IconComponent,
    SpinnerComponent,
    CreateAssignmentModalComponent
  ],
  template: `
    <section class="card">
      <header class="card-header">
        <div>
          <h3 class="card-title">Asignaciones</h3>
          <p class="card-description">
            Vincula a {{ teacher().fullName }} con
            <em>(sección, curso, periodo)</em>. Las asignaciones cerradas
            quedan en histórico para reportes.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <div class="btn-group" role="tablist" aria-label="Filtro estado">
            <button
              type="button"
              class="btn btn-sm"
              [class.btn-primary]="showActiveOnly()"
              [class.btn-ghost]="!showActiveOnly()"
              (click)="setActive(true)"
            >
              Activas
            </button>
            <button
              type="button"
              class="btn btn-sm"
              [class.btn-primary]="!showActiveOnly()"
              [class.btn-ghost]="showActiveOnly()"
              (click)="setActive(false)"
            >
              Histórico
            </button>
          </div>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            [disabled]="saving()"
            (click)="openCreate()"
          >
            <app-icon name="plus" [size]="14" />
            <span>Nueva asignación</span>
          </button>
        </div>
      </header>

      <div class="card-body">
        @if (loading()) {
          <div class="flex items-center justify-center py-10">
            <app-spinner [size]="24" label="Cargando asignaciones…" />
          </div>
        } @else if (errorMessage()) {
          <div class="alert alert-danger">
            <app-icon name="alert-circle" [size]="18" />
            <p class="flex-1 text-sm">{{ errorMessage() }}</p>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              (click)="reload()"
            >
              Reintentar
            </button>
          </div>
        } @else if (rows().length === 0) {
          <div class="py-10 text-center">
            <app-icon
              name="layers"
              [size]="32"
              class="mx-auto mb-3 text-content-subtle"
            />
            <p class="text-sm font-medium text-content">
              @if (showActiveOnly()) {
                Sin asignaciones activas
              } @else {
                Sin asignaciones en el histórico
              }
            </p>
            <p class="mt-1 text-xs text-content-muted max-w-md mx-auto">
              @if (showActiveOnly()) {
                Crea una nueva asignación para que {{ teacher().firstName }}
                aparezca en la planificación de la sección elegida.
              } @else {
                Las asignaciones que se finalicen quedarán visibles aquí.
              }
            </p>
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col">Sección</th>
                  <th scope="col">Curso</th>
                  <th scope="col">Periodo</th>
                  <th scope="col">Inicio</th>
                  <th scope="col">Fin</th>
                  <th scope="col" class="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (a of rows(); track a.publicUuid) {
                  <tr>
                    <td class="font-medium">{{ a.sectionName }}</td>
                    <td>
                      <span class="font-mono text-xs">{{ a.courseCode }}</span>
                      <span class="text-content-muted"> · </span>
                      <span>{{ a.courseName }}</span>
                    </td>
                    <td>
                      <span class="badge badge-secondary">
                        {{ periodLabel(a) }}
                      </span>
                    </td>
                    <td>
                      <span class="text-xs text-content-muted">
                        {{ a.assignedAt ? (a.assignedAt | date: 'mediumDate') : '—' }}
                      </span>
                    </td>
                    <td>
                      @if (a.unassignedAt) {
                        <span class="text-xs text-content-muted">
                          {{ a.unassignedAt | date: 'mediumDate' }}
                        </span>
                      } @else {
                        <span class="badge badge-success">Activa</span>
                      }
                    </td>
                    <td class="text-right">
                      <div class="flex justify-end gap-1">
                        <a
                          [routerLink]="evaluationsRoute(a.publicUuid)"
                          class="btn btn-ghost btn-xs"
                          title="Ver evaluaciones de esta asignación"
                        >
                          <app-icon name="target" [size]="14" />
                          <span>Evaluaciones</span>
                        </a>
                        @if (a.active) {
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs text-danger-600 hover:bg-danger-50"
                            [disabled]="saving()"
                            (click)="onSoftEnd(a.publicUuid, a.sectionName, a.courseCode)"
                          >
                            <app-icon name="x" [size]="14" />
                            <span>Finalizar</span>
                          </button>
                        } @else {
                          <span class="text-xs text-content-muted">cerrada</span>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </section>

    @if (showCreate()) {
      <app-create-assignment-modal
        [teacher]="teacher()"
        (closed)="closeCreate()"
        (created)="onCreated()"
      />
    }
  `
})
export class TeacherAssignmentsTabComponent implements OnInit {
  private readonly store = inject(TeacherAssignmentsStore);

  readonly teacher = input.required<TeacherDetail>();

  protected evaluationsRoute(assignmentPublicUuid: string): string {
    return ROUTES.EVALUATIONS.byAssignment(assignmentPublicUuid);
  }

  protected readonly rows = this.store.assignments;
  protected readonly loading = this.store.loading;
  protected readonly saving = this.store.saving;
  protected readonly errorMessage = this.store.error;

  protected readonly showActiveOnly = computed<boolean>(
    () => this.store.filters().active !== false
  );

  protected readonly showCreate = signal<boolean>(false);

  async ngOnInit(): Promise<void> {
    await this.store.loadAssignmentsFor(this.teacher().publicUuid, {
      active: true
    });
  }

  protected periodLabel(a: { periodType: keyof typeof PERIOD_TYPE_LABELS; periodOrdinal: number }): string {
    return `${PERIOD_TYPE_LABELS[a.periodType]} ${a.periodOrdinal}`;
  }

  protected async setActive(active: boolean): Promise<void> {
    if (this.showActiveOnly() === active) return;
    await this.store.setActiveFilter(active);
  }

  protected async reload(): Promise<void> {
    this.store.clearError();
    await this.store.loadAssignmentsFor(
      this.teacher().publicUuid,
      this.store.filters()
    );
  }

  protected openCreate(): void {
    this.store.clearError();
    this.showCreate.set(true);
  }

  protected closeCreate(): void {
    this.showCreate.set(false);
  }

  protected onCreated(): void {
    this.showCreate.set(false);
  }

  protected async onSoftEnd(
    publicUuid: string,
    sectionName: string,
    courseCode: string
  ): Promise<void> {
    const ok = confirm(
      `¿Finalizar la asignación de ${courseCode} en ${sectionName}?\n\n` +
        'La row quedará en el histórico (status terminado) y dejará de\n' +
        'aparecer en la lista de asignaciones activas.'
    );
    if (!ok) return;
    await this.store.softEnd(publicUuid);
  }
}
