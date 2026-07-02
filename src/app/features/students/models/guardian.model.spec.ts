import { DocumentType, RelationshipType } from '@core/enums';
import { Guardian, AddGuardianRequest, UpdateGuardianLinkRequest } from './guardian.model';

describe('GuardianModel', () => {
  describe('Guardian', () => {
    it('acepta shape mínimo', () => {
      const g: Guardian = {
        linkPublicUuid: 'l-1',
        guardianPublicUuid: 'g-1',
        documentType: DocumentType.Dni,
        documentNumber: '12345678',
        firstName: 'Maria',
        lastName: 'Gomez',
        fullName: 'Maria Gomez',
        relationship: RelationshipType.Mother,
        isPrimaryContact: true,
        canPickupStudent: true,
      };
      expect(g.linkPublicUuid).toBe('l-1');
      expect(g.email).toBeUndefined();
    });

    it('campos opcionales pueden ser undefined', () => {
      const g: Guardian = {
        linkPublicUuid: 'l-1',
        guardianPublicUuid: 'g-1',
        documentType: DocumentType.Dni,
        documentNumber: '1',
        firstName: 'A',
        lastName: 'B',
        fullName: 'A B',
        relationship: RelationshipType.Other,
        isPrimaryContact: false,
        canPickupStudent: false,
      };
      expect(g.email).toBeUndefined();
      expect(g.phone).toBeUndefined();
      expect(g.occupation).toBeUndefined();
    });
  });

  describe('AddGuardianRequest', () => {
    it('requiere doc + nombres + relación', () => {
      const req: AddGuardianRequest = {
        documentType: DocumentType.Dni,
        documentNumber: '12345678',
        firstName: 'Maria',
        lastName: 'Gomez',
        relationship: RelationshipType.Mother,
        isPrimaryContact: true,
        canPickupStudent: true,
      };
      expect(req.email).toBeUndefined();
    });
  });

  describe('UpdateGuardianLinkRequest', () => {
    it('solo campos de vínculo', () => {
      const req: UpdateGuardianLinkRequest = {
        relationship: RelationshipType.Father,
        isPrimaryContact: true,
        canPickupStudent: false,
      };
      expect(req.canPickupStudent).toBeFalse();
    });

    it('puede ser patch vacío', () => {
      const req: UpdateGuardianLinkRequest = {};
      expect(Object.keys(req)).toHaveSize(0);
    });
  });
});
