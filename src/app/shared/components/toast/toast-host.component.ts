import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService, type AppNotification, type NotificationKind } from '@core/services';
import { IconComponent } from '@shared/components/icon';
import type { IconName } from '@shared/components/icon/icons.registry';

/**
 * Global toast stack bound to {@link NotificationService.messages}.
 * Mount once at the app root so interceptor + feature toasts are visible.
 */
@Component({
  selector: 'app-toast-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div
      class="pointer-events-none fixed right-4 top-4 z-[110] flex w-full max-w-sm flex-col gap-2"
      aria-live="polite"
      aria-relevant="additions"
    >
      @for (n of notifications.messages(); track n.id) {
        <div
          class="pointer-events-auto flex items-start gap-2 rounded-md border p-3 text-sm shadow-lg"
          [class]="toastClass(n.kind)"
          role="status"
        >
          <app-icon [name]="iconFor(n.kind)" [size]="18" class="mt-0.5 shrink-0" />
          <div class="min-w-0 flex-1">
            @if (n.title) {
              <p class="font-medium leading-tight">{{ n.title }}</p>
            }
            <p class="leading-snug" [class.mt-0.5]="!!n.title">{{ n.message }}</p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
            [attr.aria-label]="'Cerrar'"
            (click)="dismiss(n)"
          >
            <app-icon name="x" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  protected readonly notifications = inject(NotificationService);

  protected dismiss(n: AppNotification): void {
    this.notifications.dismiss(n.id);
  }

  protected iconFor(kind: NotificationKind): IconName {
    switch (kind) {
      case 'success':
        return 'check';
      case 'warning':
        return 'alert-triangle';
      case 'error':
        return 'alert-circle';
      case 'info':
        return 'info';
    }
  }

  protected toastClass(kind: NotificationKind): string {
    switch (kind) {
      case 'error':
        return 'border-danger/30 bg-danger/10 text-danger';
      case 'success':
        return 'border-success/30 bg-success/10 text-success';
      case 'warning':
        return 'border-warning/30 bg-warning/10 text-warning';
      case 'info':
        return 'border-border bg-surface text-content';
    }
  }
}
