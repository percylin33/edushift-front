import {
  MaterialType,
  MaterialResponseRaw,
  MaterialSummaryRaw,
  toMaterial,
  toMaterialRow,
  materialTypeIcon,
  materialTypeLabel,
  inferMaterialTypeFromMime,
  isFileMaterial,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_FILE_MIME,
} from './material.model';

describe('material.model', () => {
  describe('toMaterial', () => {
    it('parsea ISO strings y normaliza nulls', () => {
      const raw: MaterialResponseRaw = {
        publicUuid: 'mat-1',
        sectionPublicUuid: 's-1',
        title: 'Guía de estudio',
        type: MaterialType.Pdf,
        filename: 'guia.pdf',
        sizeBytes: 204800,
        contentType: 'application/pdf',
        url: null,
        uploadedByTeacherPublicUuid: 'tch-1',
        uploadedByTeacherName: 'Prof. García',
        downloadUrl: 'https://dl.example.com/guia.pdf',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: null,
      };
      const mat = toMaterial(raw);
      expect(mat.createdAt).toBeInstanceOf(Date);
      expect(mat.type).toBe(MaterialType.Pdf);
      expect(mat.downloadUrl).toBe('https://dl.example.com/guia.pdf');
    });
  });

  describe('toMaterialRow', () => {
    it('mapea SummaryRaw correctamente', () => {
      const raw: MaterialSummaryRaw = {
        publicUuid: 'mat-1',
        title: 'Enlace útil',
        type: MaterialType.Link,
        filename: null,
        sizeBytes: null,
        contentType: null,
        url: 'https://ejemplo.com',
        uploadedByTeacherName: 'Prof. García',
        sizeBytesDisplay: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const row = toMaterialRow(raw);
      expect(row.title).toBe('Enlace útil');
      expect(row.url).toBe('https://ejemplo.com');
      expect(row.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('materialTypeIcon', () => {
    it('retorna iconos correctos por tipo', () => {
      expect(materialTypeIcon(MaterialType.Pdf)).toBe('file-text');
      expect(materialTypeIcon(MaterialType.Image)).toBe('image');
      expect(materialTypeIcon(MaterialType.Doc)).toBe('file-text');
      expect(materialTypeIcon(MaterialType.Link)).toBe('globe');
      expect(materialTypeIcon(MaterialType.Other)).toBe('paperclip');
    });
  });

  describe('materialTypeLabel', () => {
    it('retorna labels en español', () => {
      expect(materialTypeLabel(MaterialType.Pdf)).toBe('PDF');
      expect(materialTypeLabel(MaterialType.Image)).toBe('Imagen');
      expect(materialTypeLabel(MaterialType.Doc)).toBe('Documento');
      expect(materialTypeLabel(MaterialType.Link)).toBe('Enlace');
      expect(materialTypeLabel(MaterialType.Other)).toBe('Otro');
    });
  });

  describe('inferMaterialTypeFromMime', () => {
    it('infiere PDF', () => {
      expect(inferMaterialTypeFromMime('application/pdf')).toBe(MaterialType.Pdf);
    });
    it('infiere Image', () => {
      expect(inferMaterialTypeFromMime('image/jpeg')).toBe(MaterialType.Image);
      expect(inferMaterialTypeFromMime('image/png')).toBe(MaterialType.Image);
    });
    it('infiere Doc para formatos Office', () => {
      expect(inferMaterialTypeFromMime('application/msword')).toBe(MaterialType.Doc);
      expect(
        inferMaterialTypeFromMime(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ),
      ).toBe(MaterialType.Doc);
      expect(inferMaterialTypeFromMime('application/vnd.ms-excel')).toBe(MaterialType.Doc);
    });
    it('retorna Other para tipos desconocidos', () => {
      expect(inferMaterialTypeFromMime('text/csv')).toBe(MaterialType.Other);
    });
  });

  describe('isFileMaterial', () => {
    it('true para tipos de archivo', () => {
      expect(isFileMaterial(MaterialType.Pdf)).toBeTrue();
      expect(isFileMaterial(MaterialType.Image)).toBeTrue();
    });
    it('false para Link', () => {
      expect(isFileMaterial(MaterialType.Link)).toBeFalse();
    });
  });

  describe('constants', () => {
    it('MAX_FILE_SIZE_BYTES es 50 MB', () => {
      expect(MAX_FILE_SIZE_BYTES).toBe(50 * 1024 * 1024);
    });
    it('ALLOWED_FILE_MIME incluye formatos esperados', () => {
      expect(ALLOWED_FILE_MIME).toContain('application/pdf');
      expect(ALLOWED_FILE_MIME).toContain('image/jpeg');
    });
  });
});
