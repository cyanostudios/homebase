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

const fs = require('fs');
const path = require('path');
const TeamModel = require('../model');
const { AppError } = require('../../../server/core/errors/AppError');
const { Database } = require('@homebase/core');

describe('team venues CRUD', () => {
  let model;

  beforeEach(() => {
    jest.clearAllMocks();
    model = new TeamModel();
  });

  test('transformVenueRow maps camelCase mapLink and string id', () => {
    expect(
      model.transformVenueRow({
        id: 4,
        name: 'Hall A',
        map_link: 'https://maps.example/hall-a',
        created_at: 'a',
        updated_at: 'b',
      }),
    ).toEqual({
      id: '4',
      name: 'Hall A',
      mapLink: 'https://maps.example/hall-a',
      created_at: 'a',
      updated_at: 'b',
    });
  });

  test('listVenues orders by lower(name), id', async () => {
    const query = jest.fn(async () => [
      {
        id: 2,
        name: 'Beta',
        map_link: null,
        created_at: 'a',
        updated_at: 'b',
      },
    ]);
    Database.get.mockReturnValue({ query, getUserId: () => 7 });

    const rows = await model.listVenues({});
    expect(rows).toEqual([
      { id: '2', name: 'Beta', mapLink: null, created_at: 'a', updated_at: 'b' },
    ]);
    expect(query.mock.calls[0][0]).toMatch(/ORDER BY lower\(name\) ASC, id ASC/i);
  });

  test('createVenue inserts name and optional mapLink without HTML-escaping the URL', async () => {
    const insert = jest.fn(async (_table, data) => ({
      id: 1,
      name: data.name,
      map_link: data.map_link,
      created_at: 'a',
      updated_at: 'b',
    }));
    const query = jest.fn(async (sql) => {
      if (/COUNT\(\*\)/i.test(sql)) return [{ c: 0 }];
      return [];
    });
    Database.get.mockReturnValue({
      getUserId: () => 7,
      query,
      insert,
    });

    const created = await model.createVenue(
      {},
      { name: '  Hall A  ', mapLink: 'https://maps.example/a?q=1&b=2' },
    );
    expect(insert).toHaveBeenCalledWith('team_venues', {
      name: 'Hall A',
      map_link: 'https://maps.example/a?q=1&b=2',
    });
    expect(created.mapLink).toBe('https://maps.example/a?q=1&b=2');
    expect(created.mapLink).not.toMatch(/&amp;/);
  });

  test('createVenue stores empty mapLink as null', async () => {
    const insert = jest.fn(async (_table, data) => ({
      id: 1,
      name: data.name,
      map_link: data.map_link,
      created_at: 'a',
      updated_at: 'b',
    }));
    Database.get.mockReturnValue({
      getUserId: () => 7,
      query: jest.fn(async (sql) => {
        if (/COUNT\(\*\)/i.test(sql)) return [{ c: 2 }];
        return [];
      }),
      insert,
    });

    const created = await model.createVenue({}, { name: 'Pitch', mapLink: '   ' });
    expect(insert.mock.calls[0][1].map_link).toBeNull();
    expect(created.mapLink).toBeNull();
  });

  test('createVenue returns 409 when name is unique-conflict (case-insensitive)', async () => {
    Database.get.mockReturnValue({
      getUserId: () => 7,
      query: jest.fn(async (sql) => {
        if (/COUNT\(\*\)/i.test(sql)) return [{ c: 1 }];
        return [{ id: 9 }];
      }),
      insert: jest.fn(),
    });

    await expect(model.createVenue({}, { name: 'Hall A' })).rejects.toMatchObject({
      statusCode: 409,
      code: AppError.CODES.CONFLICT,
      details: [{ field: 'name', message: 'Venue name already exists' }],
    });
    expect(Database.get().insert).not.toHaveBeenCalled();
  });

  test('createVenue returns 400 when tenant already has 100 venues', async () => {
    const insert = jest.fn();
    Database.get.mockReturnValue({
      getUserId: () => 7,
      query: jest.fn(async (sql) => {
        if (/COUNT\(\*\)/i.test(sql)) return [{ c: 100 }];
        return [];
      }),
      insert,
    });

    await expect(model.createVenue({}, { name: 'Overflow' })).rejects.toMatchObject({
      statusCode: 400,
      code: AppError.CODES.VALIDATION_ERROR,
    });
    expect(insert).not.toHaveBeenCalled();
  });

  test('updateVenue returns 409 when renaming onto an existing name', async () => {
    Database.get.mockReturnValue({
      getUserId: () => 7,
      query: jest.fn(async () => [{ id: 2 }]),
      update: jest.fn(),
    });

    await expect(model.updateVenue({}, 1, { name: 'Hall B' })).rejects.toMatchObject({
      statusCode: 409,
      code: AppError.CODES.CONFLICT,
    });
    expect(Database.get().update).not.toHaveBeenCalled();
  });

  test('deleteVenue deletes the catalog row only (no cascade SQL)', async () => {
    const deleteRecord = jest.fn(async () => ({ id: 3 }));
    const query = jest.fn();
    Database.get.mockReturnValue({
      getUserId: () => 7,
      deleteRecord,
      query,
    });

    await expect(model.deleteVenue({}, 3)).resolves.toEqual({ id: '3' });
    expect(deleteRecord).toHaveBeenCalledWith('team_venues', 3);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('team venue route order', () => {
  const routesSrc = fs.readFileSync(path.join(__dirname, '../routes.js'), 'utf8');

  test('GET /venues is registered before GET /:id so venues is not captured as an id', () => {
    const venuesIdx = routesSrc.indexOf("router.get('/venues'");
    const byIdIdx = routesSrc.indexOf("router.get('/:id'");
    expect(venuesIdx).toBeGreaterThan(-1);
    expect(byIdIdx).toBeGreaterThan(-1);
    expect(venuesIdx).toBeLessThan(byIdIdx);
  });

  test('venue mutations use optionalUrl mapLink and CSRF', () => {
    expect(routesSrc).toMatch(/optionalUrl\('mapLink',\s*2000\)/);
    expect(routesSrc).toMatch(/router\.post\(\s*'\s*\/venues'/);
    expect(routesSrc).toMatch(/router\.put\(\s*'\s*\/venues\/:id'/);
    expect(routesSrc).toMatch(/router\.delete\(\s*'\s*\/venues\/:id'/);
  });
});
