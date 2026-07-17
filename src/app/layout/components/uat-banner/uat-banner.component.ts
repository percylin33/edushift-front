import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { environment } from '@env/environment';

@Component({
  selector: 'app-uat-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (environment.uatMode) {
      <div
        class="flex items-center justify-center gap-2 bg-amber-500 px-4 py-1 text-xs font-medium text-white"
        role="status"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" x2="12" y1="9" y2="13" />
          <line x1="12" x2="12.01" y1="17" y2="17" />
        </svg>
        <span>Entorno de pruebas — UAT</span>
      </div>
    }
  `,
})
export class UatBannerComponent {
  protected readonly environment = environment;
}
