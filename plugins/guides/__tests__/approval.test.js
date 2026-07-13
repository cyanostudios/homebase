// plugins/guides/__tests__/approval.test.js
const { AppError } = require('../../../server/core/errors/AppError');

jest.mock('@homebase/core', () => ({
  Logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  Database: { get: jest.fn() },
}));

const { Database } = require('@homebase/core');
const GuidesModel = require('../model');

describe('GuidesModel approval workflow', () => {
  let model;

  beforeEach(() => {
    jest.clearAllMocks();
    model = new GuidesModel();
  });

  test('updateVariant rejects published without approved+fresh', async () => {
    jest.spyOn(model, 'getVariantById').mockResolvedValue({
      id: '7',
      stopId: '5',
      placeId: '1',
      variantType: 'normal',
      language: 'sv',
      presentationText: 'Text',
      publicationStatus: 'draft',
      stalenessStatus: 'fresh',
      approvalStatus: 'draft',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await expect(
      model.updateVariant({}, '1', '5', '7', { publicationStatus: 'published' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'published requires approved content and fresh staleness',
    });
  });

  test('updateVariant allows published when approved and fresh', async () => {
    jest.spyOn(model, 'getVariantById').mockResolvedValue({
      id: '7',
      stopId: '5',
      placeId: '1',
      variantType: 'normal',
      language: 'sv',
      presentationText: 'Text',
      publicationStatus: 'ready',
      stalenessStatus: 'fresh',
      approvalStatus: 'approved',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValueOnce([
        {
          id: 7,
          stop_id: 5,
          variant_type: 'normal',
          language: 'sv',
          presentation_text: 'Text',
          publication_status: 'published',
          staleness_status: 'fresh',
          approval_status: 'approved',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
        },
      ]),
    });

    const result = await model.updateVariant({}, '1', '5', '7', { publicationStatus: 'published' });
    expect(result.publicationStatus).toBe('published');
  });

  test('approveVariantContent sets approved', async () => {
    jest.spyOn(model, 'getVariantById').mockResolvedValue({ id: '7' });
    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValueOnce([
        {
          id: 7,
          stop_id: 5,
          variant_type: 'normal',
          language: 'sv',
          presentation_text: 'Text',
          publication_status: 'draft',
          staleness_status: 'fresh',
          approval_status: 'approved',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
        },
      ]),
    });

    const result = await model.approveVariantContent({}, '1', '5', '7');
    expect(result.approvalStatus).toBe('approved');
  });

  test('update place active requires publishable variant', async () => {
    jest.spyOn(model, 'getById').mockResolvedValue({
      id: '1',
      lifecycleStatus: 'draft',
    });

    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValueOnce([]),
    });

    await expect(
      model.update({}, '1', {
        displayName: 'Place',
        lifecycleStatus: 'active',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
