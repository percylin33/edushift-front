import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { IconComponent } from '@shared/components/icon';
import { ConfirmDialogConfig } from './confirm-dialog.model';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      (click)="onBackdropClick($event)"
    >
      <div
        class="card flex max-h-[90vh] w-full max-w-sm flex-col shadow-xl"
        (click)="$event.stopPropagation()"
      >
        <header class="card-header">
          <div class="flex items-center gap-3">
            @if (config().icon; as iconName) {
              <div
                class="flex h-10 w-10 items-center justify-center rounded-full"
                [class.bg-danger-50]="config().variant === 'danger'"
                [class.bg-warning-50]="config().variant === 'warning'"
                [class.bg-surface-muted]="!config().variant || config().variant === 'default'"
              >
                <app-icon
                  [name]="iconName"
                  [size]="20"
                  [class.text-danger-600]="config().variant === 'danger'"
                  [class.text-warning-600]="config().variant === 'warning'"
                  [class.text-content]="!config().variant || config().variant === 'default'"
                />
              </div>
            }
            <h2 id="confirm-title" class="card-title">{{ config().title }}</h2>
          </div>
        </header>

        <div class="card-body">
          <p class="text-sm text-content-muted">{{ config().message }}</p>
        </div>

        <footer class="card-footer flex justify-end gap-2">
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            (click)="cancel()"
          >
            {{ config().cancelLabel || 'Cancelar' }}
          </button>
          <button
            type="button"
            class="btn btn-sm"
            [class.btn-danger]="config().variant === 'danger'"
            [class.btn-primary]="config().variant !== 'danger'"
            (click)="confirm()"
          >
            {{ config().confirmLabel || 'Confirmar' }}
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class ConfirmDialogComponent {
  readonly config = signal<ConfirmDialogConfig>({
    title: '',
    message: '',
  });

  private _resolve: ((value: boolean) => void) | null = null;

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.cancel();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cancel();
  }

  protected confirm(): void {
    this._resolve?.(true);
    this._resolve = null;
  }

  protected cancel(): void {
    this._resolve?.(false);
    this._resolve = null;
  }

  setResolver(resolve: (value: boolean) => void): void {
    this._resolve = resolve;
  }
}
