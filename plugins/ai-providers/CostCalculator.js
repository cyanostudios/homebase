// plugins/ai-providers/CostCalculator.js
// Estimated cost from PROVIDER_CATALOG.pricing. Always estimated — never invoice truth.

const { getProviderCatalogEntry } = require('./providerCatalog');

/**
 * @param {{ providerKey: string, model: string, usage: { inputTokens?: number, outputTokens?: number, promptTokens?: number, completionTokens?: number } }} input
 * @returns {{ currency: string, inputCost: number, outputCost: number, totalCost: number, estimated: true, pricingSource: string } | null}
 */
function calculateCost({ providerKey, model, usage }) {
  const entry = getProviderCatalogEntry(providerKey);
  if (!entry?.models?.length || !usage) return null;

  const modelId = String(model ?? '').trim();
  const modelEntry = entry.models.find((m) => m.id === modelId) ?? null;
  const pricing = modelEntry?.pricing;
  if (!pricing) return null;

  const inputTokens = Number(usage.inputTokens ?? usage.promptTokens ?? 0) || 0;
  const outputTokens = Number(usage.outputTokens ?? usage.completionTokens ?? 0) || 0;
  const inputPer1M = Number(pricing.inputPer1M) || 0;
  const outputPer1M = Number(pricing.outputPer1M) || 0;
  const currency = String(pricing.currency || 'USD');
  const effectiveDate = String(pricing.effectiveDate || 'unknown');

  const inputCost = (inputTokens / 1_000_000) * inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * outputPer1M;
  const totalCost = inputCost + outputCost;

  return {
    currency,
    inputCost: roundCost(inputCost),
    outputCost: roundCost(outputCost),
    totalCost: roundCost(totalCost),
    estimated: true,
    pricingSource: `catalog@${effectiveDate}`,
  };
}

function roundCost(value) {
  return Math.round(value * 1e8) / 1e8;
}

module.exports = {
  calculateCost,
};
