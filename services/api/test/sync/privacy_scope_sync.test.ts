import { applySyncPolicy } from '../../src/modules/sync/sync.policy';

describe('privacy sync policy', () => {
  it('excludes local-only records from upload payload', () => {
    const payload = applySyncPolicy([
      { id: '1', scope: 'local_only' },
      { id: '2', scope: 'sync_allowed' },
    ]);
    expect(payload.map((x: { id: string }) => x.id)).toEqual(['2']);
  });
});
