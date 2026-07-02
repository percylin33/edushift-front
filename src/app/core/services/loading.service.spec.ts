import { TestBed } from '@angular/core/testing';
import { LoadingService } from './loading.service';

describe('LoadingService', () => {
  let service: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoadingService);
  });

  it('inicia sin loading activo', () => {
    expect(service.loading()).toBeFalse();
  });

  it('start incrementa el contador y loading es true', () => {
    service.start();
    expect(service.loading()).toBeTrue();
  });

  it('stop decrementa el contador', () => {
    service.start();
    service.start();
    service.stop();
    expect(service.loading()).toBeTrue();
    service.stop();
    expect(service.loading()).toBeFalse();
  });

  it('stop no baja de 0', () => {
    service.stop();
    expect(service.loading()).toBeFalse();
  });

  it('reset limpia el contador', () => {
    service.start();
    service.start();
    service.reset();
    expect(service.loading()).toBeFalse();
  });
});
