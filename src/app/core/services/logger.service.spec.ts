import { TestBed } from '@angular/core/testing';
import { LoggerService } from './logger.service';

describe('LoggerService', () => {
  let service: LoggerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoggerService);
  });

  it('se crea correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('debug no lanza error', () => {
    expect(() => service.debug('test')).not.toThrow();
  });

  it('info no lanza error', () => {
    expect(() => service.info('test')).not.toThrow();
  });

  it('warn no lanza error', () => {
    expect(() => service.warn('test')).not.toThrow();
  });

  it('error no lanza error', () => {
    expect(() => service.error('test')).not.toThrow();
  });

  it('acepta múltiples argumentos', () => {
    expect(() => service.info('test', { key: 'value' }, [1, 2, 3])).not.toThrow();
  });
});
