jest.mock('@homebase/core', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  Context: {
    getUserId: jest.fn(() => 1),
    hasPluginAccess: jest.fn(() => true),
  },
}));

const { Context } = require('@homebase/core');
const RequestController = require('../controller');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('RequestController.markViewed', () => {
  it('returns the updated request with firstViewedAt set', async () => {
    const viewedAt = '2026-08-24T12:00:00.000Z';
    const markViewed = jest.fn().mockResolvedValue({
      id: '7',
      title: 'New kit request',
      firstViewedAt: viewedAt,
    });
    const controller = new RequestController({ markViewed });
    const req = { params: { id: '7' } };
    const res = mockRes();

    await controller.markViewed(req, res);

    expect(markViewed).toHaveBeenCalledWith(req, '7');
    expect(res.statusCode).toBe(200);
    expect(res.body.firstViewedAt).toBe(viewedAt);
  });

  it('maps AppError to HTTP status', async () => {
    const { AppError } = require('../../../server/core/errors/AppError');
    const markViewed = jest
      .fn()
      .mockRejectedValue(new AppError('Request not found', 404, AppError.CODES.NOT_FOUND));
    const controller = new RequestController({ markViewed });
    const req = { params: { id: '999' } };
    const res = mockRes();

    await controller.markViewed(req, res);

    expect(res.statusCode).toBe(404);
    expect(Context.getUserId).toHaveBeenCalled();
  });
});
