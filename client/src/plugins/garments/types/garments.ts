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
  /** When true, column is stored but hidden from the person matrix (custom columns). */
  hidden?: boolean;
}

export interface GarmentList {
  id: string;
  name: string;
  teamId: string | null;
  checkboxColumns: GarmentCheckboxColumn[];
  /** Inventory items assigned to this list. */
  assignedInventoryItemIds?: string[];
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
  /** Optional Teams id when the person belongs to a team. */
  teamId: string | null;
  checkboxValues: Record<string, boolean>;
  /** Selected size per assigned inventory item id. */
  ctSizes?: Record<string, string>;
  /** Selected audience per assigned inventory item id. */
  ctAudiences?: Record<string, string>;
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
  teamId?: string | null;
  checkboxValues?: Record<string, boolean>;
  sortOrder?: number;
}

export interface InventoryVariant {
  id: string;
  itemId: string;
  sku: string;
  audience: string;
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
  audience?: string;
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
  recommendedPrice: number | null;
  salePrice: number | null;
  currency: string;
  comment: string | null;
  tags: string[];
  variants: InventoryVariant[];
  totalQuantity: number;
  variantCount: number;
  /** Garment lists this item is assigned to. */
  assignedListIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItemPayload {
  articleName: string;
  brand?: string;
  description?: string | null;
  material?: string;
  purchasePrice?: number | null;
  recommendedPrice?: number | null;
  salePrice?: number | null;
  currency?: string;
  comment?: string | null;
  tags?: string[];
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
  /** Catalog of tags assignable on inventory items (Contacts-style). */
  tags?: string[];
}
