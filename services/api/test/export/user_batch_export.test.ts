import request from 'supertest';
import { app } from '../../src/index';
import { userDataStore } from '../../src/modules/export/user_data.store';

describe('user batch export', () => {
  beforeEach(() => {
    userDataStore.reset();
  });

  it('POST /export/batch returns 400 when userId is missing', async () => {
    const res = await request(app).post('/export/batch').send({});
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it('POST /export/batch returns export package with all sections', async () => {
    userDataStore.seed('u-demo', {
      daily_entries: [{ id: 'd1', date: '2026-05-01' }],
      advisor_memory: [{ text: 'prefers morning routine', scope: 'sync_allowed' }],
    });

    const res = await request(app).post('/export/batch').send({ userId: 'u-demo' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      schemaVersion: '1.0',
      userId: 'u-demo',
      exportedAt: expect.any(String),
      sections: expect.any(Object),
      meta: {
        recordCounts: expect.any(Object),
      },
    });
    expect(res.body.sections.daily_entries).toHaveLength(1);
    expect(res.body.sections.manifestos).toEqual([]);
    expect(res.body.meta.recordCounts.daily_entries).toBe(1);
    expect(res.body.meta.recordCounts.manifestos).toBe(0);
  });

  it('includes all required table keys even when user has no data', async () => {
    const res = await request(app).post('/export/batch').send({ userId: 'u-empty' });

    expect(res.status).toBe(200);
    const keys = Object.keys(res.body.sections).sort();
    expect(keys).toEqual(
      [
        'advisor_memory',
        'avatar_energy_state',
        'avatar_growth_state',
        'avatar_profile',
        'avatar_unlocks',
        'challenges',
        'daily_entries',
        'manifestos',
        'monthly_reviews',
      ].sort(),
    );
  });
});
