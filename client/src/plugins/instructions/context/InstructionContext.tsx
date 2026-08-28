import React, { createContext, useContext } from 'react';

import type {
  Instruction,
  InstructionCategory,
  InstructionPayload,
  PublicationStatus,
  ValidationError,
} from '../types/instructions';

export type InstructionPanelMode = 'create' | 'edit' | 'view';
export type InstructionContentView = 'list' | 'settings';
/** No settings categories remain; list view prefs live on the list header. */
export type InstructionSettingsTab = '';

export interface InstructionContextType {
  isInstructionPanelOpen: boolean;
  currentInstruction: Instruction | null;
  panelMode: InstructionPanelMode;
  validationErrors: ValidationError[];
  instructions: Instruction[];
  categories: InstructionCategory[];
  refreshCategories: () => Promise<void>;
  createInstructionCategory: (name: string) => Promise<void>;
  reorderInstructionCategories: (orderedIds: string[]) => Promise<void>;
  deleteInstructionCategory: (
    categoryId: string,
    options?: { moveToCategory: string | null },
  ) => Promise<void>;
  isSaving: boolean;
  instructionsContentView: InstructionContentView;
  instructionsSettingsTab: InstructionSettingsTab;
  openInstructionSettings: (options?: { tab?: InstructionSettingsTab }) => void;
  closeInstructionSettingsView: () => void;
  openInstructionPanel: (instruction: Instruction | null) => void;
  openInstructionForEdit: (instruction: Instruction) => void;
  openInstructionForView: (instruction: Instruction) => void;
  closeInstructionPanel: () => void;
  saveInstruction: (data: InstructionPayload) => Promise<boolean>;
  deleteInstruction: (id: string) => Promise<void>;
  deleteInstructions: (ids: string[]) => Promise<void>;
  updateInstructionPublicationStatus: (
    instruction: Instruction,
    status: PublicationStatus,
  ) => Promise<void>;
  reorderInstructionSteps: (
    instruction: Instruction,
    fromIndex: number,
    direction: -1 | 1,
  ) => Promise<void>;
  copyInstructionStep: (instruction: Instruction, index: number) => Promise<void>;
  reorderInstructionsInCategory: (category: string | null, orderedIds: string[]) => Promise<void>;
  getDuplicateConfig: (
    item: Instruction | null,
  ) => { defaultName: string; nameLabel: string; confirmOnly: boolean } | null;
  executeDuplicate: (
    item: Instruction,
    newName: string,
  ) => Promise<{ closePanel: () => void; highlightId?: string }>;
  clearValidationErrors: () => void;
  selectedInstructionIds: string[];
  toggleInstructionSelected: (id: string) => void;
  selectAllInstructions: (ids: string[]) => void;
  mergeIntoInstructionSelection: (ids: string[]) => void;
  clearInstructionSelection: () => void;
  selectedCount: number;
  isSelected: (id: string) => boolean;
  getDeleteMessage: (item: Instruction | null) => string;
  recentlyDuplicatedInstructionId: string | null;
  setRecentlyDuplicatedInstructionId: (id: string | null) => void;
  navigateToPrevItem: () => void;
  navigateToNextItem: () => void;
  hasPrevItem: boolean;
  hasNextItem: boolean;
  currentItemIndex: number;
  totalItems: number;
  getPanelTitle: (mode?: string, item?: Instruction | null) => React.ReactNode;
}

const InstructionContext = createContext<InstructionContextType | undefined>(undefined);

export function useInstructionContext() {
  const context = useContext(InstructionContext);
  if (context === undefined) {
    throw new Error('useInstructionContext must be used within an InstructionProvider');
  }
  return context;
}

const EMPTY_INSTRUCTION_CONTEXT: InstructionContextType = {
  isInstructionPanelOpen: false,
  currentInstruction: null,
  panelMode: 'create',
  validationErrors: [],
  instructions: [],
  categories: [],
  refreshCategories: async () => {},
  createInstructionCategory: async () => {},
  reorderInstructionCategories: async () => {},
  deleteInstructionCategory: async () => {},
  isSaving: false,
  instructionsContentView: 'list',
  instructionsSettingsTab: '',
  openInstructionSettings: () => {},
  closeInstructionSettingsView: () => {},
  openInstructionPanel: () => {},
  openInstructionForEdit: () => {},
  openInstructionForView: () => {},
  closeInstructionPanel: () => {},
  saveInstruction: async () => false,
  deleteInstruction: async () => {},
  deleteInstructions: async () => {},
  updateInstructionPublicationStatus: async () => {},
  reorderInstructionSteps: async () => {},
  copyInstructionStep: async () => {},
  reorderInstructionsInCategory: async () => {},
  getDuplicateConfig: () => null,
  executeDuplicate: async () => ({ closePanel: () => {} }),
  clearValidationErrors: () => {},
  selectedInstructionIds: [],
  toggleInstructionSelected: () => {},
  selectAllInstructions: () => {},
  mergeIntoInstructionSelection: () => {},
  clearInstructionSelection: () => {},
  selectedCount: 0,
  isSelected: () => false,
  getDeleteMessage: () => '',
  recentlyDuplicatedInstructionId: null,
  setRecentlyDuplicatedInstructionId: () => {},
  navigateToPrevItem: () => {},
  navigateToNextItem: () => {},
  hasPrevItem: false,
  hasNextItem: false,
  currentItemIndex: 0,
  totalItems: 0,
  getPanelTitle: () => null,
};

export function InstructionNullProvider({ children }: { children: React.ReactNode }) {
  return (
    <InstructionContext.Provider value={EMPTY_INSTRUCTION_CONTEXT}>
      {children}
    </InstructionContext.Provider>
  );
}

export { InstructionContext };
