import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
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
import { IconComponent, SpinnerComponent } from '@shared/components';
import { AcademicApiService } from '../services';
import {
  CreateTimeSlotRequest,
  DAYS_OF_WEEK,
  ScheduleSlotItem,
  UpdateTimeSlotRequest,
} from '../models';

/** Wire shape of {@code ApiError} items inside error envelopes. */
interface WireApiError {
  code?: string;
  message?: string;
}

/** Option shown in the assignment dropdown when creating a slot. */
export interface TimeSlotAssignmentOption {
  publicUuid: string;
  label: string;
}

/**
 * Modal create / edit for a weekly {@code TimeSlot}.
 * Surfaces API conflict messages (e.g. recess overlap / SCHEDULE_CONFLICT)
 * in a banner so UAT-SCH-05 can be validated from the UI.
 */
@Component({
  selector: 'app-time-slot-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, IconComponent, SpinnerComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="time-slot-form-title"
      (click)="onBackdropClick($event)"
    >
      <div
        class="card max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-xl"
        (click)="$event.stopPropagation()"
      >
        <header class="card-header flex items-start justify-between gap-3">
          <div>
            <h2 id="time-slot-form-title" class="card-title">
              {{ isEdit() ? 'Editar bloque de clase' : 'Nuevo bloque de clase' }}
            </h2>
            <p class="card-description">
              Patrón semanal de la asignación. No puede solapar recreo, lonchera u otro slot
              conflictivo.
            </p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" aria-label="Cerrar" (click)="cancel()">
            <app-icon name="x" [size]="18" />
          </button>
        </header>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="card-body grid gap-4">
          @if (errorBanner(); as err) {
            <div class="alert alert-danger" role="alert">
              <app-icon name="alert-circle" [size]="18" />
              <div class="flex-1">
                @if (errorCode(); as code) {
                  <p class="text-xs font-semibold uppercase tracking-wide opacity-80">{{ code }}</p>
                }
                <p class="text-sm">{{ err }}</p>
              </div>
            </div>
          }

          @if (!isEdit()) {
            <div class="field">
              <label class="label" for="ts-assignment">Asignación *</label>
              <select id="ts-assignment" class="select" formControlName="assignmentPublicUuid">
                <option [ngValue]="null" disabled>Selecciona asignación…</option>
                @for (a of assignments(); track a.publicUuid) {
                  <option [ngValue]="a.publicUuid">{{ a.label }}</option>
                }
              </select>
              @if (assignments().length === 0) {
                <p class="mt-1 text-xs text-content-muted">
                  No hay asignaciones activas. Creá una desde Docentes → Asignaciones.
                </p>
              }
            </div>
          }

          <div class="field">
            <label class="label" for="ts-day">Día *</label>
            <select id="ts-day" class="select" formControlName="dayOfWeek">
              @for (d of weekDays; track d.value) {
                <option [ngValue]="d.value">{{ d.label }}</option>
              }
            </select>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="field">
              <label class="label" for="ts-start">Inicio *</label>
              <input id="ts-start" type="time" class="input" formControlName="startTime" />
            </div>
            <div class="field">
              <label class="label" for="ts-end">Fin *</label>
              <input id="ts-end" type="time" class="input" formControlName="endTime" />
            </div>
          </div>

          <div class="field">
            <label class="label" for="ts-classroom">Aula (opcional)</label>
            <input
              id="ts-classroom"
              type="text"
              class="input"
              formControlName="classroom"
              maxlength="80"
              placeholder="Ej. Aula 12"
            />
          </div>

          <footer class="flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle pt-4">
            @if (isEdit()) {
              <button
                type="button"
                class="btn btn-ghost btn-sm text-danger mr-auto"
                [disabled]="saving() || deleting()"
                (click)="onDelete()"
              >
                @if (deleting()) {
                  <app-spinner [size]="14" />
                }
                Eliminar
              </button>
            }
            <button type="button" class="btn btn-ghost btn-sm" [disabled]="saving()" (click)="cancel()">
              Cancelar
            </button>
            <button
              type="submit"
              class="btn btn-primary btn-sm"
              [disabled]="form.invalid || saving() || deleting() || (!isEdit() && assignments().length === 0)"
            >
              @if (saving()) {
                <app-spinner [size]="14" />
              }
              {{ isEdit() ? 'Guardar' : 'Crear bloque' }}
            </button>
          </footer>
        </form>
      </div>
    </div>
  `,
})
export class TimeSlotFormModalComponent implements OnInit {
  private readonly api = inject(AcademicApiService);
  private readonly fb = inject(FormBuilder);

  /** Active assignments available when creating. */
  readonly assignments = input<TimeSlotAssignmentOption[]>([]);
  /** Prefill day when opening from a grid column. */
  readonly initialDayOfWeek = input<number | null>(null);
  /** Prefill start/end when opening from a suggested period. */
  readonly initialStartTime = input<string | null>(null);
  readonly initialEndTime = input<string | null>(null);
  /** Prefill assignment when only one makes sense. */
  readonly initialAssignmentUuid = input<string | null>(null);
  /** When set, modal is in edit mode. */
  readonly slot = input<ScheduleSlotItem | null>(null);

  readonly closed = output<void>();
  readonly saved = output<void>();
  readonly deleted = output<void>();

  protected readonly weekDays = DAYS_OF_WEEK.filter((d) => d.value <= 5);
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly errorBanner = signal<string | null>(null);
  protected readonly errorCode = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    assignmentPublicUuid: this.fb.control<string | null>(null, Validators.required),
    dayOfWeek: this.fb.nonNullable.control(1, Validators.required),
    startTime: this.fb.nonNullable.control('08:00', Validators.required),
    endTime: this.fb.nonNullable.control('08:45', Validators.required),
    classroom: this.fb.nonNullable.control(''),
  });

  protected isEdit(): boolean {
    return !!this.slot()?.slotPublicUuid;
  }

  ngOnInit(): void {
    const existing = this.slot();
    // #region agent log
    fetch('http://127.0.0.1:7639/ingest/f4773d1b-17bd-44c3-8d39-badf894fd980',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5d2603'},body:JSON.stringify({sessionId:'5d2603',runId:'pre-fix',hypothesisId:'A',location:'time-slot-form-modal.component.ts:ngOnInit',message:'modal init',data:{isEdit:!!existing?.slotPublicUuid,slotPublicUuid:existing?.slotPublicUuid??null,assignmentPublicUuid:existing?.assignmentPublicUuid??null,assignmentOptions:this.assignments().length,day:existing?.dayOfWeek??this.initialDayOfWeek()},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (existing) {
      this.form.patchValue({
        assignmentPublicUuid: existing.assignmentPublicUuid,
        dayOfWeek: existing.dayOfWeek,
        startTime: this.toInputTime(existing.startTime),
        endTime: this.toInputTime(existing.endTime),
        classroom: existing.classroom ?? '',
      });
      this.form.controls.assignmentPublicUuid.disable();
      return;
    }

    const day = this.initialDayOfWeek();
    if (day != null) {
      this.form.controls.dayOfWeek.setValue(day);
    }
    const start = this.initialStartTime();
    if (start) {
      this.form.controls.startTime.setValue(this.toInputTime(start));
    }
    const end = this.initialEndTime();
    if (end) {
      this.form.controls.endTime.setValue(this.toInputTime(end));
    }
    const assignmentUuid = this.initialAssignmentUuid();
    const options = this.assignments();
    if (assignmentUuid) {
      this.form.controls.assignmentPublicUuid.setValue(assignmentUuid);
    } else if (options.length === 1) {
      this.form.controls.assignmentPublicUuid.setValue(options[0].publicUuid);
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.cancel();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cancel();
  }

  protected cancel(): void {
    this.closed.emit();
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.errorBanner.set(null);
    this.errorCode.set(null);
    try {
      const raw = this.form.getRawValue();
      if (this.isEdit()) {
        const patch: UpdateTimeSlotRequest = {
          dayOfWeek: raw.dayOfWeek,
          startTime: this.toApiTime(raw.startTime),
          endTime: this.toApiTime(raw.endTime),
          classroom: raw.classroom.trim() || null,
        };
        await firstValueFrom(this.api.updateTimeSlot(this.slot()!.slotPublicUuid, patch));
      } else {
        const assignmentUuid = raw.assignmentPublicUuid;
        if (!assignmentUuid) return;
        const body: CreateTimeSlotRequest = {
          dayOfWeek: raw.dayOfWeek,
          startTime: this.toApiTime(raw.startTime),
          endTime: this.toApiTime(raw.endTime),
          classroom: raw.classroom.trim() || undefined,
        };
        await firstValueFrom(this.api.createTimeSlot(assignmentUuid, body));
      }
      this.saved.emit();
    } catch (err) {
      this.applyError(err);
    } finally {
      this.saving.set(false);
    }
  }

  protected async onDelete(): Promise<void> {
    const existing = this.slot();
    // #region agent log
    fetch('http://127.0.0.1:7639/ingest/f4773d1b-17bd-44c3-8d39-badf894fd980',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5d2603'},body:JSON.stringify({sessionId:'5d2603',runId:'pre-fix',hypothesisId:'A',location:'time-slot-form-modal.component.ts:onDelete:entry',message:'delete clicked',data:{hasSlot:!!existing,slotPublicUuid:existing?.slotPublicUuid??null,deleting:this.deleting()},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!existing || this.deleting()) return;
    const confirmed = confirm('¿Eliminar este bloque del horario semanal?');
    // #region agent log
    fetch('http://127.0.0.1:7639/ingest/f4773d1b-17bd-44c3-8d39-badf894fd980',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5d2603'},body:JSON.stringify({sessionId:'5d2603',runId:'pre-fix',hypothesisId:'C',location:'time-slot-form-modal.component.ts:onDelete:confirm',message:'confirm result',data:{confirmed,slotPublicUuid:existing.slotPublicUuid},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!confirmed) return;
    this.deleting.set(true);
    this.errorBanner.set(null);
    try {
      await firstValueFrom(this.api.deleteTimeSlot(existing.slotPublicUuid));
      // #region agent log
      fetch('http://127.0.0.1:7639/ingest/f4773d1b-17bd-44c3-8d39-badf894fd980',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5d2603'},body:JSON.stringify({sessionId:'5d2603',runId:'pre-fix',hypothesisId:'B',location:'time-slot-form-modal.component.ts:onDelete:success',message:'delete API ok',data:{slotPublicUuid:existing.slotPublicUuid},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      this.deleted.emit();
    } catch (err) {
      // #region agent log
      const he = err instanceof HttpErrorResponse ? err : null;
      fetch('http://127.0.0.1:7639/ingest/f4773d1b-17bd-44c3-8d39-badf894fd980',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5d2603'},body:JSON.stringify({sessionId:'5d2603',runId:'pre-fix',hypothesisId:'B',location:'time-slot-form-modal.component.ts:onDelete:error',message:'delete API failed',data:{status:he?.status??null,statusText:he?.statusText??null,errorName:err instanceof Error?err.name:typeof err,errorMessage:err instanceof Error?err.message:String(err),bodySnippet:typeof he?.error==='string'?he.error.slice(0,200):(he?.error?JSON.stringify(he.error).slice(0,200):null)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      this.applyError(err);
    } finally {
      this.deleting.set(false);
    }
  }

  private applyError(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) {
      this.errorBanner.set('No se pudo guardar el bloque.');
      return;
    }
    const body = err.error as
      | { message?: string; errors?: WireApiError[]; code?: string }
      | null
      | undefined;
    const first = body?.errors?.[0];
    const code = first?.code ?? body?.code ?? null;
    const message =
      first?.message ||
      body?.message ||
      (typeof err.message === 'string' ? err.message : null) ||
      'No se pudo guardar el bloque.';
    this.errorCode.set(code);
    this.errorBanner.set(message);
  }

  private toInputTime(value: string): string {
    if (!value) return '08:00';
    const parts = value.split(':');
    return `${parts[0]?.padStart(2, '0') ?? '08'}:${parts[1]?.padStart(2, '0') ?? '00'}`;
  }

  private toApiTime(value: string): string {
    if (!value) return value;
    return value.length === 5 ? `${value}:00` : value;
  }
}
