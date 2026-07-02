import { TestBed } from '@angular/core/testing';
import { BreadcrumbService } from './breadcrumb.service';
import { provideRouter } from '@angular/router';

describe('BreadcrumbService', () => {
  let service: BreadcrumbService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BreadcrumbService, provideRouter([])],
    });
    service = TestBed.inject(BreadcrumbService);
  });

  it('se crea correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('breadcrumbs es un array vacío inicialmente', () => {
    expect(service.breadcrumbs()).toEqual([]);
  });
});
