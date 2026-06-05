import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BulkImportStatus } from '@core/enums';

/**
 * Tiny chip that summarizes the lifecycle of a bulk-import job.
 * Mirrors the {@code badge-*} palette used elsewhere in the app.
 */
@Component({
  selector: 'app-bulk-import-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="badgeClass()">{{ label() }}</span>
  `
})
export class BulkImportStatusBadgeComponent {
  readonly status = input.required<BulkImportStatus>();

  readonly label = computed(
    () => BulkImportStatusBadgeComponent.LABELS[this.status()] ?? this.status()
  );
  readonly badgeClass = computed(
    () => `badge ${BulkImportStatusBadgeComponent.TIER[this.status()] ?? 'badge-neutral'}`
  );

  private static readonly LABELS: Readonly<Record<BulkImportStatus, string>> = {
    [BulkImportStatus.Pending]:    'En cola',
    [BulkImportStatus.Processing]: 'Procesando',
    [BulkImportStatus.Completed]:  'Completado',
    [BulkImportStatus.Failed]:     'Falló'
  };

  private static readonly TIER: Readonly<Record<BulkImportStatus, string>> = {
    [BulkImportStatus.Pending]:    'badge-info',
    [BulkImportStatus.Processing]: 'badge-info',
    [BulkImportStatus.Completed]:  'badge-success',
    [BulkImportStatus.Failed]:     'badge-danger'
  };
}
