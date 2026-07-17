import { ApplicationRef, Injectable, Injector, createComponent, inject } from '@angular/core';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { ConfirmDialogConfig } from './confirm-dialog.model';

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(Injector);

  open(config: ConfirmDialogConfig): Promise<boolean> {
    const host = document.body.appendChild(document.createElement('div'));
    const componentRef = createComponent(ConfirmDialogComponent, {
      environmentInjector: this.appRef.injector,
      elementInjector: this.injector,
      hostElement: host,
    });

    this.appRef.attachView(componentRef.hostView);
    componentRef.instance.config.set(config);

    return new Promise<boolean>((resolve) => {
      componentRef.instance.setResolver((result: boolean) => {
        resolve(result);
        this.destroy(componentRef, host);
      });
    });
  }

  private destroy(
    componentRef: ReturnType<typeof createComponent<ConfirmDialogComponent>>,
    host: HTMLDivElement,
  ): void {
    this.appRef.detachView(componentRef.hostView);
    componentRef.destroy();
    host.remove();
  }
}
