import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { ChatService } from './chat.service';
import { ApiService } from '@core/services/api.service';

describe('ChatService', () => {
  let service: ChatService;
  let apiSpy: jasmine.SpyObj<ApiService>;
  let httpSpy: jasmine.SpyObj<HttpClient>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post', 'delete']);
    httpSpy = jasmine.createSpyObj('HttpClient', ['post']);
    TestBed.configureTestingModule({
      providers: [
        ChatService,
        { provide: ApiService, useValue: apiSpy },
        { provide: HttpClient, useValue: httpSpy },
      ],
    });
    service = TestBed.inject(ChatService);
  });

  it('se crea correctamente', () => {
    expect(service).toBeTruthy();
  });

  describe('listSessions', () => {
    it('devuelve lista de sesiones', (done) => {
      apiSpy.get.and.returnValue(
        of({
          success: true,
          data: [
            {
              id: 's1',
              publicUuid: 's1',
              title: 'Chat',
              status: 'ACTIVE',
              messageCount: 0,
              updatedAt: '2026-01-01',
            },
          ],
        }),
      );
      service.listSessions(10).subscribe((sessions) => {
        expect(sessions.length).toBe(1);
        expect(sessions[0].title).toBe('Chat');
        done();
      });
    });

    it('devuelve array vacío si no hay data', (done) => {
      apiSpy.get.and.returnValue(of({ success: true, data: null }));
      service.listSessions().subscribe((sessions) => {
        expect(sessions).toEqual([]);
        done();
      });
    });
  });

  describe('createSession', () => {
    it('crea sesión y la devuelve', (done) => {
      apiSpy.post.and.returnValue(
        of({
          success: true,
          data: {
            id: 's2',
            publicUuid: 's2',
            title: 'Nueva',
            status: 'ACTIVE',
            messageCount: 0,
            updatedAt: '',
          },
        }),
      );
      service.createSession().subscribe((s) => {
        expect(s.title).toBe('Nueva');
        done();
      });
    });
  });

  describe('listMessages', () => {
    it('devuelve mensajes de sesión', (done) => {
      apiSpy.get.and.returnValue(
        of({
          success: true,
          data: [
            {
              id: 'm1',
              publicUuid: 'm1',
              role: 'USER',
              content: 'Hola',
              status: 'COMPLETED',
              createdAt: '',
            },
          ],
        }),
      );
      service.listMessages('s1').subscribe((msgs) => {
        expect(msgs.length).toBe(1);
        expect(msgs[0].content).toBe('Hola');
        done();
      });
    });
  });

  describe('deleteSession', () => {
    it('elimina sesión', (done) => {
      apiSpy.delete.and.returnValue(of({ success: true }));
      service.deleteSession('s1').subscribe(() => {
        expect(apiSpy.delete).toHaveBeenCalled();
        done();
      });
    });
  });

  describe('sendMessage', () => {
    it('retorna handle con chunks$ y cancel', () => {
      const handle = service.sendMessage('s1', 'Hola');
      expect(handle.chunks$).toBeDefined();
      expect(typeof handle.cancel).toBe('function');
    });
  });
});
