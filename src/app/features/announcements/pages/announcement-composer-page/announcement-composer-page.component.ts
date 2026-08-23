import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SecurityContext } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, firstValueFrom, map, of, switchMap } from 'rxjs';
import { startWith } from 'rxjs/operators';
import { UserRole } from '@core/enums';
import { ChipMultiSelectComponent, ChipOption } from '@shared/components';
import { AcademicApiService } from '../../../academic/services/academic-api.service';
import { UsersApiService } from '../../../users/services/users-api.service';
import { AnnouncementsApiService } from '../../services/announcements-api.service';
import { AnnouncementAudience } from '../../models/announcement.model';

/**
 * Announcement composer (Sprint 9 / FE-9.2).
 *
 * <p>Audience step uses {@link ChipMultiSelectComponent}: options load
 * dynamically when {@code audienceType} changes (grades, sections,
 * courses, roles, users). SCHOOL skips the select and sends {@code []}.</p>
 */
@Component({
  selector: 'app-announcement-composer-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ChipMultiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <a routerLink="/announcements" class="text-sm text-slate-500 hover:text-slate-700"
        >← Volver</a
      >
      <h1 class="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">Nuevo anuncio</h1>

      <form [formGroup]="form" (ngSubmit)="onPublish()" class="mt-6 space-y-6">
        <!-- Step 1: audience -->
        <fieldset
          class="rounded-2xl bg-white p-5 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        >
          <legend class="px-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            1. Audiencia
          </legend>
          <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            @for (a of audienceTypeRadios; track a.value) {
              <label
                class="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:border-emerald-500 has-[:checked]:bg-emerald-50 dark:border-slate-700 dark:has-[:checked]:bg-emerald-900/20"
              >
                <input
                  type="radio"
                  formControlName="audienceType"
                  [value]="a.value"
                  class="text-emerald-600"
                />
                <span class="text-sm">{{ a.label }}</span>
              </label>
            }
          </div>

          @if (audienceType() !== 'SCHOOL') {
            <div class="mt-4 space-y-2">
              <label class="text-xs text-slate-500">{{ audienceSelectLabel() }}</label>
              @if (audienceLoading()) {
                <p class="text-sm text-slate-500 dark:text-slate-400">Cargando opciones…</p>
              } @else if (audienceError()) {
                <p class="text-sm text-rose-600">{{ audienceError() }}</p>
              } @else {
                <app-chip-multi-select
                  formControlName="audienceIds"
                  [options]="audienceChipOptions()"
                  [placeholder]="audiencePlaceholder()"
                  emptyText="No hay coincidencias"
                />
                @if (audienceChipOptions().length === 0) {
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    No hay opciones disponibles para este tipo de audiencia.
                  </p>
                }
              }
            </div>
          }
        </fieldset>

        <!-- Step 2: content -->
        <fieldset
          class="rounded-2xl bg-white p-5 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        >
          <legend class="px-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            2. Contenido
          </legend>
          <div class="mt-3 space-y-3">
            <div>
              <label class="text-xs text-slate-500">Título</label>
              <input
                type="text"
                formControlName="title"
                maxlength="200"
                class="mt-1 w-full rounded-lg border-slate-200 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label class="text-xs text-slate-500"
                >Cuerpo (HTML permitido: h1-h3, p, ul, ol, li, strong, em, a href http(s) mailto,
                br, table, thead, tbody, tr, th, td)</label
              >
              <textarea
                formControlName="bodyHtml"
                rows="8"
                class="mt-1 w-full rounded-lg border-slate-200 font-mono text-sm focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800"
              ></textarea>
            </div>
            <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input type="checkbox" formControlName="pinned" class="text-emerald-600" />
              Fijar este anuncio (sale primero)
            </label>
          </div>
        </fieldset>

        <!-- Step 3: preview + actions -->
        <fieldset
          class="rounded-2xl bg-white p-5 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        >
          <legend class="px-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            3. Vista previa
          </legend>
          <div class="mt-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/40">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {{ form.controls.title.value || '(sin título)' }}
            </h2>
            <div
              class="prose prose-sm mt-2 max-w-none dark:prose-invert"
              [innerHTML]="safeBody()"
            ></div>
          </div>

          <div class="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              (click)="onSaveDraft()"
              class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Guardar borrador
            </button>
            <button
              type="submit"
              [disabled]="form.invalid || publishing()"
              class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {{ publishing() ? 'Publicando…' : 'Publicar ahora' }}
            </button>
          </div>
          @if (errorMsg()) {
            <p class="mt-3 text-sm text-rose-600">{{ errorMsg() }}</p>
          }
        </fieldset>
      </form>
    </section>
  `,
})
export class AnnouncementComposerPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AnnouncementsApiService);
  private readonly academicApi = inject(AcademicApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  readonly audienceTypeRadios: { value: AnnouncementAudience; label: string }[] = [
    { value: 'SCHOOL', label: 'Toda la escuela' },
    { value: 'GRADE', label: 'Por grado' },
    { value: 'SECTION', label: 'Por sección' },
    { value: 'COURSE', label: 'Por curso' },
    { value: 'ROLE', label: 'Por rol' },
    { value: 'USER', label: 'Usuarios específicos' },
  ];

  private static readonly ROLE_OPTIONS: ChipOption[] = [
    { id: UserRole.TenantAdmin, label: 'Administrador' },
    { id: UserRole.Staff, label: 'Staff' },
    { id: UserRole.Teacher, label: 'Profesor' },
    { id: UserRole.Student, label: 'Estudiante' },
    { id: UserRole.Parent, label: 'Tutor' },
  ];

  readonly form = this.fb.group({
    audienceType: this.fb.nonNullable.control<AnnouncementAudience>('SCHOOL'),
    audienceIds: this.fb.nonNullable.control<string[]>([]),
    title: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(200)]),
    bodyHtml: this.fb.nonNullable.control('', [Validators.required]),
    pinned: this.fb.nonNullable.control(false),
  });

  readonly publishing = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly audienceChipOptions = signal<ChipOption[]>([]);
  readonly audienceLoading = signal(false);
  readonly audienceError = signal<string | null>(null);

  readonly audienceType = toSignal(
    this.form.controls.audienceType.valueChanges.pipe(
      startWith(this.form.controls.audienceType.value),
    ),
    { initialValue: this.form.controls.audienceType.value },
  );

  readonly audienceSelectLabel = computed(() => {
    switch (this.audienceType()) {
      case 'GRADE':
        return 'Grados';
      case 'SECTION':
        return 'Secciones';
      case 'COURSE':
        return 'Cursos';
      case 'ROLE':
        return 'Roles';
      case 'USER':
        return 'Usuarios';
      default:
        return 'Destinatarios';
    }
  });

  readonly audiencePlaceholder = computed(() => {
    switch (this.audienceType()) {
      case 'GRADE':
        return 'Busca y selecciona grados…';
      case 'SECTION':
        return 'Busca y selecciona secciones…';
      case 'COURSE':
        return 'Busca y selecciona cursos…';
      case 'ROLE':
        return 'Selecciona roles…';
      case 'USER':
        return 'Busca usuarios por nombre o email…';
      default:
        return 'Selecciona…';
    }
  });

  private readonly bodyHtmlSignal = toSignal(
    this.form.controls.bodyHtml.valueChanges.pipe(
      startWith(this.form.controls.bodyHtml.value),
    ),
    { initialValue: this.form.controls.bodyHtml.value },
  );

  readonly safeBody = computed<SafeHtml>(
    () =>
      this.sanitizer.sanitize(SecurityContext.HTML, this.bodyHtmlSignal() ?? '') ?? '',
  );

  ngOnInit(): void {
    this.form.controls.audienceType.valueChanges
      .pipe(
        startWith(this.form.controls.audienceType.value),
        switchMap((type) => {
          this.form.controls.audienceIds.setValue([]);
          this.audienceError.set(null);
          if (type === 'SCHOOL') {
            this.audienceChipOptions.set([]);
            this.audienceLoading.set(false);
            return of([] as ChipOption[]);
          }
          this.audienceLoading.set(true);
          return this.loadAudienceOptions(type).pipe(
            catchError(() => {
              this.audienceError.set('No se pudieron cargar las opciones de audiencia');
              return of([] as ChipOption[]);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((opts) => {
        this.audienceChipOptions.set(opts);
        this.audienceLoading.set(false);
      });
  }

  async onSaveDraft(): Promise<void> {
    if (!this.validateAudience()) return;
    if (this.form.invalid) return;
    this.publishing.set(true);
    try {
      await firstValueFrom(this.api.create(this.payload()));
      this.router.navigate(['/announcements']);
    } catch (e: any) {
      this.errorMsg.set(e?.error?.message ?? 'No se pudo guardar');
      this.publishing.set(false);
    }
  }

  async onPublish(): Promise<void> {
    if (!this.validateAudience()) return;
    if (this.form.invalid) return;
    this.publishing.set(true);
    this.errorMsg.set(null);
    try {
      const created = await firstValueFrom(this.api.create(this.payload()));
      if (!created?.publicUuid) {
        throw new Error('Create did not return publicUuid — cannot publish');
      }
      await firstValueFrom(this.api.publish(created.publicUuid));
      this.router.navigate(['/announcements']);
    } catch (e: any) {
      this.errorMsg.set(e?.error?.message ?? e?.message ?? 'No se pudo publicar');
      this.publishing.set(false);
    }
  }

  private validateAudience(): boolean {
    const type = this.form.controls.audienceType.value;
    if (type !== 'SCHOOL' && (this.form.controls.audienceIds.value?.length ?? 0) === 0) {
      this.errorMsg.set('Selecciona al menos un destinatario para esta audiencia');
      return false;
    }
    return true;
  }

  private payload() {
    const v = this.form.getRawValue();
    return {
      title: v.title,
      bodyHtml: v.bodyHtml,
      audienceType: v.audienceType,
      audienceIds: v.audienceType === 'SCHOOL' ? [] : [...(v.audienceIds ?? [])],
      pinned: v.pinned,
    };
  }

  private loadAudienceOptions(type: AnnouncementAudience) {
    switch (type) {
      case 'GRADE':
        return this.academicApi.listLevels().pipe(
          map((levels) =>
            levels.flatMap((level) =>
              (level.grades ?? []).map(
                (g): ChipOption => ({
                  id: g.name,
                  label: g.name,
                  subtitle: level.name,
                }),
              ),
            ),
          ),
        );
      case 'SECTION':
        return this.academicApi.listSections().pipe(
          map((rows) =>
            rows.map(
              (s): ChipOption => ({
                id: s.publicUuid,
                label: s.name,
                subtitle: s.gradeName,
              }),
            ),
          ),
        );
      case 'COURSE':
        return this.academicApi.listCourses({ isActive: true }).pipe(
          map((rows) =>
            rows.map(
              (c): ChipOption => ({
                id: c.publicUuid,
                label: c.name,
                subtitle: c.code,
              }),
            ),
          ),
        );
      case 'ROLE':
        return of([...AnnouncementComposerPageComponent.ROLE_OPTIONS]);
      case 'USER':
        return this.usersApi.list({}, { page: 0, size: 100 }).pipe(
          map((page) =>
            (page.content ?? []).map(
              (u): ChipOption => ({
                id: u.publicUuid,
                label: u.fullName || u.email,
                subtitle: u.email,
              }),
            ),
          ),
        );
      default:
        return of([] as ChipOption[]);
    }
  }
}
