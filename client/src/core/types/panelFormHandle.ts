export interface PanelFormHandle {
  submit: () => unknown | Promise<unknown>;
  cancel: () => void;
  /** Optional plugin-specific action (e.g. invoice preview). */
  preview?: () => void;
}
