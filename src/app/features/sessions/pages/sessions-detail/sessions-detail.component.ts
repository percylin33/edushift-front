import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import {
  ConfirmDialogService,
  PageContainerComponent,
  PageHeaderComponent,
  IconComponent,
  SpinnerComponent,
} from '@shared/components';
import { RouterLink } from '@angular/router';
import { AcademicApiService } from '@features/academic/services';
import { SessionsApiService } from '../../services';
import {
  LearningSessionDetail,
  SessionStatus,
  SESSION_STATUS_LABELS,
  SESSION_STATUS_BADGE_CLASS,
  LifecycleRequest,
  ApplicationSheetKind,
  ApplicationSheetView,
} from '../../models';

interface GradeAssignment {
  publicUuid: string;
  coursePublicUuid: string;
  academicPeriodPublicUuid: string;
  gradeName?: string | null;
  sectionName?: string;
  courseCode?: string;
  active?: boolean;
}

/**
 * `/learning-sessions/:id`
 *
 * <h3>Características</h3>
 * <ul>
 *   <li>Vista detallada de todos los campos de la sesión.</li>
 *   <li>Botones de lifecycle contextuales: Iniciar, Completar, Cancelar.</li>
 *   <li>Estado COMPLETED o CANCELLED deshabilita las acciones y marca la vista como solo lectura.</li>
 * </ul>
 */
