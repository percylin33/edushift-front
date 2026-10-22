import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged, switchMap, of, catchError } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { AcademicApiService } from '@features/academic/services';
import { SectionRow } from '@features/academic/models';
import { StudentsApiService } from '@features/students/services';
import { StudentPaymentRecipient } from '@features/students/models';
import { PaymentsApiService } from '../../services/payments-api.service';
import {
  PaymentConcept,
  PaymentConceptsApiService,
} from '../../services/payment-concepts-api.service';
import {
  BulkEmitInvoicesResponse,
  centsToSoles,
  formatMoney,
  solesToCents,
} from '../../models/invoice.model';

/**
 * Admin — emit one invoice or bulk-emit for a section / all enrolled.
 * Student/section are picked by name (or DNI); amounts are entered in soles.
 */
@Component({
  selector: 'app-admin-emit-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="mx-auto max-w-3xl">
      @if (banner(); as b) {
        <div
          class="mb-4 rounded-md px-4 py-3 text-sm"
          [class]="b.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'"
        >
          {{ b.message }}
          <button type="button" class="ml-2 underline" (click)="banner.set(null)">Cerrar</button>
        </div>
      }

      <nav class="mb-4 flex gap-2" aria-label="Tipo de generación" role="tablist">
        <button
          type="button"
          role="tab"
          id="generation-individual-tab"
          aria-controls="generation-panel"
          [attr.aria-selected]="generationMode() === 'individual'"
          [class]="generationTabClass(generationMode() === 'individual')"
          (click)="generationMode.set('individual')"
        >
          Individual
        </button>
        <button
          type="button"
          role="tab"
          id="generation-bulk-tab"
          aria-controls="generation-panel"
          [attr.aria-selected]="generationMode() === 'bulk'"
          [class]="generationTabClass(generationMode() === 'bulk')"
          (click)="generationMode.set('bulk')"
        >
          Masiva
        </button>
      </nav>

      <div
        id="generation-panel"
        role="tabpanel"
        [attr.aria-labelledby]="generationMode() === 'individual' ? 'generation-individual-tab' : 'generation-bulk-tab'"
      >
      @if (generationMode() === 'individual') {
      <div class="mb-8 rounded-2xl bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Para un estudiante
        </h2>
        <form class="grid gap-3 sm:grid-cols-2" (ngSubmit)="submitEmit()">
          <div class="relative block text-sm sm:col-span-2">
            <span class="font-medium text-slate-700 dark:text-slate-300">Estudiante</span>
            @if (selectedStudent(); as st) {
              <div
                class="mt-1 flex items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/40"
              >
                <div>
                  <div class="font-medium text-slate-900 dark:text-slate-100">{{ st.fullName }}</div>
                  <div class="text-xs text-slate-500">
                    {{ st.documentType }} {{ st.documentNumber }}
                  </div>
                </div>
                <button
                  type="button"
                  class="text-xs font-semibold text-rose-600"
                  (click)="clearStudent()"
                >
                  Cambiar
                </button>
              </div>
            } @else {
              <input
                class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                [ngModel]="studentQuery()"
                (ngModelChange)="onStudentQuery($event)"
                (keydown)="onStudentKeydown($event)"
                name="studentQuery"
                autocomplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="emit-student-listbox"
                [attr.aria-expanded]="studentHits().length > 0"
                [attr.aria-activedescendant]="activeStudentOptionId()"
                placeholder="Buscar por nombre, apellido o DNI…"
              />
              @if (studentSearching()) {
                <p class="mt-1 text-xs text-slate-500">Buscando…</p>
              }
              @if (studentHits().length > 0) {
                <ul
                  id="emit-student-listbox"
                  role="listbox"
                  class="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
                >
                  @for (s of studentHits(); track s.publicUuid; let i = $index) {
                    <li>
                      <button
                        type="button"
                        [id]="studentOptionId(i)"
                        role="option"
                        [attr.aria-selected]="i === activeStudentIndex()"
                        class="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                        [class.bg-slate-50]="i === activeStudentIndex()"
                        (click)="pickStudent(s)"
                      >
                        <span class="font-medium text-slate-900 dark:text-slate-100">
                          {{ s.fullName }}
                        </span>
                        <span class="text-xs text-slate-500">
                          {{ s.documentType }} {{ s.documentNumber }}
                        </span>
                      </button>
                    </li>
                  }
                </ul>
              }
            }
          </div>
          <label class="block text-sm sm:col-span-2">
            <span class="font-medium text-slate-700 dark:text-slate-300">Concepto</span>
            <select
              class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              [(ngModel)]="emit.conceptPublicUuid"
              name="conceptPublicUuid"
              (ngModelChange)="onConceptChange($event)"
            >
              <option value="">— Sin concepto —</option>
              @for (c of concepts(); track c.publicUuid) {
                <option [value]="c.publicUuid">
                  {{ c.code }} · {{ c.name }} ({{ money(c.defaultAmountCents, c.currency) }})
                </option>
              }
            </select>
          </label>
          <label class="block text-sm">
            <span class="font-medium text-slate-700 dark:text-slate-300">Periodo de la cuota</span>
            <input
              class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              [(ngModel)]="emit.periodLabel"
              name="periodLabel"
              required
              maxlength="40"
              placeholder="2026-03"
            />
          </label>
          <label class="block text-sm">
            <span class="font-medium text-slate-700 dark:text-slate-300">Monto (S/)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              [(ngModel)]="emit.amountSoles"
              name="amountSoles"
              required
              placeholder="20.00"
            />
          </label>
          <label class="block text-sm">
            <span class="font-medium text-slate-700 dark:text-slate-300">Descuento (S/)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              [(ngModel)]="emit.discountSoles"
              name="discountSoles"
              placeholder="0.00"
            />
          </label>
          <label class="block text-sm">
            <span class="font-medium text-slate-700 dark:text-slate-300">Vence</span>
            <input
              type="date"
              class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              [(ngModel)]="emit.dueDate"
              name="dueDate"
            />
          </label>
          <label class="block text-sm sm:col-span-2">
            <span class="font-medium text-slate-700 dark:text-slate-300">Notas</span>
            <textarea
              rows="2"
              class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              [(ngModel)]="emit.notes"
              name="notes"
            ></textarea>
          </label>
          <div class="sm:col-span-2">
            <button
              type="submit"
              class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              [disabled]="emitting()"
            >
              {{ emitting() ? 'Generando…' : 'Generar cuota' }}
            </button>
          </div>
        </form>
      </div>
      }

      @if (generationMode() === 'bulk') {
      <div class="rounded-2xl bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Para varios estudiantes
        </h2>
        <form class="grid gap-3 sm:grid-cols-2" (ngSubmit)="previewBulk()">
          <label class="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" [(ngModel)]="bulk.allEnrolled" name="allEnrolled" />
            <span class="font-medium text-slate-700 dark:text-slate-300">
              Todos los matriculados
            </span>
          </label>
          @if (!bulk.allEnrolled) {
            <label class="block text-sm sm:col-span-2">
              <span class="font-medium text-slate-700 dark:text-slate-300">Sección</span>
              <select
                class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                [(ngModel)]="bulk.sectionPublicUuid"
                name="sectionPublicUuid"
              >
                <option value="">— Elegir sección —</option>
                @for (sec of sections(); track sec.publicUuid) {
                  <option [value]="sec.publicUuid">{{ sectionLabel(sec) }}</option>
                }
              </select>
            </label>
          }
          <label class="block text-sm sm:col-span-2">
            <span class="font-medium text-slate-700 dark:text-slate-300">Concepto</span>
            <select
              class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              [(ngModel)]="bulk.conceptPublicUuid"
              name="bulkConcept"
              (ngModelChange)="onBulkConceptChange($event)"
            >
              <option value="">— Sin concepto —</option>
              @for (c of concepts(); track c.publicUuid) {
                <option [value]="c.publicUuid">{{ c.code }} · {{ c.name }}</option>
              }
            </select>
          </label>
          <label class="block text-sm">
            <span class="font-medium text-slate-700 dark:text-slate-300">Periodo de las cuotas</span>
            <input
              class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              [(ngModel)]="bulk.periodLabel"
              name="bulkPeriod"
              required
              maxlength="40"
            />
          </label>
          <label class="block text-sm">
            <span class="font-medium text-slate-700 dark:text-slate-300">Monto (S/)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              [(ngModel)]="bulk.amountSoles"
              name="bulkAmount"
              placeholder="20.00"
            />
          </label>
          <label class="block text-sm">
            <span class="font-medium text-slate-700 dark:text-slate-300">Descuento (S/)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              [(ngModel)]="bulk.discountSoles"
              name="bulkDiscount"
              placeholder="0.00"
            />
          </label>
          <label class="block text-sm">
            <span class="font-medium text-slate-700 dark:text-slate-300">Vence</span>
            <input
              type="date"
              class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              [(ngModel)]="bulk.dueDate"
              name="bulkDue"
            />
          </label>
          <div class="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="submit"
              class="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100"
              [disabled]="bulking()"
            >
              Vista previa (dry-run)
            </button>
            @if (preview(); as p) {
              <button
                type="button"
                class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                [disabled]="bulking()"
                (click)="confirmBulk()"
              >
                Confirmar {{ p.candidateCount }} cuotas
              </button>
            }
          </div>
        </form>

        @if (preview(); as p) {
          <div class="mt-4 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
            <p>
              Candidatos: <strong>{{ p.candidateCount }}</strong> · Duplicados omitidos:
              {{ p.skippedDuplicateCount }} · Sin apoderado: {{ p.skippedNoGuardianCount }}
            </p>
          </div>
        }
      </div>
      }
      </div>
    </section>
  `,
})
export class AdminEmitPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(PaymentsApiService);
  private readonly conceptsApi = inject(PaymentConceptsApiService);
  private readonly studentsApi = inject(StudentsApiService);
  private readonly academicApi = inject(AcademicApiService);

  private readonly studentSearch$ = new Subject<string>();
  private studentSearchSub?: Subscription;

  readonly concepts = signal<readonly PaymentConcept[]>([]);
  readonly sections = signal<readonly SectionRow[]>([]);
  readonly emitting = signal(false);
  readonly bulking = signal(false);
  readonly generationMode = signal<'individual' | 'bulk'>('individual');
  readonly banner = signal<{ ok: boolean; message: string } | null>(null);
  readonly preview = signal<BulkEmitInvoicesResponse | null>(null);

  generationTabClass(selected: boolean): string {
    return selected
      ? 'rounded-t-md border-b-2 border-indigo-600 px-3 py-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300'
      : 'rounded-t-md border-b-2 border-transparent px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white';
  }

  readonly studentQuery = signal('');
  readonly studentHits = signal<StudentPaymentRecipient[]>([]);
  readonly activeStudentIndex = signal(0);
  readonly studentSearching = signal(false);
  readonly selectedStudent = signal<StudentPaymentRecipient | null>(null);

  emit = {
    conceptPublicUuid: '',
    periodLabel: '',
    amountSoles: 0,
    discountSoles: 0,
    dueDate: '',
    notes: '',
  };

  bulk = {
    allEnrolled: true,
    sectionPublicUuid: '',
    conceptPublicUuid: '',
    periodLabel: '',
    amountSoles: null as number | null,
    discountSoles: 0,
    dueDate: '',
    notes: '',
  };

  ngOnInit(): void {
    firstValueFrom(this.conceptsApi.listConcepts(0, 100))
      .then(({ items }) => this.concepts.set(items))
      .catch(() => this.concepts.set([]));

    firstValueFrom(this.academicApi.listSections())
      .then((rows) => this.sections.set(rows))
      .catch(() => this.sections.set([]));

    this.studentSearchSub = this.studentSearch$
      .pipe(
        debounceTime(280),
        distinctUntilChanged(),
        switchMap((q) => {
          const term = q.trim();
          if (term.length < 2) {
            this.studentSearching.set(false);
            return of([] as StudentPaymentRecipient[]);
          }
          this.studentSearching.set(true);
          return this.studentsApi.listPaymentRecipients(term, { page: 0, size: 15 }).pipe(
            switchMap((page) => of(page.content ?? [])),
            catchError(() => of([] as StudentPaymentRecipient[])),
          );
        }),
      )
      .subscribe((rows) => {
        this.studentSearching.set(false);
        this.studentHits.set(rows);
        this.activeStudentIndex.set(0);
      });
  }

  ngOnDestroy(): void {
    this.studentSearchSub?.unsubscribe();
  }

  onStudentQuery(value: string): void {
    this.studentQuery.set(value);
    this.activeStudentIndex.set(0);
    this.studentSearch$.next(value);
  }

  onStudentKeydown(event: KeyboardEvent): void {
    const hits = this.studentHits();
    if (event.key === 'Escape') {
      if (hits.length > 0) {
        event.preventDefault();
        this.studentHits.set([]);
      }
      return;
    }
    if (hits.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeStudentIndex.update((index) => Math.min(index + 1, hits.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeStudentIndex.update((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const student = hits[this.activeStudentIndex()];
      if (student) this.pickStudent(student);
    }
  }

  activeStudentOptionId(): string | null {
    return this.studentHits().length > 0 ? this.studentOptionId(this.activeStudentIndex()) : null;
  }

  protected studentOptionId(index: number): string {
    return `emit-student-option-${index}`;
  }

  pickStudent(s: StudentPaymentRecipient): void {
    this.selectedStudent.set(s);
    this.studentHits.set([]);
    this.studentQuery.set('');
  }

  clearStudent(): void {
    this.selectedStudent.set(null);
    this.studentHits.set([]);
    this.studentQuery.set('');
  }

  sectionLabel(sec: SectionRow): string {
    const parts = [sec.levelCode, sec.gradeName, sec.name].filter(Boolean);
    const year = sec.academicYearName ? ` · ${sec.academicYearName}` : '';
    return `${parts.join(' · ')}${year}`;
  }

  onConceptChange(uuid: string): void {
    const c = this.concepts().find((x) => x.publicUuid === uuid);
    if (c) this.emit.amountSoles = centsToSoles(c.defaultAmountCents);
  }

  onBulkConceptChange(uuid: string): void {
    const c = this.concepts().find((x) => x.publicUuid === uuid);
    if (c) this.bulk.amountSoles = centsToSoles(c.defaultAmountCents);
  }

  submitEmit(): void {
    const student = this.selectedStudent();
    if (!student || !this.emit.periodLabel.trim()) {
      this.banner.set({
        ok: false,
        message: 'Elige un estudiante (busca por nombre o DNI) y el periodo.',
      });
      return;
    }
    this.emitting.set(true);
    this.api
      .emitInvoice({
        studentPublicUuid: student.publicUuid,
        conceptPublicUuid: this.emit.conceptPublicUuid || null,
        periodLabel: this.emit.periodLabel.trim(),
        amountCents: solesToCents(Number(this.emit.amountSoles) || 0),
        discountCents: solesToCents(Number(this.emit.discountSoles) || 0),
        dueAt: this.toInstant(this.emit.dueDate),
        notes: this.emit.notes || null,
      })
      .subscribe({
        next: (inv) => {
          this.emitting.set(false);
          this.banner.set({
            ok: true,
            message: `Cuota ${inv.periodLabel} generada para ${student.fullName}.`,
          });
        },
        error: (e) => {
          this.emitting.set(false);
          this.banner.set({
            ok: false,
            message: e?.error?.message ?? 'No se pudo generar la cuota',
          });
        },
      });
  }

  previewBulk(): void {
    this.runBulk(true);
  }

  confirmBulk(): void {
    this.runBulk(false);
  }

  private runBulk(dryRun: boolean): void {
    if (!this.bulk.periodLabel.trim()) {
      this.banner.set({ ok: false, message: 'El periodo es obligatorio.' });
      return;
    }
    if (!this.bulk.allEnrolled && !this.bulk.sectionPublicUuid.trim()) {
      this.banner.set({
        ok: false,
        message: 'Elige una sección o marca “Todos los matriculados”.',
      });
      return;
    }
    this.bulking.set(true);
    this.api
      .bulkEmit({
        sectionPublicUuid: this.bulk.allEnrolled
          ? null
          : this.bulk.sectionPublicUuid.trim() || null,
        allEnrolled: this.bulk.allEnrolled,
        conceptPublicUuid: this.bulk.conceptPublicUuid || null,
        periodLabel: this.bulk.periodLabel.trim(),
        amountCents:
          this.bulk.amountSoles != null ? solesToCents(Number(this.bulk.amountSoles)) : null,
        discountCents: solesToCents(Number(this.bulk.discountSoles) || 0),
        dueAt: this.toInstant(this.bulk.dueDate),
        notes: this.bulk.notes || null,
        dryRun,
      })
      .subscribe({
        next: (res) => {
          this.bulking.set(false);
          if (dryRun) {
            this.preview.set(res);
            this.banner.set({
              ok: true,
              message: `Vista previa: ${res.candidateCount} candidatos.`,
            });
          } else {
            this.preview.set(null);
            this.banner.set({
              ok: true,
              message: `Generadas ${res.createdCount} cuotas (${res.skippedDuplicateCount} duplicados omitidos).`,
            });
          }
        },
        error: (e) => {
          this.bulking.set(false);
          this.banner.set({
            ok: false,
            message: e?.error?.message ?? 'Falló la generación masiva',
          });
        },
      });
  }

  money(cents: number, c: string): string {
    return formatMoney(cents, c);
  }

  private toInstant(dateStr: string): string | null {
    if (!dateStr) return null;
    return new Date(dateStr + 'T23:59:59').toISOString();
  }
}
