// plugins/guides/__tests__/presentations.test.js
jest.mock('@homebase/core', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  Database: {
    get: jest.fn(),
  },
}));

const { Database } = require('@homebase/core');
const { AppError } = require('../../../server/core/errors/AppError');
const GuidesModel = require('../model');

describe('GuidesModel guide presentations', () => {
  let model;

  beforeEach(() => {
    jest.clearAllMocks();
    model = new GuidesModel();
  });

  test('transformPresentationRow maps presentation fields', () => {
    const result = model.transformPresentationRow(
      {
        id: 7,
        master_guide_id: 10,
        language: 'sv',
        presentation_text: 'Welcome',
        publication_status: 'draft',
        staleness_status: 'fresh',
        approval_status: 'draft',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
      '1',
      10,
    );

    expect(result).toEqual({
      id: '7',
      masterGuideId: '10',
      placeId: '1',
      language: 'sv',
      presentationText: 'Welcome',
      publicationStatus: 'draft',
      stalenessStatus: 'fresh',
      approvalStatus: 'draft',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  test('create inserts default source-language presentation', async () => {
    const tx = {
      query: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 1,
            user_id: 7,
            display_name: 'Museum',
            short_intro: null,
            geographic_reference: null,
            lifecycle_status: 'draft',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 10,
            place_id: 1,
            source_language: 'sv',
            editorial_status: 'draft',
          },
        ])
        .mockResolvedValueOnce([]),
    };

    Database.get.mockReturnValue({
      getUserId: jest.fn().mockReturnValue(7),
      transaction: jest.fn(async (callback) => callback(tx)),
    });

    await model.create({}, { displayName: 'Museum', sourceLanguage: 'sv' });

    expect(tx.query).toHaveBeenCalledTimes(3);
    expect(tx.query.mock.calls[2][0]).toContain('INSERT INTO guide_presentations');
    expect(tx.query.mock.calls[2][1]).toEqual([10, 'sv', 'draft', 'fresh', 'draft']);
  });

  test('getPresentations lists by place', async () => {
    jest
      .spyOn(model, '_getMasterGuideForPlace')
      .mockResolvedValue({ id: 10, sourceLanguage: 'sv' });
    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValueOnce([
        {
          id: 7,
          master_guide_id: 10,
          language: 'sv',
          presentation_text: null,
          publication_status: 'draft',
          staleness_status: 'fresh',
          approval_status: 'draft',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ]),
    });

    const result = await model.getPresentations({}, '1');
    expect(result).toHaveLength(1);
    expect(result[0].language).toBe('sv');
  });

  test('ensureSourceLanguagePresentation creates missing row', async () => {
    jest
      .spyOn(model, '_getMasterGuideForPlace')
      .mockResolvedValue({ id: 10, sourceLanguage: 'sv' });
    jest
      .spyOn(model, 'getPresentationByLanguage')
      .mockRejectedValueOnce(new AppError('Presentation not found', 404, AppError.CODES.NOT_FOUND));

    const query = jest.fn().mockResolvedValueOnce([
      {
        id: 7,
        master_guide_id: 10,
        language: 'sv',
        presentation_text: null,
        publication_status: 'draft',
        staleness_status: 'fresh',
        approval_status: 'draft',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    Database.get.mockReturnValue({ query });

    const result = await model.ensureSourceLanguagePresentation({}, '1');
    expect(result.id).toBe('7');
    expect(query.mock.calls[0][0]).toContain('INSERT INTO guide_presentations');
  });

  test('applyProductionPresentationText sets pending_review', async () => {
    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValueOnce([
        {
          id: 20,
          master_guide_id: 10,
          language: 'sv',
          presentation_text: 'Generated text',
          publication_status: 'draft',
          staleness_status: 'fresh',
          approval_status: 'pending_review',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
        },
      ]),
    });

    const result = await model.applyProductionPresentationText({}, '1', '20', 'Generated text');
    expect(result.approvalStatus).toBe('pending_review');
    expect(result.presentationText).toBe('Generated text');
  });
});
