import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SpecializationInputComponent } from './specialization-input.component';

describe('SpecializationInputComponent', () => {
  let fixture: ComponentFixture<SpecializationInputComponent>;
  let component: SpecializationInputComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpecializationInputComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(SpecializationInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('writeValue setea chips', () => {
    (component as any).writeValue(['Matemática', 'Inglés']);
    expect((component as any).selected()).toEqual(['Matemática', 'Inglés']);
  });

  it('writeValue ignora no-strings', () => {
    (component as any).writeValue(['A', null as any, 1 as any, 'B']);
    expect((component as any).selected()).toEqual(['A', 'B']);
  });

  it('writeValue con null/undefined queda vacío', () => {
    (component as any).writeValue(null);
    expect((component as any).selected()).toEqual([]);
    (component as any).writeValue(undefined);
    expect((component as any).selected()).toEqual([]);
  });

  it('registerOnChange guarda callback', () => {
    const cb = jasmine.createSpy('cb');
    (component as any).registerOnChange(cb);
    expect((component as any).onChange).toBe(cb);
  });

  it('registerOnTouched guarda callback', () => {
    const cb = jasmine.createSpy('cb');
    (component as any).registerOnTouched(cb);
    expect((component as any).onTouched).toBe(cb);
  });

  it('setDisabledState actualiza disabled', () => {
    (component as any).setDisabledState(true);
    expect((component as any).disabled()).toBeTrue();
    (component as any).setDisabledState(false);
    expect((component as any).disabled()).toBeFalse();
  });

  it('addChip normaliza espacios', () => {
    (component as any).addChip('  Matem ática   ');
    expect((component as any).selected()).toContain('Matem ática');
  });

  it('addChip dedup case-insensitive', () => {
    (component as any).addChip('Matemática');
    (component as any).addChip('matemática');
    expect((component as any).selected()).toEqual(['Matemática']);
  });

  it('addChip rechaza strings >100 chars', () => {
    (component as any).addChip('x'.repeat(101));
    expect((component as any).selected()).toEqual([]);
  });

  it('addChip ignora vacío', () => {
    (component as any).addChip('   ');
    expect((component as any).selected()).toEqual([]);
  });

  it('addChip emite onChange', () => {
    const cb = jasmine.createSpy('cb');
    (component as any).registerOnChange(cb);
    (component as any).addChip('Física');
    expect(cb).toHaveBeenCalled();
  });

  it('removeChip quita y emite', () => {
    const cb = jasmine.createSpy('cb');
    (component as any).registerOnChange(cb);
    (component as any).addChip('A');
    (component as any).addChip('B');
    (component as any).removeChip('A');
    expect((component as any).selected()).toEqual(['B']);
    expect(cb).toHaveBeenCalled();
  });

  it('filteredOptions omite ya seleccionadas y filtra por query', () => {
    (component as any).writeValue(['Matemática']);
    (component as any).query.set('ing');
    const opts = (component as any).filteredOptions();
    expect(opts.some((o: string) => o === 'Matemática')).toBeFalse();
    expect(opts).toContain('Inglés');
  });

  it('filteredOptions vacío sin matches', () => {
    (component as any).query.set('xyzzz');
    expect((component as any).filteredOptions()).toEqual([]);
  });

  it('onQueryChange setea query y abre dropdown', () => {
    (component as any).onQueryChange('ing');
    expect((component as any).query()).toBe('ing');
    expect((component as any).open()).toBeTrue();
  });

  it('onFocus abre dropdown', () => {
    (component as any).open.set(false);
    (component as any).onFocus();
    expect((component as any).open()).toBeTrue();
  });
});
