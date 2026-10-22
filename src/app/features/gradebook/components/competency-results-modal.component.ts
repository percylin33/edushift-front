import { createFormProtection } from '@shared/services/form-protection.service';
import { CommonModule } from '@angular/common';
import { HostListener } from '@angular/core';
import { SafeBackdropDirective } from '@shared/directives/safe-backdrop.directive';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { AcademicApiService } from '@features/academic/services';
import { CompetencyRow } from '@features/academic/models';
import { GradeBookEvaluation, GradeBookStudent } from '../models';
import {
  CompetencyResultForm,
  CriterionResult,
  StudentCompetencyResult,
  StudentCompetencyResultRevision,
} from '../models/competency-results.model';
import { CompetencyResultsApiService } from '../services';

@Component({
  selector: 'app-competency-results-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SafeBackdropDirective, CommonModule, FormsModule, IconComponent, SpinnerComponent],
  template: `
    <div class="overlay" role="presentation" appSafeBackdrop (click)="onBackdrop($event)">
      <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="competency-title" (click)="$event.stopPropagation()">
        <header class="dialog-header">
          <div>
            <p class="eyebrow">Evaluación formativa</p>
            <h2 id="competency-title">Competencias, evidencias y conclusiones</h2>
          </div>
          <button type="button" class="icon-button" aria-label="Cerrar" (click)="requestClose()">
            <app-icon name="x" [size]="18" />
          </button>
        </header>
        <div class="notice">
          Registra los niveles y criterios definidos por el colegio. Este espacio conserva evidencias y conclusiones docentes; no calcula promedios ni determina por sí mismo una calificación oficial.
        </div>
        @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
        @if (success()) { <div class="success" role="status">{{ success() }}</div> }
        <div class="selectors">
          <label>
            <span>Evaluación</span>
            <select class="select" [ngModel]="evaluationUuid()" (ngModelChange)="onEvaluationChange($event)">
              <option value="">Selecciona una evaluación</option>
              @for (evaluation of evaluations; track evaluation.publicUuid) {
                <option [value]="evaluation.publicUuid">{{ evaluation.name }} · {{ evaluation.scheduledDate | date: 'dd/MM/yyyy' }}</option>
              }
            </select>
          </label>
          <label>
            <span>Estudiante</span>
            <select class="select" [ngModel]="studentUuid()" (ngModelChange)="onStudentChange($event)">
              <option value="">Selecciona un estudiante</option>
              @for (student of students; track student.publicUuid) {
                <option [value]="student.publicUuid">{{ student.fullName }}</option>
              }
            </select>
          </label>
        </div>
        @if (loading()) {
          <div class="loading"><app-spinner [size]="22" label="Cargando competencias y resultados…" /></div>
        } @else if (evaluationUuid() && studentUuid()) {
          @if (competencies().length === 0) {
            <div class="empty">Este curso aún no tiene competencias activas. Configúralas en el catálogo del curso para registrar resultados.</div>
          } @else {
            <div class="result-list">
              @for (competency of competencies(); track competency.publicUuid) {
                @let form = formFor(competency.publicUuid);
                <article class="result-card">
                  <div class="competency-heading">
                    <div>
                      <span class="code">{{ competency.code }}</span>
                      <h3>{{ competency.name }}</h3>
                    </div>
                    <button type="button" class="link-button" [disabled]="historyLoading()" (click)="toggleHistory(competency.publicUuid)">
                      {{ historyCompetencyUuid() === competency.publicUuid ? 'Ocultar historial' : 'Ver historial' }}
                    </button>
                  </div>
                  @if (historyCompetencyUuid() === competency.publicUuid) {
                    <section class="history-panel" aria-label="Historial de revisiones">
                      <h4>Historial de revisiones</h4>
                      @if (historyLoading()) {
                        <app-spinner [size]="18" label="Cargando historial…" />
                      } @else if (historyRows().length === 0) {
                        <p>Aún no hay revisiones registradas para esta competencia.</p>
                      } @else {
                        @for (revision of historyRows(); track revision.revision) {
                          <article class="history-item">
                            <div class="history-title">
                              <strong>Revisión {{ revision.revision }}</strong>
                              <time>{{ revision.changedAt | date: 'dd/MM/yyyy HH:mm' }}</time>
                            </div>
                            <p><strong>Nivel:</strong> {{ revision.snapshot.achievementLevel || '—' }}</p>
                            @if (revision.snapshot.evidenceSummary) {
                              <p><strong>Evidencia:</strong> {{ revision.snapshot.evidenceSummary }}</p>
                            }
                            @if (revision.snapshot.descriptiveConclusion) {
                              <p><strong>Conclusión:</strong> {{ revision.snapshot.descriptiveConclusion }}</p>
                            }
                            @if (revision.snapshot.criteriaResults?.length) {
                              <details>
                                <summary>{{ revision.snapshot.criteriaResults?.length }} criterio(s)</summary>
                                @for (criterion of revision.snapshot.criteriaResults; track $index) {
                                  <p>{{ criterion.criterionName }} · {{ criterion.achievementLevel }}</p>
                                }
                              </details>
                            }
                            @if (revision.snapshot.isActive === false) {
                              <span class="inactive-history">Resultado retirado del conjunto vigente</span>
                            }
                          </article>
                        }
                      }
                    </section>
                  }
                  <label>
                    <span>Nivel de logro institucional</span>
                    <input class="input" maxlength="32" [ngModel]="form.achievementLevel" (ngModelChange)="updateForm(competency.publicUuid, 'achievementLevel', $event)" placeholder="Ej.: En proceso" />
                  </label>
                  <label>
                    <span>Evidencia observada</span>
                    <textarea class="textarea" rows="2" maxlength="4000" [ngModel]="form.evidenceSummary" (ngModelChange)="updateForm(competency.publicUuid, 'evidenceSummary', $event)" placeholder="Describe el producto, actuación o desempeño observado"></textarea>
                  </label>
                  <label>
                    <span>Conclusión descriptiva</span>
                    <textarea class="textarea" rows="2" maxlength="4000" [ngModel]="form.descriptiveConclusion" (ngModelChange)="updateForm(competency.publicUuid, 'descriptiveConclusion', $event)" placeholder="Registra una conclusión breve basada en la evidencia"></textarea>
                  </label>
                  <div class="criteria-header">
                    <h4>Criterios observados</h4>
                    <button type="button" class="link-button" [disabled]="form.criteriaResults.length >= 20" (click)="addCriterion(competency.publicUuid)">Agregar criterio</button>
                  </div>
                  @for (criterion of form.criteriaResults; track $index; let i = $index) {
                    <div class="criterion">
                      <input class="input" maxlength="180" [ngModel]="criterion.criterionName" (ngModelChange)="updateCriterion(competency.publicUuid, i, 'criterionName', $event)" placeholder="Criterio" />
                      <input class="input" maxlength="32" [ngModel]="criterion.achievementLevel" (ngModelChange)="updateCriterion(competency.publicUuid, i, 'achievementLevel', $event)" placeholder="Nivel" />
                      <textarea class="textarea" rows="2" maxlength="2000" [ngModel]="criterion.evidence" (ngModelChange)="updateCriterion(competency.publicUuid, i, 'evidence', $event)" placeholder="Evidencia"></textarea>
                      <textarea class="textarea" rows="2" maxlength="2000" [ngModel]="criterion.feedback" (ngModelChange)="updateCriterion(competency.publicUuid, i, 'feedback', $event)" placeholder="Retroalimentación"></textarea>
                      <button type="button" class="remove-button" [attr.aria-label]="'Quitar criterio ' + (i + 1)" (click)="removeCriterion(competency.publicUuid, i)">Quitar</button>
                    </div>
                  }
                </article>
              }
            </div>
          }
          @if (selectedEvaluation()?.status === 'CLOSED') {
            <div class="readonly-note">La evaluación está cerrada. Puedes consultar los resultados, pero no modificarlos.</div>
          }
        } @else {
          <div class="empty">Selecciona una evaluación y un estudiante para registrar sus resultados.</div>
        }
        <footer class="dialog-footer">
          <span class="revision-note">Los cambios quedan registrados en el historial académico.</span>
          <div class="footer-actions">
            <button type="button" class="btn btn-ghost" (click)="requestClose()">Cerrar</button>
            <button type="button" class="btn btn-primary" [disabled]="loading() || saving() || !canSave() || selectedEvaluation()?.status === 'CLOSED'" (click)="save()">
              @if (saving()) { Guardando… } @else { Guardar resultados }
            </button>
          </div>
        </footer>
      </section>
    </div>
  `,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 1000; }
    .overlay { position: fixed; inset: 0; display: grid; place-items: center; padding: 1rem; background: rgb(15 23 42 / .55); }
    .dialog { display: flex; flex-direction: column; width: min(900px, 100%); max-height: min(92vh, 900px); overflow: hidden; border-radius: .75rem; background: var(--color-surface, #fff); box-shadow: 0 24px 60px rgb(15 23 42 / .25); }
    .dialog-header, .dialog-footer { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.25rem; border-bottom: 1px solid var(--color-border-subtle, #e5e7eb); }
    .dialog-header h2 { margin: .15rem 0 0; font-size: 1.1rem; font-weight: 700; }
    .eyebrow, .code { color: var(--color-content-muted, #64748b); font-size: .75rem; }
    .icon-button { display: grid; place-items: center; width: 2rem; height: 2rem; border-radius: .375rem; }
    .notice { margin: 1rem 1.25rem 0; padding: .75rem; border-radius: .5rem; background: var(--color-primary-50, #eff6ff); color: var(--color-primary-900, #1e3a8a); font-size: .8125rem; line-height: 1.4; }
    .selectors { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; padding: 1rem 1.25rem; }
    label { display: grid; gap: .3rem; font-size: .75rem; font-weight: 600; }
    .select, .input, .textarea { width: 100%; border: 1px solid var(--color-border, #cbd5e1); border-radius: .375rem; background: var(--color-surface, #fff); padding: .5rem .6rem; color: var(--color-content, #0f172a); font: inherit; font-weight: 400; }
    .textarea { resize: vertical; }
    .result-list { overflow: auto; padding: 0 1.25rem 1rem; }
    .result-card { display: grid; gap: .7rem; margin-bottom: .8rem; padding: .9rem; border: 1px solid var(--color-border-subtle, #e2e8f0); border-radius: .5rem; }
    .competency-heading h3 { margin: .15rem 0 0; font-size: .95rem; font-weight: 650; }
    .competency-heading { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
    .history-panel { display: grid; gap: .5rem; padding: .75rem; border-radius: .5rem; background: var(--color-surface-subtle, #f8fafc); }
    .history-panel h4 { margin: 0; font-size: .8rem; }
    .history-panel p { margin: .25rem 0; font-size: .75rem; }
    .history-item { display: grid; gap: .25rem; padding: .6rem; border: 1px solid var(--color-border-subtle, #e2e8f0); border-radius: .375rem; background: var(--color-surface, #fff); }
    .history-title { display: flex; justify-content: space-between; gap: .75rem; font-size: .75rem; }
    .history-title time, .inactive-history { color: var(--color-content-muted, #64748b); font-size: .7rem; }
    .criteria-header { display: flex; align-items: center; justify-content: space-between; }
    .criteria-header h4 { margin: 0; font-size: .8rem; }
    .criterion { display: grid; grid-template-columns: 1.3fr .7fr 1.2fr 1.2fr auto; gap: .5rem; align-items: start; }
    .link-button { color: var(--color-primary-700, #1d4ed8); font-size: .75rem; font-weight: 600; }
    .remove-button { color: var(--color-danger-700, #b91c1c); font-size: .75rem; padding: .5rem 0; }
    .empty, .loading, .readonly-note, .error { margin: 1rem 1.25rem; padding: 1rem; border-radius: .5rem; background: var(--color-surface-subtle, #f8fafc); color: var(--color-content-muted, #475569); font-size: .875rem; }
    .error { background: #fef2f2; color: #b91c1c; }
    .success { margin: 1rem 1.25rem 0; padding: .75rem; border-radius: .5rem; background: #f0fdf4; color: #166534; font-size: .8125rem; }
    .readonly-note { margin-top: 0; background: #fffbeb; color: #92400e; }
    .dialog-footer { margin-top: auto; border-top: 1px solid var(--color-border-subtle, #e5e7eb); border-bottom: 0; }
    .revision-note { color: var(--color-content-muted, #64748b); font-size: .75rem; }
    .footer-actions { display: flex; gap: .5rem; }
    @media (max-width: 720px) { .selectors { grid-template-columns: 1fr; } .criterion { grid-template-columns: 1fr 1fr; } .criterion .textarea { grid-column: span 2; } .dialog-footer { align-items: flex-start; flex-direction: column; } }
  `],
})
export class CompetencyResultsModalComponent {
  protected readonly formProtection = createFormProtection({
    snapshot: () => [this.evaluationUuid(), this.studentUuid(), this.forms()],
    saving: () => this.saving() || this.loading(),
    active: () => true,
  });

  @Input({ required: true }) courseUuid = '';
  @Input({ required: true }) students: GradeBookStudent[] = [];
  @Input({ required: true }) evaluations: GradeBookEvaluation[] = [];
  @Output() close = new EventEmitter<void>();

  private readonly academicApi = inject(AcademicApiService);
  private readonly resultsApi = inject(CompetencyResultsApiService);
  protected readonly competencies = signal<CompetencyRow[]>([]);
  protected readonly forms = signal<Record<string, CompetencyResultForm>>({});
  protected readonly evaluationUuid = signal('');
  protected readonly studentUuid = signal('');
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly historyCompetencyUuid = signal<string | null>(null);
  protected readonly historyRows = signal<StudentCompetencyResultRevision[]>([]);
  protected readonly historyLoading = signal(false);

  protected selectedEvaluation(): GradeBookEvaluation | undefined {
    return this.evaluations.find((item) => item.publicUuid === this.evaluationUuid());
  }

  protected formFor(uuid: string): CompetencyResultForm {
    return this.forms()[uuid] ?? this.emptyForm(uuid);
  }

  protected canSave(): boolean {
    if (!this.evaluationUuid() || !this.studentUuid() || this.competencies().length === 0) return false;
    return Object.values(this.forms()).every((form) => form.criteriaResults.every((item) =>
      !!item.criterionName.trim() && !!item.achievementLevel.trim(),
    ));
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void { this.requestClose(); }

  protected onBackdrop(event: MouseEvent): void { if (event.target === event.currentTarget) this.requestClose(); }

  protected requestClose(): void { this.formProtection.requestClose(() => this.close.emit()); }

  protected onEvaluationChange(value: string): void {
    this.formProtection.requestChange(() => {
      this.evaluationUuid.set(value);
      void this.loadContext();
    });
  }

  protected onStudentChange(value: string): void {
    this.formProtection.requestChange(() => {
      this.studentUuid.set(value);
      void this.loadContext();
    });
  }

  protected async toggleHistory(competencyUuid: string): Promise<void> {
    if (this.historyCompetencyUuid() === competencyUuid) {
      this.historyCompetencyUuid.set(null);
      this.historyRows.set([]);
      return;
    }
    const evaluationUuid = this.evaluationUuid();
    const studentUuid = this.studentUuid();
    if (!evaluationUuid || !studentUuid) return;
    this.historyCompetencyUuid.set(competencyUuid);
    this.historyRows.set([]);
    this.historyLoading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(
        this.resultsApi.revisions(evaluationUuid, studentUuid, competencyUuid),
      );
      this.historyRows.set(response.data);
    } catch (err) {
      this.error.set(this.errorMessage(err));
    } finally {
      this.historyLoading.set(false);
    }
  }

  protected updateForm(uuid: string, key: 'achievementLevel' | 'evidenceSummary' | 'descriptiveConclusion', value: string): void {
    this.success.set(null);
    this.forms.update((current) => ({ ...current, [uuid]: { ...this.formFor(uuid), [key]: value } }));
  }

  protected updateCriterion(uuid: string, index: number, key: keyof CriterionResult, value: string): void {
    this.success.set(null);
    this.forms.update((current) => {
      const form = this.formFor(uuid);
      const criteriaResults = form.criteriaResults.map((item, i) => i === index ? { ...item, [key]: value } : item);
      return { ...current, [uuid]: { ...form, criteriaResults } };
    });
  }

  protected addCriterion(uuid: string): void {
    this.success.set(null);
    this.forms.update((current) => ({
      ...current,
      [uuid]: { ...this.formFor(uuid), criteriaResults: [...this.formFor(uuid).criteriaResults, this.emptyCriterion()] },
    }));
  }

  protected removeCriterion(uuid: string, index: number): void {
    this.success.set(null);
    this.forms.update((current) => {
      const form = this.formFor(uuid);
      return { ...current, [uuid]: { ...form, criteriaResults: form.criteriaResults.filter((_, i) => i !== index) } };
    });
  }

  protected async save(): Promise<void> {
    const evaluationUuid = this.evaluationUuid();
    const studentUuid = this.studentUuid();
    if (!evaluationUuid || !studentUuid || !this.canSave()) return;
    const request = {
      results: this.competencies().flatMap((competency) => {
        const form = this.formFor(competency.publicUuid);
        if (!form.achievementLevel.trim()) return [];
        return [{
          ...form,
          achievementLevel: form.achievementLevel.trim(),
          evidenceSummary: form.evidenceSummary?.trim() || null,
          descriptiveConclusion: form.descriptiveConclusion?.trim() || null,
          criteriaResults: form.criteriaResults.map((item) => ({
            ...item,
            criterionName: item.criterionName.trim(),
            achievementLevel: item.achievementLevel.trim(),
            evidence: item.evidence?.trim() || null,
            feedback: item.feedback?.trim() || null,
          })),
        }];
      }),
    };
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    try {
      const response = await firstValueFrom(this.resultsApi.replace(evaluationUuid, studentUuid, request));
      this.initializeForms(response.data);
      this.formProtection.markSaved();
      this.historyCompetencyUuid.set(null);
      this.historyRows.set([]);
      this.success.set('Los resultados y su revisión histórica se guardaron correctamente.');
    } catch (err) {
      this.error.set(this.errorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }

  private async loadContext(): Promise<void> {
    const evaluationUuid = this.evaluationUuid();
    const studentUuid = this.studentUuid();
    this.error.set(null);
    this.success.set(null);
    this.forms.set({});
    this.historyCompetencyUuid.set(null);
    this.historyRows.set([]);
    if (!evaluationUuid || !studentUuid) return;
    this.loading.set(true);
    try {
      const [competencies, results] = await Promise.all([
        firstValueFrom(this.academicApi.listCompetencies(this.courseUuid, true)),
        firstValueFrom(this.resultsApi.list(evaluationUuid, studentUuid)),
      ]);
      this.competencies.set(competencies);
      this.initializeForms(results.data);
    } catch (err) {
      this.error.set(this.errorMessage(err));
    } finally {
      this.loading.set(false);
      this.formProtection.markSaved();
    }
  }

  private initializeForms(results: StudentCompetencyResult[]): void {
    const existing = new Map(results.map((result) => [result.competencyPublicUuid, result]));
    const forms: Record<string, CompetencyResultForm> = {};
    for (const competency of this.competencies()) {
      const result = existing.get(competency.publicUuid);
      forms[competency.publicUuid] = result ? {
        competencyPublicUuid: competency.publicUuid,
        achievementLevel: result.achievementLevel,
        evidenceSummary: result.evidenceSummary ?? '',
        descriptiveConclusion: result.descriptiveConclusion ?? '',
        criteriaResults: (result.criteriaResults ?? []).map((item) => ({
          criterionName: item.criterionName,
          achievementLevel: item.achievementLevel,
          evidence: item.evidence ?? '',
          feedback: item.feedback ?? '',
        })),
      } : this.emptyForm(competency.publicUuid);
    }
    this.forms.set(forms);
  }

  private emptyForm(competencyPublicUuid: string): CompetencyResultForm {
    return { competencyPublicUuid, achievementLevel: '', evidenceSummary: '', descriptiveConclusion: '', criteriaResults: [] };
  }

  private emptyCriterion(): CriterionResult {
    return { criterionName: '', achievementLevel: '', evidence: '', feedback: '' };
  }

  private errorMessage(err: unknown): string {
    const error = err as { error?: { message?: string }; message?: string };
    return error.error?.message ?? error.message ?? 'No se pudieron cargar o guardar los resultados. Intenta de nuevo.';
  }
}