@Component({
  selector: 'app-sessions-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    PageContainerComponent,
    PageHeaderComponent,
    IconComponent,
    SpinnerComponent,
  ],
  template: `
    <app-page-container size="wide">
      @if (loading()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando sesión…" />
        </div>
      } @else if (errorMessage()) {
        <div class="alert alert-danger">
          <app-icon name="alert-circle" [size]="18" />
          <div class="flex-1">
            <p class="font-medium">No pudimos cargar la sesión.</p>
            <p class="mt-1 text-xs opacity-80">{{ errorMessage() }}</p>
          </div>
          <a [routerLink]="ROUTES.SESSIONS.LIST" class="btn btn-ghost btn-sm">Volver</a>
        </div>
      } @else {
        @let s = session();
        <app-page-header
          eyebrow="Sesiones de Aprendizaje"
          [title]="s!.title"
          [subtitle]="
            s!.assignment.course.code +
            ' — ' +
            s!.assignment.section.name +
            ' · ' +
            formatDate(s!.scheduledDate)
          "
        >
          <a [routerLink]="ROUTES.SESSIONS.LIST" class="btn btn-ghost btn-sm" aria-label="Volver">
            <app-icon name="arrow-left" [size]="16" />
            <span aria-hidden="true">Volver</span>
          </a>
          @if (!isTerminal()) {
            <a [routerLink]="editRoute()" class="btn btn-outline btn-sm" aria-label="Editar">
              <app-icon name="edit-2" [size]="16" />
              <span class="hidden sm:inline" aria-hidden="true">Editar</span>
            </a>
          }
        </app-page-header>

        <!-- Estado y Acciones de Lifecycle -->
        <section class="card mb-6">
          <div class="card-body flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <span class="text-sm text-content-muted">Estado actual:</span>
              <span class="badge text-sm" [ngClass]="getStatusBadgeClass(s!.status)">
                {{ getStatusLabel(s!.status) }}
              </span>
            </div>

            @if (!isTerminal()) {
              <div class="flex flex-wrap gap-2">
                @if (s!.status === 'PLANNED') {
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    [disabled]="actionLoading()"
                    (click)="startSession()"
                  >
                    <app-icon name="sparkles" [size]="16" />
                    <span>Iniciar Sesión</span>
                  </button>
                }
                @if (s!.status === 'IN_PROGRESS') {
                  <button
                    type="button"
                    class="btn btn-success btn-sm"
                    [disabled]="actionLoading()"
                    (click)="completeSession()"
                  >
                    <app-icon name="check" [size]="16" />
                    <span>Completar</span>
                  </button>
                }
                <button
                  type="button"
                  class="btn btn-ghost btn-sm text-red-600"
                  [disabled]="actionLoading()"
                  (click)="cancelSession()"
                >
                  <app-icon name="x" [size]="16" />
                  <span>Cancelar</span>
                </button>
              </div>
            } @else {
              <div class="text-sm italic text-content-muted">
                @if (s!.status === 'COMPLETED') {
                  Completada el {{ formatDateTime(s!.endedAt) }}
                } @else if (s!.status === 'CANCELLED') {
                  Cancelada el {{ formatDateTime(s!.cancelledAt) }}
                }
              </div>
            }
          </div>
        </section>

        <section class="card mb-6">
          <div class="card-body grid gap-3">
            <h3 class="text-sm font-semibold">Fichas de aplicación</h3>
            <p class="text-xs text-content-muted">
              Cada grado tiene su propia ficha. El alumno la completa en papel.
            </p>
            @if (sheets().length === 0) {
              <p class="text-sm text-content-muted">Esta sesión todavía no tiene fichas.</p>
            }
            @for (sheet of sheets(); track sheet.kind + sheet.grade) {
              <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div>
                  <p class="text-sm font-medium">{{ sheet.title }}</p>
                  <p class="text-xs text-content-muted">
                    {{ sheet.kind === 'DIAGNOSTIC' ? 'Evaluación diagnóstica' : 'Ficha de aprendizaje' }}
                    · {{ sheet.grade }}
                  </p>
                </div>
                <div class="flex gap-2">
                  <button type="button" class="btn btn-outline btn-sm" [disabled]="actionLoading()" (click)="downloadSheet(sheet)">
                    PDF
                  </button>
                  <button type="button" class="btn btn-ghost btn-sm" [disabled]="actionLoading()" (click)="regenerateSheet(sheet.kind, sheet.grade)">
                    Regenerar
                  </button>
                </div>
              </div>
            }
            <div class="flex flex-wrap items-end gap-2">
              <label class="text-sm">
                Grado
                <input
                  class="input mt-1"
                  [value]="newSheetGrade()"
                  (input)="newSheetGrade.set($any($event.target).value)"
                />
              </label>
              <button type="button" class="btn btn-outline btn-sm" [disabled]="actionLoading()" (click)="regenerateSheet('LEARNING', newSheetGrade())">
                Generar ficha
              </button>
              <button type="button" class="btn btn-ghost btn-sm" [disabled]="actionLoading()" (click)="regenerateSheet('DIAGNOSTIC', newSheetGrade())">
                Generar diagnóstico
              </button>
            </div>
            @if (sheetMessage()) {
              <p class="text-xs text-content-muted">{{ sheetMessage() }}</p>
            }
          </div>
        </section>

        @if (s!.status !== 'CANCELLED') {
          <section class="card mb-6">
            <div class="card-body grid gap-4">
              <label class="flex items-start gap-3">
                <input
                  type="checkbox"
                  class="checkbox mt-1"
                  [checked]="s!.sharedWithGrade"
                  [disabled]="actionLoading()"
                  (change)="toggleShare($any($event.target).checked)"
                />
                <span>
                  <span class="block text-sm font-medium">Compartir con el grado</span>
                  <span class="block text-xs text-content-muted">
                    Otros docentes del mismo curso y grado pueden ver el plan y copiarlo a su
                    sección. Las observaciones no se comparten.
                  </span>
                </span>
              </label>

              @if (siblingAssignments().length > 0) {
                <div class="grid gap-3">
                  <p class="text-sm font-medium">Aplicar a mis otras secciones</p>
                  @for (assignment of siblingAssignments(); track assignment.publicUuid) {
                    <div class="flex flex-wrap items-center gap-3">
                      <label class="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          class="checkbox"
                          [checked]="isSiblingSelected(assignment.publicUuid)"
                          (change)="toggleSibling(assignment.publicUuid, $any($event.target).checked)"
                        />
                        <span>
                          {{ assignment.gradeName }} {{ assignment.sectionName }} ·
                          {{ assignment.courseCode }}
                        </span>
                      </label>
                      <input
                        type="date"
                        class="input w-auto"
                        [value]="siblingDate(assignment.publicUuid)"
                        (change)="setSiblingDate(assignment.publicUuid, $any($event.target).value)"
                      />
                    </div>
                  }
                  <button
                    type="button"
                    class="btn btn-outline btn-sm w-fit"
                    [disabled]="actionLoading() || selectedSiblings().size === 0"
                    (click)="applyToSiblings()"
                  >
                    Aplicar a las secciones elegidas
                  </button>
                  @if (copyMessage()) {
                    <p class="text-sm text-content-muted">{{ copyMessage() }}</p>
                  }
                </div>
              }
            </div>
          </section>
        }

        <!-- Detalles -->
        <div class="grid gap-6 md:grid-cols-3">
          <!-- Columna Izquierda: Metadata -->
          <section class="card md:col-span-1">
            <header class="card-header">
              <h3 class="card-title">Información General</h3>
            </header>
            <dl class="card-body grid grid-cols-1 gap-y-3 text-sm">
              <div>
                <dt class="text-xs uppercase text-content-muted">Docente</dt>
                <dd class="font-medium">
                  {{ s!.assignment.teacher.firstName }} {{ s!.assignment.teacher.lastName }}
                </dd>
              </div>
              <div>
                <dt class="text-xs uppercase text-content-muted">Curso</dt>
                <dd class="font-medium">
                  {{ s!.assignment.course.code }} — {{ s!.assignment.course.name }}
                </dd>
              </div>
              <div>
                <dt class="text-xs uppercase text-content-muted">Sección</dt>
                <dd class="font-medium">{{ s!.assignment.section.name }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase text-content-muted">Periodo</dt>
                <dd class="font-medium">
                  {{ s!.assignment.period.name }} ({{ s!.assignment.period.periodType }}
                  {{ s!.assignment.period.ordinal }})
                </dd>
              </div>
              <div>
                <dt class="text-xs uppercase text-content-muted">Unidad</dt>
                <dd class="font-medium">{{ s!.unit.displayOrder }}. {{ s!.unit.name }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase text-content-muted">Duración</dt>
                <dd class="font-medium">{{ s!.durationMinutes }} minutos</dd>
              </div>
            </dl>
          </section>

          <!-- Columna Derecha: Contenido Pedagógico -->
          <section class="card md:col-span-2">
            <header class="card-header">
              <h3 class="card-title">Contenido Pedagógico</h3>
            </header>
            <div class="card-body space-y-6">
              <div>
                <h4 class="mb-2 text-sm font-semibold uppercase text-content-muted">
                  Objetivo de Aprendizaje
                </h4>
                <p class="whitespace-pre-wrap text-sm text-content">
                  {{ s!.content.objective || '—' }}
                </p>
              </div>

              <div>
                <h4 class="mb-2 text-sm font-semibold uppercase text-content-muted">
                  Competencias y Capacidades
                </h4>
                @if (s!.competencies.length === 0) {
                  <p class="text-sm italic text-content-muted">No se seleccionaron competencias.</p>
                } @else {
                  <ul class="space-y-2">
                    @for (comp of s!.competencies; track comp.publicUuid) {
                      <li class="rounded border border-border-subtle bg-surface-subtle p-2">
                        <p class="text-sm font-medium text-content">
                          {{ comp.code }} — {{ comp.name }}
                        </p>
                        @if (getCapacitiesForCompetency(comp.publicUuid).length > 0) {
                          <ul class="ml-4 mt-1 space-y-1 border-l-2 border-border-subtle pl-3">
                            @for (
                              cap of getCapacitiesForCompetency(comp.publicUuid);
                              track cap.publicUuid
                            ) {
                              <li class="text-xs text-content-muted">
                                {{ cap.code }} — {{ cap.name }}
                              </li>
                            }
                          </ul>
                        }
                      </li>
                    }
                  </ul>
                }
              </div>

              <div>
                <h4 class="mb-2 text-sm font-semibold uppercase text-content-muted">Actividades</h4>
                @if (s!.content.activities.length === 0) {
                  <p class="text-sm italic text-content-muted">No se registraron actividades.</p>
                } @else {
                  <ul class="list-disc space-y-1 pl-5 text-sm text-content">
                    @for (act of s!.content.activities; track act) {
                      <li>{{ act }}</li>
                    }
                  </ul>
                }
              </div>

              <div>
                <h4 class="mb-2 text-sm font-semibold uppercase text-content-muted">
                  Materiales y Recursos
                </h4>
                @if (s!.content.materials.length === 0) {
                  <p class="text-sm italic text-content-muted">No se registraron materiales.</p>
                } @else {
                  <ul class="list-disc space-y-1 pl-5 text-sm text-content">
                    @for (mat of s!.content.materials; track mat) {
                      <li>{{ mat }}</li>
                    }
                  </ul>
                }
              </div>

              @if (s!.content.observations) {
                <div>
                  <h4 class="mb-2 text-sm font-semibold uppercase text-content-muted">
                    Observaciones
                  </h4>
                  <p class="whitespace-pre-wrap rounded bg-surface-subtle p-3 text-sm text-content">
                    {{ s!.content.observations }}
                  </p>
                </div>
              }
            </div>
          </section>
        </div>
      }
    </app-page-container>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class SessionsDetailComponent implements OnInit {
  private readonly api = inject(SessionsApiService);
  private readonly academicApi = inject(AcademicApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly ROUTES = ROUTES;

  protected readonly session = signal<LearningSessionDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly actionLoading = signal(false);
  protected readonly siblingAssignments = signal<GradeAssignment[]>([]);
  protected readonly selectedSiblings = signal<Set<string>>(new Set());
  protected readonly siblingDates = signal<Record<string, string>>({});
  protected readonly copyMessage = signal<string | null>(null);
  protected readonly sheets = signal<ApplicationSheetView[]>([]);
  protected readonly newSheetGrade = signal('');
  protected readonly sheetMessage = signal<string | null>(null);

  protected readonly isTerminal = computed(() => {
    const status = this.session()?.status;
    return status === SessionStatus.COMPLETED || status === SessionStatus.CANCELLED;
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      await this.loadSession(id);
    } else {
      void this.router.navigate([ROUTES.SESSIONS.LIST]);
    }
  }

  private async loadSession(publicUuid: string): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const data = await firstValueFrom(this.api.getSession(publicUuid));
      this.session.set(data);
      this.newSheetGrade.set(data.assignment.section.gradeName?.trim() ?? '');
      await this.loadSheets(publicUuid);
      await this.loadSiblingAssignments(data);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Error de red');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadSheets(publicUuid: string): Promise<void> {
    try {
      const rows = await firstValueFrom(this.api.listApplicationSheets(publicUuid));
      this.sheets.set(rows);
    } catch {
      this.sheets.set([]);
    }
  }

  protected async regenerateSheet(kind: ApplicationSheetKind, grade: string): Promise<void> {
    const session = this.session();
    const trimmed = grade.trim();
    if (!session || !trimmed) {
      this.sheetMessage.set('Escribe el grado de la ficha.');
      return;
    }
    this.actionLoading.set(true);
    this.sheetMessage.set(null);
    try {
      await firstValueFrom(
        this.api.generateStoredApplicationSheet(session.publicUuid, { kind, grade: trimmed }),
      );
      await this.loadSheets(session.publicUuid);
      this.sheetMessage.set('Ficha lista para este grado.');
    } catch (err) {
      this.sheetMessage.set(err instanceof Error ? err.message : 'No se pudo generar la ficha.');
    } finally {
      this.actionLoading.set(false);
    }
  }

  protected async downloadSheet(sheet: ApplicationSheetView): Promise<void> {
    const session = this.session();
    if (!session) return;
    this.actionLoading.set(true);
    try {
      const blob = await firstValueFrom(
        this.api.downloadApplicationSheet(session.publicUuid, sheet.kind, sheet.grade),
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ficha-${sheet.grade}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      this.sheetMessage.set('No se pudo descargar el PDF.');
    } finally {
      this.actionLoading.set(false);
    }
  }

  private async loadSiblingAssignments(session: LearningSessionDetail): Promise<void> {
    try {
      const rows = (await firstValueFrom(
        this.academicApi.listAssignments({ activeOnly: true }),
      )) as GradeAssignment[];
      const siblings = rows.filter(
        (row) =>
          row.active !== false &&
          row.publicUuid !== session.assignment.publicUuid &&
          row.coursePublicUuid === session.assignment.course.publicUuid &&
          row.academicPeriodPublicUuid === session.assignment.period.publicUuid &&
          (row.gradeName ?? '') === (session.assignment.section.gradeName ?? ''),
      );
      const dates: Record<string, string> = {};
      for (const row of siblings) {
        dates[row.publicUuid] = this.isoDate(session.scheduledDate);
      }
      this.siblingAssignments.set(siblings);
      this.siblingDates.set(dates);
      this.selectedSiblings.set(new Set());
    } catch {
      this.siblingAssignments.set([]);
    }
  }

  protected isSiblingSelected(publicUuid: string): boolean {
    return this.selectedSiblings().has(publicUuid);
  }

  protected toggleSibling(publicUuid: string, selected: boolean): void {
    const next = new Set(this.selectedSiblings());
    if (selected) next.add(publicUuid);
    else next.delete(publicUuid);
    this.selectedSiblings.set(next);
  }

  protected siblingDate(publicUuid: string): string {
    return this.siblingDates()[publicUuid] ?? '';
  }

  protected setSiblingDate(publicUuid: string, value: string): void {
    this.siblingDates.set({ ...this.siblingDates(), [publicUuid]: value });
  }

  protected async toggleShare(shared: boolean): Promise<void> {
    const current = this.session();
    if (!current) return;
    this.actionLoading.set(true);
    this.errorMessage.set(null);
    try {
      const updated = await firstValueFrom(
        this.api.updateSession(current.publicUuid, { sharedWithGrade: shared }),
      );
      this.session.set(updated);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'No se pudo compartir la sesión');
    } finally {
      this.actionLoading.set(false);
    }
  }

  protected async applyToSiblings(): Promise<void> {
    const current = this.session();
    if (!current) return;
    const selected = Array.from(this.selectedSiblings());
    if (selected.length === 0) return;
    this.actionLoading.set(true);
    this.copyMessage.set(null);
    this.errorMessage.set(null);
    try {
      const results = await Promise.allSettled(
        selected.map((assignmentUuid) =>
          firstValueFrom(
            this.api.copySession(current.publicUuid, {
              assignmentUuid,
              scheduledDate: this.siblingDate(assignmentUuid),
            }),
          ),
        ),
      );
      const created = results.filter((result) => result.status === 'fulfilled').length;
      const failed = results.length - created;
      this.copyMessage.set(
        failed === 0
          ? `Se crearon ${created} sesiones en las secciones elegidas.`
          : `Se crearon ${created} sesiones. ${failed} no se pudieron copiar.`,
      );
      this.selectedSiblings.set(new Set());
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'No se pudo copiar la sesión');
    } finally {
      this.actionLoading.set(false);
    }
  }

  private isoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  protected editRoute(): string {
    const id = this.route.snapshot.paramMap.get('id');
    return ROUTES.SESSIONS.LIST + `/${id}/edit`;
  }

  protected getStatusLabel(status: SessionStatus): string {
    return SESSION_STATUS_LABELS[status];
  }

  protected getStatusBadgeClass(status: SessionStatus): string {
    return SESSION_STATUS_BADGE_CLASS[status];
  }

  protected formatDate(date: Date): string {
    return date.toLocaleDateString('es', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  protected formatDateTime(date: Date | undefined): string {
    if (!date) return '—';
    return date.toLocaleString('es', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected getCapacitiesForCompetency(competencyUuid: string) {
    return (
      this.session()?.capacities.filter((c) => c.competencyPublicUuid === competencyUuid) || []
    );
  }

  // ===========================================================================
  // Lifecycle Actions
  // ===========================================================================

  protected async startSession(): Promise<void> {
    const ok = await this.confirmDialog.open({
      title: 'Iniciar sesión',
      message: '¿Iniciar esta sesión de aprendizaje?',
      confirmLabel: 'Iniciar',
      variant: 'default',
    });
    if (!ok) return;
    await this.executeLifecycleAction('start');
  }

  protected async completeSession(): Promise<void> {
    const ok = await this.confirmDialog.open({
      title: 'Completar sesión',
      message: '¿Marcar esta sesión como completada?',
      confirmLabel: 'Completar',
      variant: 'warning',
    });
    if (!ok) return;
    await this.executeLifecycleAction('complete');
  }

  protected async cancelSession(): Promise<void> {
    const reason = prompt('Motivo de cancelación (opcional):');
    if (reason === null) return;
    await this.executeLifecycleAction('cancel', reason || undefined);
  }

  private async executeLifecycleAction(
    action: 'start' | 'complete' | 'cancel',
    reason?: string,
  ): Promise<void> {
    const s = this.session();
    if (!s) return;

    this.actionLoading.set(true);
    this.errorMessage.set(null);

    const request: LifecycleRequest = { version: s.version, reason };

    try {
      let updated: LearningSessionDetail;
      if (action === 'start') {
        updated = await firstValueFrom(this.api.startSession(s.publicUuid, request));
      } else if (action === 'complete') {
        updated = await firstValueFrom(this.api.completeSession(s.publicUuid, request));
      } else {
        updated = await firstValueFrom(this.api.cancelSession(s.publicUuid, request));
      }
      this.session.set(updated);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Error al ejecutar la acción');
    } finally {
      this.actionLoading.set(false);
    }
  }
}
