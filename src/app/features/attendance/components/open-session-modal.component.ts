import { createFormProtection } from '@shared/services/form-protection.service';
import { SafeBackdropDirective } from '@shared/directives/safe-backdrop.directive';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '@shared/components';
import { AcademicApiService } from '@features/academic/services';
import { AcademicYearRow, AcademicYearStatus, SectionRow } from '@features/academic/models';
import { AttendanceSessionSlot, CreateSessionRequest } from '../models';

/**
 * Dialog "Abrir sesión" — emits a {@link CreateSessionRequest} on submit.
 *
 * The primary button is never {@code disabled}: previous OnPush + signal
 * / form-validity bindings left it stuck. Validation runs on submit and
 * surfaces {@link #submitHint} instead.
 */
@Component({
  selector: 'app-open-session-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SafeBackdropDirective, CommonModule, ReactiveFormsModule, IconComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="open-session-title"
      appSafeBackdrop (click)="onBackdropClick($event)"
    >
      <div
        class="card flex max-h-[90vh] w-full max-w-lg flex-col shadow-xl"
        (click)="$event.stopPropagation()"
      >
        <header class="card-header">
          <div>
            <h2 id="open-session-title" class="card-title">Abrir sesión de asistencia</h2>
            <p class="card-description">
              Selecciona sección, fecha y turno. Si ya existe una sesión ACTIVA para esa
              combinación, el sistema la reutiliza.
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

        <form
          class="card-body flex flex-col gap-3 overflow-y-auto"
          [formGroup]="form"
          (ngSubmit)="submit()"
        >
          <div>
            <label class="label" for="open-section">Sección</label>
            <select id="open-section" class="select" formControlName="sectionPublicUuid">
              <option value="" disabled>Selecciona una sección…</option>
              @for (s of sections(); track s.publicUuid) {
                <option [value]="s.publicUuid">{{ s.gradeName }} · {{ s.name }}</option>
              }
            </select>
            @if (!loadingSections() && !activeYear()) {
              <p class="hint mt-1 text-xs text-warning">
                No hay año académico activo. Crea uno en Académico antes de abrir sesiones.
              </p>
            }
            @if (!loadingSections() && activeYear() && sections().length === 0) {
              <p class="hint mt-1 text-xs text-warning">
                El año activo no tiene secciones. Crea secciones en Académico.
              </p>
            }
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="label" for="open-date">Fecha</label>
              <input id="open-date" type="date" class="input" formControlName="occurredOn" />
            </div>
            <div>
              <label class="label" for="open-slot">Slot</label>
              <select id="open-slot" class="select" formControlName="slot">
                @for (opt of slotOptions; track opt.value) {
                  <option [value]="opt.value">{{ opt.label }}</option>
                }
              </select>
            </div>
          </div>

          <div>
            <label class="label" for="open-notes">Notas (opcional)</label>
            <textarea
              id="open-notes"
              class="textarea"
              rows="2"
              maxlength="500"
              formControlName="notes"
              placeholder="Algo que el docente deba saber…"
            ></textarea>
          </div>

          @if (submitHint(); as hint) {
            <p class="text-sm text-danger" role="alert">{{ hint }}</p>
          }
        </form>

        <footer class="card-footer justify-end gap-2">
          <button type="button" class="btn btn-ghost btn-sm" (click)="close()">Cancelar</button>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            (click)="submit()"
          >
            <app-icon name="check" [size]="16" />
            <span>Abrir sesión</span>
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class OpenSessionModalComponent implements OnInit {
  protected readonly formProtection = createFormProtection({
    snapshot: () => this.form.getRawValue(),
    saving: () => this.saving(),
    active: () => true,
  });

  readonly submitRequest = output<CreateSessionRequest>();
  readonly cancelled = output<void>();
  readonly saving = input(false);

  private readonly academicApi = inject(AcademicApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly sections = signal<SectionRow[]>([]);
  protected readonly activeYear = signal<AcademicYearRow | null>(null);
  protected readonly loadingSections = signal(false);
  protected readonly submitHint = signal<string | null>(null);

  protected readonly today = formatDate(new Date());

  protected readonly slotOptions: ReadonlyArray<{ value: AttendanceSessionSlot; label: string }> = [
    { value: 'MORNING', label: 'Mañana' },
    { value: 'AFTERNOON', label: 'Tarde' },
    { value: 'EVENING', label: 'Noche' },
  ];

  protected readonly form = this.fb.nonNullable.group({
    sectionPublicUuid: ['', Validators.required],
    occurredOn: [this.today, Validators.required],
    slot: ['MORNING' as AttendanceSessionSlot, Validators.required],
    notes: [''],
  });

  async ngOnInit(): Promise<void> {
    await this.loadSections();
  }

  @HostListener('document:keydown.escape')
  protected onEsc(): void {
    this.close();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  protected close(): void {
    this.formProtection.requestClose(() => {
      this.cancelled.emit();
    });
  }

  protected submit(): void {
    const v = this.form.getRawValue();
    const section = (v.sectionPublicUuid ?? '').trim();
    const occurredOn = (v.occurredOn ?? '').trim();

    if (!section || !occurredOn) {
      this.form.markAllAsTouched();
      this.submitHint.set(
        !section
          ? 'Selecciona una sección para continuar.'
          : 'Indica la fecha de la sesión.',
      );
      return;
    }

    this.submitHint.set(null);
    this.submitRequest.emit({
      sectionPublicUuid: section,
      slot: v.slot,
      occurredOn,
    });
  }

  private async loadSections(): Promise<void> {
    this.loadingSections.set(true);
    try {
      const years = await firstValueFrom(this.academicApi.listYears());
      const active = years.find((y) => y.status === AcademicYearStatus.Active) ?? null;
      this.activeYear.set(active);
      if (!active) {
        this.sections.set([]);
        return;
      }
      const sections = await firstValueFrom(
        this.academicApi.listSections({ academicYearPublicUuid: active.publicUuid }),
      );
      this.sections.set(sections);
      if (sections.length > 0) {
        this.form.patchValue({ sectionPublicUuid: sections[0].publicUuid });
      }
    } catch {
      this.sections.set([]);
    } finally {
      this.loadingSections.set(false);
    }
  }
}

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
