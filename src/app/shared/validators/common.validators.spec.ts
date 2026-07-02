import { FormControl, FormGroup } from '@angular/forms';
import { matchControl, requiredTrimmed } from './common.validators';

describe('matchControl', () => {
  it('retorna null cuando los valores coinciden', () => {
    const group = new FormGroup({
      password: new FormControl('123456'),
      confirm: new FormControl('123456'),
    });
    const validator = matchControl('password');
    const result = validator(group.get('confirm')!);
    expect(result).toBeNull();
  });

  it('retorna error match cuando los valores no coinciden', () => {
    const group = new FormGroup({
      password: new FormControl('123456'),
      confirm: new FormControl('654321'),
    });
    const validator = matchControl('password');
    const result = validator(group.get('confirm')!);
    expect(result).toEqual({ match: true });
  });

  it('retorna null si no hay parent form group', () => {
    const control = new FormControl('test');
    const validator = matchControl('other');
    const result = validator(control);
    expect(result).toBeNull();
  });
});

describe('requiredTrimmed', () => {
  it('retorna null para string con contenido', () => {
    const control = new FormControl('  hello  ');
    const result = requiredTrimmed(control);
    expect(result).toBeNull();
  });

  it('retorna error required para string vacío', () => {
    const control = new FormControl('');
    const result = requiredTrimmed(control);
    expect(result).toEqual({ required: true });
  });

  it('retorna error required para solo espacios', () => {
    const control = new FormControl('   ');
    const result = requiredTrimmed(control);
    expect(result).toEqual({ required: true });
  });

  it('retorna error required para null', () => {
    const control = new FormControl(null);
    const result = requiredTrimmed(control);
    expect(result).toEqual({ required: true });
  });
});
