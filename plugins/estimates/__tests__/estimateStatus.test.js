const { assertClientEstimateStatus, ESTIMATE_STATUSES } = require('../estimateStatus');
const { AppError } = require('../../../server/core/errors/AppError');

describe('estimateStatus', () => {
  test('allowlist includes invoiced', () => {
    expect(ESTIMATE_STATUSES).toContain('invoiced');
  });

  test('rejects manual invoiced status', () => {
    expect(() => assertClientEstimateStatus('invoiced')).toThrow(AppError);
    try {
      assertClientEstimateStatus('invoiced');
    } catch (err) {
      expect(err.statusCode).toBe(400);
      expect(err.message).toMatch(/convert-to-invoice/i);
    }
  });

  test('allows other client statuses', () => {
    expect(assertClientEstimateStatus('accepted')).toBe('accepted');
    expect(assertClientEstimateStatus('', 'draft')).toBe('draft');
  });
});
