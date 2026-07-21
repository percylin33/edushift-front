import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Stub of GoogleSigninButtonComponent. The real component lives in the
 * `angularx-social-login` SDK and registers SocialAuthServiceConfig as a
 * provider at module load. That provider has to exist whenever the
 * template references `app-google-signin-button` — there is no way to
 * gate it behind environment.google.enabled without making this a
 * different selector.
 *
 * To keep the build green and the production bundle free of the Google
 * provider, the LoginComponent no longer renders `<app-google-signin-button>`
 * directly; it delegates to a lazy wrapper loaded via @defer when the
 * feature is enabled. This stub remains as a placeholder so the file
 * keeps its selector symbol for IDE tooling.
 */
@Component({
  selector: 'app-google-signin-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
})
export class GoogleSigninButtonComponent {
  @Input() busy = false;
  @Input() label = '';
  @Input() loadingLabel = '';
  @Output() signinClick = new EventEmitter<void>();
}
