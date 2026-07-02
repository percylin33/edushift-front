import {
  Directive,
  EmbeddedViewRef,
  Input,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
} from '@angular/core';
import { AuthService } from '@core/services';
import { Permission } from '@core/enums';

/**
 * Structural directive that conditionally renders its host element when the
 * current user holds **at least one** of the listed {@link Permission}
 * authorities. Hidden elements are removed from the DOM (not just
 * `display:none`) so they are never in the tab order, never reachable by
 * screen readers, and never queryable by tests. This matches the
 * permission-as-perimeter mental model the rest of the app uses.
 *
 * <h3>Usage</h3>
 * <pre>
 *   &lt;button *appHasPermission="Permission.LmsTaskGrade"&gt;Calificar&lt;/button&gt;
 *   &lt;a *appHasPermission="[Permission.LmsTaskCreate, Permission.LmsTaskGrade]"
 *      routerLink="/lms/tasks/new"&gt;Crear tarea&lt;/a&gt;
 *   &lt;button *appHasPermission="[P, Q]; mode: 'all'"&gt;Ver rúbrica&lt;/button&gt;
 * </pre>
 *
 * <h3>Why the `app` prefix</h3>
 * Angular's micro-syntax `*foo="x; bar: y"` de-sugars into a property
 * binding named `fooBar` on the {@code <ng-template>} wrapper. Naming
 * the selector {@code [appHasPermission]} keeps the wire-instruction
 * in user code terse while making the binding names Angular generates
 * unambiguous ({@code [appHasPermissionMode]}).
 *
 * <h3>Why standalone</h3>
 * The rest of the LMS feature work (FE-7a.1..3) ships standalone components,
 * and Angular 17 deprecated module-declared directives. Keeping this
 * directive standalone also means each feature can import it directly
 * without dragging a `SharedModule` into its import graph.
 *
 * <h3>Why a structural directive (vs attribute)</h3>
 * A structural directive is the only correct tool when the failure mode is
 * "this button must not exist for STUDENT". An attribute directive that
 * toggles `display:none` would leave the button in the DOM, in the tab
 * order, and reachable by automated tests. See the a11y note in
 * sprint-07a-lms-foundations.md §FE-7a.4.
 *
 * <h3>Reactivity</h3>
 * The directive registers an `effect` that re-evaluates whenever
 * {@link AuthService.user} or {@link AuthService.permissions} changes
 * (login, logout, role bump, or a 401-triggered silent refresh that
 * enriches the user). When the predicate flips, the view is either
 * created or torn down; no manual change-detection is needed thanks to
 * signals.
 */
@Directive({
  selector: '[appHasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  private readonly template = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly auth = inject(AuthService);

  /** Required permissions — accepts a single `Permission` or an array (ANY_OF semantics). */
  @Input({ required: true })
  set appHasPermission(value: Permission | Permission[] | null | undefined) {
    this.#required = Array.isArray(value) ? value : value ? [value] : [];
  }

  /**
   * Optional mode flip: render only if the user has **all** of the listed
   * permissions (conjunction). Accepts either {@code 'any'} (default) or
   * {@code 'all'}.
   *
   * <p>Bound from the micro-syntax via {@code *appHasPermission="...; mode: 'all'"};
   * Angular's de-sugaring turns {@code mode: 'all'} into a property
   * binding named {@code appHasPermissionMode} on the host element
   * (selector name + binding key), so the {@code @Input} alias has to
   * match that generated name verbatim. The setter is named {@code mode}
   * (no prefix) to keep the binding key short.
   */
  @Input('appHasPermissionMode')
  set mode(value: 'any' | 'all') {
    this.#mode = value;
  }

  #required: Permission[] = [];
  #mode: 'any' | 'all' = 'any';
  #viewRef: EmbeddedViewRef<unknown> | null = null;

  constructor() {
    effect(() => {
      /* Reading the signals here wires the effect to the auth state. */
      const owned = this.auth.permissions();
      this.evaluate(owned);
    });
  }

  private evaluate(owned: Permission[]): void {
    const grant =
      this.#required.length === 0
        ? true
        : this.#mode === 'all'
          ? this.#required.every((p) => owned.includes(p))
          : this.#required.some((p) => owned.includes(p));

    if (grant && !this.#viewRef) {
      this.#viewRef = this.viewContainer.createEmbeddedView(this.template);
    } else if (!grant && this.#viewRef) {
      this.viewContainer.clear();
      this.#viewRef = null;
    }
  }
}
