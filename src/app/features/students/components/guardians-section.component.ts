import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal
} from '@angular/core';
import {
  EmptyStateComponent,
  IconComponent,
  SpinnerComponent
} from '@shared/components';
import { StudentsStore } from '../store/students.store';
import { Guardian } from '../models';
import { AddGuardianModalComponent } from './add-guardian-modal.component';
import { EditGuardianLinkModalComponent } from './edit-guardian-link-modal.component';
import { RelationshipBadgeComponent } from './relationship-badge.component';

/**
 * Drop-in section for the student detail page. Owns the guardian
 * slice of {@link StudentsStore}, hydrates it on mount, and renders:
 *
 * <ul>
 *   <li>An empty state with a CTA when the student has no guardians.</li>
 *   <li>A card list otherwise — primary contact pinned on top, the
 *       rest sorted by relationship.</li>
 *   <li>"Vincular tutor" button that opens
 *       {@link AddGuardianModalComponent}.</li>
 *   <li>Per-row "Editar" / "Quitar" actions (the edit modal is the
 *       only way to flip {@code isPrimaryContact} for now).</li>
 * </ul>
 *
 * <p>Designed as a self-contained section so the detail page can drop
 * it in with a single import; the page doesn't need to know about
 * the modals or the slice's signals.
 */
@Component({
  selector: 'app-guardians-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    EmptyStateComponent,
    IconComponent,
    SpinnerComponent,
    RelationshipBadgeComponent,
    AddGuardianModalComponent,
    EditGuardianLinkModalComponent
  ],
  template: `
    <section class="card lg:col-span-3">
      <header class="card-header">
        <div>
          <h2 class="card-title">Tutores</h2>
          <p class="card-description">
            Apoderados vinculados al estudiante. El contacto principal recibe
            las comunicaciones críticas.
          </p>
        </div>
        <button type="button" class="btn btn-primary btn-sm" (click)="openAddModal()">
          <app-icon name="plus" [size]="16" />
          <span class="hidden sm:inline">Vincular tutor</span>
        </button>
      </header>

      @if (loading() && guardians().length === 0) {
        <div class="flex items-center justify-center py-12">
          <app-spinner [size]="22" label="Cargando tutores…" />
        </div>
      } @else if (errorMessage() && guardians().length === 0) {
        <div class="card-body alert alert-danger">
          <app-icon name="alert-circle" [size]="18" />
          <div class="flex-1">
            <p class="font-medium">No pudimos cargar los tutores.</p>
            <p class="mt-1 text-xs opacity-80">{{ errorMessage() }}</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" (click)="retry()">Reintentar</button>
        </div>
      } @else if (guardians().length === 0) {
        <div class="p-2">
          <app-empty-state
            icon="users"
            title="Aún no hay tutores"
            description="Vincula a un padre, madre o apoderado legal para gestionar comunicaciones y permisos.">
            <button type="button" class="btn btn-primary btn-sm" (click)="openAddModal()">
              Vincular tutor
            </button>
          </app-empty-state>
        </div>
      } @else {
        <ul class="card-body grid gap-3">
          @for (g of orderedGuardians(); track g.linkPublicUuid) {
            <li class="rounded-md border border-border-subtle bg-surface p-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="text-sm font-semibold text-content">{{ g.fullName }}</p>
                    <app-relationship-badge [relationship]="g.relationship" />
                    @if (g.isPrimaryContact) {
                      <span class="badge badge-success">Principal</span>
                    }
                    @if (g.canPickupStudent) {
                      <span class="badge badge-info">Recoge</span>
                    }
                  </div>
                  <p class="text-xs text-content-muted">
                    <span class="font-mono">{{ g.documentType }}</span>
                    <span class="ml-1">{{ g.documentNumber }}</span>
                    @if (g.occupation) {
                      <span class="mx-2 text-content-subtle">·</span>
                      <span>{{ g.occupation }}</span>
                    }
                  </p>
                  <div class="flex flex-wrap items-center gap-3 text-xs text-content-muted">
                    @if (g.email) {
                      <span class="inline-flex items-center gap-1">
                        <app-icon name="mail" [size]="14" />
                        <span>{{ g.email }}</span>
                      </span>
                    }
                    @if (g.phone) {
                      <span class="inline-flex items-center gap-1">
                        <app-icon name="phone" [size]="14" />
                        <span>{{ g.phone }}</span>
                      </span>
                    }
                    @if (!g.email && !g.phone) {
                      <span class="italic text-content-subtle">Sin datos de contacto</span>
                    }
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm"
                    aria-label="Editar vínculo"
                    [disabled]="saving()"
                    (click)="openEditModal(g)"
                  >
                    <app-icon name="pencil" [size]="14" />
                    <span class="hidden sm:inline">Editar</span>
                  </button>
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm text-danger hover:bg-danger/10"
                    aria-label="Quitar tutor"
                    [disabled]="saving()"
                    (click)="onUnlink(g)"
                  >
                    <app-icon name="trash" [size]="14" />
                    <span class="hidden sm:inline">Quitar</span>
                  </button>
                </div>
              </div>
            </li>
          }
        </ul>
      }
    </section>

    @if (addOpen()) {
      <app-add-guardian-modal
        [studentPublicUuid]="studentPublicUuid()"
        (closed)="closeAddModal()"
      />
    }
    @if (editTarget(); as t) {
      <app-edit-guardian-link-modal
        [studentPublicUuid]="studentPublicUuid()"
        [guardian]="t"
        (closed)="closeEditModal()"
      />
    }
  `
})
export class GuardiansSectionComponent implements OnInit {
  private readonly store = inject(StudentsStore);

