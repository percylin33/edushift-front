import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { AcademicApiService } from '@features/academic/services';
import {
  AcademicYearRow,
  AcademicYearStatus,
  SectionRow
} from '@features/academic/models';
import { StudentDetail } from '../models';
import { StudentsStore } from '../store';

/**
 * Dialog "Matricular en sección" — crea una row en
 * {@code student_enrollments} (BE-4.8).
 *
 * <h3>Modos</h3>
 * El componente cubre dos casos a la vez:
 * <ol>
 *   <li><b>Primera matrícula</b> ({@code activeEnrollment === null}):
 *       el admin elige sección + fecha y dispara
 *       {@link StudentsStore#enrollStudent}.</li>
 *   <li><b>Cambio de sección</b>
 *       (cuando se le pasa {@code activeEnrollmentPublicUuid}): el
 *       dialog hace un dual-write atómico — withdraw {@code TRANSFERRED}
 *       de la matrícula activa + create de la nueva — vía
 *       {@link StudentsStore#transferStudentSection}.</li>
 * </ol>
 *
 * <h3>Validaciones</h3>
 * Cliente: {@code enrolledAt} debe estar dentro del rango del año
 * activo (anticipa 409 {@code ENROLLMENT_DATE_OUT_OF_YEAR}). El
 * backend además rechaza el caso "ya hay una ACTIVE para
 * (student, year)" con 409 {@code STUDENT_ALREADY_ENROLLED}; en modo
 * <em>cambio</em> esto no aplica porque hacemos withdraw antes.
 */
