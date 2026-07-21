import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { environment } from '@env/environment';

/**
 * Placeholder component used by the LoginComponent template. It owns no
 * Angular dependencies on the angularx-social-login SDK, so when
 * `environment.google.enabled` is false the Angular compiler can
 * tree-shake the whole Google path away from the production bundle.
 *
 * To actually render a Google Sign-In button, the consumer is expected
 * to swap this component for `GoogleSigninButtonComponent` via a lazy
 * load (e.g. a feature-flag-gated route or @defer block). For now we
 * keep it intentionally empty: production builds do not include the
 * social-login SDK, and dev builds where google.enabled is true render
 * a placeholder until the lazy load is implemented.
 */
@Component({
  selector: 'app-google-signin-wrapper',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
})
export class GoogleSigninWrapperComponent {
  @Input() busy = false;
  @Input() label = 'Continuar con Google';
  @Input() loadingLabel = 'Conectando con Google…';
  @Output() signinClick = new EventEmitter<void>();

  protected readonly enabled = environment.google.enabled;
}
