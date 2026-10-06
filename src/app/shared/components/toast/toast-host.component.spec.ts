import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationService } from '@core/services';
import { ToastHostComponent } from './toast-host.component';

describe('ToastHostComponent', () => {
  let fixture: ComponentFixture<ToastHostComponent>;
  let notifications: NotificationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastHostComponent],
      providers: [NotificationService],
    }).compileComponents();

    notifications = TestBed.inject(NotificationService);
    fixture = TestBed.createComponent(ToastHostComponent);
    fixture.detectChanges();
  });

  it('no renderiza toasts cuando la cola está vacía', () => {
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelectorAll('[role="status"]').length).toBe(0);
  });

  it('renderiza kinds y permite dismiss', () => {
    notifications.success('Guardado', 'OK');
    notifications.error('Falló');
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const toasts = host.querySelectorAll('[role="status"]');
    expect(toasts.length).toBe(2);
    expect(toasts[0].textContent).toContain('OK');
    expect(toasts[0].textContent).toContain('Guardado');
    expect(toasts[1].textContent).toContain('Falló');

    const dismissBtn = toasts[0].querySelector('button') as HTMLButtonElement;
    dismissBtn.click();
    fixture.detectChanges();

    expect(host.querySelectorAll('[role="status"]').length).toBe(1);
    expect(notifications.messages().length).toBe(1);
  });
});
