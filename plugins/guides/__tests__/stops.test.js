// plugins/guides/__tests__/stops.test.js
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
const GuidesModel = require('../model');

describe('GuidesModel guide stops', () => {
  let model;

  beforeEach(() => {
    jest.clearAllMocks();
    model = new GuidesModel();
  });

  test('transformStopRow maps stop fields', () => {
    const result = model.transformStopRow(
      {
        id: 5,
        master_guide_id: 10,
        title: 'Entrance',
        sequence_order: 1,
        canonical_narrative: 'Welcome',
        editorial_status: 'draft',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
      '1',
      10,
    );

    expect(result).toEqual({
      id: '5',
      masterGuideId: '10',
      placeId: '1',
      title: 'Entrance',
      sequenceOrder: 1,
      canonicalNarrative: 'Welcome',
      editorialStatus: 'draft',
      approvalStatus: 'draft',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  test('createStop assigns next sequence order and inserts stop with default variants', async () => {
    const tx = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ next_order: 2 }])
        .mockResolvedValueOnce([
          {
            id: 5,
            master_guide_id: 10,
            title: 'Hall',
            sequence_order: 2,
            canonical_narrative: null,
            editorial_status: 'draft',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ])
        .mockResolvedValue([]),
    };

    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValueOnce([{ id: 10, source_language: 'sv' }]),
      transaction: jest.fn(async (callback) => callback(tx)),
    });

    const result = await model.createStop({}, '1', { title: 'Hall' });

    expect(tx.query.mock.calls[1][1]).toEqual([10, 'Hall', 2, null, 'draft', 'draft']);
    expect(tx.query).toHaveBeenCalledTimes(5);
    expect(result.title).toBe('Hall');
    expect(result.sequenceOrder).toBe(2);
    expect(result.placeId).toBe('1');
  });

  test('createStop requires title', async () => {
    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValueOnce([{ id: 10, source_language: 'sv' }]),
    });

    await expect(model.createStop({}, '1', { title: '   ' })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test('updateStop updates provided fields only', async () => {
    const existingStop = {
      id: '5',
      masterGuideId: '10',
      placeId: '1',
      title: 'Hall',
      sequenceOrder: 1,
      canonicalNarrative: null,
      editorialStatus: 'draft',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    jest.spyOn(model, 'getStopById').mockResolvedValue(existingStop);

    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValueOnce([
        {
          id: 5,
          master_guide_id: 10,
          title: 'Main Hall',
          sequence_order: 1,
          canonical_narrative: 'Updated narrative',
          editorial_status: 'in-progress',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
        },
      ]),
    });

    const result = await model.updateStop({}, '1', '5', {
      title: 'Main Hall',
      canonicalNarrative: 'Updated narrative',
      editorialStatus: 'in-progress',
    });

    expect(result.title).toBe('Main Hall');
    expect(result.canonicalNarrative).toBe('Updated narrative');
    expect(result.editorialStatus).toBe('in-progress');
  });

  test('reorderStops reassigns sequence order in two phases', async () => {
    Database.get.mockReturnValue({
      query: jest
        .fn()
        .mockResolvedValueOnce([{ id: 10, source_language: 'sv' }])
        .mockResolvedValueOnce([{ id: 5 }, { id: 6 }])
        .mockResolvedValueOnce([]),
      transaction: jest.fn(async (callback) => {
        const tx = { query: jest.fn().mockResolvedValue([]) };
        await callback(tx);
        return tx;
      }),
    });

    jest.spyOn(model, 'getStops').mockResolvedValue([]);

    await model.reorderStops({}, '1', ['6', '5']);

    const db = Database.get.mock.results[0].value;
    const tx = await db.transaction.mock.results[0].value;
    expect(tx.query).toHaveBeenCalledTimes(4);
    expect(tx.query.mock.calls[0][1]).toEqual([-1, '6', '1']);
    expect(tx.query.mock.calls[2][1]).toEqual([1, '6', '1']);
    expect(tx.query.mock.calls[3][1]).toEqual([2, '5', '1']);
  });

  test('reorderStops rejects unknown stop ids', async () => {
    Database.get.mockReturnValue({
      query: jest
        .fn()
        .mockResolvedValueOnce([{ id: 10, source_language: 'sv' }])
        .mockResolvedValueOnce([{ id: 5 }]),
    });

    await expect(model.reorderStops({}, '1', ['5', '99'])).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test('deleteStop returns not found when scoped delete misses', async () => {
    jest.spyOn(model, 'getStopById').mockResolvedValue({
      id: '5',
      masterGuideId: '10',
      placeId: '1',
      title: 'Hall',
      sequenceOrder: 1,
      canonicalNarrative: null,
      editorialStatus: 'draft',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValueOnce([]),
    });

    await expect(model.deleteStop({}, '1', '5')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
