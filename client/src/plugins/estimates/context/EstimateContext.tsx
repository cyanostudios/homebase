import React, { createContext, useContext } from 'react';

import type { Estimate, EstimateShare, ValidationError } from '../types/estimate';

export interface EstimateContextType {
  isEstimatePanelOpen: boolean;
  currentEstimate: Estimate | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: ValidationError[];
  estimates: Estimate[];
  openEstimatePanel: (estimate: Estimate | null) => void;
  openEstimateForEdit: (estimate: Estimate) => void;
  openEstimateForView: (estimate: Estimate) => void;
  closeEstimatePanel: () => void;
  saveEstimate: (
    estimateData: any,
    estimateId?: string,
  ) => Promise<{ success: boolean; message?: string }>;
  deleteEstimate: (id: string) => Promise<void>;
  deleteEstimates: (ids: string[]) => Promise<void>;
  duplicateEstimate: (estimate: Estimate) => Promise<Estimate | null>;
  getDuplicateConfig: (
    item: Estimate | null,
  ) => { defaultName: string; nameLabel: string; confirmOnly: boolean } | null;
  executeDuplicate: (
    item: Estimate,
    newName: string,
  ) => Promise<{ closePanel: () => void; highlightId?: string }>;
  recentlyDuplicatedEstimateId: string | null;
  setRecentlyDuplicatedEstimateId: (id: string | null) => void;
  clearValidationErrors: () => void;
  selectedEstimateIds: string[];
  toggleEstimateSelected: (id: string) => void;
  selectAllEstimates: (ids: string[]) => void;
  mergeIntoEstimateSelection: (ids: string[]) => void;
  clearEstimateSelection: () => void;
  selectedCount: number;
  isSelected: (id: string) => boolean;
  getPanelTitle: (
    mode: string,
    item: Estimate | null,
    isMobileView: boolean,
    handleEstimateContactClick: (contactId: string) => void,
  ) => any;
  getPanelSubtitle: (mode: string, item: Estimate | null) => any;
  getDeleteMessage: (item: Estimate | null) => string;
  detailFooterActions: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: (item: Estimate) => void;
    className?: string;
    disabled?: boolean;
  }>;
  estimateShareExistingShare: EstimateShare | null;
  estimateShareShowDialog: boolean;
  setEstimateShareShowDialog: (show: boolean) => void;
  estimateShareShowExpiredModal: boolean;
  setEstimateShareShowExpiredModal: (show: boolean) => void;
  estimateShareIsDownloadingPdf: boolean;
  estimateShareIsCreatingShare: boolean;
  handleEstimateCopyShareUrl: () => void;
  handleEstimateRevokeShare: () => void;
  quickEditDraft: Partial<{ status: string }> | null;
  setQuickEditField: (field: 'status', value: string) => void;
  hasQuickEditChanges: boolean;
  onApplyQuickEdit: () => Promise<void>;
  showDiscardQuickEditDialog: boolean;
  setShowDiscardQuickEditDialog: (show: boolean) => void;
  getCloseHandler: (defaultClose: () => void) => () => void;
  onDiscardQuickEditAndClose: () => void;
  estimateQuickEditShowStatusModal: boolean;
  estimateQuickEditShowSentConfirmation: boolean;
  estimateQuickEditPendingStatus: 'accepted' | 'rejected' | null;
  handleEstimateQuickEditSentConfirm: () => void;
  handleEstimateQuickEditSentCancel: () => void;
  handleEstimateQuickEditModalConfirm: (reasons: string[]) => void;
  handleEstimateQuickEditModalCancel: () => void;
  navigateToPrevItem: () => void;
  navigateToNextItem: () => void;
  hasPrevItem: boolean;
  hasNextItem: boolean;
  currentItemIndex: number;
  totalItems: number;
  estimatesContentView: 'list' | 'settings';
  openEstimateSettings: () => void;
  closeEstimateSettingsView: () => void;
}

export const EstimateContext = createContext<EstimateContextType | undefined>(undefined);

export function useEstimateContext() {
  const context = useContext(EstimateContext);
  if (context === undefined) {
    throw new Error('useEstimateContext must be used within an EstimateProvider');
  }
  return context;
}

const EMPTY_ESTIMATE_CONTEXT: EstimateContextType = {
  isEstimatePanelOpen: false,
  currentEstimate: null,
  panelMode: 'create',
  validationErrors: [],
  estimates: [],
  openEstimatePanel: () => {},
  openEstimateForEdit: () => {},
  openEstimateForView: () => {},
  closeEstimatePanel: () => {},
  saveEstimate: async () => ({ success: false }),
  deleteEstimate: async () => {},
  deleteEstimates: async () => {},
  duplicateEstimate: async () => null,
  getDuplicateConfig: () => null,
  executeDuplicate: async () => ({ closePanel: () => {} }),
  recentlyDuplicatedEstimateId: null,
  setRecentlyDuplicatedEstimateId: () => {},
  clearValidationErrors: () => {},
  selectedEstimateIds: [],
  toggleEstimateSelected: () => {},
  selectAllEstimates: () => {},
  mergeIntoEstimateSelection: () => {},
  clearEstimateSelection: () => {},
  selectedCount: 0,
  isSelected: () => false,
  getPanelTitle: () => null,
  getPanelSubtitle: () => null,
  getDeleteMessage: () => '',
  detailFooterActions: [],
  estimateShareExistingShare: null,
  estimateShareShowDialog: false,
  setEstimateShareShowDialog: () => {},
  estimateShareShowExpiredModal: false,
  setEstimateShareShowExpiredModal: () => {},
  estimateShareIsDownloadingPdf: false,
  estimateShareIsCreatingShare: false,
  handleEstimateCopyShareUrl: () => {},
  handleEstimateRevokeShare: () => {},
  quickEditDraft: null,
  setQuickEditField: () => {},
  hasQuickEditChanges: false,
  onApplyQuickEdit: async () => {},
  showDiscardQuickEditDialog: false,
  setShowDiscardQuickEditDialog: () => {},
  getCloseHandler: (fn) => fn,
  onDiscardQuickEditAndClose: () => {},
  estimateQuickEditShowStatusModal: false,
  estimateQuickEditShowSentConfirmation: false,
  estimateQuickEditPendingStatus: null,
  handleEstimateQuickEditSentConfirm: () => {},
  handleEstimateQuickEditSentCancel: () => {},
  handleEstimateQuickEditModalConfirm: () => {},
  handleEstimateQuickEditModalCancel: () => {},
  navigateToPrevItem: () => {},
  navigateToNextItem: () => {},
  hasPrevItem: false,
  hasNextItem: false,
  currentItemIndex: 0,
  totalItems: 0,
  estimatesContentView: 'list',
  openEstimateSettings: () => {},
  closeEstimateSettingsView: () => {},
};

export function EstimateNullProvider({ children }: { children: React.ReactNode }) {
  return (
    <EstimateContext.Provider value={EMPTY_ESTIMATE_CONTEXT}>{children}</EstimateContext.Provider>
  );
}
