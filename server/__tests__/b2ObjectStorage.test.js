jest.mock('@homebase/core', () => ({
  Logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const {
  B2ObjectStorage,
  objectKeyFromB2FileUrl,
  normalizeB2PublicBaseUrl,
  normalizeProductIdForStorageKey,
} = require('../core/services/storage/b2ObjectStorage');

const b2Opts = {
  driver: 'b2',
  bucket: 'homebase-media-01',
  endpoint: 'https://s3.eu-central-003.backblazeb2.com',
  region: 'eu-central-003',
  accessKeyId: 'test-key-id',
  secretAccessKey: 'test-secret',
};

describe('normalizeB2PublicBaseUrl', () => {
  it('keeps custom domain root base without injecting /file/{bucket}', () => {
    expect(normalizeB2PublicBaseUrl('https://media.syncer.se', 'homebase-media-01')).toBe(
      'https://media.syncer.se',
    );
    expect(normalizeB2PublicBaseUrl('https://media.syncer.se/', 'homebase-media-01')).toBe(
      'https://media.syncer.se',
    );
  });

  it('normalizes Friendly URL base so bucket segment matches B2_BUCKET', () => {
    expect(
      normalizeB2PublicBaseUrl(
        'https://f004.backblazeb2.com/file/wrong-bucket',
        'homebase-media-01',
      ),
    ).toBe('https://f004.backblazeb2.com/file/homebase-media-01');
  });
});

describe('objectKeyFromB2FileUrl', () => {
  it('extracts key after /file/{bucket}/ (strict bucket)', () => {
    expect(
      objectKeyFromB2FileUrl(
        'https://f004.backblazeb2.com/file/homebase-media-01/tenants/1/products/x.jpg',
        'homebase-media-01',
      ),
    ).toBe('tenants/1/products/x.jpg');
  });

  it('extracts key from Friendly URL when configured bucket differs but path has /file/<name>/', () => {
    expect(
      objectKeyFromB2FileUrl(
        'https://f003.backblazeb2.com/file/other-bucket/1/products/z.jpg',
        'homebase-media-01',
      ),
    ).toBe('1/products/z.jpg');
  });

  it('extracts object key from custom domain root-path URL', () => {
    expect(
      objectKeyFromB2FileUrl(
        'https://media.syncer.se/1/products/58324746/original/0_asset_hash.jpg',
        'homebase-media-01',
      ),
    ).toBe('1/products/58324746/original/0_asset_hash.jpg');
  });

  it('returns null for bare origin without path', () => {
    expect(objectKeyFromB2FileUrl('https://media.syncer.se/', 'homebase-media-01')).toBe(null);
  });
});

describe('normalizeProductIdForStorageKey', () => {
  it('strips sello- prefix case-insensitively', () => {
    expect(normalizeProductIdForStorageKey('sello-58324746')).toBe('58324746');
    expect(normalizeProductIdForStorageKey('SELLO-99')).toBe('99');
    expect(normalizeProductIdForStorageKey('58324746')).toBe('58324746');
  });
});

describe('B2ObjectStorage keys and public URLs', () => {
  it('builds root-path public URLs for custom domain base', () => {
    const storage = new B2ObjectStorage({
      ...b2Opts,
      publicBaseUrl: 'https://media.syncer.se',
    });
    expect(storage.publicBaseUrl).toBe('https://media.syncer.se');
    expect(storage.getPublicUrl('1/products/5/original/0_a_h.jpg')).toBe(
      'https://media.syncer.se/1/products/5/original/0_a_h.jpg',
    );
  });

  it('buildAssetVariantKey uses tenant/products layout without tenants/ prefix and strips sello-', () => {
    const storage = new B2ObjectStorage({
      ...b2Opts,
      publicBaseUrl: 'https://media.syncer.se',
    });
    expect(
      storage.buildAssetVariantKey({
        tenantId: 1,
        productId: 'sello-58324746',
        assetId: 'e5a443b5-db44-4349-b68e-34a7787f6597',
        position: 0,
        variant: 'original',
        hash: '330d732626764a4f93b3df4acbe55fbe1f72fc288a328730eb6edd565c4a2744',
        extension: 'jpg',
      }),
    ).toBe(
      '1/products/58324746/original/0_e5a443b5-db44-4349-b68e-34a7787f6597_330d732626764a4f93b3df4acbe55fbe1f72fc288a328730eb6edd565c4a2744.jpg',
    );
  });

  it('buildAssetVariantKey uses pending scope when productId is absent', () => {
    const storage = new B2ObjectStorage({
      ...b2Opts,
      publicBaseUrl: 'https://media.syncer.se',
    });
    const key = storage.buildAssetVariantKey({
      tenantId: 2,
      productId: null,
      pendingScope: 'manual/user-1',
      assetId: 'aid',
      position: 0,
      variant: 'preview',
      hash: 'abc',
      extension: 'webp',
    });
    expect(key).toBe('2/products/manual-user-1/preview/0_aid_abc.webp');
  });

  it('buildAssetVariantKey pending path strips sello- after slash-to-dash (Sello import before product row)', () => {
    const storage = new B2ObjectStorage({
      ...b2Opts,
      publicBaseUrl: 'https://media.syncer.se',
    });
    const key = storage.buildAssetVariantKey({
      tenantId: 1,
      productId: null,
      pendingScope: 'sello/70503461',
      assetId: 'f566aae7-c9d1-4388-a3c3-85ff832689ba',
      position: 0,
      variant: 'original',
      hash: '0281acc8cfe209a1e2849597aab4a1e8f74ae46b78243bd791250a5cc175db4e',
      extension: 'jpg',
    });
    expect(key).toBe(
      '1/products/70503461/original/0_f566aae7-c9d1-4388-a3c3-85ff832689ba_0281acc8cfe209a1e2849597aab4a1e8f74ae46b78243bd791250a5cc175db4e.jpg',
    );
  });
});
