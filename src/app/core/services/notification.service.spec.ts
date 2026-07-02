import { TestBed } from '@angular/core/testing';
import { NotificationService, AppNotification } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [NotificationService] });
    service = TestBed.inject(NotificationService);
    jasmine.clock().install();
  });

  afterEach(() => {
    try {
      jasmine.clock().uninstall();
    } catch (e) {
      // Clock already uninstalled; safe to ignore.
    }
  });

  it('inicia con lista vacía', () => {
    expect(service.messages()).toEqual([]);
  });

  it('push agrega una notificación con id y timeout por defecto', () => {
    const id = service.push({ kind: 'info', message: 'Hola' });
    expect(id).toBeTruthy();
    expect(service.messages()).toHaveSize(1);
    expect(service.messages()[0].kind).toBe('info');
    expect(service.messages()[0].message).toBe('Hola');
  });

  it('success, info, warning, error son helpers', () => {
    const sid = service.success('OK');
    const iid = service.info('Info');
    const wid = service.warning('Warning');
    const eid = service.error('Error');

    expect(service.messages()).toHaveSize(4);
    expect(service.messages()[0].kind).toBe('success');
    expect(service.messages()[1].kind).toBe('info');
    expect(service.messages()[2].kind).toBe('warning');
    expect(service.messages()[3].kind).toBe('error');
  });

  it('dismiss remueve una notificación por id', () => {
    const id = service.push({ kind: 'info', message: 'Msg' });
    expect(service.messages()).toHaveSize(1);
    service.dismiss(id);
    expect(service.messages()).toHaveSize(0);
  });

  it('clear vacía todas las notificaciones', () => {
    service.success('A');
    service.error('B');
    expect(service.messages()).toHaveSize(2);
    service.clear();
    expect(service.messages()).toHaveSize(0);
  });
});
