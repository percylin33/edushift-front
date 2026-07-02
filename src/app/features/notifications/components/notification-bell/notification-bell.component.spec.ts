import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationBellComponent } from './notification-bell.component';
import { NotificationsApiService } from '../../services/notifications-api.service';
import { RealtimeService } from '@core/realtime/realtime.service';
import { AuthService } from '@core/services/auth.service';
import { of } from 'rxjs';

describe('NotificationBellComponent', () => {
  let component: NotificationBellComponent;
  let fixture: ComponentFixture<NotificationBellComponent>;
  let apiSpy: jasmine.SpyObj<NotificationsApiService>;
  let realtimeSpy: jasmine.SpyObj<RealtimeService>;
  let authSpy: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj('NotificationsApiService', [
      'listUnreadCount',
      'list',
      'markRead',
      'markAllRead',
    ]);
    apiSpy.listUnreadCount.and.returnValue(of({ unreadCount: 3 }));
    apiSpy.list.and.returnValue(of({ items: [] }));
    realtimeSpy = jasmine.createSpyObj('RealtimeService', ['connect', 'subscribe'], {
      connected: () => true,
      incoming$: of(),
    });
    authSpy = jasmine.createSpyObj('AuthService', [], { user$: of({ id: 'u1', tenantId: 't1' }) });

    await TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [
        { provide: NotificationsApiService, useValue: apiSpy },
        { provide: RealtimeService, useValue: realtimeSpy },
        { provide: AuthService, useValue: authSpy },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(NotificationBellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('carga conteo inicial', () => {
    expect(apiSpy.listUnreadCount).toHaveBeenCalled();
    expect(component.unreadCount()).toBe(3);
  });

  describe('toggle', () => {
    it('alterna open', () => {
      component.toggle();
      expect(component.open()).toBeTrue();
      component.toggle();
      expect(component.open()).toBeFalse();
    });

    it('carga items al abrir si está vacío', () => {
      component.toggle();
      expect(apiSpy.list).toHaveBeenCalled();
    });
  });

  describe('loadItems', () => {
    it('carga lista de notificaciones', () => {
      apiSpy.list.and.returnValue(
        of({ items: [{ id: 'n1', title: 'Test', body: '', createdAt: '' }] }),
      );
      component.loadItems();
      expect(component.items().length).toBe(1);
      expect(component.loading()).toBeFalse();
    });

    it('maneja error de carga', () => {
      apiSpy.list.and.returnValue(of({ items: [] }));
      component.loadItems();
      expect(component.loading()).toBeFalse();
    });
  });

  describe('onItemClick', () => {
    it('marca como leída', () => {
      apiSpy.markRead.and.returnValue(of({ id: 'n1', title: 'Test', body: '', createdAt: '' }));
      component.onItemClick({ id: 'n1', title: 'Test', body: '', createdAt: '' });
      expect(apiSpy.markRead).toHaveBeenCalledWith('n1');
    });
  });

  describe('markAllRead', () => {
    it('marca todas leídas', () => {
      apiSpy.markAllRead.and.returnValue(of({ updated: 2 }));
      component.markAllRead();
      expect(apiSpy.markAllRead).toHaveBeenCalled();
    });
  });
});
