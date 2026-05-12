import { AvatarConfigContractService } from '../../src/modules/sync/avatar_config_contract.service';

describe('avatar config contract', () => {
  it('returns syncable config summary and current version', () => {
    const service = new AvatarConfigContractService();
    const summary = service.getSyncSummary();

    expect(summary).toMatchObject({
      currentVersion: 'v1',
      supportedMinVersion: 'v1',
      promptKeys: ['healer', 'coach', 'strategist'],
    });
  });

  it('checks version compatibility with explicit result', () => {
    const service = new AvatarConfigContractService();

    expect(service.checkCompatibility('v1')).toEqual({
      compatible: true,
      recommendedVersion: 'v1',
    });
    expect(service.checkCompatibility('v0')).toEqual({
      compatible: false,
      recommendedVersion: 'v1',
    });
  });
});
