import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@shared/components';
import { ReportFormat } from '@features/reports/models/report.model';
import { ATTENDANCE_EXPORT_FORMATS } from '../../models/attendance-report-params.model';

@Component({
  selector: 'app-attendance-export-actions',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="btn btn-outline btn-sm" [disabled]="disabled() || busy()" (click)="printClick.emit()">
        <app-icon name="printer" [size]="16" />
        <span>Imprimir</span>
      </button>
      <div class="relative inline-flex">
        <button
          type="button"
          class="btn btn-primary btn-sm"
          [disabled]="disabled() || busy()"
          (click)="toggleMenu()"
        >
          <app-icon name="download" [size]="16" />
          <span>{{ busy() ? 'Generando…' : 'Descargar' }}</span>
        </button>
        @if (menuOpen()) {
          <div
            class="absolute right-0 top-full z-20 mt-1 min-w-[8rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            @for (f of formats; track f) {
              <button
                type="button"
                class="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                (click)="onDownload(f)"
              >
                {{ f }}
              </button>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class AttendanceExportActionsComponent {
  readonly disabled = input(false);
  readonly busy = input(false);
  readonly printClick = output<void>();
  readonly downloadClick = output<ReportFormat>();

  readonly formats = ATTENDANCE_EXPORT_FORMATS;
  readonly menuOpen = signal(false);

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  onDownload(format: ReportFormat): void {
    this.menuOpen.set(false);
    this.downloadClick.emit(format);
  }
}