  readonly studentPublicUuid = input.required<string>();

  protected readonly guardians = this.store.guardians;
  protected readonly loading = this.store.loadingGuardians;
  protected readonly saving = this.store.savingGuardian;
  protected readonly errorMessage = this.store.error;

  protected readonly addOpen = signal(false);
  protected readonly editTarget = signal<Guardian | null>(null);

  /**
   * Re-fetch whenever the bound student id changes. Mirrors the
   * pattern used by other detail-page sections — keeps the section
   * usable from any host without forcing the host to coordinate the
   * fetch lifecycle.
   */
  constructor() {
    effect(() => {
      const id = this.studentPublicUuid();
      if (id) {
        void this.store.loadGuardians(id);
      }
    });
  }

  ngOnInit(): void {
    /* {@link effect} above already covers the initial load; the
     * hook is a no-op kept for parity with other section components
     * that wire init-only logic. */
  }

  /**
   * Sort: primary first, then by relationship priority (Mother /
   * Father / Grandparent / Guardian / Other), and finally by full
   * name to keep the order stable across renders.
   */
  protected readonly orderedGuardians = computed(() => {
    const list = this.guardians();
    return [...list].sort((a, b) => {
      if (a.isPrimaryContact !== b.isPrimaryContact) {
        return a.isPrimaryContact ? -1 : 1;
      }
      const ra = GuardiansSectionComponent.RELATIONSHIP_ORDER[a.relationship] ?? 99;
      const rb = GuardiansSectionComponent.RELATIONSHIP_ORDER[b.relationship] ?? 99;
      if (ra !== rb) return ra - rb;
      return a.fullName.localeCompare(b.fullName, 'es');
    });
  });

  private static readonly RELATIONSHIP_ORDER: Readonly<Record<string, number>> = {
    MOTHER: 0,
    FATHER: 1,
    GRANDPARENT: 2,
    GUARDIAN: 3,
    OTHER: 4
  };

  protected openAddModal(): void {
    this.store.clearError();
    this.addOpen.set(true);
  }

  protected closeAddModal(): void {
    this.addOpen.set(false);
  }

  protected openEditModal(guardian: Guardian): void {
    this.store.clearError();
    this.editTarget.set(guardian);
  }

  protected closeEditModal(): void {
    this.editTarget.set(null);
  }

  protected retry(): void {
    this.store.clearError();
    void this.store.loadGuardians(this.studentPublicUuid());
  }

  protected async onUnlink(guardian: Guardian): Promise<void> {
    /* Native confirm() is intentionally low-effort here — Sprint 3
     * doesn't ship a confirm-dialog component yet. The backend
     * still enforces the LAST_PRIMARY_CONTACT guardrail, so the
     * worst case is an inline error banner. */
    const ok = window.confirm(
      `¿Quitar a ${guardian.fullName} como tutor? Se mantendrá el registro del tutor por si está vinculado a un hermano.`
    );
    if (!ok) return;

    await this.store.unlinkGuardian(
      this.studentPublicUuid(),
      guardian.guardianPublicUuid,
      guardian.linkPublicUuid
    );
  }
}
