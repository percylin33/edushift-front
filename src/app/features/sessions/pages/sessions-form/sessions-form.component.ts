import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import {
  PageContainerComponent,
  PageHeaderComponent,
  IconComponent,
  SpinnerComponent,
} from '@shared/components';
import { RouterLink } from '@angular/router';
import { SessionsApiService } from '../../services';
import { AcademicApiService } from '@features/academic/services';
import {
  CreateLearningSessionRequest,
  UpdateLearningSessionRequest,
  LearningSessionDetail,
  SessionStatus,
} from '../../models';

/**
 * `/learning-sessions/new` y `/learning-sessions/:id/edit`
 *
 * <h3>Características</h3>
 * <ul>
 *   <li>Cascada: Asignación → Unidad → Competencias (multi-select).</li>
 *   <li>Editor de contenido: Objetivo, Actividades (lista dinámica),
 *       Materiales (lista dinámica) y Observaciones.</li>
 *   <li>Modo solo lectura si el estado es COMPLETED o CANCELLED.</li>
 *   <li>Botones de lifecycle (Iniciar, Completar, Cancelar) en modo edición.</li>
 * </ul>
 */
@Component({
  selector: 'app-sessions-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    PageContainerComponent,
    PageHeaderComponent,
    IconComponent,
    SpinnerComponent,
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header
        eyebrow="Sesiones de Aprendizaje"
        [title]="isEdit() ? 'Editar Sesión' : 'Nueva Sesión'"
        [subtitle]="
          isReadOnly()
            ? 'Esta sesión ya fue completada o cancelada y no puede editarse.'
            : 'Planifica el detalle pedagógico de la sesión.'
        "
      >
        <a [routerLink]="ROUTES.SESSIONS.LIST" class="btn btn-ghost btn-sm">
          <app-icon name="arrow-left" [size]="16" />
          <span>Volver</span>
        </a>
        @if (!isReadOnly() && !saving()) {
          <button
            type="button"
            class="btn btn-primary btn-sm"
            [disabled]="form.invalid"
            (click)="onSubmit()"
          >
            <app-icon name="check" [size]="16" />
            <span>{{ isEdit() ? 'Guardar Cambios' : 'Crear Sesión' }}</span>
          </button>
        }
      </app-page-header>

      @if (loading()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando datos…" />
        </div>
      } @else {
        <form [formGroup]="form" class="grid gap-6">
          <!-- Datos Generales -->
          <section class="card">
            <header class="card-header">
              <h3 class="card-title">Datos Generales</h3>
            </header>
            <div class="card-body grid gap-4 sm:grid-cols-2">
              <div class="field sm:col-span-2">
                <label class="label">Asignación (Docente - Curso - Sección) *</label>
                <select
                  class="input"
                  formControlName="assignmentUuid"
                  [disabled]="isEdit() || isReadOnly()"
                >
                  <option value="">Selecciona una asignación...</option>
                  @for (a of assignments(); track a.publicUuid) {
                    <option [value]="a.publicUuid">
                      {{ a.teacherFullName }} — {{ a.courseCode }} ({{ a.sectionName }})
                    </option>
                  }
                </select>
                @if (form.get('assignmentUuid')?.invalid && form.get('assignmentUuid')?.touched) {
                  <p class="field-error">Campo requerido.</p>
                }
              </div>

              <div class="field">
                <label class="label">Unidad de Aprendizaje *</label>
                <select
                  class="input"
                  formControlName="unitUuid"
                  [disabled]="!selectedCourseUuid() || isReadOnly()"
                >
                  <option value="">Selecciona una unidad...</option>
                  @for (u of units(); track u.publicUuid) {
                    <option [value]="u.publicUuid">{{ u.displayOrder }}. {{ u.name }}</option>
                  }
                </select>
                @if (form.get('unitUuid')?.invalid && form.get('unitUuid')?.touched) {
                  <p class="field-error">Campo requerido.</p>
                }
              </div>

              <div class="field">
                <label class="label">Fecha Programada *</label>
                <input
                  type="date"
                  class="input"
                  formControlName="scheduledDate"
                  [disabled]="isReadOnly()"
                />
                @if (form.get('scheduledDate')?.invalid && form.get('scheduledDate')?.touched) {
                  <p class="field-error">Campo requerido.</p>
                }
              </div>

              <div class="field sm:col-span-2">
                <label class="label">Título de la Sesión *</label>
                <input
                  type="text"
                  class="input"
                  formControlName="title"
                  placeholder="Ej: Introducción a las fracciones"
                  [disabled]="isReadOnly()"
                />
                @if (form.get('title')?.invalid && form.get('title')?.touched) {
                  <p class="field-error">Campo requerido.</p>
                }
              </div>

              <div class="field">
                <label class="label">Duración (minutos) *</label>
                <input
                  type="number"
                  class="input"
                  formControlName="durationMinutes"
                  min="1"
                  max="480"
                  [disabled]="isReadOnly()"
                />
                @if (form.get('durationMinutes')?.invalid && form.get('durationMinutes')?.touched) {
                  <p class="field-error">Valor entre 1 y 480.</p>
                }
              </div>
            </div>
          </section>

          <!-- Competencias y Capacidades -->
          <section class="card">
            <header class="card-header">
              <h3 class="card-title">Competencias y Capacidades</h3>
            </header>
            <div class="card-body">
              <p class="mb-3 text-sm text-content-muted">
                Selecciona las competencias y sus capacidades específicas que se trabajarán en esta
                sesión.
              </p>

              @if (!selectedCourseUuid()) {
                <p class="text-sm italic text-content-muted">Selecciona una asignación primero.</p>
              } @else {
                <div class="space-y-4">
                  @for (comp of competencies(); track comp.publicUuid) {
                    <div class="rounded border border-border-subtle bg-surface-subtle p-3">
                      <label class="flex items-start gap-2 font-medium text-content">
                        <input
                          type="checkbox"
                          class="form-checkbox mt-1"
                          [value]="comp.publicUuid"
                          [checked]="isCompetencySelected(comp.publicUuid)"
                          (change)="toggleCompetency(comp.publicUuid, $event)"
                          [disabled]="isReadOnly()"
                        />
                        <span>{{ comp.code }} — {{ comp.name }}</span>
                      </label>

                      @if (isCompetencySelected(comp.publicUuid) && comp.capacities.length > 0) {
                        <div class="ml-6 mt-2 space-y-1 border-l-2 border-border-subtle pl-3">
                          @for (cap of comp.capacities; track cap.publicUuid) {
                            <label class="flex items-center gap-2 text-sm text-content-muted">
                              <input
                                type="checkbox"
                                class="form-checkbox"
                                [value]="cap.publicUuid"
                                [checked]="isCapacitySelected(cap.publicUuid)"
                                (change)="toggleCapacity(cap.publicUuid, $event)"
                                [disabled]="isReadOnly()"
                              />
                              <span>{{ cap.code }} — {{ cap.name }}</span>
                            </label>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </section>

          <!-- Contenido Pedagógico -->
          <section class="card">
            <header class="card-header">
              <h3 class="card-title">Contenido Pedagógico</h3>
            </header>
            <div class="card-body grid gap-4">
              <div class="field">
                <label class="label">Objetivo de Aprendizaje *</label>
                <textarea
                  class="input"
                  rows="3"
                  formControlName="objective"
                  placeholder="¿Qué lograrán los estudiantes al final de la sesión?"
                  [disabled]="isReadOnly()"
                ></textarea>
                @if (form.get('objective')?.invalid && form.get('objective')?.touched) {
                  <p class="field-error">Campo requerido.</p>
                }
              </div>

              <div class="field">
                <label class="label">Actividades</label>
                <div formArrayName="activities" class="space-y-2">
                  @for (activity of activitiesArray.controls; let i = $index; track i) {
                    <div class="flex gap-2">
                      <input
                        type="text"
                        class="input flex-1"
                        [formControlName]="i"
                        placeholder="Ej: Dinámica grupal de 15 min"
                        [disabled]="isReadOnly()"
                      />
                      @if (!isReadOnly()) {
                        <button
                          type="button"
                          class="btn btn-ghost btn-sm text-red-600"
                          (click)="removeActivity(i)"
                        >
                          <app-icon name="trash-2" [size]="16" />
                        </button>
                      }
                    </div>
                  }
                </div>
                @if (!isReadOnly()) {
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm mt-2 text-primary-600"
                    (click)="addActivity()"
                  >
                    <app-icon name="plus" [size]="16" />
                    <span>Añadir actividad</span>
                  </button>
                }
              </div>

              <div class="field">
                <label class="label">Materiales y Recursos</label>
                <div formArrayName="materials" class="space-y-2">
                  @for (material of materialsArray.controls; let i = $index; track i) {
                    <div class="flex gap-2">
                      <input
                        type="text"
                        class="input flex-1"
                        [formControlName]="i"
                        placeholder="Ej: Proyector, fichas impresas"
                        [disabled]="isReadOnly()"
                      />
                      @if (!isReadOnly()) {
                        <button
                          type="button"
                          class="btn btn-ghost btn-sm text-red-600"
                          (click)="removeMaterial(i)"
                        >
                          <app-icon name="trash-2" [size]="16" />
                        </button>
                      }
                    </div>
                  }
                </div>
                @if (!isReadOnly()) {
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm mt-2 text-primary-600"
                    (click)="addMaterial()"
                  >
                    <app-icon name="plus" [size]="16" />
                    <span>Añadir material</span>
                  </button>
                }
              </div>

              <div class="field">
                <label class="label">Observaciones</label>
                <textarea
                  class="input"
                  rows="2"
                  formControlName="observations"
                  placeholder="Notas adicionales para el docente..."
                  [disabled]="isReadOnly()"
                ></textarea>
              </div>
            </div>
          </section>

          @if (errorMessage()) {
            <div class="alert alert-danger">
              <app-icon name="alert-circle" [size]="18" />
              <p class="flex-1 text-sm">{{ errorMessage() }}</p>
            </div>
          }
        </form>
      }
    </app-page-container>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .field-error {
        @apply mt-1 text-xs text-red-600;
      }
    `,
  ],
})
export class SessionsFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(SessionsApiService);
  private readonly academicApi = inject(AcademicApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly ROUTES = ROUTES;

  protected readonly form: FormGroup = this.fb.group({
    assignmentUuid: ['', Validators.required],
    unitUuid: ['', Validators.required],
    scheduledDate: ['', Validators.required],
    title: ['', [Validators.required, Validators.maxLength(200)]],
    durationMinutes: [90, [Validators.required, Validators.min(1), Validators.max(480)]],
    objective: ['', Validators.required],
    observations: [''],
    activities: this.fb.array([]),
    materials: this.fb.array([]),
  });

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly assignments = signal<any[]>([]);
  protected readonly units = signal<any[]>([]);
  protected readonly competencies = signal<any[]>([]);

  protected readonly selectedSession = signal<LearningSessionDetail | null>(null);
  protected readonly selectedCompetencies = signal<Set<string>>(new Set());
  protected readonly selectedCapacities = signal<Set<string>>(new Set());

  protected readonly isEdit = computed(() => !!this.selectedSession());
  protected readonly isReadOnly = computed(() => {
    const status = this.selectedSession()?.status;
    return status === SessionStatus.COMPLETED || status === SessionStatus.CANCELLED;
  });

  protected readonly selectedCourseUuid = computed(() => {
    const assignmentUuid = this.form.get('assignmentUuid')?.value;
    const assignment = this.assignments().find((a: any) => a.publicUuid === assignmentUuid);
    return assignment?.coursePublicUuid || null;
  });

  get activitiesArray(): FormArray {
    return this.form.get('activities') as FormArray;
  }

  get materialsArray(): FormArray {
    return this.form.get('materials') as FormArray;
  }

  async ngOnInit(): Promise<void> {
    await this.loadAssignments();

    const sessionId = this.route.snapshot.paramMap.get('id');
    if (sessionId) {
      await this.loadSession(sessionId);
    }

    // Escuchar cambios en la asignación para cargar unidades y competencias
    this.form.get('assignmentUuid')?.valueChanges.subscribe((assignmentUuid) => {
      if (assignmentUuid) {
        const assignment = this.assignments().find((a) => a.publicUuid === assignmentUuid);
        if (assignment?.courseUuid) {
          this.loadUnits(assignment.courseUuid);
          this.loadCompetencies(assignment.courseUuid);
          this.form.get('unitUuid')?.setValue('');
          this.selectedCompetencies.set(new Set());
          this.selectedCapacities.set(new Set());
        }
      } else {
        this.units.set([]);
        this.competencies.set([]);
        this.form.get('unitUuid')?.setValue('');
      }
    });
  }

  private async loadAssignments(): Promise<void> {
    try {
      const data = await firstValueFrom(this.academicApi.listAssignments({ activeOnly: true }));
      this.assignments.set(data);
    } catch (err) {
      this.errorMessage.set('Error al cargar asignaciones');
    }
  }

  private async loadUnits(courseUuid: string): Promise<void> {
    try {
      const data = await firstValueFrom(this.academicApi.listUnits(courseUuid));
      this.units.set(data.filter((u: any) => u.isActive));
    } catch (err) {
      this.errorMessage.set('Error al cargar unidades');
    }
  }

  private async loadCompetencies(courseUuid: string): Promise<void> {
    try {
      const data = await firstValueFrom(this.academicApi.listCompetencies(courseUuid));
      this.competencies.set(data.filter((c: any) => c.isActive));
    } catch (err) {
      this.errorMessage.set('Error al cargar competencias');
    }
  }

  private async loadSession(publicUuid: string): Promise<void> {
    this.loading.set(true);
    try {
      const session = await firstValueFrom(this.api.getSession(publicUuid));
      this.selectedSession.set(session);

      this.form.patchValue({
        assignmentUuid: session.assignment.publicUuid,
        unitUuid: session.unit.publicUuid,
        scheduledDate: session.scheduledDate.toISOString().split('T')[0],
        title: session.title,
        durationMinutes: session.durationMinutes,
        objective: session.content.objective,
        observations: session.content.observations,
      });

      // Cargar actividades
      this.activitiesArray.clear();
      session.content.activities.forEach((act) => {
        this.activitiesArray.push(this.fb.control(act));
      });

      // Cargar materiales
      this.materialsArray.clear();
      session.content.materials.forEach((mat) => {
        this.materialsArray.push(this.fb.control(mat));
      });

      // Seleccionar competencias y capacidades
      const compSet = new Set<string>();
      const capSet = new Set<string>();
      session.competencies.forEach((c) => compSet.add(c.publicUuid));
      session.capacities.forEach((c) => capSet.add(c.publicUuid));
      this.selectedCompetencies.set(compSet);
      this.selectedCapacities.set(capSet);

      // Forzar la carga de unidades y competencias de este curso
      await this.loadUnits(session.assignment.course.publicUuid);
      await this.loadCompetencies(session.assignment.course.publicUuid);
    } catch (err) {
      this.errorMessage.set('Error al cargar la sesión');
    } finally {
      this.loading.set(false);
    }
  }

  protected addActivity(): void {
    this.activitiesArray.push(this.fb.control(''));
  }

  protected removeActivity(index: number): void {
    this.activitiesArray.removeAt(index);
  }

  protected addMaterial(): void {
    this.materialsArray.push(this.fb.control(''));
  }

  protected removeMaterial(index: number): void {
    this.materialsArray.removeAt(index);
  }

  protected isCompetencySelected(publicUuid: string): boolean {
    return this.selectedCompetencies().has(publicUuid);
  }

  protected isCapacitySelected(publicUuid: string): boolean {
    return this.selectedCapacities().has(publicUuid);
  }

  protected toggleCompetency(publicUuid: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const set = new Set(this.selectedCompetencies());
    if (checked) {
      set.add(publicUuid);
    } else {
      set.delete(publicUuid);
      // Deseleccionar capacidades de esta competencia
      const comp = this.competencies().find((c) => c.publicUuid === publicUuid);
      if (comp) {
        const capSet = new Set(this.selectedCapacities());
        comp.capacities.forEach((cap: any) => capSet.delete(cap.publicUuid));
        this.selectedCapacities.set(capSet);
      }
    }
    this.selectedCompetencies.set(set);
  }

  protected toggleCapacity(publicUuid: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const set = new Set(this.selectedCapacities());
    if (checked) {
      set.add(publicUuid);
    } else {
      set.delete(publicUuid);
    }
    this.selectedCapacities.set(set);
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    const payload = {
      assignmentUuid: raw.assignmentUuid,
      unitUuid: raw.unitUuid,
      title: raw.title.trim(),
      objective: raw.objective.trim(),
      scheduledDate: raw.scheduledDate,
      durationMinutes: raw.durationMinutes,
      competencyUuids: Array.from(this.selectedCompetencies()),
      capacityUuids: Array.from(this.selectedCapacities()),
      content: {
        objective: raw.objective.trim(),
        activities: raw.activities.filter((a: string) => a.trim() !== ''),
        materials: raw.materials.filter((m: string) => m.trim() !== ''),
        observations: raw.observations?.trim() || '',
      },
    };

    try {
      if (this.isEdit()) {
        const uuid = this.route.snapshot.paramMap.get('id')!;
        await firstValueFrom(this.api.updateSession(uuid, payload as UpdateLearningSessionRequest));
      } else {
        await firstValueFrom(this.api.createSession(payload as CreateLearningSessionRequest));
      }
      void this.router.navigate([ROUTES.SESSIONS.LIST]);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Error al guardar la sesión');
      this.saving.set(false);
    }
  }
}