@Component({
  selector: 'app-enroll-student-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IconComponent, SpinnerComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="enroll-title"
      (click)="onBackdropClick($event)"
    >
      <div
        class="card w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]"
        (click)="$event.stopPropagation()"
      >
        <header class="card-header">
          <div>
            <h2 id="enroll-title" class="card-title">
              {{ isTransfer() ? 'Cambiar de sección' : 'Matricular en sección' }}
            </h2>
            <p class="card-description">
              @if (isTransfer()) {
                Mover a {{ student().fullName }} a otra sección. Se cerrará la
                matrícula actual con estado <em>TRANSFERRED</em> y se creará
                una nueva.
              } @else {
                Asignar a {{ student().fullName }} a una sección del año
                académico activo.
              }
            </p>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-icon"
            aria-label="Cerrar"
            (click)="close()"
          >
            <app-icon name="x" [size]="18" />
          </button>
        </header>

        <div class="card-body flex flex-col gap-3 overflow-y-auto">
          @if (errorMessage(); as err) {
            <div class="alert alert-danger">
              <app-icon name="alert-circle" [size]="18" />
              <p class="flex-1 text-sm">{{ err }}</p>
            </div>
          }

          @if (loadingCatalogs()) {
            <div class="flex items-center justify-center py-10">
              <app-spinner [size]="24" label="Cargando catálogos…" />
            </div>
          } @else if (!activeYear()) {
            <div class="alert alert-warning">
              <app-icon name="info" [size]="18" />
              <p class="flex-1 text-sm">
                No hay un año académico <strong>activo</strong>. Activa uno
                desde <em>Académico → Años</em> antes de matricular.
              </p>
            </div>
          } @else if (sections().length === 0) {
            <div class="alert alert-warning">
              <app-icon name="info" [size]="18" />
              <p class="flex-1 text-sm">
                El año {{ activeYear()?.name }} no tiene secciones. Crea al
                menos una desde <em>Académico → Secciones</em>.
              </p>
            </div>
          } @else {
            <div class="field">
              <label class="label" for="enroll-section">
                Sección <span class="text-danger-500">*</span>
              </label>
              <select
                id="enroll-section"
                class="select"
                [ngModel]="sectionUuid()"
                (ngModelChange)="sectionUuid.set($event)"
                [disabled]="saving()"
              >
                <option value="" disabled>Seleccionar sección…</option>
                @for (s of sections(); track s.publicUuid) {
                  <option
                    [value]="s.publicUuid"
                    [disabled]="s.publicUuid === currentSectionUuid()"
                  >
                    {{ s.gradeName }} · {{ s.name }} ({{ s.levelCode }})
                    @if (s.publicUuid === currentSectionUuid()) {
                      — actual
                    }
                  </option>
                }
              </select>
            </div>

            <div class="field">
              <label class="label" for="enroll-date">
                Fecha de matrícula <span class="text-danger-500">*</span>
              </label>
              <input
                id="enroll-date"
                type="date"
                class="input"
                [min]="yearMinDate()"
                [max]="yearMaxDate()"
                [ngModel]="enrolledAt()"
                (ngModelChange)="enrolledAt.set($event)"
                [disabled]="saving()"
              />
              <p class="hint mt-1 text-content-muted text-xs">
                Debe estar dentro del rango del año
                <strong>{{ activeYear()?.name }}</strong>
                ({{ yearMinDate() }} → {{ yearMaxDate() }}).
              </p>
            </div>

            <div class="field">
              <label class="label" for="enroll-notes">
                Notas <span class="text-content-muted text-xs">(opcional)</span>
              </label>
              <textarea
                id="enroll-notes"
                class="input"
                rows="2"
                maxlength="1000"
                [ngModel]="notes()"
                (ngModelChange)="notes.set($event)"
                [disabled]="saving()"
              ></textarea>
            </div>
          }
        </div>

        <footer class="card-footer">
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            [disabled]="saving()"
            (click)="close()"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            [disabled]="!canSubmit() || saving()"
            (click)="onSubmit()"
          >
            @if (saving()) {
              <app-spinner [size]="14" />
            }
            <span>
              {{ isTransfer() ? 'Confirmar cambio' : 'Matricular' }}
            </span>
          </button>
        </footer>
      </div>
    </div>
  `
})
export class EnrollStudentModalComponent implements OnInit {
  private readonly academicApi = inject(AcademicApiService);
  private readonly store = inject(StudentsStore);

  readonly student = input.required<StudentDetail>();

  /**
   * UUID de la matrícula activa actual. Si se provee, el modal entra
   * en <em>modo cambio de sección</em> y dispara el dual-write
   * (withdraw TRANSFERRED + create) en lugar del create simple.
   */
  readonly activeEnrollmentPublicUuid = input<string | null>(null);

  /**
   * UUID de la sección activa actual. Sirve para dos cosas:
   * <ul>
   *   <li>Bloquear esa opción en el dropdown (no permite "cambiar a
   *       la misma sección").</li>
   *   <li>Identificar el modo del modal (informativo).</li>
   * </ul>
   */
  readonly currentSectionUuid = input<string | null>(null);

  readonly closed = output<void>();
  readonly enrolled = output<void>();

  protected readonly activeYear = signal<AcademicYearRow | null>(null);
  protected readonly sections = signal<SectionRow[]>([]);
  protected readonly loadingCatalogs = signal(false);
  protected readonly saving = this.store.savingEnrollment;
  protected readonly errorMessage = this.store.error;

  protected readonly sectionUuid  = signal<string>('');
  protected readonly enrolledAt   = signal<string>('');
  protected readonly notes        = signal<string>('');

  protected readonly isTransfer = computed<boolean>(
    () => !!this.activeEnrollmentPublicUuid()
  );

  protected readonly yearMinDate = computed<string>(() => {
    const y = this.activeYear();
    return y ? this.toIsoDate(y.startDate) : '';
  });

  protected readonly yearMaxDate = computed<string>(() => {
    const y = this.activeYear();
    return y ? this.toIsoDate(y.endDate) : '';
  });

  protected readonly canSubmit = computed<boolean>(() => {
    if (!this.sectionUuid() || !this.enrolledAt() || !this.activeYear())
      return false;
    if (this.sectionUuid() === this.currentSectionUuid()) return false;
    const min = this.yearMinDate();
    const max = this.yearMaxDate();
    return this.enrolledAt() >= min && this.enrolledAt() <= max;
  });

  async ngOnInit(): Promise<void> {
    this.store.clearError();
    /* Default razonable de la fecha = hoy si está dentro del rango,
     * sino el inicio del año. Lo seteamos después de cargar el año. */
    await this.fetchCatalogs();
    const today = this.toIsoDate(new Date());
    this.enrolledAt.set(
      today >= this.yearMinDate() && today <= this.yearMaxDate()
        ? today
        : this.yearMinDate()
    );
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (!this.saving()) this.close();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.saving()) this.close();
  }

  protected close(): void {
    this.store.clearError();
    this.closed.emit();
  }

  protected async onSubmit(): Promise<void> {
    if (!this.canSubmit() || this.saving()) return;
    const year = this.activeYear();
    if (!year) return;

    const create = {
      sectionPublicUuid: this.sectionUuid(),
      academicYearPublicUuid: year.publicUuid,
      enrolledAt: this.enrolledAt(),
      notes: this.notes().trim() || undefined
    };

    const activeUuid = this.activeEnrollmentPublicUuid();
    let result;
    if (activeUuid) {
      result = await this.store.transferStudentSection(
        this.student().publicUuid,
        activeUuid,
        this.enrolledAt(),
        create
      );
    } else {
      result = await this.store.enrollStudent(
        this.student().publicUuid,
        create
      );
    }
    if (result) this.enrolled.emit();
  }

  private async fetchCatalogs(): Promise<void> {
    this.loadingCatalogs.set(true);
    try {
      const years = await firstValueFrom(this.academicApi.listYears());
      const active =
        years.find((y) => y.status === AcademicYearStatus.Active) ?? null;
      this.activeYear.set(active);

      if (!active) return;

      const sections = await firstValueFrom(
        this.academicApi.listSections({
          academicYearPublicUuid: active.publicUuid
        })
      );
      this.sections.set(sections);
    }
    catch {
      this.activeYear.set(null);
      this.sections.set([]);
    }
    finally {
      this.loadingCatalogs.set(false);
    }
  }

  private toIsoDate(value: Date | string): string {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    /* yyyy-MM-dd en local timezone. Evitamos {@code toISOString} que
     * convierte a UTC y puede shiftear el día en zonas con offset
     * negativo. */
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
