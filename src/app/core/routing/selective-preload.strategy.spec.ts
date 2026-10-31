import { TestBed } from '@angular/core/testing';
import { Route } from '@angular/router';
import { of } from 'rxjs';

import { SelectivePreloadStrategy } from './selective-preload.strategy';

describe('SelectivePreloadStrategy', () => {
  let strategy: SelectivePreloadStrategy;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    strategy = TestBed.inject(SelectivePreloadStrategy);
  });

  it('no precarga si la ruta no marca preload', () => {
    const load = jasmine.createSpy('load').and.returnValue(of('chunk'));
    const route: Route = { path: 'academic' };
    let result: unknown = 'pending';

    strategy.preload(route, load).subscribe((value) => {
      result = value;
    });

    expect(load).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('precarga cuando data.preload es true', () => {
    const load = jasmine.createSpy('load').and.returnValue(of('chunk'));
    const route: Route = { path: 'dashboard', data: { preload: true } };
    let result: unknown;

    strategy.preload(route, load).subscribe((value) => {
      result = value;
    });

    expect(load).toHaveBeenCalledTimes(1);
    expect(result).toBe('chunk');
  });
});
