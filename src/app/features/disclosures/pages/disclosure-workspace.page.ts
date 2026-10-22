import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AcademicApiService } from '@features/academic/services/academic-api.service';
import { AcademicYearRow } from '@features/academic/models/academic-year.model';
import { FileMetadata, FileUploadService } from '@core/services';
import { AuthService } from '@core/services/auth.service';
import { Permission, UserRole } from '@core/enums';
import { DisclosuresApiService } from '../services/disclosures-api.service';
import { FilePreviewDialogComponent } from '@shared/components';
import {
  DisclosureAttachmentCategory,
  DisclosureContent,
  DisclosureField,
  DisclosureFieldDefinition,
  DisclosurePackage,
  DisclosureVersionSummary,
} from '../models/disclosure.model';

@Component({
  selector: 'app-disclosure-workspace-page',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, FilePreviewDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header class="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">Gestión institucional</p>
          <h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Información anual para familias</h1>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            Avanza requisito por requisito. En cada paso puedes escribir una respuesta o subir el documento que la respalda; los datos disponibles en EduShift se completan solos.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          @if (selectedYearUuid()) {
            @if (canCopyPrevious()) {
              <button type="button" (click)="copyPreviousYear()" [disabled]="busy() || uploading()" class="rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-900 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-indigo-950/40">Copiar año anterior</button>
            }
            <button type="button" (click)="downloadPreview()" [disabled]="busy() || uploading()" class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">Descargar copia imprimible</button>
            @if (canManage()) {
              <button type="button" (click)="save()" [disabled]="busy() || uploading() || isEditLocked(workspace())" class="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">{{ busy() ? 'Guardando…' : 'Guardar cambios' }}</button>
            }
          }
        </div>
      </header>

      @if (error()) {
        <div role="alert" class="mb-6 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          <span>{{ error() }}</span>
          <button type="button" class="font-semibold underline" (click)="load()">Reintentar</button>
        </div>
      }
      @if (message()) {
        <div role="status" class="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{{ message() }}</div>
      }
      @if (hasUnsavedChanges()) {
        <div role="status" class="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Tienes cambios sin guardar. Guarda el expediente para conservarlos.
        </div>
      }
      @if (!canManage()) {
        <div role="status" class="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
          Estás en modo de consulta. Puedes revisar lo guardado y sus documentos; el personal autorizado completa el borrador y lo envía a revisión.
        </div>
      }
      @if (pendingYearUuid(); as nextYearUuid) {
        <section aria-labelledby="year-change-title" class="mb-6 rounded-2xl border border-amber-300 bg-white p-5 shadow-lg dark:border-amber-800 dark:bg-slate-900">
          <h2 id="year-change-title" class="font-semibold text-slate-900 dark:text-white">Hay cambios sin guardar</h2>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">¿Qué quieres hacer antes de abrir {{ yearName(nextYearUuid) }}?</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <button type="button" (click)="saveAndChangeYear()" [disabled]="busy() || uploading()" class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">Guardar y cambiar</button>
            <button type="button" (click)="discardAndChangeYear()" [disabled]="busy() || uploading()" class="rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30">Descartar cambios</button>
            <button type="button" (click)="cancelYearChange()" [disabled]="busy() || uploading()" class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Seguir editando</button>
          </div>
        </section>
      }

      @if (loading()) {
        <div class="grid gap-4 lg:grid-cols-[280px_1fr]" aria-label="Cargando expediente">
          <div class="h-44 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
          <div class="h-96 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
        </div>
      } @else if (years().length === 0) {
        <section class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Primero crea un año académico</h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">El expediente se vincula al calendario y año que administra el colegio.</p>
          <a routerLink="/academic/years" class="mt-5 inline-flex rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">Ir a años académicos</a>
        </section>
      } @else {
        <div class="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside class="space-y-4 lg:sticky lg:top-6">
            <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <label for="disclosure-year" class="text-sm font-semibold text-slate-800 dark:text-slate-100">Año académico</label>
              <select id="disclosure-year" [value]="selectedYearUuid()" (change)="requestYearChange($event)" [disabled]="loading() || busy() || uploading()" class="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                @for (year of years(); track year.publicUuid) {
                  <option [value]="year.publicUuid">{{ year.name }} · {{ statusLabel(year.status) }}</option>
                }
              </select>
              @if (workspace(); as package) {
                <div class="mt-5 flex items-center justify-between gap-3">
                  <span class="text-sm text-slate-500 dark:text-slate-400">Estado</span>
                  <span [class]="'rounded-full px-2.5 py-1 text-xs font-bold ' + statusClass(package.status)">{{ workflowLabel(package.status) }}</span>
                </div>
                <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Revisión {{ package.revisionNumber }}@if (package.latestPublishedVersion) { · Publicada v{{ package.latestPublishedVersion }} }</p>
                <div class="mt-5">
                  <div class="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-300"><span>Checklist informativo</span><span>{{ package.completeness.completed }}/{{ package.completeness.total }}</span></div>
                  <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-full rounded-full bg-indigo-600 transition-all" [style.width.%]="completionPercent()"></div></div>
                  <p class="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">Los pendientes se muestran como alertas. Una fecha vencida no bloquea la publicación.</p>
                </div>
                <div class="mt-5 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <div><p class="text-xs font-semibold text-slate-500 dark:text-slate-400">Información previa a matrícula</p><p class="mt-1 text-sm text-slate-800 dark:text-slate-200">{{ deadlineLabel(content().enrollmentDisclosureDeadline) }}</p></div>
                  <div><p class="text-xs font-semibold text-slate-500 dark:text-slate-400">Información antes del cierre lectivo</p><p class="mt-1 text-sm text-slate-800 dark:text-slate-200">{{ deadlineLabel(content().yearCloseDisclosureDeadline) }}</p></div>
                </div>
              }
            </section>

            @if (workspace(); as package) {
              <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 class="text-sm font-semibold text-slate-900 dark:text-white">Flujo de revisión</h2>
                <p class="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">La aprobación y la publicación son acciones separadas. Publicar entrega esta versión a las familias vinculadas.</p>
                @if (package.reviewNote) { <p class="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Observación: {{ package.reviewNote }}</p> }
                <div class="mt-4 space-y-2">
                  @if (package.status === 'DRAFT') {
                    @if (canSubmit()) {
                      <button type="button" (click)="submitForReview()" [disabled]="busy() || !package.publicUuid" class="w-full rounded-xl border border-indigo-200 px-3 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-950/40">Enviar a revisión</button>
                    } @else {
                      <p class="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:bg-slate-950 dark:text-slate-300">El borrador está disponible para consulta. El envío a revisión corresponde al personal autorizado para prepararlo.</p>
                    }
                  }
                  @if (package.status === 'IN_REVIEW') {
                    @if (canReview()) {
                      <label for="review-note" class="block text-xs font-semibold text-slate-600 dark:text-slate-300">Observaciones para devolver</label>
                      <textarea id="review-note" rows="3" [value]="reviewNote()" (input)="updateReviewNote($event)" class="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Describe qué debe corregir el equipo"></textarea>
                      <button type="button" (click)="requestChanges()" [disabled]="busy() || !reviewNote().trim()" class="w-full rounded-xl border border-amber-300 px-3 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-900 dark:text-amber-200">Devolver con observaciones</button>
                      <button type="button" (click)="approve()" [disabled]="busy()" class="w-full rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Aprobar expediente</button>
                    } @else {
                      <p class="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:bg-slate-950 dark:text-slate-300">El expediente está en revisión. Tu cuenta puede consultar la información, pero no tiene permiso para aprobarla ni devolverla.</p>
                    }
                  }
                  @if (package.status === 'APPROVED') {
                    @if (canPublish()) {
                      @if (confirmingPublish()) {
                        <p class="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">La versión actual será visible para las familias. Los datos pendientes permanecerán señalados en el documento.</p>
                        <div class="flex gap-2"><button type="button" (click)="confirmingPublish.set(false)" class="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold dark:border-slate-700 dark:text-slate-200">Volver</button><button type="button" (click)="publish()" [disabled]="busy()" class="flex-1 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">Confirmar publicación</button></div>
                      } @else {
                        <button type="button" (click)="confirmingPublish.set(true)" class="w-full rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Publicar a familias</button>
                      }
                    } @else {
                      <p class="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:bg-slate-950 dark:text-slate-300">El expediente está aprobado y listo. Una cuenta con permiso de publicación debe confirmar su entrega a las familias.</p>
                    }
                  }
                  @if (package.status === 'PUBLISHED') {
                    <p class="rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">Publicado el {{ package.publishedAt | date:'dd/MM/yyyy HH:mm' }}. Guarda una modificación para iniciar una nueva revisión.</p>
                  }
                </div>
              </section>
            }

            <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 class="text-sm font-semibold text-slate-900 dark:text-white">Versiones publicadas</h2>
              @if (versions().length === 0) {
                <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Aún no hay publicaciones para este año.</p>
              } @else {
                <ul class="mt-3 space-y-3">
                  @for (version of versions(); track version.publicUuid) {
                    <li class="flex items-center justify-between gap-3 text-sm"><span class="text-slate-700 dark:text-slate-300">Versión {{ version.versionNumber }}<span class="block text-xs text-slate-500">{{ version.publishedAt | date:'dd/MM/yyyy HH:mm' }}</span></span><span class="font-mono text-[10px] text-slate-400" [title]="version.contentSha256">{{ version.contentSha256.slice(0, 10) }}…</span></li>
                  }
                </ul>
              }
            </section>
          </aside>

          @if (workspace(); as package) {
            <div class="space-y-5">
              @if (systemManagedFields().length > 0) {
                <section class="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
                  <h2 class="text-sm font-semibold text-indigo-900 dark:text-indigo-200">EduShift gestiona {{ systemManagedFields().length }} datos automáticamente</h2>
                  @if (autoFilledFields().length > 0) { <p class="mt-1 text-xs leading-5 text-indigo-800 dark:text-indigo-300">Ya cargados: {{ autoFilledFieldLabels() }}. No necesitas llenarlos en estos pasos.</p> }
                  @if (systemManagedPendingFields().length > 0) {
                    <p class="mt-2 text-xs leading-5 text-amber-800 dark:text-amber-200">Falta configurar: {{ systemManagedPendingLabels() }}. Revisa <a routerLink="/payments/admin/concepts" class="font-semibold underline">Pagos &gt; Conceptos</a>, <a routerLink="/payments/admin/plans" class="font-semibold underline">Planes automáticos</a> o <a routerLink="/schedule/jornada" class="font-semibold underline">Jornada y horarios</a>. Estos datos no se pedirán en el formulario.</p>
                  }
                </section>
              }
              @if (currentStepField(); as field) {
                <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 dark:border-slate-800 dark:bg-slate-900">
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div class="min-w-0">
                      <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-600 dark:text-indigo-400">Paso {{ stepIndex() + 1 }} de {{ stepFields().length }} <span class="px-1 text-slate-300">•</span> Información anual · Ley 26549</p>
                      <h2 class="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">{{ questionTitle(field) }}</h2>
                    </div>
                    <label class="sr-only" for="disclosure-question">Ir a una pregunta específica</label>
                    <select id="disclosure-question" [value]="field.key" (change)="jumpToField($event)" [disabled]="busy() || uploading()" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60 sm:w-64 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                      @for (group of stepGroups(); track group.section) {
                        <optgroup [label]="group.section">
                          @for (question of group.fields; track question.key) {
                            <option [value]="question.key">{{ stepIndexFor(question.key) + 1 }}. {{ question.label }} · {{ fieldStatusLabel(question.key) }}</option>
                          }
                        </optgroup>
                      }
                    </select>
                  </div>
                  <div role="progressbar" aria-label="Requisitos de información anual completados" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="completionPercent()" class="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-full rounded-full bg-blue-600 transition-all" [style.width.%]="completionPercent()"></div></div>
                  <div class="mt-2 text-right text-[11px] font-medium text-slate-500 dark:text-slate-400">{{ completionPercent() }}% completado</div>

                  <div class="mt-6">
                    <p class="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{{ field.guidance }}</p>
                    @if (fieldValue(field.key).systemSource) { <p class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{{ fieldValue(field.key).systemSource }} · verifica y actualiza si cambió.</p> }

                    <section class="mt-5 flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 dark:border-amber-900/70 dark:bg-amber-950/25">
                      <div class="flex min-w-0 items-start gap-3">
                        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-5 w-5"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M9 9l6 6m0-6l-6 6"/></svg>
                        </span>
                        <div class="min-w-0">
                          <h3 class="text-sm font-semibold text-amber-950 dark:text-amber-100">¿Este requisito no aplica a tu sede?</h3>
                          <p class="mt-1 text-sm leading-5 text-amber-900/80 dark:text-amber-200/80">Puedes marcarlo así y explicar el motivo. La justificación es necesaria para guardar esta respuesta.</p>
                          @if (fieldValue(field.key).state === 'NOT_APPLICABLE') {
                            <p role="status" class="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-200">Estado actual: No aplica</p>
                          }
                        </div>
                      </div>
                      <div class="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                        <button
                          type="button"
                          (click)="updateState(field.key, 'NOT_APPLICABLE')"
                          [disabled]="isEditLocked(package)"
                          [attr.aria-pressed]="fieldValue(field.key).state === 'NOT_APPLICABLE'"
                          [class]="'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-slate-900 ' + (fieldValue(field.key).state === 'NOT_APPLICABLE' ? 'border-amber-700 bg-amber-600 text-white hover:bg-amber-700 dark:border-amber-500 dark:bg-amber-600 dark:text-white dark:hover:bg-amber-500' : 'border-amber-300 bg-white text-amber-950 hover:border-amber-400 hover:bg-amber-100 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-100 dark:hover:bg-amber-950/60')">
                          @if (fieldValue(field.key).state === 'NOT_APPLICABLE') {
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m5 12 4 4L19 6"/></svg>
                            No aplica seleccionado
                          } @else {
                            Marcar como No aplica
                          }
                        </button>
                        @if (fieldValue(field.key).state !== 'PENDING') {
                          <button type="button" (click)="updateState(field.key, 'PENDING')" [disabled]="isEditLocked(package)" class="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900">Marcar como pendiente</button>
                        }
                      </div>
                    </section>

                    @if (fieldValue(field.key).state === 'NOT_APPLICABLE') {
                      <label [for]="'note-' + field.key" class="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">¿Por qué no aplica?</label>
                      <input [id]="'note-' + field.key" [value]="fieldValue(field.key).note ?? ''" (input)="updateNote(field.key, $event)" [disabled]="isEditLocked(package)" class="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" placeholder="Explica brevemente el motivo" />
                    } @else {
                      @if (!isFileOnlyField(field.key)) {
                        <fieldset class="mt-5">
                          <legend class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">1. ¿Cómo deseas responder?</legend>
                          <div class="mt-2 grid gap-2 sm:grid-cols-2">
                            <label [class]="'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ' + (answerMode() === 'document' ? 'border-blue-500 bg-blue-50 text-slate-900 ring-1 ring-blue-500 dark:bg-blue-950/30 dark:text-white' : 'border-slate-200 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300')">
                              <input type="radio" [name]="'answer-mode-' + field.key" value="document" [checked]="answerMode() === 'document'" [disabled]="isEditLocked(package)" (change)="selectAnswerMode(field.key, 'document')" />
                              <span><strong class="block">{{ isDocumentRecommended(field.key) ? 'Subir documento oficial' : 'Subir documento' }}</strong><span class="text-xs text-slate-500 dark:text-slate-400">Adjunta el archivo que respalda esta respuesta.</span></span>
                              @if (isDocumentRecommended(field.key)) { <span class="ml-auto shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">Recomendado</span> }
                            </label>
                            <label [class]="'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ' + (answerMode() === 'text' ? 'border-blue-500 bg-blue-50 text-slate-900 ring-1 ring-blue-500 dark:bg-blue-950/30 dark:text-white' : 'border-slate-200 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300')">
                              <input type="radio" [name]="'answer-mode-' + field.key" value="text" [checked]="answerMode() === 'text'" [disabled]="isEditLocked(package)" (change)="selectAnswerMode(field.key, 'text')" />
                              <span><strong class="block">Redactar texto libre</strong><span class="text-xs text-slate-500 dark:text-slate-400">Escribe una respuesta directa y concisa.</span></span>
                            </label>
                          </div>
                        </fieldset>
                      }
                      @if (isFileOnlyField(field.key)) {
                        <p class="mt-5 rounded-xl bg-indigo-50 p-4 text-sm leading-6 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">Adjunta la resolución o autorización oficial del colegio. Este dato se responde únicamente con el archivo; no hay que transcribirlo.</p>
                      } @else if (answerMode() === 'text') {
                        <label [for]="'field-' + field.key" class="mt-5 block text-sm font-medium text-slate-700 dark:text-slate-200">Respuesta para las familias</label>
                        <textarea [id]="'field-' + field.key" rows="5" maxlength="4000" [value]="fieldValue(field.key).value ?? ''" (input)="updateValue(field.key, $event)" [disabled]="isEditLocked(package)" class="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm leading-6 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900" placeholder="Escribe la respuesta o un resumen breve"></textarea>
                        <p class="mt-1 text-right text-xs text-slate-500">{{ fieldValue(field.key).value?.length ?? 0 }} / 4,000 caracteres.</p>
                      } @else {
                        <p class="mt-3 rounded-xl bg-indigo-50 p-4 text-sm leading-6 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">La respuesta se dará con el documento vinculado. No necesitas escribir una respuesta aparte.</p>
                      }

                      @if (answerMode() === 'document' || isFileOnlyField(field.key)) {
                      <div class="mt-5">
                        <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">2. Documento adjunto</h3>
                        @if (fieldValue(field.key).sources.length > 0) {
                          <div class="mt-2 space-y-2">
                            @for (source of fieldValue(field.key).sources; track source.filePublicUuid) {
                              @if (attachment(source.filePublicUuid); as sourceDocument) {
                                <div class="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-950/50">
                                  <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-5 w-5"><path stroke-linecap="round" stroke-linejoin="round" d="M7 3.75h6l4.25 4.5v12H7a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2Z"/><path stroke-linecap="round" d="M13 4v5h4M8.5 13h6M8.5 16h6"/></svg>
                                  </span>
                                  <div class="min-w-0 flex-1">
                                    <p class="break-all text-sm font-semibold text-slate-800 dark:text-slate-100">{{ sourceDocument.label }}</p>
                                    <p class="mt-0.5 text-xs text-emerald-700 dark:text-emerald-300">● Listo para usar en esta pregunta</p>
                                  </div>
                                  <div class="flex items-center gap-3 text-xs font-semibold">
                                    <button type="button" (click)="previewingAttachment.set(sourceDocument)" class="text-slate-600 hover:text-blue-700 hover:underline dark:text-slate-300 dark:hover:text-blue-300">Ver</button>
                                    <label class="cursor-pointer text-blue-700 hover:underline dark:text-blue-300">{{ uploading() ? 'Subiendo…' : 'Reemplazar' }}<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv" class="sr-only" [disabled]="uploading() || isEditLocked(package)" (change)="uploadAttachmentForField(field.key, $event, source.filePublicUuid)" /></label>
                                    <button type="button" (click)="unlinkSource(field.key, source.filePublicUuid)" [disabled]="isEditLocked(package)" class="text-rose-600 hover:underline disabled:opacity-40">Quitar</button>
                                  </div>
                                  <div class="w-full border-t border-slate-200 pt-2 dark:border-slate-700">
                                    <label class="flex items-start gap-2 text-xs leading-5 text-slate-600 dark:text-slate-300"><input type="checkbox" [checked]="sourceDocument.visibleToFamilies" [disabled]="isEditLocked(package)" (change)="setAttachmentVisibility(source.filePublicUuid, $event)" class="mt-0.5" /><span>Incluir para las familias cuando se publique el expediente.</span></label>
                                    <label class="mt-2 block text-xs font-medium text-slate-600 dark:text-slate-300">Página o sección (opcional)<input [value]="source.pageReference ?? ''" (input)="updateSourcePage(field.key, source.filePublicUuid, $event)" [disabled]="isEditLocked(package)" class="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" placeholder="Ej. páginas 4–6" /></label>
                                  </div>
                                </div>
                              }
                            }
                          </div>
                        } @else {
                          <div class="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                            <label class="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><span>{{ uploading() ? 'Subiendo documento…' : 'Seleccionar documento' }}</span><input type="file" accept="application/pdf,image/png,image/jpeg,image/webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv" class="sr-only" [disabled]="uploading() || isEditLocked(package)" (change)="uploadAttachmentForField(field.key, $event)" /></label>
                            <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">PDF, imágenes, Word, Excel, PowerPoint o texto. El archivo quedará vinculado a esta pregunta.</p>
                          </div>
                        }
                      </div>
                      <div class="mt-5">
                        <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">3. Datos de validación y vigencia</h3>
                        <div class="mt-2 grid gap-3 sm:grid-cols-2">
                          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Tipo de documento
                            <select [value]="attachmentCategory()" (change)="selectAttachmentCategory($event)" [disabled]="isEditLocked(package)" class="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"><option value="INTERNAL_REGULATIONS">Reglamento interno</option><option value="SCHOOL_AUTHORIZATION">Autorización</option><option value="ADMISSION_INFORMATION">Admisión</option><option value="ECONOMIC_INFORMATION">Información económica</option><option value="CURRICULUM_PLAN">Plan curricular</option><option value="SCHOOL_CALENDAR">Calendario escolar</option><option value="SERVICE_INFORMATION">Servicio educativo</option><option value="OTHER">Otro</option></select>
                          </label>
                          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Versión o número de resolución<input [value]="attachmentVersion()" (input)="updateAttachmentVersion($event)" [disabled]="isEditLocked(package)" class="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Ej. R.D. N.º 045-2026" /></label>
                          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Fecha de aprobación o emisión<input type="date" [value]="attachmentDocumentDate()" (change)="updateAttachmentDocumentDate($event)" [disabled]="isEditLocked(package)" class="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Vigente hasta<input type="date" [value]="attachmentValidUntil()" (change)="updateAttachmentValidUntil($event)" [disabled]="isEditLocked(package)" class="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                        </div>
                        @if (fieldValue(field.key).sources.length === 0) { <label class="mt-4 flex items-start gap-2 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-700 dark:border-slate-800 dark:text-slate-300"><input type="checkbox" [checked]="attachmentVisibleToFamilies()" [disabled]="isEditLocked(package)" (change)="updateAttachmentVisibility($event)" class="mt-0.5" /><span><strong>Incluir para las familias</strong> cuando se publique el expediente.</span></label> }
                      </div>
                      @if (content().attachments.length > fieldValue(field.key).sources.length) {
                        <details class="mt-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                          <summary class="cursor-pointer text-sm font-semibold text-indigo-700 dark:text-indigo-300">Vincular otro documento ya cargado</summary>
                          <div class="mt-3 space-y-2">
                            @for (attachment of content().attachments; track attachment.filePublicUuid) {
                              <div class="flex flex-wrap items-start justify-between gap-2">
                                <label class="flex min-w-0 items-start gap-2 text-sm text-slate-700 dark:text-slate-300"><input type="checkbox" [checked]="hasSource(field.key, attachment.filePublicUuid)" [disabled]="isEditLocked(package)" (change)="toggleSource(field.key, attachment.filePublicUuid, $event)" /><span class="min-w-0 break-words">{{ attachment.label }} <span class="text-xs text-slate-500">· {{ attachmentCategoryLabel(attachment.category) }}@if (attachmentMetadata(attachment)) { · {{ attachmentMetadata(attachment) }} }@if (!attachment.visibleToFamilies) { · solo interno }</span></span></label>
                                @if (!isAttachmentLinked(attachment.filePublicUuid)) { <button type="button" (click)="removeAttachment(attachment.filePublicUuid)" [disabled]="isEditLocked(package)" class="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-40">Quitar del expediente</button> }
                              </div>
                            }
                          </div>
                        </details>
                      }
                      @if (fieldValue(field.key).sources.length > 0 && !hasFamilyVisibleSource(field.key)) { <p class="mt-2 text-xs text-amber-700 dark:text-amber-300">Marca “Incluir para las familias” para que este documento pueda completar la respuesta.</p> }
                      }
                    }

                    <div class="sticky bottom-0 z-10 -mx-5 mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur sm:-mx-7 sm:px-7 dark:border-slate-700 dark:bg-slate-900/95">
                      @if (canManage()) {
                        <button type="button" (click)="saveCurrentStep()" [disabled]="busy() || uploading() || isEditLocked(package)" class="text-sm font-medium text-slate-600 hover:text-blue-700 disabled:opacity-40 dark:text-slate-300 dark:hover:text-blue-300">{{ busy() ? 'Guardando…' : 'Guardar borrador' }}</button>
                      }
                      <p class="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">Paso {{ stepIndex() + 1 }} de {{ stepFields().length }}</p>
                      <div class="ml-auto flex items-center gap-2">
                        <button type="button" (click)="previousStep()" [disabled]="busy() || uploading() || stepIndex() === 0" class="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800">Anterior</button>
                      @if (stepIndex() < stepFields().length - 1) {
                        <button type="button" (click)="nextStep()" [disabled]="busy() || uploading() || (canManage() && exceedsFieldLimit(field.key))" class="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{{ busy() ? 'Guardando…' : (canManage() ? 'Guardar y siguiente →' : 'Siguiente →') }}</button>
                      } @else {
                        @if (canManage()) {
                          <button type="button" (click)="saveCurrentStep()" [disabled]="busy() || uploading() || isEditLocked(package) || exceedsFieldLimit(field.key)" class="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{{ busy() ? 'Guardando…' : 'Guardar respuesta' }}</button>
                        }
                      }
                      </div>
                    </div>
                  </div>
                </section>
              } @else {
                @if (systemManagedPendingFields().length > 0) {
                  <section class="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30"><h2 class="font-semibold text-amber-900 dark:text-amber-200">Faltan datos de configuración</h2><p class="mt-1 text-sm text-amber-800 dark:text-amber-300">Configura {{ systemManagedPendingLabels() }} en <a routerLink="/payments/admin/concepts" class="font-semibold underline">Pagos &gt; Conceptos</a>, <a routerLink="/payments/admin/plans" class="font-semibold underline">Planes automáticos</a> o <a routerLink="/schedule/jornada" class="font-semibold underline">Jornada y horarios</a>. No tienes que escribirlos aquí.</p></section>
                } @else {
                  <section class="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30"><h2 class="font-semibold text-emerald-900 dark:text-emerald-200">Todos los datos están precargados</h2><p class="mt-1 text-sm text-emerald-800 dark:text-emerald-300">EduShift tiene la información de todos los campos del checklist.</p></section>
                }
              }

              <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
                <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Fechas de información a familias</h2>
                <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Configura las fechas reales del colegio; EduShift no las infiere ni fija un calendario nacional.</p>
                <div class="mt-4 grid gap-4 sm:grid-cols-2">
                  <label class="text-sm font-medium text-slate-700 dark:text-slate-200">Plazo antes del inicio de matrícula<input type="date" [value]="content().enrollmentDisclosureDeadline ?? ''" (change)="updateDeadline('enrollmentDisclosureDeadline', $event)" [disabled]="isEditLocked(package)" class="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" /></label>
                  <label class="text-sm font-medium text-slate-700 dark:text-slate-200">Plazo antes del cierre del año lectivo<input type="date" [value]="content().yearCloseDisclosureDeadline ?? ''" (change)="updateDeadline('yearCloseDisclosureDeadline', $event)" [disabled]="isEditLocked(package)" class="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" /></label>
                </div>
              </section>

              <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
                <label for="additional-info" class="text-lg font-semibold text-slate-900 dark:text-white">Información complementaria</label>
                <textarea id="additional-info" rows="4" [value]="content().additionalInformation ?? ''" (input)="updateAdditionalInformation($event)" [disabled]="isEditLocked(package)" class="mt-3 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" placeholder="Incluye información pertinente adicional para las familias"></textarea>
              </section>
            </div>
          }
        </div>
      }
      @if (previewingAttachment(); as previewFile) {
        <app-file-preview-dialog [open]="true" [filePublicUuid]="previewFile.filePublicUuid" [filename]="previewFile.label" (closed)="previewingAttachment.set(null)" />
      }
    </main>
  `,
})
export class DisclosureWorkspacePage implements OnInit {
  private readonly academicApi = inject(AcademicApiService);
  private readonly api = inject(DisclosuresApiService);
  private readonly files = inject(FileUploadService);
  private readonly auth = inject(AuthService);

  readonly years = signal<AcademicYearRow[]>([]);
  readonly selectedYearUuid = signal('');
  readonly pendingYearUuid = signal<string | null>(null);
  readonly stepIndex = signal(0);
  readonly answerMode = signal<'text' | 'document'>('text');
  readonly workspace = signal<DisclosurePackage | null>(null);
  readonly content = signal<DisclosureContent>(this.emptyContent());
  private readonly savedContentJson = signal(JSON.stringify(this.emptyContent()));
  readonly catalog = signal<DisclosureFieldDefinition[]>([]);
  readonly versions = signal<DisclosureVersionSummary[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly reviewNote = signal('');
  readonly confirmingPublish = signal(false);
  readonly canManage = computed(() =>
    !this.auth.hasRole(UserRole.TenantAdmin) && this.auth.hasPermission(Permission.LmsDisclosureManage));
  readonly canSubmit = computed(() =>
    this.auth.hasRole(UserRole.Staff) && !this.auth.hasRole(UserRole.TenantAdmin)
      && this.auth.hasPermission(Permission.LmsDisclosureSubmit));
  readonly canReview = computed(() => this.auth.hasPermission(Permission.LmsDisclosureReview));
  readonly canPublish = computed(() => this.auth.hasPermission(Permission.LmsDisclosurePublish));
  readonly attachmentCategory = signal<DisclosureAttachmentCategory>('INTERNAL_REGULATIONS');
  readonly attachmentVersion = signal('');
  readonly attachmentDocumentDate = signal('');
  readonly attachmentValidUntil = signal('');
  readonly attachmentVisibleToFamilies = signal(false);
  readonly previewingAttachment = signal<DisclosureContent['attachments'][number] | null>(null);
  private workspaceLoadSequence = 0;
  readonly stepFields = computed(() => this.catalog().filter((field) => !this.fieldValue(field.key).systemManaged));
  readonly stepGroups = computed(() => {
    const sections = new Map<string, DisclosureFieldDefinition[]>();
    for (const field of this.stepFields()) {
      const fields = sections.get(field.section) ?? [];
      fields.push(field);
      sections.set(field.section, fields);
    }
    return [...sections.entries()].map(([section, fields]) => ({ section, fields }));
  });
  readonly hasUnsavedChanges = computed(() => JSON.stringify(this.content()) !== this.savedContentJson());
  readonly systemManagedFields = computed(() => this.catalog().filter((field) => this.fieldValue(field.key).systemManaged));
  readonly autoFilledFields = computed(() => this.systemManagedFields()
    .filter((field) => this.fieldValue(field.key).state !== 'PENDING'));
  readonly systemManagedPendingFields = computed(() => this.systemManagedFields()
    .filter((field) => this.fieldValue(field.key).state === 'PENDING'));
  readonly currentStepField = computed(() => this.stepFields()[this.stepIndex()] ?? null);
  readonly stepProgress = computed(() => this.stepFields().length
    ? Math.round((this.stepIndex() + 1) * 100 / this.stepFields().length) : 100);
  readonly completionPercent = computed(() => {
    const current = this.workspace();
    return current?.completeness.total ? Math.round(100 * current.completeness.completed / current.completeness.total) : 0;
  });
  readonly canCopyPrevious = computed(() => {
    const current = this.workspace();
    const content = this.content();
    return this.canManage() && current?.status === 'DRAFT' && (current.latestPublishedVersion ?? 0) === 0 && content.attachments.length === 0
      && content.additionalInformation === null && content.enrollmentDisclosureDeadline === null
      && content.yearCloseDisclosureDeadline === null
      && Object.values(content.fields).every((field) => field.systemManaged
        || (field.state === 'PENDING' && !field.value && field.sources.length === 0));
  });

  async ngOnInit(): Promise<void> { await this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [years, catalog] = await Promise.all([
        firstValueFrom(this.academicApi.listYears()),
        firstValueFrom(this.api.getCatalog()),
      ]);
      this.years.set(years);
      this.catalog.set(catalog.data ?? []);
      const currentUuid = this.selectedYearUuid();
      const selected = years.find((year) => year.publicUuid === currentUuid)
        ?? years.find((year) => year.status === 'ACTIVE')
        ?? years[0];
      this.selectedYearUuid.set(selected?.publicUuid ?? '');
      if (selected) await this.loadWorkspace(selected.publicUuid);
      else this.workspace.set(null);
    } catch {
      this.error.set('No se pudo cargar la información anual. Revisa tu conexión y vuelve a intentar.');
    } finally {
      this.loading.set(false);
    }
  }

  async requestYearChange(event: Event): Promise<void> {
    const yearUuid = (event.currentTarget as HTMLSelectElement).value;
    if (!yearUuid || yearUuid === this.selectedYearUuid()) return;
    if (this.hasUnsavedChanges()) {
      this.pendingYearUuid.set(yearUuid);
      return;
    }
    await this.changeYear(yearUuid);
  }

  yearName(yearUuid: string): string {
    return this.years().find((year) => year.publicUuid === yearUuid)?.name ?? 'el año seleccionado';
  }

  async saveAndChangeYear(): Promise<void> {
    if (!this.canManage()) return;
    const yearUuid = this.pendingYearUuid();
    if (!yearUuid || !await this.save()) return;
    this.pendingYearUuid.set(null);
    await this.changeYear(yearUuid);
  }

  async discardAndChangeYear(): Promise<void> {
    const yearUuid = this.pendingYearUuid();
    if (!yearUuid) return;
    this.pendingYearUuid.set(null);
    await this.changeYear(yearUuid);
  }

  cancelYearChange(): void {
    this.pendingYearUuid.set(null);
  }

  private async changeYear(yearUuid: string): Promise<void> {
    this.selectedYearUuid.set(yearUuid);
    await this.loadWorkspace(yearUuid);
  }

  fieldValue(key: string): DisclosureField {
    return this.content().fields[key] ?? { state: 'PENDING', value: null, note: null, sources: [],
      documentOnly: false, systemManaged: false, systemSource: null };
  }

  autoFilledFieldLabels(): string {
    return this.autoFilledFields().map((field) => field.label).join(', ');
  }

  systemManagedPendingLabels(): string {
    return this.systemManagedPendingFields().map((field) => field.label).join(', ');
  }

  isFileOnlyField(key: string): boolean { return key === 'school_authorizations'; }

  isDocumentRecommended(key: string): boolean { return key === 'internal_regulation'; }

  questionTitle(field: DisclosureFieldDefinition): string {
    return field.key === 'internal_regulation' ? 'Reglamento Interno Institucional' : field.label;
  }

  private isDocumentAnswerMode(key: string): boolean {
    return this.isFileOnlyField(key)
      || (this.currentStepField()?.key === key && this.answerMode() === 'document');
  }

  selectAnswerMode(key: string, mode: 'text' | 'document'): void {
    if (this.isFileOnlyField(key)) return;
    this.answerMode.set(mode);
    this.content.update((content) => {
      const field = content.fields[key] ?? this.fieldValue(key);
      const hasVisibleSource = mode === 'document' && field.sources.some((source) =>
        content.attachments.some((attachment) => attachment.filePublicUuid === source.filePublicUuid && attachment.visibleToFamilies));
      const linkedElsewhere = new Set(Object.entries(content.fields)
        .filter(([fieldKey]) => fieldKey !== key)
        .flatMap(([, otherField]) => otherField.sources.map((source) => source.filePublicUuid)));
      const sources = mode === 'text' ? [] : field.sources;
      const attachments = mode === 'text'
        ? content.attachments.filter((attachment) => !field.sources.some((source) => source.filePublicUuid === attachment.filePublicUuid)
          || linkedElsewhere.has(attachment.filePublicUuid))
        : content.attachments;
      return {
        ...content,
        attachments,
        fields: { ...content.fields, [key]: {
          ...field,
          state: mode === 'document' ? (hasVisibleSource ? 'COMPLETED' : 'PENDING')
            : (field.value?.trim() ? field.state : 'PENDING'),
          value: mode === 'document' ? null : field.value,
          sources,
          documentOnly: mode === 'document' && hasVisibleSource,
        } },
      };
    });
  }

  isAttachmentLinked(filePublicUuid: string): boolean {
    return Object.values(this.content().fields).some((field) =>
      field.sources.some((source) => source.filePublicUuid === filePublicUuid));
  }

  updateState(key: string, value: DisclosureField['state'] | Event): void {
    const state = typeof value === 'string' ? value : (value.currentTarget as HTMLSelectElement).value as DisclosureField['state'];
    this.updateField(key, { ...this.fieldValue(key), state, documentOnly: state === 'COMPLETED' && this.fieldValue(key).documentOnly });
  }

  async previousStep(): Promise<void> {
    if (this.stepIndex() === 0 || (this.canManage() && !await this.save())) return;
    this.setStepIndex(Math.max(0, this.stepIndex() - 1));
  }

  async nextStep(): Promise<void> {
    const field = this.currentStepField();
    if (!field || this.exceedsFieldLimit(field.key) || (this.canManage() && !await this.save())) return;
    this.setStepIndex(Math.min(this.stepFields().length - 1, this.stepIndex() + 1));
  }

  async jumpToField(value: string | Event): Promise<void> {
    const fieldKey = typeof value === 'string'
      ? value
      : (value.currentTarget as HTMLSelectElement).value;
    const targetIndex = this.stepIndexFor(fieldKey);
    if (targetIndex < 0 || targetIndex === this.stepIndex()) return;
    const currentField = this.currentStepField();
    if (currentField && this.exceedsFieldLimit(currentField.key)) return;
    if (this.canManage() && !await this.save()) return;
    this.setStepIndex(targetIndex);
  }

  private setStepIndex(index: number): void {
    this.stepIndex.set(index);
    const field = this.currentStepField();
    this.answerMode.set(field && (this.isFileOnlyField(field.key) || this.fieldValue(field.key).documentOnly
      || this.fieldValue(field.key).sources.length > 0)
      ? 'document' : 'text');
    this.syncAttachmentDetailsFromCurrentField();
  }

  private syncAttachmentDetailsFromCurrentField(): void {
    const field = this.currentStepField();
    const sources = field ? this.fieldValue(field.key).sources : [];
    const existing = sources.length ? this.attachment(sources[0].filePublicUuid) : null;
    this.attachmentCategory.set(existing?.category ?? (field ? this.attachmentCategoryForField(field.key) : 'INTERNAL_REGULATIONS'));
    this.attachmentVersion.set(existing?.versionLabel ?? '');
    this.attachmentDocumentDate.set(existing?.documentDate ?? '');
    this.attachmentValidUntil.set(existing?.validUntil ?? '');
    this.attachmentVisibleToFamilies.set(existing?.visibleToFamilies ?? (field ? this.isFileOnlyField(field.key) : false));
  }

  stepIndexFor(fieldKey: string): number {
    return this.stepFields().findIndex((field) => field.key === fieldKey);
  }

  fieldStatusLabel(fieldKey: string): string {
    const state = this.fieldValue(fieldKey).state;
    return state === 'COMPLETED' ? 'Completado'
      : state === 'NOT_APPLICABLE' ? 'No aplica' : 'Pendiente';
  }

  async saveCurrentStep(): Promise<void> {
    const field = this.currentStepField();
    if (field) await this.save(`${field.label} guardado.`);
  }

  exceedsFieldLimit(key: string): boolean { return (this.fieldValue(key).value?.length ?? 0) > 4000; }

  updateValue(key: string, event: Event): void {
    const value = (event.currentTarget as HTMLTextAreaElement).value;
    this.updateField(key, { ...this.fieldValue(key), value, state: value.trim() ? 'COMPLETED' : 'PENDING', documentOnly: false });
  }

  updateNote(key: string, event: Event): void {
    this.updateField(key, { ...this.fieldValue(key), note: (event.currentTarget as HTMLInputElement).value });
  }

  hasSource(key: string, filePublicUuid: string): boolean {
    return this.fieldValue(key).sources.some((source) => source.filePublicUuid === filePublicUuid);
  }

  attachment(filePublicUuid: string): DisclosureContent['attachments'][number] | null {
    return this.content().attachments.find((item) => item.filePublicUuid === filePublicUuid) ?? null;
  }

  unlinkSource(key: string, filePublicUuid: string): void {
    const field = this.fieldValue(key);
    const sources = field.sources.filter((source) => source.filePublicUuid !== filePublicUuid);
    const hasVisibleSource = sources.some((source) => this.attachment(source.filePublicUuid)?.visibleToFamilies);
    const documentOnly = this.isDocumentAnswerMode(key) ? hasVisibleSource : field.documentOnly && hasVisibleSource;
    this.updateField(key, { ...field, sources, documentOnly,
      state: this.isDocumentAnswerMode(key)
        ? (documentOnly ? 'COMPLETED' : 'PENDING')
        : (field.documentOnly && !documentOnly && !field.value?.trim() ? 'PENDING' : field.state) });
    if (this.currentStepField()?.key === key) this.syncAttachmentDetailsFromCurrentField();
  }

  toggleSource(key: string, filePublicUuid: string, event: Event): void {
    const checked = (event.currentTarget as HTMLInputElement).checked;
    const field = this.fieldValue(key);
    const sources = checked
      ? [...field.sources, { filePublicUuid, pageReference: null }]
      : field.sources.filter((source) => source.filePublicUuid !== filePublicUuid);
    const hasVisibleSource = sources.some((source) => this.attachment(source.filePublicUuid)?.visibleToFamilies);
    const documentAnswer = this.isDocumentAnswerMode(key);
    const documentOnly = documentAnswer ? hasVisibleSource : field.documentOnly && hasVisibleSource;
    this.updateField(key, { ...field, sources,
      state: documentAnswer ? (documentOnly ? 'COMPLETED' : 'PENDING')
        : (field.documentOnly && !documentOnly && !field.value?.trim() ? 'PENDING' : field.state),
      value: documentAnswer ? null : field.value,
      documentOnly });
    if (this.currentStepField()?.key === key) this.syncAttachmentDetailsFromCurrentField();
  }

  hasFamilyVisibleSource(key: string): boolean {
    const visibleFiles = new Set(this.content().attachments.filter((item) => item.visibleToFamilies)
      .map((item) => item.filePublicUuid));
    return this.fieldValue(key).sources.some((source) => visibleFiles.has(source.filePublicUuid));
  }

  updateSourcePage(key: string, filePublicUuid: string, event: Event): void {
    const pageReference = (event.currentTarget as HTMLInputElement).value || null;
    const field = this.fieldValue(key);
    this.updateField(key, { ...field, sources: field.sources.map((source) =>
      source.filePublicUuid === filePublicUuid ? { ...source, pageReference } : source) });
  }

  setAttachmentVisibility(filePublicUuid: string, event: Event): void {
    const visibleToFamilies = (event.currentTarget as HTMLInputElement).checked;
    const currentField = this.currentStepField();
    if (currentField && this.fieldValue(currentField.key).sources[0]?.filePublicUuid === filePublicUuid) {
      this.attachmentVisibleToFamilies.set(visibleToFamilies);
    }
    this.content.update((value) => {
      const attachments = value.attachments.map((attachment) =>
        attachment.filePublicUuid === filePublicUuid ? { ...attachment, visibleToFamilies } : attachment);
      const visibleFiles = new Set(attachments.filter((attachment) => attachment.visibleToFamilies)
        .map((attachment) => attachment.filePublicUuid));
      const fields = Object.fromEntries(Object.entries(value.fields).map(([key, field]) => {
        const hasVisibleSource = field.sources.some((source) => visibleFiles.has(source.filePublicUuid));
        if (this.isDocumentAnswerMode(key) && field.state !== 'NOT_APPLICABLE') {
          return [key, { ...field, value: null, documentOnly: hasVisibleSource,
            state: hasVisibleSource ? 'COMPLETED' as const : 'PENDING' as const }];
        }
        if (!field.documentOnly || hasVisibleSource) return [key, field];
        return [key, { ...field, documentOnly: false,
          state: field.value?.trim() ? field.state : 'PENDING' as const }];
      }));
      return { ...value, attachments, fields };
    });
  }

  updateReviewNote(event: Event): void { this.reviewNote.set((event.currentTarget as HTMLTextAreaElement).value); }

  updateAttachmentVersion(event: Event): void { this.attachmentVersion.set((event.currentTarget as HTMLInputElement).value); this.updateCurrentAttachmentMetadata(); }
  updateAttachmentDocumentDate(event: Event): void { this.attachmentDocumentDate.set((event.currentTarget as HTMLInputElement).value); this.updateCurrentAttachmentMetadata(); }
  updateAttachmentValidUntil(event: Event): void { this.attachmentValidUntil.set((event.currentTarget as HTMLInputElement).value); this.updateCurrentAttachmentMetadata(); }
  updateAttachmentVisibility(event: Event): void { this.attachmentVisibleToFamilies.set((event.currentTarget as HTMLInputElement).checked); this.updateCurrentAttachmentMetadata(); }

  private updateCurrentAttachmentMetadata(): void {
    const currentField = this.currentStepField();
    const filePublicUuid = currentField ? this.fieldValue(currentField.key).sources[0]?.filePublicUuid : undefined;
    if (!filePublicUuid) return;
    this.content.update((value) => ({ ...value, attachments: value.attachments.map((attachment) =>
      attachment.filePublicUuid === filePublicUuid ? {
        ...attachment,
        category: this.attachmentCategory(),
        versionLabel: this.attachmentVersion().trim() || null,
        documentDate: this.attachmentDocumentDate() || null,
        validUntil: this.attachmentValidUntil() || null,
        visibleToFamilies: this.attachmentVisibleToFamilies(),
      } : attachment) }));
  }

  updateDeadline(field: 'enrollmentDisclosureDeadline' | 'yearCloseDisclosureDeadline', event: Event): void {
    this.content.update((value) => ({ ...value, [field]: (event.currentTarget as HTMLInputElement).value || null }));
  }

  updateAdditionalInformation(event: Event): void {
    this.content.update((value) => ({ ...value, additionalInformation: (event.currentTarget as HTMLTextAreaElement).value || null }));
  }

  selectAttachmentCategory(event: Event): void {
    this.attachmentCategory.set((event.currentTarget as HTMLSelectElement).value as DisclosureAttachmentCategory);
    this.updateCurrentAttachmentMetadata();
  }

  async uploadAttachmentForField(fieldKey: string, event: Event, replacedFileUuid?: string): Promise<void> {
    if (!this.canManage()) return;
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploading.set(true);
    this.error.set(null);
    try {
      let metadata: FileMetadata;
      try {
        metadata = await firstValueFrom(this.files.upload('disclosures', file));
      } catch {
        this.error.set('No se pudo subir el documento. Comprueba el formato y el tamaño permitido.');
        return;
      }
      const attachment: DisclosureContent['attachments'][number] = {
        category: this.attachmentCategory(), label: file.name,
        filePublicUuid: metadata.publicUuid, versionLabel: this.attachmentVersion().trim() || null,
        documentDate: this.attachmentDocumentDate() || null,
        validUntil: this.attachmentValidUntil() || null,
        visibleToFamilies: this.attachmentVisibleToFamilies(),
      };
      const field = this.fieldValue(fieldKey);
      const fileOnly = this.isFileOnlyField(fieldKey);
      const documentAnswer = fileOnly || this.answerMode() === 'document';
      const documentIsVisible = documentAnswer && attachment.visibleToFamilies;
      const retainedSources = replacedFileUuid
        ? field.sources.filter((source) => source.filePublicUuid !== replacedFileUuid)
        : field.sources;
      const linkedElsewhere = replacedFileUuid && Object.entries(this.content().fields)
        .some(([key, otherField]) => key !== fieldKey
          && otherField.sources.some((source) => source.filePublicUuid === replacedFileUuid));
      this.content.update((value) => ({
        ...value,
        attachments: [...value.attachments.filter((item) => item.filePublicUuid !== replacedFileUuid || linkedElsewhere), attachment],
        fields: { ...value.fields, [fieldKey]: { ...field,
          state: documentAnswer ? (documentIsVisible ? 'COMPLETED' : 'PENDING') : field.state,
          value: documentAnswer ? null : field.value,
          documentOnly: documentAnswer ? documentIsVisible : field.documentOnly,
          sources: [...retainedSources, { filePublicUuid: metadata.publicUuid, pageReference: null }] } },
      }));
      await this.save(fileOnly && attachment.visibleToFamilies
        ? 'Autorización guardada. Se compartirá con las familias cuando publiques el expediente.'
        : 'Documento y respuesta guardados.');
    } catch (error) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.uploading.set(false);
    }
  }

  private attachmentCategoryForField(fieldKey: string): DisclosureAttachmentCategory {
    if (fieldKey === 'internal_regulation') return 'INTERNAL_REGULATIONS';
    if (fieldKey === 'school_authorizations') return 'SCHOOL_AUTHORIZATION';
    if (['enrollment_fee', 'monthly_tuition', 'tuition_payment_dates', 'fee_increases', 'tuition_history',
      'admission_fee', 'admission_fee_refund', 'certificate_retention'].includes(fieldKey)) return 'ECONOMIC_INFORMATION';
    if (['admission_requirements', 'admission_process', 'vacancies'].includes(fieldKey)) return 'ADMISSION_INFORMATION';
    if (fieldKey === 'curriculum_plan') return 'CURRICULUM_PLAN';
    if (fieldKey === 'school_calendar') return 'SCHOOL_CALENDAR';
    return 'SERVICE_INFORMATION';
  }

  removeAttachment(fileUuid: string): void {
    this.content.update((value) => {
      const attachments = value.attachments.filter((item) => item.filePublicUuid !== fileUuid);
      const visibleFiles = new Set(attachments.filter((item) => item.visibleToFamilies).map((item) => item.filePublicUuid));
      const fields = Object.fromEntries(Object.entries(value.fields).map(([key, field]) => {
        const sources = field.sources.filter((source) => source.filePublicUuid !== fileUuid);
        const documentOnly = field.documentOnly && sources.some((source) => visibleFiles.has(source.filePublicUuid));
        if (this.isFileOnlyField(key) && field.state !== 'NOT_APPLICABLE') {
          return [key, { ...field, sources, value: null, documentOnly,
            state: documentOnly ? 'COMPLETED' as const : 'PENDING' as const }];
        }
        return [key, { ...field, sources, documentOnly,
          state: field.documentOnly && !documentOnly && !field.value?.trim() ? 'PENDING' as const : field.state }];
      }));
      return { ...value, attachments, fields };
    });
  }

  async save(successMessage = 'Cambios guardados.'): Promise<boolean> {
    if (!this.canManage()) return !this.hasUnsavedChanges();
    if (!this.hasUnsavedChanges()) return true;
    if (this.workspace()?.status === 'IN_REVIEW' || this.workspace()?.status === 'APPROVED') return false;
    return this.perform((yearUuid) => this.api.save(yearUuid, this.content()), successMessage, false);
  }

  async copyPreviousYear(): Promise<void> {
    if (!this.canManage()) return;
    await this.perform((yearUuid) => this.api.copyPreviousYear(yearUuid),
      'Se copiaron los datos del año anterior. Revisa importes, fechas y documentos antes de enviarlos a revisión.');
  }

  async submitForReview(): Promise<void> {
    if (!this.canSubmit()) return;
    if (!await this.save()) return;
    await this.perform((yearUuid) => this.api.submitForReview(yearUuid), 'Expediente enviado a revisión.');
  }

  async requestChanges(): Promise<void> {
    if (!this.canReview()) return;
    await this.perform((yearUuid) => this.api.requestChanges(yearUuid, this.reviewNote()), 'El expediente volvió a edición con observaciones.');
  }

  async approve(): Promise<void> {
    if (!this.canReview()) return;
    await this.perform((yearUuid) => this.api.approve(yearUuid), 'Expediente aprobado.');
  }

  async publish(): Promise<void> {
    if (!this.canPublish()) return;
    this.confirmingPublish.set(false);
    await this.perform((yearUuid) => this.api.publish(yearUuid), 'Versión publicada en el portal familiar.');
  }

  async downloadPreview(): Promise<void> {
    const yearUuid = this.selectedYearUuid();
    if (!yearUuid) return;
    if (!await this.save()) return;
    try { this.saveBlob(await firstValueFrom(this.api.downloadPreview(yearUuid)), `informacion-anual-${this.workspace()?.academicYearName ?? 'colegio'}.pdf`); }
    catch { this.error.set('No se pudo generar la copia imprimible.'); }
  }

  statusLabel(status: AcademicYearRow['status']): string {
    return status === 'ACTIVE' ? 'Activo' : status === 'CLOSED' ? 'Cerrado' : 'En preparación';
  }

  workflowLabel(status: DisclosurePackage['status']): string {
    return ({ DRAFT: 'Borrador', IN_REVIEW: 'En revisión', APPROVED: 'Aprobado', PUBLISHED: 'Publicado' })[status];
  }

  statusClass(status: DisclosurePackage['status']): string {
    return ({ DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
      IN_REVIEW: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
      APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
      PUBLISHED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200' })[status];
  }

  isEditLocked(pkg: DisclosurePackage | null): boolean {
    return !this.canManage() || !pkg || pkg.status === 'IN_REVIEW' || pkg.status === 'APPROVED';
  }

  deadlineLabel(date: string | null): string {
    if (!date) return 'Sin fecha configurada';
    const days = Math.ceil((new Date(`${date}T12:00:00`).getTime() - new Date().setHours(12, 0, 0, 0)) / 86400000);
    if (days < 0) return `Vencida hace ${Math.abs(days)} día(s)`;
    if (days === 0) return 'Vence hoy';
    return days <= 30 ? `Vence en ${days} día(s)` : `Programada para ${new Date(`${date}T12:00:00`).toLocaleDateString('es-PE')}`;
  }

  attachmentCategoryLabel(category: DisclosureAttachmentCategory): string {
    return ({ INTERNAL_REGULATIONS: 'Reglamento interno', SCHOOL_AUTHORIZATION: 'Autorización',
      ADMISSION_INFORMATION: 'Admisión', ECONOMIC_INFORMATION: 'Información económica',
      CURRICULUM_PLAN: 'Plan curricular', SCHOOL_CALENDAR: 'Calendario escolar',
      SERVICE_INFORMATION: 'Servicio educativo', OTHER: 'Otro documento' })[category];
  }

  attachmentMetadata(attachment: DisclosureContent['attachments'][number]): string {
    return [attachment.versionLabel, attachment.documentDate ? `emitido ${attachment.documentDate}` : null,
      attachment.validUntil ? `vigente hasta ${attachment.validUntil}` : null].filter(Boolean).join(' · ');
  }

  private async loadWorkspace(yearUuid: string): Promise<void> {
    const requestSequence = ++this.workspaceLoadSequence;
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
    this.stepIndex.set(0);
    try {
      const [response, versions] = await Promise.all([
        firstValueFrom(this.api.getWorkspace(yearUuid)),
        firstValueFrom(this.api.listVersions(yearUuid)),
      ]);
      if (requestSequence !== this.workspaceLoadSequence) return;
      this.workspace.set(response.data);
      this.content.set(this.normalizeContent(response.data.content));
      this.savedContentJson.set(JSON.stringify(this.content()));
      this.versions.set(versions.data ?? []);
      this.setStepIndex(0);
    } catch {
      if (requestSequence !== this.workspaceLoadSequence) return;
      this.workspace.set(null);
      this.versions.set([]);
      this.content.set(this.emptyContent());
      this.savedContentJson.set(JSON.stringify(this.content()));
      this.setStepIndex(0);
      this.error.set('No se pudo cargar este año. Actualiza la pantalla e intenta nuevamente.');
    } finally {
      if (requestSequence === this.workspaceLoadSequence) this.loading.set(false);
    }
  }

  private async perform(
    action: (yearUuid: string) => ReturnType<DisclosuresApiService['save']>,
    successMessage: string,
    refreshVersions = true,
  ): Promise<boolean> {
    const yearUuid = this.selectedYearUuid();
    if (!yearUuid) return false;
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    try {
      const response = await firstValueFrom(action(yearUuid));
      this.workspace.set(response.data);
      this.content.set(this.normalizeContent(response.data.content));
      this.savedContentJson.set(JSON.stringify(this.content()));
      this.message.set(successMessage);
      if (refreshVersions) {
        const versions = await firstValueFrom(this.api.listVersions(yearUuid));
        this.versions.set(versions.data ?? []);
      }
      return true;
    } catch (error) {
      this.error.set(this.errorMessage(error));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  private updateField(key: string, field: DisclosureField): void {
    if (this.fieldValue(key).systemManaged) return;
    this.content.update((value) => ({ ...value, fields: { ...value.fields, [key]: {
      ...field, systemManaged: false, systemSource: null,
    } } }));
  }

  private normalizeContent(content: DisclosureContent): DisclosureContent {
    const fields = Object.fromEntries(Object.entries(content.fields ?? {}).map(([key, field]) =>
      [key, { ...field, sources: field.sources ?? [], documentOnly: field.documentOnly ?? false,
        systemManaged: field.systemManaged ?? false, systemSource: field.systemSource ?? null }]));
    const attachments = (content.attachments ?? []).map((attachment) => ({
      ...attachment, versionLabel: attachment.versionLabel ?? null, documentDate: attachment.documentDate ?? null,
      validUntil: attachment.validUntil ?? null, visibleToFamilies: attachment.visibleToFamilies ?? true,
    }));
    return { ...content, fields, attachments,
      enrollmentDisclosureDeadline: content.enrollmentDisclosureDeadline ?? null,
      yearCloseDisclosureDeadline: content.yearCloseDisclosureDeadline ?? null,
      additionalInformation: content.additionalInformation ?? null };
  }

  private emptyContent(): DisclosureContent {
    return { fields: {}, attachments: [], enrollmentDisclosureDeadline: null,
      yearCloseDisclosureDeadline: null, additionalInformation: null };
  }

  private errorMessage(error: unknown): string {
    const response = error as HttpErrorResponse;
    const body = response?.error as {
      message?: unknown;
      errors?: Array<{ code?: unknown; message?: unknown }>;
      traceId?: unknown;
    } | null;
    const firstError = body?.errors?.[0];
    if (firstError?.code === 'DATA_INTEGRITY_VIOLATION') {
      const trace = typeof body?.traceId === 'string' ? ` Referencia: ${body.traceId}.` : '';
      return `No se pudieron guardar los cambios por un conflicto de datos.${trace} Intenta recargar; si persiste, comparte la referencia con soporte.`;
    }
    if (typeof body?.message === 'string' && body.message !== 'Conflict') return body.message;
    if (typeof firstError?.message === 'string') return firstError.message;
    return 'No se pudo completar la acción. Revisa el estado del expediente y vuelve a intentar.';
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.click();
    URL.revokeObjectURL(url);
  }
}
