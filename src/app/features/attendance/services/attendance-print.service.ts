import { Injectable, ApplicationRef, ComponentRef, createComponent, EnvironmentInjector, inject } from '@angular/core';
import { AttendancePrintPayload } from '../models/attendance-report-params.model';
import { AttendancePrintViewComponent } from '../components/attendance-print-view/attendance-print-view.component';

/**
 * Opens a print-only overlay and triggers the browser print dialog.
 */
@Injectable({ providedIn: 'root' })
export class AttendancePrintService {
  private readonly appRef = inject(ApplicationRef);
  private readonly envInjector = inject(EnvironmentInjector);

  print(payload: AttendancePrintPayload): void {
    const host = document.createElement('div');
    host.className = 'attendance-print-host';
    document.body.appendChild(host);

    const ref: ComponentRef<AttendancePrintViewComponent> = createComponent(
      AttendancePrintViewComponent,
      { environmentInjector: this.envInjector, hostElement: host },
    );
    ref.setInput('payload', payload);
    this.appRef.attachView(ref.hostView);
    ref.changeDetectorRef.detectChanges();

    const cleanup = (): void => {
      this.appRef.detachView(ref.hostView);
      ref.destroy();
      host.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    requestAnimationFrame(() => window.print());
  }
}
