import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlertComponent } from './alert.component';

describe('AlertComponent', () => {
  let fixture: ComponentFixture<AlertComponent>;
  let component: AlertComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlertComponent],
    }).compileComponents();
  });

  function create(variant: 'error' | 'success' | 'warning' | 'info', message: string): void {
    fixture = TestBed.createComponent(AlertComponent);
    component = fixture.componentInstance;
    component.variant = variant;
    component.message = message;
    fixture.detectChanges();
  }

  it('se crea correctamente', () => {
    create('error', 'Algo falló');
    expect(component).toBeTruthy();
  });

  it('renderiza el mensaje en el template', () => {
    create('error', 'No se pudo conectar');
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('No se pudo conectar');
  });

  it('usa role="alert" para variant=error por defecto', () => {
    create('error', 'boom');
    const el = fixture.nativeElement.querySelector('[role="alert"]');
    expect(el).toBeTruthy();
  });

  it('usa role="status" para variant=success por defecto', () => {
    create('success', 'ok');
    const el = fixture.nativeElement.querySelector('[role="status"]');
    expect(el).toBeTruthy();
  });

  it('respeta role override', () => {
    create('info', 'info');
    component.role = 'alert';
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[role="alert"]');
    expect(el).toBeTruthy();
  });

  it('iconName retorna alert-circle para error', () => {
    create('error', 'x');
    expect(component.iconName()).toBe('alert-circle');
  });

  it('iconName retorna check para success', () => {
    create('success', 'x');
    expect(component.iconName()).toBe('check');
  });

  it('iconName retorna alert-triangle para warning', () => {
    create('warning', 'x');
    expect(component.iconName()).toBe('alert-triangle');
  });

  it('iconName retorna info para info', () => {
    create('info', 'x');
    expect(component.iconName()).toBe('info');
  });

  it('iconName respeta icon override', () => {
    create('success', 'x');
    component.icon = 'mail';
    expect(component.iconName()).toBe('mail');
  });
});