import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import { FileUploadService } from '@core/services/file-upload.service';
import {
  AiSource, AiSourceService, SourceAudience, SourceKind,
} from '../../services/ai-source.service';

@Component({
  selector: 'app-ai-sources',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="mx-auto max-w-5xl space-y-6 p-4">
      <a [routerLink]="home" class="text-sm text-indigo-600">← Asistentes</a>
      <header>
        <h1 class="text-2xl font-semibold">Fuentes de conocimiento IA</h1>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Sube un documento del colegio o una copia de una fuente oficial peruana.
          Revisa el texto y publícalo antes de que los asistentes puedan consultarlo.
        </p>
      </header>
      <form (ngSubmit)="register()" class="grid gap-4 rounded-xl border border-slate-200 p-5 dark:border-slate-700">
        <label class="text-sm">Título
          <input name="title" [(ngModel)]="title" required maxlength="240"
            class="mt-1 block w-full rounded-lg border p-2 dark:bg-slate-800" />
        </label>
        <label class="text-sm">Tipo
          <select name="kind" [(ngModel)]="kind"
            class="mt-1 block w-full rounded-lg border p-2 dark:bg-slate-800">
            <option value="INSTITUTIONAL">Documento del colegio</option>
            <option value="OFFICIAL">Currículo o norma oficial del Perú</option>
          </select>
        </label>
        @if (kind === 'OFFICIAL') {
          <label class="text-sm">URL oficial HTTPS
            <input name="sourceUrl" [(ngModel)]="sourceUrl" required maxlength="1000"
              placeholder="https://www.minedu.gob.pe/..."
              class="mt-1 block w-full rounded-lg border p-2 dark:bg-slate-800" />
          </label>
          <label class="text-sm">Versión o resolución
            <input name="sourceVersion" [(ngModel)]="sourceVersion" required maxlength="120"
              class="mt-1 block w-full rounded-lg border p-2 dark:bg-slate-800" />
          </label>
        }
        <fieldset class="text-sm">
          <legend class="font-medium">Visible para</legend>
          <div class="mt-2 flex flex-wrap gap-4">
            <label><input type="checkbox" name="student" [(ngModel)]="audienceStudent" /> Estudiantes</label>
            <label><input type="checkbox" name="teacher" [(ngModel)]="audienceTeacher" /> Docentes</label>
            <label><input type="checkbox" name="family" [(ngModel)]="audienceFamily" /> Familias</label>
          </div>
        </fieldset>
        <label class="text-sm">Fecha de revisión
          <input type="date" name="reviewAfter" [(ngModel)]="reviewAfter"
            class="mt-1 block rounded-lg border p-2 dark:bg-slate-800" />
        </label>
        <label class="text-sm">Archivo PDF, DOCX o TXT (máximo 25 MB)
          <input type="file" accept=".pdf,.docx,.txt" (change)="chooseFile($event)"
            class="mt-1 block w-full text-sm" />
        </label>
        <button type="submit" [disabled]="busy() || !file || !title.trim()"
          class="w-fit rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">
          {{ busy() ? 'Procesando…' : 'Subir e indexar' }}
        </button>
      </form>
      @if (error()) { <p role="alert" class="text-sm text-rose-600">{{ error() }}</p> }
      @if (notice()) { <p role="status" class="text-sm text-emerald-700">{{ notice() }}</p> }
      <section>
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">Documentos</h2>
          <button type="button" (click)="load()" class="rounded-lg border px-3 py-1 text-sm">Actualizar estados</button>
        </div>
        <div class="mt-3 space-y-3">
          @for (source of sources(); track source.publicUuid) {
            <article class="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 class="font-medium">{{ source.title }}</h3>
                  <p class="text-xs text-slate-500">
                    {{ source.kind }} · {{ source.status }} ·
                    {{ source.textBytes }} bytes de texto ·
                    {{ source.audiences.join(', ') }}
                  </p>
                  @if (source.status === 'NEEDS_OCR') {
                    <p class="mt-1 text-sm text-amber-700">
                      Este PDF no contiene texto seleccionable. Requiere OCR antes de publicar.
                    </p>
                  }
                  @if (source.status === 'INDEXING' || source.status === 'PROCESSING') {
                    <p class="mt-1 text-sm text-indigo-700">Indexación en curso. Actualiza los estados en unos segundos.</p>
                  }
                  @if (source.status === 'FAILED') {
                    <p class="mt-1 text-sm text-rose-700">{{ indexErrorMessage(source.indexErrorCode) }}</p>
                  }
                </div>
                <div class="flex gap-2">
                  @if (source.status === 'READY') {
                    <button type="button" (click)="publish(source)"
                      class="rounded-lg bg-emerald-700 px-3 py-1 text-sm text-white">Publicar</button>
                  }
                  @if (source.status === 'FAILED' || source.status === 'NEEDS_OCR') {
                    <button type="button" (click)="retry(source)"
                      class="rounded-lg border px-3 py-1 text-sm">Reintentar</button>
                  }
                  @if (source.status !== 'RETIRED') {
                    <button type="button" (click)="retire(source)"
                      class="rounded-lg border px-3 py-1 text-sm">Retirar</button>
                  }
                </div>
              </div>
            </article>
          } @empty {
            <p class="text-sm text-slate-500">Aún no hay fuentes cargadas.</p>
          }
        </div>
      </section>
    </main>
  `,
})
export class AiSourcesComponent implements OnInit {
  private readonly api = inject(AiSourceService);
  private readonly uploads = inject(FileUploadService);
  readonly home = ROUTES.AI.ROOT;
  readonly sources = signal<AiSource[]>([]);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  title = '';
  kind: SourceKind = 'INSTITUTIONAL';
  sourceUrl = '';
  sourceVersion = '';
  reviewAfter = '';
  audienceStudent = true;
  audienceTeacher = true;
  audienceFamily = true;
  file: File | null = null;
  private stagedFileUuid: string | null = null;

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  chooseFile(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.stagedFileUuid = null;
    if (this.file && this.file.size > 25_000_000) {
      this.file = null;
      this.error.set('El archivo supera el máximo de 25 MB.');
    }
  }

  async register(): Promise<void> {
    if (!this.file || this.busy()) return;
    const audiences: SourceAudience[] = [];
    if (this.audienceStudent) audiences.push('STUDENT');
    if (this.audienceTeacher) audiences.push('TEACHER');
    if (this.audienceFamily) audiences.push('FAMILY');
    if (!audiences.length) {
      this.error.set('Selecciona al menos una audiencia.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      if (!this.stagedFileUuid) {
        this.stagedFileUuid = (await firstValueFrom(
          this.uploads.upload('ai-sources', this.file))).publicUuid;
      }
      const source = await firstValueFrom(this.api.register({
        filePublicUuid: this.stagedFileUuid,
        title: this.title.trim(),
        kind: this.kind,
        audiences,
        sourceUrl: this.kind === 'OFFICIAL' ? this.sourceUrl.trim() : null,
        sourceVersion: this.kind === 'OFFICIAL' ? this.sourceVersion.trim() : null,
        effectiveAt: null,
        reviewAfter: this.reviewAfter || null,
      }));
      this.sources.update((items) => [source, ...items]);
      this.notice.set('Archivo registrado. La indexación continuará en segundo plano.');
      this.stagedFileUuid = null;
      this.file = null;
      this.title = '';
    } catch {
      this.error.set('No se pudo registrar la fuente. Revisa el archivo, plan y metadatos.');
    } finally {
      this.busy.set(false);
    }
  }

  async publish(source: AiSource): Promise<void> {
    try {
      const updated = await firstValueFrom(this.api.publish(source.publicUuid));
      this.sources.update((items) => items.map((item) =>
        item.publicUuid === updated.publicUuid ? updated : item));
      this.notice.set('Fuente publicada.');
    } catch {
      this.error.set('No se pudo publicar la fuente.');
    }
  }

  async retire(source: AiSource): Promise<void> {
    try {
      await firstValueFrom(this.api.retire(source.publicUuid));
      this.sources.update((items) => items.map((item) =>
        item.publicUuid === source.publicUuid ? { ...item, status: 'RETIRED' } : item));
      this.notice.set('Fuente retirada de la búsqueda.');
    } catch {
      this.error.set('No se pudo retirar la fuente.');
    }
  }

  async retry(source: AiSource): Promise<void> {
    try {
      const updated = await firstValueFrom(this.api.retry(source.publicUuid));
      this.sources.update((items) => items.map((item) =>
        item.publicUuid === updated.publicUuid ? updated : item));
      this.notice.set('La indexación se ha puesto en cola de nuevo.');
    } catch {
      this.error.set('No se pudo reintentar la indexación.');
    }
  }

  indexErrorMessage(code: string | null): string {
    if (code === 'AI_SOURCE_TEXT_LIMIT') {
      return 'El texto supera el límite de fuentes del plan. Retira una fuente o consulta un plan superior.';
    }
    if (code === 'AI_SOURCE_INVALID' || code === 'AI_SOURCE_UNSUPPORTED') {
      return 'No se pudo extraer el texto. Revisa el formato del archivo.';
    }
    return 'No se pudo indexar esta fuente. Revisa el archivo o vuelve a intentarlo.';
  }

  async load(): Promise<void> {
    try {
      this.sources.set(await firstValueFrom(this.api.list()));
    } catch {
      this.error.set('No se pudieron cargar las fuentes.');
    }
  }
}
