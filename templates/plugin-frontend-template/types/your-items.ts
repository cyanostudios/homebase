export type PanelMode = 'create' | 'edit' | 'view';

export interface ValidationError {
  field: string;
  message: string;
}

export interface YourItem {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface YourItemPayload {
  title: string;
  description: string | null;
}

/** Persisted via AppContext getSettings/updateSettings — add domain keys as needed. */
export interface YourItemsSettings {
  /** Example placeholder — no list layout prefs in this template (table-only). */
  exampleSetting?: string;
}
