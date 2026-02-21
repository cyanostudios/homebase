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
  /** Count of public bookings for this slot. */
  booked_count?: number;
}

export interface SlotBooking {
  id: string;
  slot_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  created_at: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export const CAPACITY_OPTIONS = [1, 2, 3, 4, 5] as const;
