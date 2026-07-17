import { ApplicationRef, Injectable, Injector, createComponent, inject } from '@angular/core';
import { PromptDialogComponent } from './prompt-dialog.component';
import { PromptDialogConfig } from './prompt-dialog.model';

@Injectable({ providedIn: 'root' })
export class PromptDialogService {
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(Injector);

  open(config: PromptDialogConfig): Promise<string | null> {
    const host = document.body.appendChild(document.createElement('div'));
    const componentRef = createComponent(PromptDialogComponent, {
      environmentInjector: this.appRef.injector,
      elementInjector: this.injector,
      hostElement: host,
    });

    this.appRef.attachView(componentRef.hostView);
    componentRef.instance.config.set(config);

    return new Promise<string | null>((resolve) => {
      componentRef.instance.setResolver((result: string | null) => {
        resolve(result);
        this.destroy(componentRef, host);
      });
    });
  }

  private destroy(
    componentRef: ReturnType<typeof createComponent<PromptDialogComponent>>,
    host: HTMLDivElement,
  ): void {
    this.appRef.detachView(componentRef.hostView);
    componentRef.destroy();
    host.remove();
  }
}
