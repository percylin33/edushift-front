import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatPageComponent } from './chat-page.component';
import { ChatService } from '../../services/chat.service';
import { of } from 'rxjs';

describe('ChatPageComponent', () => {
  let component: ChatPageComponent;
  let fixture: ComponentFixture<ChatPageComponent>;
  let chatSpy: jasmine.SpyObj<ChatService>;

  beforeEach(async () => {
    chatSpy = jasmine.createSpyObj('ChatService', [
      'listSessions',
      'createSession',
      'listMessages',
      'sendMessage',
    ]);
    chatSpy.listSessions.and.returnValue(of([]));
    chatSpy.createSession.and.returnValue(
      of({
        id: 's1',
        publicUuid: 's1',
        title: 'Nueva',
        status: 'ACTIVE',
        messageCount: 0,
        updatedAt: '',
      }),
    );
    chatSpy.listMessages.and.returnValue(of([]));
    chatSpy.sendMessage.and.returnValue({
      chunks$: of({ kind: 'done', publicUuid: 'm1' }),
      cancel: () => {},
    });

    await TestBed.configureTestingModule({
      imports: [ChatPageComponent],
      providers: [{ provide: ChatService, useValue: chatSpy }],
    }).compileComponents();
    fixture = TestBed.createComponent(ChatPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('carga sesiones al iniciar', () => {
    expect(chatSpy.listSessions).toHaveBeenCalled();
  });

  describe('relativeTime', () => {
    it('retorna vacío para string vacío', () => {
      expect(component.relativeTime('')).toBe('');
    });

    it('retorna "ahora" para tiempo reciente', () => {
      const now = new Date().toISOString();
      expect(component.relativeTime(now)).toBe('ahora');
    });

    it('retorna "hace X h" para horas', () => {
      const past = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
      expect(component.relativeTime(past)).toMatch(/hace \d+ h/);
    });
  });

  describe('newSession', () => {
    it('crea nueva sesión', async () => {
      await component.newSession();
      expect(chatSpy.createSession).toHaveBeenCalled();
      expect(component.sessions().length).toBeGreaterThan(0);
    });
  });

  describe('cancel', () => {
    it('cancela y establece error', () => {
      component.cancel();
      expect(component.streaming()).toBeFalse();
      expect(component.error()).toContain('cancelada');
    });
  });
});
