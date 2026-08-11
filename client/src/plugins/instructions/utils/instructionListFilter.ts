import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';

import type { PublicationStatus } from '../types/instructions';

/** Selectable filters (excluding "all", which clears the selection). */
export type InstructionListFilter = 'draft' | 'published';

/** Empty array = show all. Multiple filters are AND-combined. */
export type InstructionListFilterSelection = InstructionListFilter[];

const STATUS_FILTERS = ['draft', 'published'] as const satisfies readonly InstructionListFilter[];

export const INSTRUCTION_LIST_FILTER_EXCLUSIVE_GROUPS = [STATUS_FILTERS] as const;

export function instructionMatchesSingleFilter(
  item: { publicationStatus: PublicationStatus },
  filter: InstructionListFilter,
): boolean {
  return item.publicationStatus === filter;
}

/** AND across selected filters. Empty selection = all instructions. */
export function instructionMatchesListFilters(
  item: { publicationStatus: PublicationStatus },
  filters: InstructionListFilterSelection,
): boolean {
  return itemMatchesListFilters(item, filters, instructionMatchesSingleFilter);
}

export function toggleInstructionListFilter(
  current: InstructionListFilterSelection,
  filter: InstructionListFilter,
): InstructionListFilterSelection {
  return toggleListFilterSelection(current, filter, INSTRUCTION_LIST_FILTER_EXCLUSIVE_GROUPS);
}
