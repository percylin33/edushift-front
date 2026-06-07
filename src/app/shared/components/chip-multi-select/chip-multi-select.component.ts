import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  signal
} from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR
} from '@angular/forms';
import { IconComponent } from '../icon/icon.component';

/**
 * Opción consumible por {@link ChipMultiSelectComponent}.
 *
 * <p>{@code id} es la única clave que se persiste en el value del
 * control; {@code label} (y opcionalmente {@code subtitle}) sirven para
 * renderizar el chip y la lista. {@code disabled} es un hint visual y
 * de teclado: la opción se sigue mostrando pero no se puede
 * seleccionar.</p>
 */
export interface ChipOption {
  id: string;
  label: string;
  subtitle?: string;
  disabled?: boolean;
}

/**
 * Multi-select de chips con dropdown filtrable. Componente
 * <em>standalone</em> y reusable a través del workspace; primer caller
 * = <code>course-form-modal</code> (FE-4.4) para asociar levels a un
 * curso.
 *
 * <h3>Comportamiento</h3>
 * <ul>
 *   <li>Implementa {@link ControlValueAccessor} para integrarse con
 *       Reactive Forms (<code>formControlName</code>) o NgModel.</li>
 *   <li>El value es un <code>string[]</code> con los <code>id</code>
 *       seleccionados — orden estable según el orden del input
 *       <code>options</code>.</li>
 *   <li>El dropdown soporta búsqueda por <code>label</code> /
 *       <code>subtitle</code> y navegación con teclado:
 *       <kbd>↓</kbd>/<kbd>↑</kbd> para mover el highlight,
 *       <kbd>Enter</kbd>/<kbd>Space</kbd> para toggle, <kbd>Esc</kbd>
 *       para cerrar, <kbd>Backspace</kbd> en input vacío para quitar
 *       el último chip.</li>
 *   <li>Click fuera del componente cierra el panel.</li>
 * </ul>
 *
 * <h3>Accesibilidad</h3>
 * <ul>
 *   <li>{@code role="combobox"} sobre el wrapper, {@code role="listbox"}
 *       en el panel, {@code role="option"} en cada item.</li>
 *   <li>{@code aria-multiselectable="true"} y
 *       {@code aria-activedescendant} para anunciar el highlight.</li>
 *   <li>Cada chip seleccionado tiene un botón "remove" con
 *       {@code aria-label} explícito.</li>
 * </ul>
 */
@Component({
  selector: 'app-chip-multi-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IconComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ChipMultiSelectComponent),
      multi: true
    }
  ],
  template: `
    <div
      class="chip-mselect"
      role="combobox"
      [attr.aria-expanded]="open()"
      aria-haspopup="listbox"
      [attr.aria-disabled]="disabled() ? 'true' : null"
    >
      <div
        class="chip-mselect__input flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1.5 cursor-text focus-within:ring-2 focus-within:ring-primary-500/40 focus-within:border-primary-500"
        [class.opacity-60]="disabled()"
        [class.pointer-events-none]="disabled()"
        (click)="focusInput()"
      >
        @for (chip of selectedOptions(); track chip.id) {
          <span
            class="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700 ring-1 ring-inset ring-primary-200"
          >
            <span>{{ chip.label }}</span>
            <button
              type="button"
              class="rounded-full p-0.5 text-primary-500 hover:bg-primary-100 hover:text-primary-700"
              [attr.aria-label]="'Quitar ' + chip.label"
              (click)="removeChip(chip.id, $event)"
            >
              <app-icon name="x" [size]="12" />
            </button>
          </span>
        }
        <input
          #searchInput
          type="text"
          class="flex-1 min-w-[6rem] border-0 bg-transparent p-0 text-sm placeholder:text-content-subtle focus:outline-none focus:ring-0"
          [placeholder]="placeholderText()"
          [ngModel]="query()"
          (ngModelChange)="onQueryChange($event)"
          (focus)="open.set(true)"
          (keydown)="onKeydown($event)"
          [disabled]="disabled()"
        />
      </div>

      @if (open() && !disabled()) {
        <div
          role="listbox"
          aria-multiselectable="true"
          [attr.aria-activedescendant]="activeItemId()"
          class="chip-mselect__panel mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-surface-elevated shadow-lg"
        >
          @if (filteredOptions().length === 0) {
            <p class="px-3 py-2 text-xs italic text-content-muted">
              {{ emptyMessage() }}
            </p>
          } @else {
            <ul class="py-1">
              @for (opt of filteredOptions(); track opt.id; let i = $index) {
                <li
                  role="option"
                  [id]="optionDomId(opt.id)"
                  [attr.aria-selected]="isSelected(opt.id)"
                  [attr.aria-disabled]="opt.disabled ? 'true' : null"
                  [class.bg-primary-50]="i === highlightIndex()"
                  [class.opacity-50]="opt.disabled"
                  [class.cursor-not-allowed]="opt.disabled"
                  class="flex items-center justify-between gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-surface-subtle"
                  (mousedown)="$event.preventDefault()"
                  (click)="toggle(opt, $event)"
                  (mouseenter)="highlightIndex.set(i)"
                >
                  <div class="min-w-0">
                    <p class="font-medium text-content truncate">{{ opt.label }}</p>
                    @if (opt.subtitle) {
                      <p class="text-xs text-content-muted truncate">{{ opt.subtitle }}</p>
                    }
                  </div>
                  @if (isSelected(opt.id)) {
                    <app-icon name="check" [size]="16" class="text-primary-600" />
                  }
                </li>
              }
            </ul>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .chip-mselect {
        position: relative;
        display: block;
      }
      .chip-mselect__panel {
        position: absolute;
        z-index: 30;
        left: 0;
        right: 0;
      }
    `
  ]
})
export class ChipMultiSelectComponent implements ControlValueAccessor {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly options = input.required<ChipOption[]>();
  readonly placeholder = input<string>('Selecciona…');
  readonly emptyText = input<string>('Sin coincidencias');

