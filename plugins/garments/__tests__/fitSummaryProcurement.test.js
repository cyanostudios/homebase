// plugins/garments/__tests__/fitSummaryProcurement.test.js
const { normalizeFitSummaryProcurement, mergeFitSummaryProcurementPatch } = require('../model');
const { AppError } = require('../../../server/core/errors/AppError');

describe('fitSummaryProcurement normalize + merge', () => {
  it('normalizes stored procurement map', () => {
    const key = `Men\u001fL`;
    const out = normalizeFitSummaryProcurement({
      3: { [key]: { ordered: true, qtyOrdered: 5 } },
      bad: { x: { ordered: true } },
    });
    expect(out).toEqual({
      3: { [key]: { ordered: true, qtyOrdered: 5 } },
    });
  });

  it('merges patch for assigned items and clears qty with null', () => {
    const key = `Women\u001fM`;
    const assigned = new Set(['3']);
    const merged = mergeFitSummaryProcurementPatch(
      { 3: { [key]: { ordered: false, qtyOrdered: 2 } } },
      { 3: { [key]: { ordered: true, qtyOrdered: null } } },
      assigned,
    );
    expect(merged['3'][key]).toEqual({ ordered: true, qtyOrdered: null });
  });

  it('rejects unassigned item ids', () => {
    expect(() =>
      mergeFitSummaryProcurementPatch({}, { 99: { x: { ordered: true } } }, new Set(['3'])),
    ).toThrow(AppError);
  });

  it('persists unit-separator keys in JSON without null bytes', () => {
    const key = `Men\u001fL`;
    const out = normalizeFitSummaryProcurement({
      1: { [key]: { ordered: true, qtyOrdered: 7 } },
    });
    const json = JSON.stringify(out);
    expect(json).not.toMatch(/\\u0000/);
    expect(json).toContain('\\u001f');
    expect(JSON.parse(json)).toEqual(out);
  });
});
