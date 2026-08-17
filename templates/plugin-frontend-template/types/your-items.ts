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

/** Persisted via AppContext getSettings/updateSettings — not a plugin /settings route. */
export interface YourItemsSettings {
  listViewMode?: 'cards' | 'table';
  columnCount?: 1 | 2 | 3;
  /** Legacy; migrate grid→3, list→1 in columnCount helper. */
  viewMode?: 'grid' | 'list';
}
