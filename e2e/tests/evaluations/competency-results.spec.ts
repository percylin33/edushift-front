import { test, expect } from '@playwright/test';
import { TENANT_ADMIN, TEACHER } from '../../fixtures/test-users';
import { TEACHER_STORAGE_STATE } from '../../fixtures/storage-state-paths';
import { apiContextFor } from '../../utils/api-helpers';
import {
  makeAcademicBundle,
  makeAcademicPeriod,
  makeCourse,
  makeStudent,
  makeTeacher,
  makeTeacherUserLink,
} from '../../factories';

const ACADEMIC = '/api/v1/academic';

/**
 * Jornada 4 / F1-ACA-01 — registros por competencia, revisiones y
 * bloqueo de escritura al cerrar la evaluación.
 *
 * El spec crea datos sintéticos bajo el tenant de QA Tecnosur y los
 * retira al terminar. Si falta el perfil docente de QA, crea un perfil
 * sintético reutilizable para la cuenta docente de pruebas. No usa
 * expedientes de estudiantes existentes.
 */
test.describe('Resultados por competencia — recorrido docente', () => {
  test('guarda evidencia e historial, valida límites y deja la evaluación en solo lectura al cerrarla', async ({
    browser,
    baseURL,
  }) => {
    test.skip(test.info().project.name !== 'chromium-desktop', 'Este recorrido se ejecuta solo en escritorio.');

    const adminApi = await apiContextFor({ user: TENANT_ADMIN });
    const teacherApi = await apiContextFor({ user: TEACHER });
    let bundle: Awaited<ReturnType<typeof makeAcademicBundle>> | undefined;
    let otherCourse: Awaited<ReturnType<typeof makeCourse>> | undefined;
    let period: Awaited<ReturnType<typeof makeAcademicPeriod>> | undefined;
    let student: Awaited<ReturnType<typeof makeStudent>> | undefined;
    let unEnrolledStudent: Awaited<ReturnType<typeof makeStudent>> | undefined;
    let assignmentPublicUuid = '';
    let evaluationPublicUuid = '';
    let competencyPublicUuid = '';
    let otherCourseCompetencyUuid = '';
    let enrollmentPublicUuid = '';
    let teacherContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;

    try {
      bundle = await makeAcademicBundle(adminApi);
      otherCourse = await makeCourse(adminApi, {
        levelPublicUuids: [bundle.level.publicUuid],
      });
      period = await makeAcademicPeriod(adminApi, {
        academicYearPublicUuid: bundle.year.publicUuid,
        endDate: String(bundle.year.payload.endDate),
      });

      let teacherProfileRes = await teacherApi.get('/api/v1/teachers/me');
      if (teacherProfileRes.status() === 404) {
        // Some local QA databases have the TEACHER login but are missing
        // its linked profile. Provision one synthetic profile once so the
        // teacher screen can be tested; the account link is reusable.
        const meRes = await teacherApi.get('/api/v1/auth/me');
        expect(meRes.ok(), 'the QA teacher login must be authenticated').toBeTruthy();
        const meBody = await meRes.json();
        const userPublicUuid = meBody.data?.publicUuid ?? meBody.publicUuid;
        expect(userPublicUuid).toBeTruthy();
        const qaTeacher = await makeTeacher(adminApi, {
          firstName: 'QA',
          lastName: 'Playwright Competency Teacher',
        });
        const link = await makeTeacherUserLink(adminApi, qaTeacher.publicUuid, userPublicUuid);
        expect(link).toBeTruthy();
        teacherProfileRes = await teacherApi.get('/api/v1/teachers/me');
      }
      expect(teacherProfileRes.ok(), `the QA teacher profile must resolve (${teacherProfileRes.status()})`).toBeTruthy();
      const teacherProfile = await teacherProfileRes.json();
      const teacherPublicUuid = teacherProfile.data?.publicUuid;
      expect(teacherPublicUuid).toBeTruthy();

      const assignmentRes = await adminApi.post(
        `/api/v1/teachers/${teacherPublicUuid}/assignments`,
        {
          data: {
            sectionPublicUuid: bundle.section.publicUuid,
            coursePublicUuid: bundle.course.publicUuid,
            academicPeriodPublicUuid: period.publicUuid,
          },
        },
      );
      expect(assignmentRes.status(), await assignmentRes.text()).toBe(201);
      assignmentPublicUuid = (await assignmentRes.json()).data.publicUuid;

      const today = new Date().toISOString().slice(0, 10);
      const evaluationRes = await adminApi.post(
        `${ACADEMIC}/assignments/${assignmentPublicUuid}/evaluations`,
        {
          data: {
            kind: 'TASK',
            name: `Playwright Competency ${Date.now().toString(36)}`,
            weight: 10,
            scheduledDate: today,
            scale: 'SCORE_0_20',
          },
        },
      );
      expect(evaluationRes.status(), await evaluationRes.text()).toBe(201);
      evaluationPublicUuid = (await evaluationRes.json()).data.publicUuid;

      const unique = Date.now().toString(36).toUpperCase();
      const competencyRes = await adminApi.post(
        `${ACADEMIC}/courses/${bundle.course.publicUuid}/competencies`,
        {
          data: {
            code: `PW${unique}`.slice(0, 16),
            name: `Competencia QA ${unique}`,
            description: 'Competencia sintética para el recorrido Playwright.',
            displayOrder: 1,
          },
        },
      );
      expect(competencyRes.status(), await competencyRes.text()).toBe(201);
      competencyPublicUuid = (await competencyRes.json()).data.publicUuid;

      const otherCompetencyRes = await adminApi.post(
        `${ACADEMIC}/courses/${otherCourse.publicUuid}/competencies`,
        {
          data: {
            code: `PX${unique}`.slice(0, 16),
            name: `Competencia de otro curso ${unique}`,
            description: 'Debe ser rechazada en la evaluación del curso principal.',
            displayOrder: 1,
          },
        },
      );
      expect(otherCompetencyRes.status(), await otherCompetencyRes.text()).toBe(201);
      otherCourseCompetencyUuid = (await otherCompetencyRes.json()).data.publicUuid;

      student = await makeStudent(adminApi, {
        firstName: 'Estudiante',
        lastName: `QA-${unique}`,
      });
      const enrollmentRes = await adminApi.post(
        `/api/v1/students/${student.publicUuid}/enrollments`,
        {
          data: {
            sectionPublicUuid: bundle.section.publicUuid,
            academicYearPublicUuid: bundle.year.publicUuid,
            enrolledAt: today,
          },
        },
      );
      expect(enrollmentRes.status(), await enrollmentRes.text()).toBe(201);
      enrollmentPublicUuid = (await enrollmentRes.json()).data.publicUuid;

      unEnrolledStudent = await makeStudent(adminApi, {
        firstName: 'NoMatriculado',
        lastName: `QA-${unique}`,
      });

      teacherContext = await browser.newContext({ storageState: TEACHER_STORAGE_STATE });
      const teacherPage = await teacherContext.newPage();
      await teacherPage.goto(
        `${baseURL}/evaluations/by-assignment/${assignmentPublicUuid}/gradebook`,
      );
      await expect(teacherPage.getByRole('button', { name: 'Evidencias' })).toBeEnabled();
      await teacherPage.getByRole('button', { name: 'Evidencias' }).click();

      const dialog = teacherPage.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: 'Competencias, evidencias y conclusiones' })).toBeVisible();
      await dialog.getByLabel('Evaluación').selectOption(evaluationPublicUuid);
      await dialog.getByLabel('Estudiante').selectOption(student.publicUuid);
      await expect(teacherPage.getByRole('heading', { name: '¿Descartar los cambios?' })).toHaveCount(0);
      await expect(dialog.getByRole('heading', { name: `Competencia QA ${unique}` })).toBeVisible();

      await dialog.getByLabel('Nivel de logro institucional').fill('En proceso');
      await dialog.getByLabel('Evidencia observada').fill('Resolvió una situación de práctica ficticia.');
      await dialog.getByLabel('Conclusión descriptiva').fill('Explica el procedimiento con apoyo de una representación.');
      await dialog.getByRole('button', { name: 'Agregar criterio' }).click();
      await dialog.getByPlaceholder('Criterio').fill('Justifica su procedimiento');
      await dialog.getByPlaceholder('Nivel').fill('Logro esperado');
      await dialog.getByPlaceholder('Evidencia', { exact: true }).fill('Incluye dos pasos verificables.');
      await dialog.getByPlaceholder('Retroalimentación').fill('Puede explicar por qué eligió esa estrategia.');
      await dialog.getByRole('button', { name: 'Guardar resultados' }).click();
      await expect(dialog.getByRole('status')).toContainText('se guardaron correctamente');

      await dialog.getByRole('button', { name: 'Ver historial' }).click();
      const history = dialog.getByRole('region', { name: 'Historial de revisiones' });
      await expect(history.getByText('Revisión 1')).toBeVisible();
      await expect(history.getByText('Resolvió una situación de práctica ficticia.')).toBeVisible();

      // A second save must append a revision instead of overwriting history.
      await dialog.getByLabel('Evidencia observada').fill('En una segunda revisión, explica el procedimiento sin apoyo.');
      await dialog.getByRole('button', { name: 'Guardar resultados' }).click();
      await expect(dialog.getByRole('status')).toContainText('se guardaron correctamente');
      await dialog.getByRole('button', { name: 'Ver historial' }).click();
      await expect(history.getByText('Revisión 2')).toBeVisible();
      await expect(history.getByText('Revisión 1')).toBeVisible();

      const historyApiRes = await teacherApi.get(
        `${ACADEMIC}/evaluations/${evaluationPublicUuid}/students/${student.publicUuid}` +
          `/competency-results/${competencyPublicUuid}/revisions`,
      );
      expect(historyApiRes.status()).toBe(200);
      const revisions = (await historyApiRes.json()).data;
      expect(revisions.map((revision: { revision: number }) => revision.revision)).toEqual([2, 1]);

      const notEnrolledRes = await teacherApi.put(
        `${ACADEMIC}/evaluations/${evaluationPublicUuid}/students/${unEnrolledStudent.publicUuid}/competency-results`,
        {
          data: {
            results: [{
              competencyPublicUuid,
              achievementLevel: 'En proceso',
              evidenceSummary: 'Debe rechazarse porque no está matriculado.',
            }],
          },
        },
      );
      expect(notEnrolledRes.status(), 'a student outside the section must be hidden from this evaluation').toBe(404);

      const wrongCourseRes = await teacherApi.put(
        `${ACADEMIC}/evaluations/${evaluationPublicUuid}/students/${student.publicUuid}/competency-results`,
        {
          data: {
            results: [{
              competencyPublicUuid: otherCourseCompetencyUuid,
              achievementLevel: 'En proceso',
              evidenceSummary: 'Debe rechazarse porque pertenece a otro curso.',
            }],
          },
        },
      );
      expect(wrongCourseRes.status(), 'a competency from another course must be rejected').toBe(409);

      const publishRes = await adminApi.post(`${ACADEMIC}/evaluations/${evaluationPublicUuid}/publish`);
      expect([200, 204]).toContain(publishRes.status());
      const closeRes = await adminApi.post(`${ACADEMIC}/evaluations/${evaluationPublicUuid}/close`);
      expect([200, 204]).toContain(closeRes.status());

      const closedWriteRes = await teacherApi.put(
        `${ACADEMIC}/evaluations/${evaluationPublicUuid}/students/${student.publicUuid}/competency-results`,
        {
          data: {
            results: [{
              competencyPublicUuid,
              achievementLevel: 'Logro esperado',
              evidenceSummary: 'No debe permitir cambios después del cierre.',
            }],
          },
        },
      );
      expect(closedWriteRes.status(), 'a closed evaluation must reject writes').toBe(409);

      await teacherPage.reload();
      await teacherPage.getByRole('button', { name: 'Evidencias' }).click();
      const closedDialog = teacherPage.getByRole('dialog');
      await closedDialog.getByLabel('Evaluación').selectOption(evaluationPublicUuid);
      await closedDialog.getByLabel('Estudiante').selectOption(student.publicUuid);
      await expect(closedDialog.getByText('La evaluación está cerrada. Puedes consultar los resultados, pero no modificarlos.')).toBeVisible();
      await expect(closedDialog.getByRole('button', { name: 'Guardar resultados' })).toBeDisabled();
    } finally {
      await teacherContext?.close().catch(() => undefined);
      if (evaluationPublicUuid) {
        await adminApi.delete(`${ACADEMIC}/evaluations/${evaluationPublicUuid}`).catch(() => undefined);
      }
      if (assignmentPublicUuid) {
        await adminApi.delete(`/api/v1/assignments/${assignmentPublicUuid}`).catch(() => undefined);
      }
      if (enrollmentPublicUuid) {
        await adminApi.post(`/api/v1/enrollments/${enrollmentPublicUuid}/withdraw`, {
          data: { status: 'WITHDRAWN', withdrawnAt: new Date().toISOString().slice(0, 10) },
        }).catch(() => undefined);
      }
      if (competencyPublicUuid) {
        await adminApi.delete(`${ACADEMIC}/competencies/${competencyPublicUuid}`).catch(() => undefined);
      }
      if (otherCourseCompetencyUuid) {
        await adminApi.delete(`${ACADEMIC}/competencies/${otherCourseCompetencyUuid}`).catch(() => undefined);
      }
      if (student) await student.cleanup().catch(() => undefined);
      if (unEnrolledStudent) await unEnrolledStudent.cleanup().catch(() => undefined);
      if (otherCourse) await otherCourse.cleanup().catch(() => undefined);
      if (period) await period.cleanup().catch(() => undefined);
      if (bundle) await bundle.cleanup().catch(() => undefined);
      await teacherApi.dispose();
      await adminApi.dispose();
    }
  });
});
