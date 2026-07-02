import { TestBed } from '@angular/core/testing';
import { FocusTrap } from './focus-trap.service';

describe('FocusTrap', () => {
  let service: FocusTrap;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FocusTrap);

    root = document.createElement('div');
    root.setAttribute('role', 'dialog');
    const btn = document.createElement('button');
    btn.textContent = 'Cerrar';
    root.appendChild(btn);
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.removeChild(root);
    service.deactivate();
  });

  it('se crea correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('activate enfoca el primer elemento tabbable', () => {
    service.activate(root);
    expect(document.activeElement).toBe(root.querySelector('button'));
  });

  it('activate y deactivate limpian el handler', () => {
    service.activate(root);
    service.deactivate();
    expect(service['handler']).toBeNull();
    expect(service['restoreTo']).toBeNull();
  });

  it('deactivate no falla si no hay handler activo', () => {
    expect(() => service.deactivate()).not.toThrow();
  });
});
