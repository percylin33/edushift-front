import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Validator: the control's value must equal the value of `otherControlName`. */
export function matchControl(otherControlName: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const parent = control.parent;
    if (!parent) return null;
    const other = parent.get(otherControlName);
    if (!other) return null;
    return other.value === control.value ? null : { match: true };
  };
}

/** Validator: trims the value and requires a non-empty string. */
export function requiredTrimmed(control: AbstractControl): ValidationErrors | null {
  const value = (control.value ?? '').toString().trim();
  return value.length > 0 ? null : { required: true };
}
