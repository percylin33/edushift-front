import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, ActivatedRouteSnapshot } from '@angular/router';
import { AppTitleStrategy } from './app-title.strategy';

describe('AppTitleStrategy', () => {
  let strategy: AppTitleStrategy;
  let titleSpy: jasmine.SpyObj<Title>;

  beforeEach(() => {
    titleSpy = jasmine.createSpyObj('Title', ['setTitle']);
    TestBed.configureTestingModule({
      providers: [AppTitleStrategy, { provide: Title, useValue: titleSpy }],
    });
    strategy = TestBed.inject(AppTitleStrategy);
  });

  it('se crea correctamente', () => {
    expect(strategy).toBeTruthy();
  });

  it('updateTitle establece título con el nombre de la app', () => {
    const snapshot = { root: { data: {}, firstChild: null } } as unknown as RouterStateSnapshot;
    strategy.updateTitle(snapshot);
    expect(titleSpy.setTitle).toHaveBeenCalled();
  });
});
