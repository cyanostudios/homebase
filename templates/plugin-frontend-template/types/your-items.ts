export type PanelMode = 'create' | 'edit' | 'view' | 'settings';

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

export interface YourItemsSettings {
  defaultView: 'list' | 'grid';
  allowDuplicate: boolean;
}
