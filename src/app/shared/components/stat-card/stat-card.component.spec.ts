import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatCardComponent } from './stat-card.component';

describe('StatCardComponent', () => {
  let component: StatCardComponent;
  let fixture: ComponentFixture<StatCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('label', 'Alumnos');
    fixture.componentRef.setInput('value', '1,284');
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('label es el input proporcionado', () => {
    expect(component.label()).toBe('Alumnos');
  });

  it('value es el input proporcionado', () => {
    expect(component.value()).toBe('1,284');
  });

  it('icon es null por defecto', () => {
    expect(component.icon()).toBeNull();
  });

  it('delta es null por defecto', () => {
    expect(component.delta()).toBeNull();
  });

  it('trend es flat por defecto', () => {
    expect(component.trend()).toBe('flat');
  });

  it('deltaClass es text-success para trend up', () => {
    fixture.componentRef.setInput('trend', 'up');
    expect(component.deltaClass()).toBe('text-success');
  });

  it('deltaClass es text-danger para trend down', () => {
    fixture.componentRef.setInput('trend', 'down');
    expect(component.deltaClass()).toBe('text-danger');
  });

  it('deltaClass es text-content-subtle para trend flat', () => {
    fixture.componentRef.setInput('trend', 'flat');
    expect(component.deltaClass()).toBe('text-content-subtle');
  });
});
