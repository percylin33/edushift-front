import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastHostComponent } from '@shared/components/toast/toast-host.component';
import { PwaInstallService } from '@core/services/pwa-install.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastHostComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <app-toast-host />
  `,
})
export class AppComponent {
  // Attach the install-prompt listener at application startup, before lazy
  // route components (such as /install) have finished loading.
  readonly installService = inject(PwaInstallService);

  @HostListener('wheel', ['$event'])
  preventNumberInputScroll(event: WheelEvent): void {
    const target = event.target as HTMLInputElement | null;
    if (target?.tagName === 'INPUT' && target.type === 'number') {
      target.blur();
    }
  }
}