  @ViewChild('searchInput') private readonly searchInput?: ElementRef<HTMLInputElement>;

  /** Internal state. */
  protected readonly value = signal<string[]>([]);
  protected readonly disabled = signal(false);
  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly highlightIndex = signal(0);

  /** ControlValueAccessor callbacks. */
  private onChange: (v: string[]) => void = () => {};
  private onTouched: () => void = () => {};

  protected readonly selectedOptions = computed<ChipOption[]>(() => {
    const opts = this.options();
    const ids = new Set(this.value());
    /* Mantenemos el orden de `options` (estable y predecible) en
     * lugar del orden de selección — es lo que el spec espera para
     * los chips de levels (orden por ordinal asc del nivel). */
    return opts.filter((o) => ids.has(o.id));
  });

  protected readonly filteredOptions = computed<ChipOption[]>(() => {
    const opts = this.options();
    const q = this.query().trim().toLowerCase();
    if (!q) return opts;
    return opts.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.subtitle?.toLowerCase().includes(q) ?? false)
    );
  });

  protected readonly placeholderText = computed(() =>
    this.selectedOptions().length === 0 ? this.placeholder() : ''
  );

  protected readonly emptyMessage = computed(() => {
    if (this.options().length === 0) return 'No hay opciones disponibles';
    return this.emptyText();
  });

  protected readonly activeItemId = computed<string | null>(() => {
    const opts = this.filteredOptions();
    const idx = this.highlightIndex();
    if (opts.length === 0 || idx < 0 || idx >= opts.length) return null;
    return this.optionDomId(opts[idx].id);
  });

  constructor() {
    /* Cuando la lista filtrada cambia, reseteamos el highlight para
     * que no quede apuntando a un índice fuera de rango. */
    effect(() => {
      const list = this.filteredOptions();
      if (this.highlightIndex() >= list.length) {
        this.highlightIndex.set(Math.max(0, list.length - 1));
      }
    });
  }

  // ===========================================================================
  // ControlValueAccessor
  // ===========================================================================

  writeValue(value: string[] | null): void {
    this.value.set(Array.isArray(value) ? [...value] : []);
  }

  registerOnChange(fn: (v: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
    if (isDisabled) this.open.set(false);
  }

  // ===========================================================================
  // Interactions
  // ===========================================================================

  protected isSelected(id: string): boolean {
    return this.value().includes(id);
  }

  protected toggle(opt: ChipOption, ev?: Event): void {
    ev?.preventDefault();
    if (opt.disabled) return;
    const next = this.isSelected(opt.id)
      ? this.value().filter((id) => id !== opt.id)
      : [...this.value(), opt.id];
    this.commit(next);
    this.searchInput?.nativeElement.focus();
  }

  protected removeChip(id: string, ev: Event): void {
    ev.stopPropagation();
    if (this.disabled()) return;
    const next = this.value().filter((v) => v !== id);
    this.commit(next);
  }

  protected onQueryChange(value: string): void {
    this.query.set(value);
    this.open.set(true);
    this.highlightIndex.set(0);
  }

  protected focusInput(): void {
    if (this.disabled()) return;
    this.searchInput?.nativeElement.focus();
    this.open.set(true);
  }

  protected onKeydown(ev: KeyboardEvent): void {
    if (this.disabled()) return;

    switch (ev.key) {
      case 'ArrowDown': {
        ev.preventDefault();
        this.open.set(true);
        const len = this.filteredOptions().length;
        if (len === 0) return;
        this.highlightIndex.set((this.highlightIndex() + 1) % len);
        return;
      }
      case 'ArrowUp': {
        ev.preventDefault();
        this.open.set(true);
        const len = this.filteredOptions().length;
        if (len === 0) return;
        this.highlightIndex.set(
          (this.highlightIndex() - 1 + len) % len
        );
        return;
      }
      case 'Enter':
      case ' ': {
        if (!this.open()) {
          this.open.set(true);
          ev.preventDefault();
          return;
        }
        const opts = this.filteredOptions();
        const idx = this.highlightIndex();
        if (idx >= 0 && idx < opts.length) {
          ev.preventDefault();
          this.toggle(opts[idx]);
        }
        return;
      }
      case 'Escape': {
        if (this.open()) {
          ev.preventDefault();
          this.open.set(false);
        }
        return;
      }
      case 'Backspace': {
        /* Si el input está vacío, quitar el último chip seleccionado. */
        if (!this.query() && this.value().length > 0) {
          this.commit(this.value().slice(0, -1));
        }
        return;
      }
    }
  }

  /**
   * Cierra el dropdown si el usuario hace click fuera del componente.
   * Usamos {@code mousedown} en {@code document} para captar también
   * clicks en otros inputs antes de que pierdan foco.
   */
  @HostListener('document:mousedown', ['$event'])
  onDocumentMousedown(ev: MouseEvent): void {
    const target = ev.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      if (this.open()) {
        this.open.set(false);
        this.onTouched();
      }
    }
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  private commit(next: string[]): void {
    this.value.set(next);
    this.onChange(next);
    this.onTouched();
  }

  protected optionDomId(id: string): string {
    return `chip-mselect-opt-${id}`;
  }
}
