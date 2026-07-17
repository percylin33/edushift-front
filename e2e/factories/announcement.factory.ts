import { APIRequestContext } from '@playwright/test';
import { CreatedEntity, seqId } from './_shared';

/**
 * Factory: create + publish an announcement.
 *
 * <p>Used by notifications + RBAC specs that need a published
 * announcement in the bell feed. The publish step is required —
 * announcements stay in {@code DRAFT} until {@code POST /publish}
 * is called.</p>
 */
export async function makeAnnouncement(
  api: APIRequestContext,
  overrides: {
    title?: string;
    bodyHtml?: string;
    audienceType?: 'SCHOOL' | 'COURSE' | 'SECTION' | 'ROLE';
    pinned?: boolean;
    publish?: boolean;
  } = {},
): Promise<CreatedEntity> {
  const id = seqId('ann');
  const payload = {
    title: overrides.title ?? `Announcement ${id}`,
    bodyHtml: overrides.bodyHtml ?? `<p>auto ${id}</p>`,
    audienceType: overrides.audienceType ?? 'SCHOOL',
    pinned: overrides.pinned ?? false,
  };
  const createRes = await api.post('/api/v1/announcements', { data: payload });
  if (!createRes.ok()) {
    throw new Error(`makeAnnouncement create failed: ${createRes.status()} ${await createRes.text()}`);
  }
  const body = await createRes.json();
  const publicUuid: string = body.data.publicUuid;

  if (overrides.publish !== false) {
    const pubRes = await api.post(`/api/v1/announcements/${publicUuid}/publish`);
    if (!pubRes.ok()) {
      throw new Error(`makeAnnouncement publish failed: ${pubRes.status()} ${await pubRes.text()}`);
    }
  }

  return {
    publicUuid,
    payload,
    cleanup: async () => {
      await api.delete(`/api/v1/announcements/${publicUuid}`);
    },
  };
}
