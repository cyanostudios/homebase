// client/src/types/global.d.ts
// Window globals are registered by each *Form component (create/edit) and by *SettingsForm
// components (settings mode). They are called by panelHandlers.ts handleSaveClick /
// handleCancelClick which are triggered by the panel header Save/Cancel buttons.
export {};

declare global {
  interface Window {
    // create/edit forms – registered by the active *Form component
    submitNotesForm?: () => void;
    cancelNotesForm?: () => void;
    submitNoteForm?: () => void;
    cancelNoteForm?: () => void;
    submitTasksForm?: () => void;
    cancelTasksForm?: () => void;
    submitTaskForm?: () => void;
    cancelTaskForm?: () => void;
    submitContactsForm?: () => void;
    cancelContactsForm?: () => void;
    submitContactForm?: () => void;
    cancelContactForm?: () => void;
    submitSlotsForm?: () => void;
    cancelSlotsForm?: () => void;
    submitSlotForm?: () => void;
    cancelSlotForm?: () => void;
    submitMatchesForm?: () => void;
    cancelMatchesForm?: () => void;
    submitMatchForm?: () => void;
    cancelMatchForm?: () => void;
    submitEstimatesForm?: () => void;
    cancelEstimatesForm?: () => void;
    submitEstimateForm?: () => void;
    cancelEstimateForm?: () => void;
    submitInvoicesForm?: () => void;
    cancelInvoicesForm?: () => void;
    submitInvoiceForm?: () => void;
    cancelInvoiceForm?: () => void;
    submitFilesForm?: () => void;
    cancelFilesForm?: () => void;
    submitFileForm?: () => void;
    cancelFileForm?: () => void;
    submitMailForm?: () => void;
    cancelMailForm?: () => void;
    // Settings plugin itself
    submitSettingsForm?: () => void;
    cancelSettingsForm?: () => void;
    // Pulses plugin (not yet migrated)
    submitPulsesForm?: () => void;
    cancelPulsesForm?: () => void;
    submitPulseForm?: () => void;
    cancelPulseForm?: () => void;
    submitIngestForm?: () => void;
    cancelIngestForm?: () => void;
  }
}
