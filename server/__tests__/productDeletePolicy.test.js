jest.mock('@homebase/core', () => ({
  Context: { getUserId: jest.fn(() => 'user-1') },
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  Database: { get: jest.fn() },
}));

const ProductController = require('../../plugins/products/controller');
const { AppError } = require('../../server/core/errors/AppError');

function createRes() {
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

describe('product delete policy', () => {
  it('keeps bulk delete partial when media delete or db delete fails', async () => {
    const controller = Object.create(ProductController.prototype);
    controller.productMediaService = {
      deleteProductsMediaStrictPartial: jest.fn().mockResolvedValue({
        okIds: ['1', '2'],
        failed: [
          {
            productId: '3',
            code: 'PRODUCT_MEDIA_DELETE_FAILED',
            message: 'Failed to delete product media from B2',
            details: { productId: '3' },
          },
        ],
      }),
    };
    controller.model = {
      delete: jest
        .fn()
        .mockResolvedValueOnce({ id: '1' })
        .mockRejectedValueOnce(new AppError('Product not found', 404, AppError.CODES.NOT_FOUND)),
    };

    const req = {
      body: { ids: ['1', '2', '3'] },
      session: { tenantId: 7 },
    };
    const res = createRes();

    await controller.bulkDelete(req, res);

    expect(controller.productMediaService.deleteProductsMediaStrictPartial).toHaveBeenCalledWith(
      req,
      ['1', '2', '3'],
    );
    expect(controller.model.delete).toHaveBeenCalledTimes(2);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      ok: false,
      partial: true,
      requested: 3,
      deleted: 1,
      deletedIds: ['1'],
      failedCount: 2,
      failed: [
        {
          productId: '3',
          code: 'PRODUCT_MEDIA_DELETE_FAILED',
          message: 'Failed to delete product media from B2',
          details: { productId: '3' },
        },
        {
          productId: '2',
          code: 'NOT_FOUND',
          message: 'Product not found',
          details: null,
        },
      ],
    });
  });
});
