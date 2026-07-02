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

  it('listBySection hace GET y mapea a rows', (done) => {
    httpSpy.get.and.returnValue(
      of([
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
      ]),
    );

    service.listBySection('s-1').subscribe((rows) => {
      expect(rows).toHaveSize(1);
      expect(rows[0].title).toBe('Guía');
      done();
    });
  });

  it('getMaterial desenvuelve ApiResponse', (done) => {
    const raw: MaterialResponseRaw = {
      publicUuid: 'mat-1',
      sectionPublicUuid: 's-1',
      title: 'Doc',
      type: MaterialType.Doc,
      filename: 'doc.docx',
      sizeBytes: 2048,
      contentType: 'application/msword',
      url: null,
      uploadedByTeacherPublicUuid: 'tch-1',
      uploadedByTeacherName: 'Prof.',
      downloadUrl: null,
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
      type: MaterialType.Pdf,
      filename: 'nuevo.pdf',
      sizeBytes: 512,
      contentType: 'application/pdf',
      url: null,
      uploadedByTeacherPublicUuid: 'tch-1',
      uploadedByTeacherName: 'Prof.',
      downloadUrl: null,
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
      type: MaterialType.Link,
      filename: null,
      sizeBytes: null,
      contentType: null,
      url: 'https://ejemplo.com',
      uploadedByTeacherPublicUuid: 'tch-1',
      uploadedByTeacherName: 'Prof.',
      downloadUrl: null,
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
