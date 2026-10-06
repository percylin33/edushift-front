import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { SecurityContext } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, firstValueFrom, map, of, shareReplay, switchMap } from 'rxjs';
import { startWith } from 'rxjs/operators';
import { Permission, UserRole } from '@core/enums';
import { AuthService } from '@core/services';
import { ChipMultiSelectComponent, ChipOption } from '@shared/components';
import { AcademicApiService } from '../../../academic/services/academic-api.service';
import { UsersApiService } from '../../../users/services/users-api.service';
import { AnnouncementsApiService } from '../../services/announcements-api.service';
import {
  AnnouncementAudience,
  AudiencePreview,
  TeachingScope,
} from '../../models/announcement.model';

/**
 * Announcement composer. Admins target any audience. Teachers only see
 * their assigned sections and courses. Students never reach this page.
 * The body is a visual editor; HTML stays in the form control.
 */
@Component({
  selector: 'app-announcement-composer-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ChipMultiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .announce-editor.is-empty:before {
        content: attr(data-placeholder);
        color: rgb(148 163 184);
        pointer-events: none;
      }
    `,
  ],
  template: `
    <section class="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <a routerLink="/announcements" class="text-sm text-slate-500 hover:text-slate-700">← Volver</a>
      <h1 class="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
        {{ editingId() ? 'Editar anuncio' : 'Nuevo anuncio' }}
      </h1>

      <form [formGroup]="form" (ngSubmit)="onPublish()" class="mt-6 space-y-6">
        <fieldset class="rounded-2xl bg-white p-5 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <legend class="px-2 text-sm font-semibold text-slate-700 dark:text-slate-200">1. Audiencia</legend>
          <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            @for (a of visibleAudiences(); track a.value) {
              <label class="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:border-emerald-500 has-[:checked]:bg-emerald-50 dark:border-slate-700 dark:has-[:checked]:bg-emerald-900/20">
                <input type="radio" formControlName="audienceType" [value]="a.value" class="text-emerald-600" />
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

          @if (showGuardians()) {
            <label class="mt-4 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input type="checkbox" formControlName="includeGuardians" class="text-emerald-600" />
              Incluir apoderados con cuenta en el portal
            </label>
          }
        </fieldset>

        <fieldset class="rounded-2xl bg-white p-5 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <legend class="px-2 text-sm font-semibold text-slate-700 dark:text-slate-200">2. Contenido</legend>
          <div class="mt-3 space-y-3">
            <div>
              <label class="text-xs text-slate-500">Título</label>
              <input type="text" formControlName="title" maxlength="200" class="mt-1 w-full rounded-lg border-slate-200 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800" />
            </div>
            <div>
              <label class="text-xs text-slate-500">Mensaje</label>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Escribe como en un documento. El formato se guarda solo; no hace falta escribir etiquetas.
              </p>
              <div class="mt-2 flex flex-wrap gap-1">
                <button type="button" class="rounded border border-slate-200 px-2 py-1 text-xs font-semibold dark:border-slate-700" (mousedown)="$event.preventDefault()" (click)="format('bold')">Negrita</button>
                <button type="button" class="rounded border border-slate-200 px-2 py-1 text-xs italic dark:border-slate-700" (mousedown)="$event.preventDefault()" (click)="format('italic')">Cursiva</button>
                <button type="button" class="rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-700" (mousedown)="$event.preventDefault()" (click)="format('formatBlock', 'h2')">Título</button>
                <button type="button" class="rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-700" (mousedown)="$event.preventDefault()" (click)="format('insertUnorderedList')">Lista</button>
                <button type="button" class="rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-700" (mousedown)="$event.preventDefault()" (click)="insertLink()">Enlace</button>
              </div>
              <div
                #editor
                class="announce-editor mt-2 min-h-40 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 [&_a]:text-emerald-600 [&_a]:underline [&_h2]:mb-1 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
                [class.is-empty]="!form.controls.bodyHtml.value"
                contenteditable="true"
                role="textbox"
                aria-multiline="true"
                aria-label="Mensaje del anuncio"
                data-placeholder="Escribe aquí el aviso para alumnos y familias…"
                (input)="onEditorInput()"
                (paste)="onPaste($event)"
              ></div>
            </div>
            <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input type="checkbox" formControlName="pinned" class="text-emerald-600" />
              Fijar este anuncio (sale primero)
            </label>
            <div>
              <label class="text-xs text-slate-500">Publicar en (opcional)</label>
              <input type="datetime-local" formControlName="publishAt" class="mt-1 rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800" />
            </div>
          </div>
        </fieldset>

        <fieldset class="rounded-2xl bg-white p-5 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <legend class="px-2 text-sm font-semibold text-slate-700 dark:text-slate-200">3. Publicar</legend>
          <div class="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
            <button type="button" class="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold dark:border-slate-700" (click)="refreshPreview()">
              Ver destinatarios
            </button>
            @if (preview(); as p) {
              <span>{{ p.students }} alumnos · {{ p.teachers }} docentes · {{ p.guardians }} apoderados · {{ p.total }} en total</span>
            }
          </div>

          <div class="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button type="button" (click)="onSaveDraft()" class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              Guardar borrador
            </button>
            <button type="submit" [disabled]="form.invalid || publishing()" class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
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
  @ViewChild('editor') private editor?: ElementRef<HTMLDivElement>;

  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AnnouncementsApiService);
  private readonly academicApi = inject(AcademicApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  private readonly audienceTypeRadios: { value: AnnouncementAudience; label: string }[] = [
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

  readonly editingId = signal<string | null>(null);
  readonly publishing = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly audienceChipOptions = signal<ChipOption[]>([]);
  readonly audienceLoading = signal(false);
  readonly audienceError = signal<string | null>(null);
  readonly preview = signal<AudiencePreview | null>(null);

  readonly teacherScoped = computed(
    () =>
      this.auth.hasRole(UserRole.Teacher) &&
      !this.auth.hasRole(UserRole.TenantAdmin) &&
      !this.auth.hasRole(UserRole.SuperAdmin) &&
      !this.auth.hasPermission(Permission.LmsAnnouncementsCreate),
  );

  readonly visibleAudiences = computed(() =>
    this.teacherScoped()
      ? this.audienceTypeRadios.filter((a) => a.value === 'SECTION' || a.value === 'COURSE')
      : this.audienceTypeRadios,
  );

  readonly form = this.fb.group({
    audienceType: this.fb.nonNullable.control<AnnouncementAudience>('SCHOOL'),
    audienceIds: this.fb.nonNullable.control<string[]>([]),
    title: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(200)]),
    bodyHtml: this.fb.nonNullable.control('', [Validators.required]),
    pinned: this.fb.nonNullable.control(false),
    includeGuardians: this.fb.nonNullable.control(true),
    publishAt: this.fb.nonNullable.control(''),
  });

  readonly audienceType = toSignal(
    this.form.controls.audienceType.valueChanges.pipe(startWith(this.form.controls.audienceType.value)),
    { initialValue: this.form.controls.audienceType.value },
  );

  readonly showGuardians = computed(() => {
    const type = this.audienceType();
    return type === 'GRADE' || type === 'SECTION' || type === 'COURSE';
  });

  readonly audienceSelectLabel = computed(() => {
    switch (this.audienceType()) {
      case 'GRADE': return 'Grados';
      case 'SECTION': return 'Secciones';
      case 'COURSE': return 'Cursos';
      case 'ROLE': return 'Roles';
      case 'USER': return 'Usuarios';
      default: return 'Destinatarios';
    }
  });

  readonly audiencePlaceholder = computed(() => {
    switch (this.audienceType()) {
      case 'GRADE': return 'Busca y selecciona grados…';
      case 'SECTION': return 'Busca y selecciona secciones…';
      case 'COURSE': return 'Busca y selecciona cursos…';
      case 'ROLE': return 'Selecciona roles…';
      case 'USER': return 'Busca usuarios por nombre o email…';
      default: return 'Selecciona…';
    }
  });

  private hydrating = false;
  private pendingAudienceIds: string[] | null = null;
  private readonly scope$ = this.teacherScoped()
    ? this.api.teachingScope().pipe(shareReplay(1))
    : of({ sections: [], courses: [] } as TeachingScope);

  ngOnInit(): void {
    document.execCommand('defaultParagraphSeparator', false, 'p');
    if (this.teacherScoped()) {
      this.form.controls.audienceType.setValue('SECTION');
    }
    const id = this.route.snapshot.paramMap.get('publicUuid');
    if (id) this.editingId.set(id);

    this.form.controls.audienceType.valueChanges
      .pipe(
        startWith(this.form.controls.audienceType.value),
        switchMap((type) => {
          if (!this.hydrating) this.form.controls.audienceIds.setValue([]);
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
        if (this.pendingAudienceIds) {
          this.form.controls.audienceIds.setValue(this.pendingAudienceIds);
          this.pendingAudienceIds = null;
          this.hydrating = false;
        }
      });

    if (id) this.hydrate(id);
  }

  onEditorInput(): void {
    const el = this.editor?.nativeElement;
    if (!el) return;
    const text = el.innerText.replace(/\u00a0/g, ' ').trim();
    if (!text) {
      if (el.innerHTML !== '') el.innerHTML = '';
      this.form.controls.bodyHtml.setValue('');
      return;
    }
    this.form.controls.bodyHtml.setValue(el.innerHTML);
  }

  format(command: string, value?: string): void {
    this.editor?.nativeElement.focus();
    document.execCommand(command, false, value);
    this.onEditorInput();
  }

  insertLink(): void {
    const url = window.prompt('Pega la dirección del enlace (https://…)');
    if (!url) return;
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed) && !/^mailto:/i.test(trimmed)) {
      this.errorMsg.set('El enlace debe empezar por https://');
      return;
    }
    this.errorMsg.set(null);
    this.format('createLink', trimmed);
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const html = event.clipboardData?.getData('text/html');
    const text = event.clipboardData?.getData('text/plain') ?? '';
    const clean = html ? (this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '') : '';
    if (clean) document.execCommand('insertHTML', false, clean);
    else document.execCommand('insertText', false, text);
    this.onEditorInput();
  }

  async refreshPreview(): Promise<void> {
    if (!this.validateAudience()) return;
    try {
      const preview = await firstValueFrom(this.api.preview(this.payload()));
      this.preview.set(preview);
    } catch {
      this.errorMsg.set('No se pudo calcular la audiencia');
    }
  }

  async onSaveDraft(): Promise<void> {
    if (!this.validateAudience()) return;
    if (this.form.invalid) return;
    this.publishing.set(true);
    try {
      await this.persist();
      await this.router.navigate(['/announcements']);
    } catch (e: unknown) {
      this.errorMsg.set(this.messageOf(e, 'No se pudo guardar'));
      this.publishing.set(false);
    }
  }

  async onPublish(): Promise<void> {
    if (!this.validateAudience()) return;
    if (this.form.invalid) return;
    this.publishing.set(true);
    this.errorMsg.set(null);
    try {
      await this.refreshPreview();
      const saved = await this.persist();
      if (!saved?.publicUuid) throw new Error('Create did not return publicUuid — cannot publish');
      await firstValueFrom(this.api.publish(saved.publicUuid));
      await this.router.navigate(['/announcements']);
    } catch (e: unknown) {
      this.errorMsg.set(this.messageOf(e, 'No se pudo publicar'));
      this.publishing.set(false);
    }
  }

  private async persist() {
    const body = this.payload();
    const id = this.editingId();
    if (id) return firstValueFrom(this.api.update(id, body));
    const created = await firstValueFrom(this.api.create(body));
    if (created?.publicUuid) this.editingId.set(created.publicUuid);
    return created;
  }

  private hydrate(id: string): void {
    this.api.get(id).subscribe({
      next: (a) => {
        this.hydrating = true;
        this.pendingAudienceIds = a.audienceIds ?? [];
        this.form.patchValue({
          audienceType: a.audienceType,
          title: a.title,
          bodyHtml: a.bodyHtml,
          pinned: a.pinned,
          includeGuardians: a.includeGuardians ?? true,
          publishAt: toLocalInput(a.publishAt),
        });
        this.paintBody(a.bodyHtml ?? '');
        if (a.audienceType === 'SCHOOL') {
          this.pendingAudienceIds = null;
          this.hydrating = false;
        }
      },
      error: () => this.errorMsg.set('No se pudo abrir el anuncio'),
    });
  }

  private validateAudience(): boolean {
    const type = this.form.controls.audienceType.value;
    if (type !== 'SCHOOL' && (this.form.controls.audienceIds.value?.length ?? 0) === 0) {
      this.errorMsg.set('Selecciona al menos un destinatario para esta audiencia');
      return false;
    }
    this.errorMsg.set(null);
    return true;
  }

  private payload() {
    const v = this.form.getRawValue();
    const guardians = v.audienceType === 'GRADE' || v.audienceType === 'SECTION' || v.audienceType === 'COURSE';
    return {
      title: v.title,
      bodyHtml: this.sanitizer.sanitize(SecurityContext.HTML, v.bodyHtml) ?? '',
      audienceType: v.audienceType,
      audienceIds: v.audienceType === 'SCHOOL' ? [] : [...(v.audienceIds ?? [])],
      pinned: v.pinned,
      includeGuardians: guardians ? v.includeGuardians : false,
      publishAt: v.publishAt ? new Date(v.publishAt).toISOString() : null,
    };
  }

  private loadAudienceOptions(type: AnnouncementAudience) {
    if (this.teacherScoped() && (type === 'SECTION' || type === 'COURSE')) {
      return this.scope$.pipe(
        map((scope) =>
          (type === 'SECTION' ? scope.sections : scope.courses).map(
            (row): ChipOption => ({ id: row.id, label: row.label, subtitle: row.subtitle }),
          ),
        ),
      );
    }
    switch (type) {
      case 'GRADE':
        return this.academicApi.listLevels().pipe(
          map((levels) =>
            levels.flatMap((level) =>
              (level.grades ?? []).map(
                (g): ChipOption => ({ id: g.publicUuid, label: g.name, subtitle: level.name }),
              ),
            ),
          ),
        );
      case 'SECTION':
        return this.academicApi.listSections().pipe(
          map((rows) => rows.map((s): ChipOption => ({ id: s.publicUuid, label: s.name, subtitle: s.gradeName }))),
        );
      case 'COURSE':
        return this.academicApi.listCourses({ isActive: true }).pipe(
          map((rows) => rows.map((c): ChipOption => ({ id: c.publicUuid, label: c.name, subtitle: c.code }))),
        );
      case 'ROLE':
        return of([...AnnouncementComposerPageComponent.ROLE_OPTIONS]);
      case 'USER':
        return this.usersApi.list({}, { page: 0, size: 100 }).pipe(
          map((page) =>
            (page.content ?? []).map(
              (u): ChipOption => ({ id: u.publicUuid, label: u.fullName || u.email, subtitle: u.email }),
            ),
          ),
        );
      default:
        return of([] as ChipOption[]);
    }
  }

  private paintBody(html: string): void {
    const apply = () => {
      const el = this.editor?.nativeElement;
      if (!el) return;
      el.innerHTML = html;
    };
    if (this.editor) apply();
    else queueMicrotask(apply);
  }

  private messageOf(e: unknown, fallback: string): string {
    const err = e as { error?: { message?: string }; message?: string };
    return err?.error?.message ?? err?.message ?? fallback;
  }
}

function toLocalInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
