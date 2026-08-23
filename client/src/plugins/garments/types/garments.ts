export type PanelMode = 'create' | 'edit' | 'view';

export type GarmentsContentView = 'lists' | 'inventory' | 'settings';

export type GarmentPanelKind = 'list' | 'inventory';

export interface ValidationError {
  field: string;
  message: string;
}

export interface GarmentCheckboxColumn {
  id: string;
  label: string;
  /** Category grouping for spreadsheet headers, e.g. Shorts | Shirt | Socks */
  group?: string;
  sortOrder: number;
}

export interface GarmentList {
  id: string;
  name: string;
  teamId: string | null;
  checkboxColumns: GarmentCheckboxColumn[];
  personCount?: number;
  persons?: GarmentPerson[];
  createdAt: string;
  updatedAt: string;
}

export interface GarmentListPayload {
  name: string;
  teamId?: string | null;
  checkboxColumns?: GarmentCheckboxColumn[];
}

export interface GarmentPerson {
  id: string;
  listId: string;
  name: string;
  shirtSize: string | null;
  shortsSize: string | null;
  socksSize: string | null;
  jerseyNumber: string | null;
  /** Name printed on the jersey / shirt. */
  jerseyName: string | null;
  initials: string | null;
  comment: string | null;
  /** Linked Contacts id when imported/linked from Contacts. */
  contactId: string | null;
  checkboxValues: Record<string, boolean>;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface GarmentPersonPayload {
  name: string;
  shirtSize?: string | null;
  shortsSize?: string | null;
  socksSize?: string | null;
  jerseyNumber?: string | null;
  jerseyName?: string | null;
  initials?: string | null;
  comment?: string | null;
  contactId?: string | null;
  checkboxValues?: Record<string, boolean>;
  sortOrder?: number;
}

export interface InventoryVariant {
  id: string;
  itemId: string;
  sku: string;
  color: string;
  size: string;
  quantity: number;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryVariantPayload {
  id?: string;
  sku?: string;
  color?: string;
  size?: string;
  quantity?: number;
  sortOrder?: number;
}

export interface InventoryItem {
  id: string;
  articleName: string;
  brand: string;
  description: string | null;
  material: string;
  purchasePrice: number | null;
  currency: string;
  comment: string | null;
  variants: InventoryVariant[];
  totalQuantity: number;
  variantCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItemPayload {
  articleName: string;
  brand?: string;
  description?: string | null;
  material?: string;
  purchasePrice?: number | null;
  currency?: string;
  comment?: string | null;
  variants?: InventoryVariantPayload[];
}

export interface GarmentShare {
  id: string;
  listId: string;
  shareToken: string;
  validUntil: Date;
  createdAt: Date;
  accessedCount: number;
  lastAccessedAt?: Date;
}

export interface CreateGarmentShareRequest {
  listId: string;
  validUntil: Date;
}

export interface PublicGarmentList extends GarmentList {
  shareValidUntil?: string;
  accessedCount?: number;
}

/** Persisted via AppContext getSettings/updateSettings — key `garments`. */
export interface GarmentsSettings {
  listViewMode?: 'cards' | 'table';
  columnCount?: 1 | 2 | 3;
}
