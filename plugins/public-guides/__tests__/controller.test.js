// plugins/public-guides/__tests__/controller.test.js
jest.mock('@homebase/core', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const PublicGuidesController = require('../controller');

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
    },
  };
  return res;
}

describe('PublicGuidesController', () => {
  test('getPresentations returns presentations payload', async () => {
    const model = {
      parsePositiveInt: jest.fn((v) => Number(v)),
      parseOptionalLanguageQuery: jest.fn(() => null),
      listPresentations: jest
        .fn()
        .mockResolvedValue([{ id: '1', language: 'sv', presentationText: 'Hej' }]),
    };
    const controller = new PublicGuidesController(model);
    const req = {
      publicGuidesPool: {},
      publicGuidesOwnerUserId: 42,
      params: { placeId: '7' },
      query: {},
    };
    const res = mockRes();

    await controller.getPresentations(req, res);

    expect(model.listPresentations).toHaveBeenCalledWith({}, 42, 7, null);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      presentations: [{ id: '1', language: 'sv', presentationText: 'Hej' }],
    });
  });

  test('getPresentations returns 404 when place is not public', async () => {
    const model = {
      parsePositiveInt: jest.fn((v) => Number(v)),
      parseOptionalLanguageQuery: jest.fn(() => 'en'),
      listPresentations: jest.fn().mockResolvedValue(null),
    };
    const controller = new PublicGuidesController(model);
    const req = {
      publicGuidesPool: {},
      publicGuidesOwnerUserId: 42,
      params: { placeId: '7' },
      query: { language: 'en' },
    };
    const res = mockRes();

    await controller.getPresentations(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Guide not found' });
  });
});
