export interface SlotMention {
  contactId: string;
  contactName: string;
  companyName?: string;
  position?: number;
  length?: number;
}

export interface Slot {
  id: string;
  location: string | null;
  slot_time: string;
  capacity: number;
  visible: boolean;
  notifications_enabled: boolean;
  contact_id: string | null;
  mentions: SlotMention[];
  created_at: string;
  updated_at: string;
  /** Set when slot was created via "To slot" from a match. */
  match_id?: string | null;
}

export interface ValidationError {
  field: string;
  message: string;
}

export const CAPACITY_OPTIONS = [1, 2, 3, 4, 5] as const;
