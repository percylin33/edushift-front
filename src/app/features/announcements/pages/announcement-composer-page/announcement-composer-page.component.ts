import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AnnouncementsApiService } from '../../services/announcements-api.service';
import { AnnouncementAudience } from '../../models/announcement.model';

/**
 * Announcement composer (Sprint 9 / FE-9.2).
 *
 * <p>3-step wizard (Sprint 9 uses 1 page with a 3-pane layout, which
 * is the modern equivalent):</p>
 * <ol>
 *   <li>Pick audience (SCHOOL / GRADE / SECTION / COURSE / ROLE / USER).</li>
 *   <li>Write the title + body (sanitized on the server; we send HTML).</li>
 *   <li>Preview + Publish (or save as DRAFT).</li>
 * </ol>
 *
 * <p>Pin: a checkbox to mark the announcement as pinned (it floats
 * to the top of the announcements list). Publish: immediate
 * dispatch to all recipients via the outbox.</p>
 */
@Component({
  selector: 'edushift-announcement-composer-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <a routerLink="/announcements" class="text-sm text-slate-500
                                            hover:text-slate-700">← Volver</a>
      <h1 class="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
        Nuevo anuncio
      </h1>

      <form [formGroup]="form" (ngSubmit)="onPublish()" class="mt-6 space-y-6">
        <!-- Step 1: audience -->
        <fieldset class="rounded-2xl bg-white dark:bg-slate-900 shadow
                         ring-1 ring-slate-200 dark:ring-slate-800 p-5">
          <legend class="px-2 text-sm font-semibold text-slate-700
                         dark:text-slate-200">1. Audiencia</legend>
          <div class="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
            @for (a of audienceOptions; track a.value) {
              <label class="flex items-center gap-2 rounded-lg border
                            border-slate-200 dark:border-slate-700 px-3 py-2
                            cursor-pointer hover:border-emerald-500
                            has-[:checked]:bg-emerald-50
                            dark:has-[:checked]:bg-emerald-900/20">
                <input type="radio" formControlName="audienceType"
                       [value]="a.value" class="text-emerald-600"/>
                <span class="text-sm">{{ a.label }}</span>
              </label>
            }
          </div>
          @if (form.controls.audienceType.value !== 'SCHOOL') {
            <div class="mt-3">
              <label class="text-xs text-slate-500">
                IDs de audiencia (separados por coma, según el tipo)
              </label>
              <input type="text" formControlName="audienceIdsCsv"
                     class="mt-1 w-full rounded-lg border-slate-200
                            dark:border-slate-700 dark:bg-slate-800
                            focus:ring-emerald-500"
                     placeholder="e.g. 1A, 1B"/>
            </div>
          }
        </fieldset>

        <!-- Step 2: content -->
        <fieldset class="rounded-2xl bg-white dark:bg-slate-900 shadow
                         ring-1 ring-slate-200 dark:ring-slate-800 p-5">
          <legend class="px-2 text-sm font-semibold text-slate-700
                         dark:text-slate-200">2. Contenido</legend>
          <div class="mt-3 space-y-3">
            <div>
              <label class="text-xs text-slate-500">Título</label>
              <input type="text" formControlName="title" maxlength="200"
                     class="mt-1 w-full rounded-lg border-slate-200
                            dark:border-slate-700 dark:bg-slate-800
                            focus:ring-emerald-500"/>
            </div>
            <div>
              <label class="text-xs text-slate-500">Cuerpo (HTML permitido:
                h1-h3, p, ul, ol, li, strong, em, a href http(s) mailto,
                br, table, thead, tbody, tr, th, td)</label>
              <textarea formControlName="bodyHtml" rows="8"
                        class="mt-1 w-full rounded-lg border-slate-200
                               dark:border-slate-700 dark:bg-slate-800
                               focus:ring-emerald-500 font-mono text-sm"></textarea>
            </div>
            <label class="flex items-center gap-2 text-sm text-slate-700
                          dark:text-slate-200">
              <input type="checkbox" formControlName="pinned"
                     class="text-emerald-600"/>
              Fijar este anuncio (sale primero)
            </label>
          </div>
        </fieldset>

        <!-- Step 3: preview + actions -->
        <fieldset class="rounded-2xl bg-white dark:bg-slate-900 shadow
                         ring-1 ring-slate-200 dark:ring-slate-800 p-5">
          <legend class="px-2 text-sm font-semibold text-slate-700
                         dark:text-slate-200">3. Vista previa</legend>
          <div class="mt-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 p-4">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {{ form.controls.title.value || '(sin título)' }}
            </h2>
            <div class="mt-2 prose prose-sm dark:prose-invert max-w-none"
                 [innerHTML]="safeBody()"></div>
          </div>

          <div class="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button type="button" (click)="onSaveDraft()"
                    class="rounded-lg border border-slate-200 dark:border-slate-700
                           px-4 py-2 text-sm font-semibold text-slate-700
                           dark:text-slate-200 hover:bg-slate-50
                           dark:hover:bg-slate-800">
              Guardar borrador
            </button>
            <button type="submit"
                    [disabled]="form.invalid || publishing()"
                    class="rounded-lg bg-emerald-600 px-4 py-2 text-sm
                           font-semibold text-white hover:bg-emerald-700
                           disabled:opacity-50">
              {{ publishing() ? 'Publicando…' : 'Publicar ahora' }}
            </button>
          </div>
          @if (errorMsg()) {
            <p class="mt-3 text-sm text-rose-600">{{ errorMsg() }}</p>
          }
        </fieldset>
      </form>
    </section>
  `
})
export class AnnouncementComposerPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AnnouncementsApiService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);

  readonly audienceOptions: { value: AnnouncementAudience; label: string }[] = [
    { value: 'SCHOOL',   label: 'Toda la escuela' },
    { value: 'GRADE',    label: 'Por grado' },
    { value: 'SECTION',  label: 'Por sección' },
    { value: 'COURSE',   label: 'Por curso' },
    { value: 'ROLE',     label: 'Por rol (e.g. TEACHER)' },
    { value: 'USER',     label: 'Usuarios específicos' }
  ];

  readonly form = this.fb.group({
    audienceType: this.fb.nonNullable.control<AnnouncementAudience>('SCHOOL'),
    audienceIdsCsv: this.fb.nonNullable.control(''),
    title: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(200)]),
    bodyHtml: this.fb.nonNullable.control('', [Validators.required]),
    pinned: this.fb.nonNullable.control(false)
  });

  readonly publishing = signal(false);
  readonly errorMsg = signal<string | null>(null);

  /**
   * Sprint 10 / DEBT-9-FE-1 (XSS defense in depth):
   * Sanitize the body before [innerHTML]. The backend also sanitizes
   * with jsoup (allowlist) but we never trust the round-trip: a
   * bug or migration could send raw `<script>` and we don't want
   * it to execute in the composer's preview iframe-less context.
   */
  readonly safeBody = computed<SafeHtml>(() =>
    this.sanitizer.sanitize(
      this.sanitizer.SECURITY_CONTEXT,
      this.form.controls.bodyHtml.value ?? ''
    ) ?? ''
  );

  async onSaveDraft(): Promise<void> {
    if (this.form.invalid) return;
    this.publishing.set(true);
    try {
      await this.api.create(this.payload(false)).toPromise();
      this.router.navigate(['/announcements']);
    } catch (e: any) {
      this.errorMsg.set(e?.error?.message ?? 'No se pudo guardar');
      this.publishing.set(false);
    }
  }

  async onPublish(): Promise<void> {
    if (this.form.invalid) return;
    this.publishing.set(true);
    this.errorMsg.set(null);
    try {
      const created = await this.api.create(this.payload(false)).toPromise();
      if (created?.publicUuid) {
        await this.api.publish(created.publicUuid).toPromise();
      }
      this.router.navigate(['/announcements']);
    } catch (e: any) {
      this.errorMsg.set(e?.error?.message ?? 'No se pudo publicar');
      this.publishing.set(false);
    }
  }

  private payload(_: boolean) {
    const v = this.form.getRawValue();
    return {
      title: v.title,
      bodyHtml: v.bodyHtml,
      audienceType: v.audienceType,
      audienceIds: v.audienceIdsCsv
        ? v.audienceIdsCsv.split(',').map(s => s.trim()).filter(Boolean)
        : [],
      pinned: v.pinned
    };
  }
}
