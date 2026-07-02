import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '@shared/components';
import { AcademicApiService } from '@features/academic/services';
import { AcademicYearRow, AcademicYearStatus, SectionRow } from '@features/academic/models';
import { AttendanceSessionSlot, CreateSessionRequest } from '../models';

/**
 * Dialog "Abrir sesión" — emits a {@link CreateSessionRequest} on submit.
 *
 * <h3>Why a fire-and-emit modal</h3>
 * The dialog doesn't talk to the backend; the parent page owns the
 * {@link AttendanceStore} and runs the request, so the loading
 * state, error surfacing, and post-create navigation all live in
 * one place. The modal's only job is to collect a valid request.
 *
 * <h3>Why the date defaults to today</h3>
 * 99% of the time the docente opens a session for "ahora" (the
 * current school day). Defaulting to `today` keeps the form
 * one-tap: the only meaningful choice is the section + slot.
 */
@Component({
  selector: 'app-open-session-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="open-session-title"
      (click)="onBackdropClick($event)"
    >
      <div
        class="card flex max-h-[90vh] w-full max-w-lg flex-col shadow-xl"
        (click)="$event.stopPropagation()"
      >
        <header class="card-header">
          <div>
            <h2 id="open-session-title" class="card-title">Abrir sesión de asistencia</h2>
            <p class="card-description">
              El backend la hace idempotente: si ya hay una ACTIVA para (sección, día, slot), la
              trae en lugar de fallar.
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

        <form class="card-body flex flex-col gap-3 overflow-y-auto" (ngSubmit)="submit()">
          <div>
            <label class="label" for="open-section">Sección</label>
            <select
              id="open-section"
              class="select"
              [(ngModel)]="sectionPublicUuid"
              name="section"
              [disabled]="loadingSections()"
              required
            >
              <option [ngValue]="null" disabled>Selecciona una sección…</option>
              @for (s of sections(); track s.publicUuid) {
                <option [ngValue]="s.publicUuid">{{ s.gradeName }} · {{ s.name }}</option>
              }
            </select>
            @if (!loadingSections() && !activeYear()) {
              <p class="hint mt-1 text-xs text-warning">
                No hay año académico activo. Crea uno en Académico antes de abrir sesiones.
              </p>
            }
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="label" for="open-date">Fecha</label>
              <input
                id="open-date"
                type="date"
                class="input"
                [(ngModel)]="occurredOn"
                name="date"
                [max]="today"
                required
              />
            </div>
            <div>
              <label class="label" for="open-slot">Slot</label>
              <select id="open-slot" class="select" [(ngModel)]="slot" name="slot" required>
                @for (opt of slotOptions; track opt.value) {
                  <option [ngValue]="opt.value">{{ opt.label }}</option>
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
              [(ngModel)]="notes"
              name="notes"
              placeholder="Algo que el docente deba saber…"
            ></textarea>
          </div>
        </form>

        <footer class="card-footer justify-end gap-2">
          <button type="button" class="btn btn-ghost btn-sm" (click)="close()">Cancelar</button>
          <button
            type="submit"
            class="btn btn-primary btn-sm"
            [disabled]="!canSubmit()"
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
  /** Fires with the validated request on submit. */
  readonly submitRequest = output<CreateSessionRequest>();
  /** Fires when the docente dismisses the dialog without submitting. */
  readonly cancelled = output<void>();

  private readonly academicApi = inject(AcademicApiService);

  protected sectionPublicUuid: string | null = null;
  protected occurredOn = '';
  protected slot: AttendanceSessionSlot = 'MORNING';
  protected notes = '';

  protected readonly sections = signal<SectionRow[]>([]);
  protected readonly activeYear = signal<AcademicYearRow | null>(null);
  protected readonly loadingSections = signal(false);

  protected readonly today = formatDate(new Date());

  protected readonly slotOptions: ReadonlyArray<{ value: AttendanceSessionSlot; label: string }> = [
    { value: 'MORNING', label: 'Mañana' },
    { value: 'AFTERNOON', label: 'Tarde' },
    { value: 'EVENING', label: 'Noche' },
  ];

  protected readonly canSubmit = computed(
    () => Boolean(this.sectionPublicUuid) && Boolean(this.occurredOn),
  );

  async ngOnInit(): Promise<void> {
    this.occurredOn = this.today;
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
    this.cancelled.emit();
  }

  protected submit(): void {
    if (!this.canSubmit() || !this.sectionPublicUuid) return;
    this.submitRequest.emit({
      sectionPublicUuid: this.sectionPublicUuid,
      slot: this.slot,
      occurredOn: this.occurredOn,
    });
  }

  private async loadSections(): Promise<void> {
    this.loadingSections.set(true);
    try {
      const years = await firstValueFrom(this.academicApi.listYears());
      const active = years.find((y) => y.status === AcademicYearStatus.Active) ?? null;
      this.activeYear.set(active);
      if (!active) return;
      const sections = await firstValueFrom(
        this.academicApi.listSections({ academicYearPublicUuid: active.publicUuid }),
      );
      this.sections.set(sections);
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
