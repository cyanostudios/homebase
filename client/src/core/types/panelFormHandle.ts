export interface PanelFormHandle {
  submit: () => unknown | Promise<unknown>;
  cancel: () => void;
}
