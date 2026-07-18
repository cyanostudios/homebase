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

  test('updatePresentation rejects published without approved+fresh', async () => {
    jest.spyOn(model, 'getPresentationByLanguage').mockResolvedValue({
      id: '7',
      masterGuideId: '10',
      placeId: '1',
      language: 'sv',
      presentationText: 'Text',
      publicationStatus: 'draft',
      stalenessStatus: 'fresh',
      approvalStatus: 'draft',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await expect(
      model.updatePresentation({}, '1', 'sv', { publicationStatus: 'published' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'published requires approved content and fresh staleness',
    });
  });

  test('updatePresentation allows published when approved and fresh', async () => {
    jest.spyOn(model, 'getPresentationByLanguage').mockResolvedValue({
      id: '7',
      masterGuideId: '10',
      placeId: '1',
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
          master_guide_id: 10,
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

    const result = await model.updatePresentation({}, '1', 'sv', {
      publicationStatus: 'published',
    });
    expect(result.publicationStatus).toBe('published');
  });

  test('update place active requires publishable presentation', async () => {
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
