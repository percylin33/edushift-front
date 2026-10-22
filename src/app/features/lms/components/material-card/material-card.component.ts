import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FileUploadService } from '@core/services/file-upload.service';
import { FilePreviewDialogComponent, IconComponent, IconName } from '@shared/components';
import { HasPermissionDirective } from '@shared/directives';
import { Permission } from '@core/enums';
import {
  MaterialRow,
  MaterialType,
  isFileMaterial,
  materialTypeIcon,
  materialTypeLabel,
} from '../../models';

@Component({
  selector: 'app-material-card',
  standalone: true,
  imports: [CommonModule, IconComponent, HasPermissionDirective, FilePreviewDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card transition-shadow hover:shadow-md">
      <div class="card-body flex items-start gap-3">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
          [class]="iconBgClass()"
          aria-hidden="true"
        >
          <app-icon [name]="iconName()" [size]="20" />
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <h3 class="truncate text-sm font-semibold text-content">
                {{ material.title }}
              </h3>
              <p class="text-xs text-content-muted">
                {{ material.createdAt | date: 'mediumDate' }}
                @if (material.sizeBytesDisplay) {
                  · {{ material.sizeBytesDisplay }}
                }
                @if (material.filename) {
                  · {{ material.filename }}
                }
              </p>
            </div>
            <span
              class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
              [class]="badgeClass()"
            >
              {{ typeLabel() }}
            </span>
          </div>
        </div>
      </div>

      <footer class="card-footer flex flex-wrap items-center justify-end gap-2">
        @if (isLink()) {
          <a [href]="material.url" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">
            <app-icon name="globe" [size]="14" />
            Abrir enlace
          </a>
        } @else {
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            (click)="onPreview()"
          >
            <app-icon name="eye" [size]="14" />
            Ver documento
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            [disabled]="downloading()"
            (click)="onDownload()"
          >
            <app-icon name="download" [size]="14" />
            {{ downloading() ? 'Descargando…' : 'Descargar' }}
          </button>
        }
        <button
          *appHasPermission="permission.LmsMaterialWrite"
          type="button"
          class="btn btn-ghost btn-sm text-rose-700 hover:bg-rose-50"
          (click)="onDelete()"
        >
          <app-icon name="trash" [size]="14" />
          Eliminar
        </button>
      </footer>
      <app-file-preview-dialog
        [open]="previewOpen()"
        [filePublicUuid]="material.filePublicUuid"
        [filename]="material.filename || material.title || 'material'"
        (closed)="previewOpen.set(false)"
      />
    </article>
  `,
})
export class MaterialCardComponent {
  @Input({ required: true }) material!: MaterialRow;
  @Output() readonly delete = new EventEmitter<MaterialRow>();

  private readonly files = inject(FileUploadService);

  protected readonly permission = Permission;
  protected readonly downloading = signal(false);
  protected readonly previewOpen = signal(false);

  protected onPreview(): void {
    if (this.material.filePublicUuid) this.previewOpen.set(true);
  }

  iconName(): IconName {
    return materialTypeIcon(this.material.type) as IconName;
  }

  typeLabel(): string {
    return materialTypeLabel(this.material.type);
  }

  isLink(): boolean {
    return !isFileMaterial(this.material.type);
  }

  async onDownload(): Promise<void> {
    if (!this.material.filePublicUuid) return;
    this.downloading.set(true);
    try {
      await this.files.downloadAndSave(
        this.material.filePublicUuid,
        this.material.filename || this.material.title || 'material',
      );
    } catch {
      // global error interceptor
    } finally {
      this.downloading.set(false);
    }
  }

  protected iconBgClass(): string {
    switch (this.material.type) {
      case MaterialType.Pdf:
        return 'bg-rose-50 text-rose-700';
      case MaterialType.Image:
        return 'bg-emerald-50 text-emerald-700';
      case MaterialType.Doc:
        return 'bg-sky-50 text-sky-700';
      case MaterialType.Link:
        return 'bg-amber-50 text-amber-700';
      default:
        return 'bg-slate-50 text-slate-700';
    }
  }

  protected badgeClass(): string {
    switch (this.material.type) {
      case MaterialType.Pdf:
        return 'border-rose-300 bg-rose-50 text-rose-700';
      case MaterialType.Image:
        return 'border-emerald-300 bg-emerald-50 text-emerald-700';
      case MaterialType.Doc:
        return 'border-sky-300 bg-sky-50 text-sky-700';
      case MaterialType.Link:
        return 'border-amber-300 bg-amber-50 text-amber-700';
      default:
        return 'border-slate-300 bg-slate-50 text-slate-700';
    }
  }

  onDelete(): void {
    this.delete.emit(this.material);
  }
}
