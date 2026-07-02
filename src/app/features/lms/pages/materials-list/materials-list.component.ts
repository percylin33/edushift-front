import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { Permission } from '@core/enums';
import { AuthService } from '@core/services';
import { EmptyStateComponent, IconComponent } from '@shared/components';
import { HasPermissionDirective } from '@shared/directives';
import { MaterialsStore } from '../../store';
import { MaterialRow } from '../../models';
import { MaterialCardComponent } from '../../components';
import { MaterialUploadDialogComponent } from '../../components';

/**
 * `/lms/sections/:sectionUuid/materials` — listing de materiales
 * (FE-7a.3 Scenario 1 y 2).
 *
 * <h3>Responsabilidades</h3>
 * <ul>
 *   <li>Cargar el listing via {@link MaterialsStore.loadBySection}.</li>
 *   <li>Botón "Subir material" gated por {@code LMS_MATERIAL_WRITE}
 *       (TEACHER/ADMIN) que abre el dialog.</li>
 *   <li>Render de cards con icono por type y acciones "Descargar"
 *       (302) / "Eliminar" (soft-delete + Firebase cleanup).</li>
 *   <li>Empty state contextual ("Aún no hay materiales" + CTA
 *       "Subir el primer material" si TEACHER/ADMIN).</li>
 * </ul>
 */
@Component({
  selector: 'app-materials-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IconComponent,
    EmptyStateComponent,
    HasPermissionDirective,
    MaterialCardComponent,
    MaterialUploadDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <p class="text-xs uppercase tracking-wide text-content-muted">
          <a [routerLink]="listRoute()" class="hover:underline">LMS</a>
        </p>
        <h1 class="text-2xl font-semibold text-content">Materiales</h1>
        <p class="text-sm text-content-muted">Recursos compartidos con la sección.</p>
      </div>

      <button
        *appHasPermission="permission.LmsMaterialWrite"
        type="button"
        class="btn btn-primary btn-sm self-start sm:self-auto"
        (click)="onOpenDialog()"
      >
        <app-icon name="plus" [size]="16" />
        <span class="hidden sm:inline">Subir material</span>
      </button>
    </header>

    @if (loading()) {
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        @for (i of [0, 1, 2, 3, 4, 5]; track i) {
          <div class="card animate-pulse">
            <div class="card-body space-y-2">
              <div class="h-4 w-2/3 rounded bg-surface-muted"></div>
              <div class="h-3 w-1/3 rounded bg-surface-muted"></div>
            </div>
          </div>
        }
      </div>
    } @else if (errorBanner()) {
      <div class="alert alert-danger mb-4" role="alert">
        <app-icon name="alert-circle" [size]="18" />
        <div class="flex-1">
          <p class="font-medium">No pudimos cargar los materiales.</p>
          <p class="mt-1 text-xs opacity-80">{{ errorBanner() }}</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" (click)="reload()">
          <app-icon name="refresh" [size]="14" />
          Reintentar
        </button>
      </div>
    } @else if (rows().length === 0) {
      <app-empty-state
        title="Aún no hay materiales"
        description="Sube un PDF, imagen, documento o un enlace externo para compartir con la sección."
        icon="paperclip"
      >
        <button
          *appHasPermission="permission.LmsMaterialWrite"
          type="button"
          class="btn btn-primary btn-sm"
          (click)="onOpenDialog()"
        >
          <app-icon name="plus" [size]="16" />
          Subir el primer material
        </button>
      </app-empty-state>
    } @else {
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        @for (row of rows(); track row.publicUuid) {
          <app-material-card [material]="row" (delete)="onDelete($event)" />
        }
      </div>
    }

    <app-material-upload-dialog
      [open]="dialogOpen()"
      [uploading]="uploading()"
      [uploadPercent]="uploadPercent()"
      (submitted)="onUpload($event)"
      (dialogClosed)="onCancelDialog()"
    />
  `,
})
export class MaterialsListComponent implements OnInit {
  private readonly store = inject(MaterialsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly rows = this.store.rows;
  protected readonly loading = this.store.loading;
  protected readonly errorBanner = this.store.error;
  protected readonly uploading = this.store.uploading;
  protected readonly uploadPercent = this.store.uploadPercent;
  protected readonly permission = Permission;
  protected readonly dialogOpen = signal(false);

  #sectionUuid: string | null = null;

  ngOnInit(): void {
    const sectionUuid = this.route.snapshot.paramMap.get('sectionUuid');
    if (!sectionUuid) {
      void this.router.navigate([ROUTES.LMS.ROOT]);
      return;
    }
    this.#sectionUuid = sectionUuid;
    void this.store.loadBySection(sectionUuid);
  }

  protected listRoute(): string {
    if (!this.#sectionUuid) return ROUTES.LMS.ROOT;
    return ROUTES.LMS.sectionAssignments(this.#sectionUuid);
  }

  protected reload(): void {
    if (!this.#sectionUuid) return;
    this.store.clearError();
    void this.store.loadBySection(this.#sectionUuid);
  }

  protected onOpenDialog(): void {
    this.dialogOpen.set(true);
  }

  protected onCancelDialog(): void {
    this.dialogOpen.set(false);
  }

  protected async onUpload(request: Parameters<MaterialsStore['upload']>[1]): Promise<void> {
    if (!this.#sectionUuid) return;
    const result = await this.store.upload(this.#sectionUuid, request);
    if (result) this.dialogOpen.set(false);
  }

  protected async onDelete(row: MaterialRow): Promise<void> {
    const ok = window.confirm(
      `¿Eliminar el material "${row.title}"? Esta acción no se puede deshacer.`,
    );
    if (!ok) return;
    await this.store.remove(row.publicUuid);
  }
}
