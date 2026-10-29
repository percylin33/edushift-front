import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  AdminAiPlatformSourcesService,
  AiPlatformSource,
  AiPlatformSourceReviewChecks,
} from '../../services/admin-ai-platform-sources.service';
import { readErrorMessage } from '@core/utils/error.utils';

@Component({
  selector: 'app-admin-ai-global-sources',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (reviewSource(); as source) {
      <main class="min-h-screen space-y-5 bg-slate-950 p-4 text-slate-100 sm:p-6">
        <header class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-start gap-3">
            <button type="button" (click)="closeReview()" class="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">← Volver al catálogo</button>
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-amber-300">Revisión humana requerida</p>
              <h1 class="mt-1 text-xl font-bold text-white sm:text-2xl">{{ source.title }}</h1>
              <p class="mt-1 text-sm text-slate-400">{{ source.sourceVersion }} · {{ source.originalName }}</p>
            </div>
          </div>
          <span class="rounded-full border border-amber-700/60 bg-amber-950/40 px-3 py-1 text-xs font-medium text-amber-200">Pendiente de aprobación</span>
        </header>

        @if (reviewError()) {
          <p role="alert" class="rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-200">{{ reviewError() }}</p>
        }

        <div class="grid gap-5 2xl:grid-cols-[minmax(0,1.25fr)_minmax(420px,0.75fr)]">
          <section class="flex min-h-[55vh] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 2xl:min-h-[72vh]">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
              <div><h2 class="font-semibold text-white">Documento original</h2><p class="text-xs text-slate-400">{{ source.originalName }} · {{ formatBytes(source.sizeBytes) }}</p></div>
              @if (previewUrl()) {
                <a [href]="previewUrl()" [download]="source.originalName" class="text-sm text-indigo-300 underline">Descargar</a>
              }
            </div>
            @if (reviewLoading()) {
              <div role="status" class="flex flex-1 items-center justify-center p-8 text-sm text-slate-400">Cargando el PDF y el texto extraído…</div>
            } @else if (previewContentType() === 'application/pdf' && safePreviewUrl()) {
              <iframe title="Vista previa del documento PDF" [src]="safePreviewUrl()!" class="min-h-[55vh] w-full flex-1 bg-white 2xl:min-h-[72vh]"></iframe>
            } @else if (previewUrl()) {
              <div class="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                <p class="text-sm text-slate-300">La vista integrada está disponible para PDF. Descarga este archivo para revisarlo.</p>
                <a [href]="previewUrl()" [download]="source.originalName" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Descargar documento</a>
              </div>
            } @else {
              <p class="p-5 text-sm text-slate-400">El archivo original no está disponible para previsualización.</p>
            }
          </section>

          <div class="space-y-5">
            <section class="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-2">
              <div><p class="text-xs text-slate-500">Fuente oficial declarada</p><a [href]="source.sourceUrl" target="_blank" rel="noopener noreferrer" class="mt-1 inline-block break-all text-sm text-indigo-300 underline">Abrir fuente oficial ↗</a></div>
              <div><p class="text-xs text-slate-500">Audiencias</p><p class="mt-1 text-sm text-white">{{ audienceLabels(source.audiences) }}</p></div>
              <div><p class="text-xs text-slate-500">Vigente desde</p><p class="mt-1 text-sm text-white">{{ source.effectiveAt || 'Sin fecha de inicio' }}</p></div>
              <div><p class="text-xs text-slate-500">Revisar antes de</p><p class="mt-1 text-sm text-white">{{ source.reviewAfter }}</p></div>
              <div><p class="text-xs text-slate-500">Texto indexado</p><p class="mt-1 text-sm text-white">{{ formatBytes(source.textBytes) }} · {{ reviewDetails()?.indexedChunks ?? 0 }} fragmentos</p></div>
            </section>

            <section class="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
              <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
                <div><h2 class="font-semibold text-white">Texto que consultará la IA</h2><p class="text-xs text-slate-400">Compáralo con el PDF para detectar errores de extracción.</p></div>
                @if (reviewDetails()?.previewTruncated) { <span class="text-xs text-amber-300">Vista parcial</span> }
              </div>
              @if (reviewLoading()) {
                <p class="p-5 text-sm text-slate-400">Cargando texto extraído…</p>
              } @else if (reviewDetails()?.extractedTextPreview) {
                <pre class="max-h-[32vh] overflow-auto whitespace-pre-wrap p-4 font-sans text-sm leading-6 text-slate-200">{{ reviewDetails()?.extractedTextPreview }}</pre>
                @if (reviewDetails()?.previewTruncated) { <p class="border-t border-slate-800 px-4 py-2 text-xs text-slate-500">Se muestran los primeros fragmentos; el índice contiene más texto.</p> }
              } @else {
                <p class="p-5 text-sm text-amber-200">No hay texto extraído. No publiques; vuelve a indexar o carga una versión con texto seleccionable.</p>
              }
            </section>
          </div>
        </div>

        <fieldset class="rounded-xl border border-amber-700/50 bg-amber-950/20 p-4">
          <legend class="px-2 text-sm font-semibold text-amber-200">Lista de verificación obligatoria</legend>
          <div class="grid gap-3 text-sm text-slate-200 md:grid-cols-2">
            <label class="flex items-start gap-2"><input type="checkbox" [ngModel]="reviewChecks().officialUrlMatchesFile" (ngModelChange)="setReviewCheck('officialUrlMatchesFile', $event)" class="mt-1 accent-emerald-500" />Confirmé que el archivo corresponde a la URL oficial y al título.</label>
            <label class="flex items-start gap-2"><input type="checkbox" [ngModel]="reviewChecks().currentVersionConfirmed" (ngModelChange)="setReviewCheck('currentVersionConfirmed', $event)" class="mt-1 accent-emerald-500" />Verifiqué que la norma o versión sigue vigente.</label>
            <label class="flex items-start gap-2"><input type="checkbox" [ngModel]="reviewChecks().extractedTextReviewed" (ngModelChange)="setReviewCheck('extractedTextReviewed', $event)" class="mt-1 accent-emerald-500" />Revisé el PDF y el texto extraído; no contiene datos privados ni errores críticos.</label>
            <label class="flex items-start gap-2"><input type="checkbox" [ngModel]="reviewChecks().audiencesAndDatesConfirmed" (ngModelChange)="setReviewCheck('audiencesAndDatesConfirmed', $event)" class="mt-1 accent-emerald-500" />Confirmé las audiencias y las fechas de vigencia y revisión.</label>
          </div>
        </fieldset>

        <footer class="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-xs text-slate-400">Al publicar, la fuente podrá ser consultada por las audiencias seleccionadas en todos los colegios.</p>
          <div class="flex justify-end gap-2">
            <button type="button" (click)="closeReview()" class="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">Cancelar</button>
            <button type="button" (click)="publishReviewed()" [disabled]="!canPublishReviewed()" class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{{ publishingReview() ? 'Publicando…' : 'Confirmar y publicar' }}</button>
          </div>
        </footer>
      </main>
    } @else {
    <div class="space-y-6 p-6 text-slate-100">
      <header>
        <h1 class="text-2xl font-bold text-white">Fuentes RAG de EduShift</h1>
        <p class="mt-1 text-sm text-slate-400">Documentos oficiales que pueden consultar todos los colegios.</p>
        <p class="mt-3 max-w-4xl rounded-lg border border-amber-700/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          “Lista para revisar” significa que se extrajo el texto; todavía no está aprobado. Abre “Revisar y publicar” para comparar el PDF, el texto indexado, la URL, la versión, las audiencias y las fechas.
        </p>
      </header>

      @if (svc.error(); as error) {
        <div role="alert" class="rounded-lg border border-red-800 bg-red-950/60 p-3 text-sm text-red-300">{{ error }}</div>
      }
      @if (notice()) {
        <div role="status" class="rounded-lg border border-emerald-800 bg-emerald-950/60 p-3 text-sm text-emerald-300">{{ notice() }}</div>
      }

      <section class="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 class="text-lg font-semibold">Cargar documento compartido</h2>
        <p class="mt-1 text-xs text-slate-400">Usa una fuente HTTPS oficial peruana. El archivo se indexa antes de poder publicarse.</p>
        <form class="mt-4 grid gap-4 md:grid-cols-2" (submit)="submit($event)">
          <label class="text-sm">Título
            <input name="title" [(ngModel)]="title" required maxlength="240"
              class="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2" />
          </label>
          <label class="text-sm">Organismo / URL oficial
            <input name="sourceUrl" [(ngModel)]="sourceUrl" required type="url" maxlength="1000"
              placeholder="https://www.gob.pe/..."
              class="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2" />
          </label>
          <label class="text-sm">Versión o norma
            <input name="sourceVersion" [(ngModel)]="sourceVersion" required maxlength="120"
              placeholder="RM 501-2025-MINEDU"
              class="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2" />
          </label>
          <label class="text-sm">Vigente desde (opcional)
            <input name="effectiveAt" [(ngModel)]="effectiveAt" type="date"
              class="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2" />
          </label>
          <label class="text-sm">Revisar antes de
            <input name="reviewAfter" [(ngModel)]="reviewAfter" required type="date"
              class="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2" />
          </label>
          <label class="text-sm">Archivo PDF, DOCX o TXT (máx. 25 MB)
            <input name="file" required type="file" accept=".pdf,.docx,.txt"
              (change)="selectFile($event)"
              class="mt-1 block w-full text-sm text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-white" />
          </label>
          <fieldset class="md:col-span-2">
            <legend class="text-sm">Audiencias que pueden consultarlo</legend>
            <div class="mt-2 flex flex-wrap gap-4 text-sm">
              <label><input type="checkbox" [(ngModel)]="forStudents" name="forStudents" /> Estudiantes</label>
              <label><input type="checkbox" [(ngModel)]="forTeachers" name="forTeachers" /> Docentes</label>
              <label><input type="checkbox" [(ngModel)]="forFamilies" name="forFamilies" /> Familias</label>
            </div>
          </fieldset>
          <div class="md:col-span-2">
            <button type="submit" [disabled]="uploading() || svc.busy() || !file()"
              class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {{ uploading() ? 'Subiendo…' : 'Subir e indexar' }}
            </button>
          </div>
        </form>
      </section>

      <section class="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-semibold">Catálogo de EduShift</h2>
          <button type="button" (click)="svc.load()" class="text-sm text-indigo-300 underline">Actualizar</button>
        </div>
        @if (svc.busy()) { <p class="text-sm text-slate-400">Cargando…</p> }
        @else if (svc.sources().length === 0) { <p class="text-sm text-slate-400">Aún no hay fuentes cargadas.</p> }
        @else {
          <table class="w-full min-w-[850px] text-left text-sm">
            <thead class="border-b border-slate-700 text-xs uppercase text-slate-400">
              <tr><th class="py-3 pr-4">Documento</th><th class="py-3 pr-4">Estado</th><th class="py-3 pr-4">Audiencias</th><th class="py-3 pr-4">Revisión</th><th class="py-3">Acciones</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-800">
              @for (source of svc.sources(); track source.publicUuid) {
                <tr class="align-top">
                  <td class="py-3 pr-4">
                    <p class="font-medium text-white">{{ source.title }}</p>
                    <p class="mt-1 text-xs text-slate-400">{{ source.sourceVersion }} · {{ source.originalName }}</p>
                    <a [href]="source.sourceUrl" target="_blank" rel="noopener noreferrer" class="mt-1 inline-block text-xs text-indigo-300 underline">Ver fuente oficial</a>
                    @if (source.indexErrorCode) { <p class="mt-1 text-xs text-red-300">{{ source.indexErrorCode }}</p> }
                  </td>
                  <td class="py-3 pr-4">{{ statusLabel(source.status) }}</td>
                  <td class="py-3 pr-4">{{ audienceLabels(source.audiences) }}</td>
                  <td class="py-3 pr-4">{{ source.reviewAfter }}</td>
                  <td class="py-3">
                    <div class="flex flex-wrap gap-2">
                      @if (source.status === 'READY') {
                        <button type="button" (click)="openReview(source)" class="font-semibold text-emerald-300 underline">Revisar y publicar</button>
                      }
                      @if (source.status === 'READY' || source.status === 'PUBLISHED') {
                        <button type="button" (click)="reindex(source)" class="text-amber-300 underline">Reindexar</button>
                      }
                      @if (source.status === 'FAILED' || source.status === 'NEEDS_OCR') {
                        <button type="button" (click)="retry(source)" class="text-amber-300 underline">Reintentar</button>
                      }
                      @if (source.status !== 'RETIRED') {
                        <button type="button" (click)="retire(source)" class="text-red-300 underline">Retirar</button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </section>
    </div>
    }
  `,
})
export class AdminAiGlobalSourcesComponent implements OnInit, OnDestroy {
  protected readonly svc = inject(AdminAiPlatformSourcesService);
  private readonly sanitizer = inject(DomSanitizer);
  private reviewRequestVersion = 0;
  protected readonly uploading = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly file = signal<File | null>(null);
  protected readonly reviewSource = signal<AiPlatformSource | null>(null);
  protected readonly reviewDetails = signal<{ extractedTextPreview: string; indexedChunks: number; previewTruncated: boolean } | null>(null);
  protected readonly reviewLoading = signal(false);
  protected readonly reviewError = signal<string | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly safePreviewUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.previewUrl();
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
  protected readonly previewContentType = signal('');
  protected readonly publishingReview = signal(false);
  protected readonly reviewChecks = signal<AiPlatformSourceReviewChecks>({
    officialUrlMatchesFile: false,
    currentVersionConfirmed: false,
    extractedTextReviewed: false,
    audiencesAndDatesConfirmed: false,
  });
  protected readonly canPublishReviewed = computed(() => {
    const checks = this.reviewChecks();
    return !this.reviewLoading() && !this.publishingReview() && this.reviewDetails() !== null
      && !!this.reviewDetails()?.extractedTextPreview.trim() && !!this.previewUrl()
      && Object.values(checks).every(Boolean);
  });
  private readonly reviewObjectUrl = signal<string | null>(null);

  protected title = '';
  protected sourceUrl = '';
  protected sourceVersion = '';
  protected effectiveAt = '';
  protected reviewAfter = '';
  protected forStudents = true;
  protected forTeachers = true;
  protected forFamilies = false;

  ngOnInit(): void { void this.svc.load(); }

  ngOnDestroy(): void { this.closeReview(); }

  protected selectFile(event: Event): void {
    this.file.set((event.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    const selected = this.file();
    const audiences = [
      this.forStudents ? 'STUDENT' : null,
      this.forTeachers ? 'TEACHER' : null,
      this.forFamilies ? 'FAMILY' : null,
    ].filter((value): value is string => value !== null);
    if (!selected || audiences.length === 0) {
      this.svc.error.set('Selecciona un archivo y al menos una audiencia.');
      return;
    }
    this.uploading.set(true);
    this.svc.error.set(null);
    this.notice.set(null);
    try {
      await this.svc.upload({
        title: this.title,
        sourceUrl: this.sourceUrl,
        sourceVersion: this.sourceVersion,
        effectiveAt: this.effectiveAt,
        reviewAfter: this.reviewAfter,
        audiences,
        file: selected,
      });
      this.title = '';
      this.sourceUrl = '';
      this.sourceVersion = '';
      this.effectiveAt = '';
      this.reviewAfter = '';
      this.file.set(null);
      this.notice.set('Fuente cargada. La indexación se ejecutará en segundo plano.');
    } catch (err: unknown) {
      this.svc.error.set(readErrorMessage(err, 'No se pudo cargar la fuente.'));
    } finally {
      this.uploading.set(false);
    }
  }

  protected async openReview(source: AiPlatformSource): Promise<void> {
    this.closeReview();
    const requestVersion = ++this.reviewRequestVersion;
    this.reviewSource.set(source);
    this.reviewLoading.set(true);
    try {
      const [details, blob] = await Promise.all([
        this.svc.loadReview(source.publicUuid),
        this.svc.downloadOriginal(source.publicUuid),
      ]);
      if (requestVersion !== this.reviewRequestVersion) return;
      this.reviewDetails.set(details);
      this.previewContentType.set(blob.type.split(';', 1)[0]?.trim().toLowerCase() ?? '');
      const url = URL.createObjectURL(blob);
      this.reviewObjectUrl.set(url);
      this.previewUrl.set(url);
      this.reviewError.set(null);
    } catch (err: unknown) {
      if (requestVersion === this.reviewRequestVersion) {
        this.reviewError.set(readErrorMessage(err, 'No se pudo cargar la vista de revisión.'));
      }
    } finally {
      if (requestVersion === this.reviewRequestVersion) this.reviewLoading.set(false);
    }
  }

  protected closeReview(): void {
    this.reviewRequestVersion++;
    this.reviewSource.set(null);
    this.reviewDetails.set(null);
    this.reviewError.set(null);
    this.previewContentType.set('');
    this.reviewChecks.set({
      officialUrlMatchesFile: false,
      currentVersionConfirmed: false,
      extractedTextReviewed: false,
      audiencesAndDatesConfirmed: false,
    });
    this.clearReviewObjectUrl();
  }

  protected setReviewCheck(key: keyof AiPlatformSourceReviewChecks, value: boolean): void {
    this.reviewChecks.update((checks) => ({ ...checks, [key]: value }));
  }

  protected async publishReviewed(): Promise<void> {
    const source = this.reviewSource();
    if (!source || !this.canPublishReviewed()) return;
    this.publishingReview.set(true);
    this.reviewError.set(null);
    try {
      await this.svc.publish(source.publicUuid, this.reviewChecks());
      this.closeReview();
      this.notice.set('Fuente revisada y publicada para las audiencias seleccionadas.');
    } catch (err: unknown) {
      this.reviewError.set(readErrorMessage(err, 'No se pudo publicar la fuente.'));
    } finally {
      this.publishingReview.set(false);
    }
  }

  protected audienceLabels(audiences: string[]): string {
    const labels: Record<string, string> = {
      STUDENT: 'Estudiantes', TEACHER: 'Docentes', FAMILY: 'Familias',
    };
    return audiences.map((audience) => labels[audience] ?? audience).join(', ');
  }

  protected formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private clearReviewObjectUrl(): void {
    const url = this.reviewObjectUrl();
    if (url) URL.revokeObjectURL(url);
    this.reviewObjectUrl.set(null);
    this.previewUrl.set(null);
  }

  protected async retry(source: AiPlatformSource): Promise<void> {
    await this.runAction(() => this.svc.retry(source.publicUuid), 'Se reintentará la indexación.');
  }

  protected async reindex(source: AiPlatformSource): Promise<void> {
    const message = source.status === 'PUBLISHED'
      ? 'La fuente se retirará temporalmente de las respuestas mientras se reindexa. Al terminar, tendrás que revisar el texto y publicarla de nuevo. ¿Continuar?'
      : 'Se volverá a extraer el texto del archivo. Al terminar, tendrás que revisar el resultado antes de publicarlo. ¿Continuar?';
    if (!window.confirm(message)) return;
    await this.runAction(() => this.svc.reindex(source.publicUuid), 'Se inició la reindexación. Revisa el estado en unos segundos.');
  }

  protected async retire(source: AiPlatformSource): Promise<void> {
    await this.runAction(() => this.svc.retire(source.publicUuid), 'Fuente retirada del RAG compartido.');
  }

  protected statusLabel(status: string): string {
    const labels: Record<string, string> = {
      INDEXING: 'En cola', PROCESSING: 'Indexando', READY: 'Lista para revisar',
      PUBLISHED: 'Publicada', NEEDS_OCR: 'Requiere OCR', FAILED: 'Falló', RETIRED: 'Retirada',
    };
    return labels[status] ?? status;
  }

  private async runAction(action: () => Promise<void>, success: string): Promise<void> {
    this.svc.error.set(null);
    this.notice.set(null);
    try {
      await action();
      this.notice.set(success);
    } catch (err: unknown) {
      this.svc.error.set(readErrorMessage(err, 'No se pudo actualizar la fuente.'));
    }
  }
}
