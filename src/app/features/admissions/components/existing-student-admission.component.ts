import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StudentsApiService } from '@features/students/services';
import { AcademicApiService } from '@features/academic/services/academic-api.service';
import { StudentRow } from '@features/students/models';
import { AdmissionsApiService } from '../services/admissions-api.service';
import { AdmissionApplication } from '../models';
import { admissionError } from '../models/admission-errors';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-existing-student-admission',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="mx-auto max-w-2xl space-y-5 rounded-2xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
      aria-labelledby="existing-student-title"
    >
      <h2 id="existing-student-title" class="text-xl font-bold">
        Solicitud para estudiante registrado
      </h2>
      <p class="text-sm text-slate-500">
        Busca por nombre o documento y selecciona su ficha. No se creará otro estudiante.
      </p>
      @if (errorSignal()) {
        <p
          role="alert"
          class="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200"
        >
          {{ errorSignal() }}
        </p>
      }
      <form (ngSubmit)="search()" class="flex gap-2">
        <input
          name="search"
          [(ngModel)]="term"
          aria-label="Buscar estudiante existente"
          placeholder="Nombre o documento"
          class="min-w-0 flex-1 rounded-xl border p-3 dark:bg-slate-950"
        /><button type="submit" class="rounded-xl bg-indigo-600 px-4 text-white">Buscar</button>
      </form>
      @if (loadingSignal()) {
        <p role="status" class="text-sm">Buscando estudiantes…</p>
      }
      <form (ngSubmit)="create()" ngNativeValidate class="space-y-4">
        <label class="block text-sm font-medium"
          >Estudiante<select
            name="student"
            [(ngModel)]="studentUuid"
            (ngModelChange)="dirty.emit()"
            required
            class="mt-1 w-full rounded-xl border p-3 dark:bg-slate-950"
          >
            <option value="">Seleccionar ficha</option>
            @for (student of studentsSignal(); track student.publicUuid) {
              <option [value]="student.publicUuid">
                {{ student.fullName }} · {{ student.documentNumber }}
              </option>
            }
          </select></label
        >
        @if (!loadingSignal() && !studentsSignal().length) {
          <p class="text-sm text-slate-500">
            No se encontraron estudiantes. Prueba otro nombre o documento.
          </p>
        }
        <div class="flex justify-between text-sm">
          <button
            type="button"
            (click)="search(pageSignal() - 1)"
            [disabled]="pageSignal() === 0 || loadingSignal()"
          >
            Anterior</button
          ><span>Página {{ pageSignal() + 1 }}</span
          ><button
            type="button"
            (click)="search(pageSignal() + 1)"
            [disabled]="!hasNextSignal() || loadingSignal()"
          >
            Siguiente
          </button>
        </div>
        <label class="block text-sm font-medium"
          >Grado solicitado<select
            name="grade"
            [(ngModel)]="gradeUuid"
            (ngModelChange)="dirty.emit()"
            required
            class="mt-1 w-full rounded-xl border p-3 dark:bg-slate-950"
          >
            <option value="">Seleccionar grado</option>
            @for (grade of gradesSignal(); track grade.publicUuid) {
              <option [value]="grade.publicUuid">{{ grade.name }}</option>
            }
          </select></label
        >
        <label class="block text-sm font-medium"
          >Nota inicial<textarea
            name="note"
            [(ngModel)]="note"
            (ngModelChange)="dirty.emit()"
            maxlength="2000"
            rows="2"
            class="mt-1 w-full rounded-xl border p-3 dark:bg-slate-950"
          ></textarea>
        </label>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            [disabled]="savingSignal()"
            (click)="cancelled.emit()"
            class="rounded-xl border px-4 py-2"
          >
            Cancelar</button
          ><button
            type="submit"
            [disabled]="savingSignal() || !year() || !studentUuid || !gradeUuid"
            class="rounded-xl bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {{ savingSignal() ? 'Guardando…' : 'Crear solicitud' }}
          </button>
        </div>
      </form>
    </section>
  `,
})
export class ExistingStudentAdmissionComponent {
  readonly year = input.required<string>();
  readonly dirty = output<void>();
  readonly busy = output<boolean>();
  readonly created = output<AdmissionApplication>();
  readonly cancelled = output<void>();
  readonly studentsSignal = signal<StudentRow[]>([]);
  readonly gradesSignal = signal<{ publicUuid: string; name: string }[]>([]);
  readonly loadingSignal = signal(false);
  readonly savingSignal = signal(false);
  readonly errorSignal = signal('');
  readonly pageSignal = signal(0);
  readonly hasNextSignal = signal(false);
  private readonly students = inject(StudentsApiService);
  private readonly api = inject(AdmissionsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private subscription?: Subscription;
  term = '';
  studentUuid = '';
  gradeUuid = '';
  note = '';
  constructor() {
    inject(AcademicApiService)
      .listLevels()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (levels) =>
          this.gradesSignal.set(
            levels.flatMap((level) =>
              level.grades.map((grade) => ({
                publicUuid: grade.publicUuid,
                name: `${level.name} · ${grade.name}`,
              })),
            ),
          ),
        error: (error) =>
          this.errorSignal.set(admissionError(error, 'No se pudieron cargar los grados.')),
      });
    this.search();
    this.destroyRef.onDestroy(() => this.subscription?.unsubscribe());
  }
  search(page = 0): void {
    this.subscription?.unsubscribe();
    this.loadingSignal.set(true);
    this.errorSignal.set('');
    this.studentUuid = '';
    this.subscription = this.students
      .list({ search: this.term }, { page, size: 20, sort: 'lastName,asc' })
      .subscribe({
        next: (result) => {
          this.studentsSignal.set(result.content);
          this.pageSignal.set(page);
          this.hasNextSignal.set(!result.last);
          this.loadingSignal.set(false);
        },
        error: (error) => {
          this.studentsSignal.set([]);
          this.loadingSignal.set(false);
          this.errorSignal.set(admissionError(error, 'No se pudo buscar estudiantes.'));
        },
      });
  }
  create(): void {
    if (this.savingSignal() || !this.year() || !this.studentUuid || !this.gradeUuid) return;
    this.savingSignal.set(true);
    this.busy.emit(true);
    this.errorSignal.set('');
    this.api
      .create(this.year(), {
        studentPublicUuid: this.studentUuid,
        gradePublicUuid: this.gradeUuid,
        source: 'IN_PERSON',
        note: this.note.trim() || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.savingSignal.set(false);
          this.busy.emit(false);
          this.created.emit(result.data);
        },
        error: (error) => {
          this.savingSignal.set(false);
          this.busy.emit(false);
          this.errorSignal.set(
            admissionError(error, 'No se pudo crear la solicitud. Revisa el año y los datos.'),
          );
        },
      });
  }
}
