import { clampPaymentTermsDaysInput, isPresetPaymentTerms } from '../PaymentTermsField';

describe('PaymentTermsField helpers', () => {
  it('recognizes preset day values', () => {
    expect(isPresetPaymentTerms('0')).toBe(true);
    expect(isPresetPaymentTerms('15')).toBe(true);
    expect(isPresetPaymentTerms('30')).toBe(true);
    expect(isPresetPaymentTerms('60')).toBe(true);
    expect(isPresetPaymentTerms('14')).toBe(false);
    expect(isPresetPaymentTerms('45')).toBe(false);
  });

  it('clamps custom day input to digits within range', () => {
    expect(clampPaymentTermsDaysInput('14')).toBe('14');
    expect(clampPaymentTermsDaysInput('20 dagar')).toBe('20');
    expect(clampPaymentTermsDaysInput('')).toBe('0');
    expect(clampPaymentTermsDaysInput('99999')).toBe('3650');
  });
});
