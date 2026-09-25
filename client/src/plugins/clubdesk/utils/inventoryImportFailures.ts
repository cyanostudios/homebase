import type { ClubdeskInventoryItemPayload } from '../types/inventory';

export type InventoryImportFailureCounts = {
  missingArticle: number;
  emptyArticle: number;
  articleUnmapped: number;
  validation: number;
  duplicate: number;
  apiError: number;
  validationExamples: string[];
  duplicateExamples: string[];
  apiErrorExamples: string[];
};

export function createEmptyInventoryImportFailureCounts(): InventoryImportFailureCounts {
  return {
    missingArticle: 0,
    emptyArticle: 0,
    articleUnmapped: 0,
    validation: 0,
    duplicate: 0,
    apiError: 0,
    validationExamples: [],
    duplicateExamples: [],
    apiErrorExamples: [],
  };
}

function formatItemLabel(payload: ClubdeskInventoryItemPayload): string {
  const article = (payload.articleName ?? '').trim();
  const brand = (payload.brand ?? '').trim();
  return brand ? `${article} / ${brand}` : article;
}

function pushExample(examples: string[], label: string, max = 3): void {
  if (!label || examples.includes(label) || examples.length >= max) {
    return;
  }
  examples.push(label);
}

export function recordInventoryValidationFailure(
  counts: InventoryImportFailureCounts,
  payload: ClubdeskInventoryItemPayload,
): void {
  counts.validation += 1;
  pushExample(counts.validationExamples, formatItemLabel(payload));
}

export function recordInventoryDuplicateFailure(
  counts: InventoryImportFailureCounts,
  payload: ClubdeskInventoryItemPayload,
): void {
  counts.duplicate += 1;
  pushExample(counts.duplicateExamples, formatItemLabel(payload));
}

export function recordInventoryApiFailure(
  counts: InventoryImportFailureCounts,
  payload: ClubdeskInventoryItemPayload,
  message?: string,
): void {
  counts.apiError += 1;
  const label = message?.trim() || formatItemLabel(payload);
  pushExample(counts.apiErrorExamples, label);
}

type ImportFailureTranslator = (key: string, options?: Record<string, string | number>) => string;

export function buildInventoryImportFailureMessages(
  counts: InventoryImportFailureCounts,
  t: ImportFailureTranslator,
): string[] {
  const messages: string[] = [];

  if (counts.emptyArticle > 0) {
    messages.push(
      t('clubdesk.inventory.importFailureEmptyArticle', { count: counts.emptyArticle }),
    );
  }
  if (counts.articleUnmapped > 0) {
    messages.push(
      t('clubdesk.inventory.importFailureArticleUnmapped', { count: counts.articleUnmapped }),
    );
  }
  if (counts.missingArticle > 0) {
    messages.push(
      t('clubdesk.inventory.importFailureMissingArticle', { count: counts.missingArticle }),
    );
  }
  if (counts.validation > 0) {
    messages.push(
      counts.validationExamples.length > 0
        ? t('clubdesk.inventory.importFailureValidationExamples', {
            count: counts.validation,
            examples: counts.validationExamples.join(', '),
          })
        : t('clubdesk.inventory.importFailureValidation', { count: counts.validation }),
    );
  }
  if (counts.duplicate > 0) {
    messages.push(
      counts.duplicateExamples.length > 0
        ? t('clubdesk.inventory.importFailureDuplicateExamples', {
            count: counts.duplicate,
            examples: counts.duplicateExamples.join(', '),
          })
        : t('clubdesk.inventory.importFailureDuplicate', { count: counts.duplicate }),
    );
  }
  if (counts.apiError > 0) {
    messages.push(
      counts.apiErrorExamples.length > 0
        ? t('clubdesk.inventory.importFailureApiExamples', {
            count: counts.apiError,
            examples: counts.apiErrorExamples.join(', '),
          })
        : t('clubdesk.inventory.importFailureApi', { count: counts.apiError }),
    );
  }

  return messages;
}

export function inventoryImportFailureTotal(counts: InventoryImportFailureCounts): number {
  return (
    counts.missingArticle +
    counts.emptyArticle +
    counts.articleUnmapped +
    counts.validation +
    counts.duplicate +
    counts.apiError
  );
}
