import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChipMultiSelectComponent, ChipOption } from './chip-multi-select.component';
import { FormsModule } from '@angular/forms';

describe('ChipMultiSelectComponent', () => {
  let component: ChipMultiSelectComponent;
  let fixture: ComponentFixture<ChipMultiSelectComponent>;

  const mockOptions: ChipOption[] = [
    { id: '1', label: 'Opción 1' },
    { id: '2', label: 'Opción 2', subtitle: 'Subtítulo 2' },
    { id: '3', label: 'Opción 3' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChipMultiSelectComponent, FormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(ChipMultiSelectComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('options', mockOptions);
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('inicia con value vacío', () => {
    expect(component['value']()).toEqual([]);
  });

  it('inicia sin disabled', () => {
    expect(component['disabled']()).toBeFalse();
  });

  it('inicia sin query', () => {
    expect(component['query']()).toBe('');
  });

  it('inicia sin open', () => {
    expect(component['open']()).toBeFalse();
  });

  it('selectedOptions filtra por ids seleccionados', () => {
    component['commit'](['1', '3']);
    const selected = component['selectedOptions']();
    expect(selected.length).toBe(2);
    expect(selected[0].id).toBe('1');
    expect(selected[1].id).toBe('3');
  });

  it('filteredOptions filtra por query', () => {
    component['query'].set('Opción 1');
    const filtered = component['filteredOptions']();
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('1');
  });

  it('filteredOptions retorna todos sin query', () => {
    expect(component['filteredOptions']().length).toBe(3);
  });

  it('isSelected retorna true para ids seleccionados', () => {
    component['commit'](['1']);
    expect(component['isSelected']('1')).toBeTrue();
    expect(component['isSelected']('2')).toBeFalse();
  });

  it('writeValue establece el value', () => {
    component.writeValue(['2']);
    expect(component['value']()).toEqual(['2']);
  });

  it('setDisabledState actualiza disabled', () => {
    component.setDisabledState(true);
    expect(component['disabled']()).toBeTrue();
    expect(component['open']()).toBeFalse();
  });

  it('toggle selecciona y deselecciona opciones', () => {
    component.toggle(mockOptions[0]);
    expect(component['value']()).toEqual(['1']);
    component.toggle(mockOptions[0]);
    expect(component['value']()).toEqual([]);
  });

  it('removeChip quita un chip seleccionado', () => {
    component['commit'](['1', '2']);
    const event = new MouseEvent('click');
    component['removeChip']('1', event);
    expect(component['value']()).toEqual(['2']);
  });

  it('onQueryChange establece query y abre el panel', () => {
    component['onQueryChange']('test');
    expect(component['query']()).toBe('test');
    expect(component['open']()).toBeTrue();
  });

  it('placeholderText retorna placeholder cuando no hay selección', () => {
    expect(component['placeholderText']()).toBe('Selecciona…');
  });
});
