// client/src/types/global.d.ts
export {};

declare global {
  interface Window {
    // Contacts
    submitContactsForm?: () => void;
    cancelContactsForm?: () => void;

    // Notes
    submitNotesForm?: () => void;
    cancelNotesForm?: () => void;

    // Estimates
    submitEstimatesForm?: () => void;
    cancelEstimatesForm?: () => void;

    // Tasks
    submitTasksForm?: () => void;
    cancelTasksForm?: () => void;

    // Rails (MVP no-op, men finns i RailContext)
    submitRailsForm?: () => void;
    cancelRailsForm?: () => void;
  }
}
