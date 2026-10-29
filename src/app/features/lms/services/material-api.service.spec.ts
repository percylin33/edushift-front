import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { MaterialApiService } from './material-api.service';
import { CreateMaterialRequest, MaterialType, MaterialResponseRaw } from '../models';

describe('MaterialApiService', () => {
  let service: MaterialApiService;
  let httpSpy: jasmine.SpyObj<HttpClient>;

  beforeEach(() => {
    httpSpy = jasmine.createSpyObj<HttpClient>('HttpClient', ['get', 'post', 'delete']);
    TestBed.configureTestingModule({
      providers: [MaterialApiService, { provide: HttpClient, useValue: httpSpy }],
    });
    service = TestBed.inject(MaterialApiService);
  });

  it('listBySection hace GET, desenvuelve Page.content y mapea a rows (BUG-2026-07-31-05)', (done) => {
    // Backend returns Spring `Page<MaterialSummary>`:
    // { content: [...], totalElements, ... }, not a flat array.
    httpSpy.get.and.returnValue(
      of({
        content: [
          {
            publicUuid: 'mat-1',
            title: 'Guía',
            type: MaterialType.Pdf,
            filename: 'guia.pdf',
            sizeBytes: 1024,
            contentType: 'application/pdf',
            url: null,
            uploadedByTeacherName: 'Prof. A',
            sizeBytesDisplay: '1 KB',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        totalElements: 1,
        number: 0,
        size: 20,
      }),
    );

    service.listBySection('s-1').subscribe((rows) => {
      expect(rows).toHaveSize(1);
      expect(rows[0].title).toBe('Guía');
      done();
    });
  });

  it('listBySection con content vacio devuelve []', (done) => {
    httpSpy.get.and.returnValue(
      of({ content: [], totalElements: 0, number: 0, size: 20 }),
    );
    service.listBySection('s-empty').subscribe((rows) => {
      expect(rows).toEqual([]);
      done();
    });
  });

  it('listBySection defensivo si content es undefined devuelve []', (done) => {
    httpSpy.get.and.returnValue(of({} as any));
    service.listBySection('s-weird').subscribe((rows) => {
      expect(rows).toEqual([]);
      done();
    });
  });

  it('getMaterial desenvuelve ApiResponse', (done) => {
    const raw: MaterialResponseRaw = {
      publicUuid: 'mat-1',
      sectionPublicUuid: 's-1',
      title: 'Doc',
      kind: 'FILE',
      file: { publicUuid: 'file-1', originalName: 'doc.docx', sizeBytes: 2048, contentType: 'application/msword', url: null, createdAt: '2026-01-01T00:00:00.000Z' },
      externalUrl: null,
      ownerPublicUuid: 'tch-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: null,
    };
    httpSpy.get.and.returnValue(of({ success: true, data: raw }));

    service.getMaterial('mat-1').subscribe((mat) => {
      expect(mat.type).toBe(MaterialType.Doc);
      done();
    });
  });

  it('upload con file usa FormData', (done) => {
    const raw: MaterialResponseRaw = {
      publicUuid: 'mat-new',
      sectionPublicUuid: 's-1',
      title: 'Nuevo',
      kind: 'FILE',
      file: { publicUuid: 'file-2', originalName: 'nuevo.pdf', sizeBytes: 512, contentType: 'application/pdf', url: null, createdAt: '2026-01-01T00:00:00.000Z' },
      externalUrl: null,
      ownerPublicUuid: 'tch-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: null,
    };
    const resp = new HttpResponse({ body: { success: true, data: raw } });
    httpSpy.post.and.returnValue(of(resp));

    const req: CreateMaterialRequest = {
      title: 'Nuevo',
      type: MaterialType.Pdf,
      file: new File(['data'], 'nuevo.pdf', { type: 'application/pdf' }),
      url: null,
      teacherAssignmentPublicUuid: 'assignment-1',
    };

    service.upload('s-1', req).subscribe((p) => {
      if (p.kind === 'Response') {
        expect(p.value.title).toBe('Nuevo');
        done();
      }
    });
  });

  it('upload con LINK envía JSON', (done) => {
    const raw: MaterialResponseRaw = {
      publicUuid: 'mat-link',
      sectionPublicUuid: 's-1',
      title: 'Enlace',
      kind: 'VIDEO_LINK',
      file: null,
      externalUrl: 'https://ejemplo.com',
      ownerPublicUuid: 'tch-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: null,
    };
    const resp = new HttpResponse({ body: { success: true, data: raw } });
    httpSpy.post.and.returnValue(of(resp));

    service
      .upload('s-1', {
        title: 'Enlace',
        type: MaterialType.Link,
        url: 'https://ejemplo.com',
        teacherAssignmentPublicUuid: 'assignment-1',
      })
      .subscribe((p) => {
        if (p.kind === 'Response') {
          expect(p.value.url).toBe('https://ejemplo.com');
          done();
        }
      });
  });

  it('delete llama DELETE', (done) => {
    httpSpy.delete.and.returnValue(of(undefined));

    service.delete('mat-1').subscribe(() => {
      expect(httpSpy.delete).toHaveBeenCalled();
      done();
    });
  });
});
