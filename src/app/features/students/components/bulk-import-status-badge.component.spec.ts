import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BulkImportStatusBadgeComponent } from './bulk-import-status-badge.component';
import { BulkImportStatus } from '@core/enums';

describe('BulkImportStatusBadgeComponent', () => {
  let fixture: ComponentFixture<BulkImportStatusBadgeComponent>;
  let component: BulkImportStatusBadgeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BulkImportStatusBadgeComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(BulkImportStatusBadgeComponent);
    component = fixture.componentInstance;
  });

  it('se crea correctamente', () => {
    fixture.componentRef.setInput('status', BulkImportStatus.Pending);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('label Pending = En cola', () => {
    fixture.componentRef.setInput('status', BulkImportStatus.Pending);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('En cola');
  });

  it('label Processing = Procesando', () => {
    fixture.componentRef.setInput('status', BulkImportStatus.Processing);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Procesando');
  });

  it('label Completed = Completado', () => {
    fixture.componentRef.setInput('status', BulkImportStatus.Completed);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Completado');
  });

  it('label Failed = Falló', () => {
    fixture.componentRef.setInput('status', BulkImportStatus.Failed);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Falló');
  });

  it('badgeClass aplica tier correcto por status', () => {
    const map: Array<[BulkImportStatus, string]> = [
      [BulkImportStatus.Pending, 'badge-info'],
      [BulkImportStatus.Processing, 'badge-info'],
      [BulkImportStatus.Completed, 'badge-success'],
      [BulkImportStatus.Failed, 'badge-danger'],
    ];
    for (const [status, expected] of map) {
      fixture.componentRef.setInput('status', status);
      fixture.detectChanges();
      const cls = fixture.nativeElement.querySelector('span').className;
      expect(cls).toContain(expected);
    }
  });

  it('fallback a badge-neutral si status desconocido', () => {
    fixture.componentRef.setInput('status', 'UNKNOWN' as BulkImportStatus);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('span').className).toContain('badge-neutral');
    expect(fixture.nativeElement.textContent).toContain('UNKNOWN');
  });
});
