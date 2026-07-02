import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SidebarItemComponent } from './sidebar-item.component';
import { provideRouter } from '@angular/router';
import { NavigationItem } from '../../models';

describe('SidebarItemComponent', () => {
  let component: SidebarItemComponent;
  let fixture: ComponentFixture<SidebarItemComponent>;

  const mockItem: NavigationItem = { id: 'test', label: 'Test', route: '/test' };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarItemComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarItemComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('item', mockItem);
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('inicializa collapsed como false por defecto', () => {
    expect(component.collapsed()).toBeFalse();
  });

  it('hasChildren es false cuando item no tiene children', () => {
    expect(component.hasChildren()).toBeFalse();
  });

  it('toggle cambia el estado open', () => {
    const initial = component.open();
    component.toggle();
    expect(component.open()).toBe(!initial);
  });

  it('hasChildren es true cuando item tiene children', () => {
    fixture.componentRef.setInput('item', {
      ...mockItem,
      children: [{ id: 'child', label: 'Child', route: '/child' }],
    });
    fixture.detectChanges();
    expect(component.hasChildren()).toBeTrue();
  });
});
