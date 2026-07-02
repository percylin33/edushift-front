import { TestBed } from '@angular/core/testing';
import { RealtimeService } from './realtime.service';
import { AuthService } from '@core/services/auth.service';

describe('RealtimeService', () => {
  let service: RealtimeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        RealtimeService,
        {
          provide: AuthService,
          useValue: jasmine.createSpyObj('AuthService', ['getToken'], { refreshToken: () => null }),
        },
      ],
    });
    service = TestBed.inject(RealtimeService);
  });

  it('se crea correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('connected es false inicialmente', () => {
    expect(service.connected()).toBeFalse();
  });

  it('incoming$ es un Subject', () => {
    expect(service.incoming$).toBeDefined();
  });

  it('disconnect no lanza error cuando no hay cliente', () => {
    expect(() => service.disconnect()).not.toThrow();
  });
});
