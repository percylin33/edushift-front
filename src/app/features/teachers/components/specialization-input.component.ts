import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  forwardRef,
  signal
} from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR
} from '@angular/forms';
import { IconComponent } from '@shared/components';
import { SPECIALIZATION_CATALOG } from '../models';

/**
 * Chip-input para el array de {@code specializations} del docente.
 * Implementa {@link ControlValueAccessor} para integrarse con
 * Reactive Forms (el caller wirea con {@code formControlName}).
 *
 * <h3>Comportamiento</h3>
 * <ul>
 *   <li>Las opciones del catálogo seed
 *       ({@link SPECIALIZATION_CATALOG}) se sugieren en un dropdown
 *       filtrable mientras el admin tipea.</li>
 *   <li>Enter / Tab confirma la entrada vigente como chip nuevo.
 *       Si la entrada coincide con una opción del catálogo, se
 *       agrega tal cual; si es libre, se acepta sin más (el back es
 *       free-form).</li>
 *   <li>Backspace con el input vacío elimina el último chip.</li>
 *   <li>Click en una opción del dropdown la agrega y limpia la
 *       query.</li>
 *   <li>Click en la X de un chip lo remueve.</li>
 * </ul>
 *
 * <h3>Decisión técnica</h3>
 * El componente normaliza espacios y deduplica case-insensitive (para
 * que "Matemática" y "matemática" no coexistan), pero preserva el
 * casing original que tipeó el admin. La validación de longitud
 * (1..100) por chip es responsabilidad del caller — el backend
 * responde 400 si el chip es muy largo.
 */
@Component({
  selector: 'app-specialization-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IconComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SpecializationInputComponent),
      multi: true
    }
  ],
  template: `
    <div
      class="spec-input"
      [class.spec-input--disabled]="disabled()"
      (click)="focusInput()"
    >
      @for (chip of selected(); track chip) {
        <span class="spec-chip">
          <span class="spec-chip__label">{{ chip }}</span>
          @if (!disabled()) {
            <button
              type="button"
              class="spec-chip__remove"
              [attr.aria-label]="'Quitar ' + chip"
              (click)="removeChip(chip); $event.stopPropagation()"
            >
              <app-icon name="x" [size]="12" />
            </button>
          }
        </span>
      }

      <input
        #input
        type="text"
        class="spec-input__field"
        [disabled]="disabled()"
        [placeholder]="selected().length === 0 ? placeholder : ''"
        [ngModel]="query()"
        (ngModelChange)="onQueryChange($event)"
        (keydown)="onKeydown($event)"
        (focus)="onFocus()"
        (blur)="onBlur()"
        autocomplete="off"
        aria-autocomplete="list"
        [attr.aria-expanded]="open()"
      />
    </div>

    @if (open() && filteredOptions().length > 0 && !disabled()) {
      <ul role="listbox" class="spec-listbox">
        @for (opt of filteredOptions(); track opt) {
          <li
            role="option"
            class="spec-listbox__item"
            [class.spec-listbox__item--active]="opt === activeOption()"
            (mousedown)="addOption(opt); $event.preventDefault()"
          >
            {{ opt }}
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        position: relative;
      }
      .spec-input {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        padding: 0.4rem 0.5rem;
        border: 1px solid rgb(var(--color-border-rgb, 209 213 219));
        border-radius: 0.375rem;
        background: rgb(var(--color-surface-rgb, 255 255 255));
        cursor: text;
        min-height: 2.5rem;
      }
      .spec-input:focus-within {
        border-color: rgb(var(--color-primary-500-rgb, 59 130 246));
        box-shadow: 0 0 0 3px rgba(59 130 246 / 0.1);
      }
      .spec-input--disabled {
        background: rgb(var(--color-surface-muted-rgb, 243 244 246));
        cursor: not-allowed;
      }
      .spec-chip {
        display: inline-flex;
        align-items: center;
        background: rgb(var(--color-primary-50-rgb, 239 246 255));
        color: rgb(var(--color-primary-700-rgb, 29 78 216));
        border-radius: 9999px;
        padding: 0.15rem 0.6rem;
        font-size: 0.75rem;
        font-weight: 500;
        gap: 0.35rem;
      }
      .spec-chip__remove {
        background: transparent;
        border: 0;
        color: inherit;
        cursor: pointer;
        opacity: 0.7;
        display: inline-flex;
        align-items: center;
      }
      .spec-chip__remove:hover { opacity: 1; }
      .spec-input__field {
        flex: 1;
        min-width: 6rem;
        border: 0;
        outline: 0;
        background: transparent;
        font-size: 0.875rem;
        color: rgb(var(--color-content-rgb, 17 24 39));
      }
      .spec-listbox {
        position: absolute;
        z-index: 50;
        left: 0;
        right: 0;
        margin-top: 0.25rem;
        max-height: 14rem;
        overflow-y: auto;
        background: rgb(var(--color-surface-rgb, 255 255 255));
        border: 1px solid rgb(var(--color-border-rgb, 209 213 219));
        border-radius: 0.375rem;
        box-shadow: 0 8px 16px rgba(0 0 0 / 0.08);
        list-style: none;
        padding: 0.25rem;
      }
      .spec-listbox__item {
        padding: 0.4rem 0.6rem;
        font-size: 0.85rem;
        border-radius: 0.25rem;
        cursor: pointer;
        color: rgb(var(--color-content-rgb, 17 24 39));
      }
      .spec-listbox__item:hover,
      .spec-listbox__item--active {
        background: rgb(var(--color-primary-50-rgb, 239 246 255));
        color: rgb(var(--color-primary-700-rgb, 29 78 216));
      }
    `
  ]
})
export class SpecializationInputComponent implements ControlValueAccessor {
  protected readonly placeholder = 'Matemática, Comunicación…';

  protected readonly selected = signal<string[]>([]);
  protected readonly query = signal<string>('');
  protected readonly open = signal<boolean>(false);
  protected readonly disabled = signal<boolean>(false);
  protected readonly activeOption = signal<string | null>(null);

  @ViewChild('input', { static: true })
  private inputRef!: ElementRef<HTMLInputElement>;

  /* ControlValueAccessor wiring. */
  private onChange: (value: string[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  /**
   * Lista filtrada del catálogo: omite las ya seleccionadas (no
   * sentido sugerir un chip que ya está) y filtra por substring
   * case-insensitive sobre la query vigente.
   */
  protected readonly filteredOptions = computed<string[]>(() => {
    const q = this.query().trim().toLowerCase();
    const taken = new Set(this.selected().map((s) => s.toLowerCase()));
    return SPECIALIZATION_CATALOG.filter((opt) => {
      if (taken.has(opt.toLowerCase())) return false;
      if (!q) return true;
      return opt.toLowerCase().includes(q);
    });
  });

  // ---------------------------------------------------------------------------
  // ControlValueAccessor
  // ---------------------------------------------------------------------------

  writeValue(value: string[] | null | undefined): void {
    this.selected.set((value ?? []).filter((s) => typeof s === 'string'));
  }

  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  // ---------------------------------------------------------------------------
  // Interaction
  // ---------------------------------------------------------------------------

  protected focusInput(): void {
    if (this.disabled()) return;
    this.inputRef.nativeElement.focus();
  }

  protected onQueryChange(value: string): void {
    this.query.set(value);
    this.open.set(true);
    this.activeOption.set(this.filteredOptions()[0] ?? null);
  }

  protected onFocus(): void {
    this.open.set(true);
  }

  protected onBlur(): void {
    /* Delay para que el {@code mousedown} del listbox tenga tiempo
     * de ejecutar antes de cerrar (sin esto, click en una opción
     * cancela porque el blur cierra el listbox antes). */
    setTimeout(() => {
      this.open.set(false);
      this.onTouched();
    }, 120);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const sel = this.selected();
    const q = this.query();

    if (event.key === 'Enter' || event.key === 'Tab') {
      const candidate = (this.activeOption() ?? q).trim();
      if (candidate.length > 0) {
        event.preventDefault();
        this.addChip(candidate);
      }
      return;
    }

    if (event.key === 'Backspace' && q.length === 0 && sel.length > 0) {
      event.preventDefault();
      this.removeChip(sel[sel.length - 1]);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.moveActive(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveActive(-1);
      return;
    }
    if (event.key === 'Escape') {
      this.open.set(false);
      return;
    }
  }

  protected addOption(opt: string): void {
    this.addChip(opt);
  }

  protected addChip(rawValue: string): void {
    const value = rawValue.trim().replace(/\s+/g, ' ');
    if (value.length === 0) return;
    if (value.length > 100) return; // espejo del @Size(max=100) del back

    const exists = this.selected().some(
      (s) => s.toLowerCase() === value.toLowerCase()
    );
    if (exists) {
      this.query.set('');
      this.activeOption.set(null);
      return;
    }
    const next = [...this.selected(), value];
    this.selected.set(next);
    this.onChange(next);
    this.query.set('');
    this.activeOption.set(null);
  }

  protected removeChip(chip: string): void {
    const next = this.selected().filter((s) => s !== chip);
    this.selected.set(next);
    this.onChange(next);
    this.focusInput();
  }

  private moveActive(delta: number): void {
    const opts = this.filteredOptions();
    if (opts.length === 0) {
      this.activeOption.set(null);
      return;
    }
    const current = this.activeOption();
    const idx = current ? opts.indexOf(current) : -1;
    const next = (idx + delta + opts.length) % opts.length;
    this.activeOption.set(opts[next]);
  }
}
