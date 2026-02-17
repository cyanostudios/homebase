export interface Slot {
  id: string;
  location: string | null;
  slot_time: string;
  capacity: number;
  visible: boolean;
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export const CAPACITY_OPTIONS = [1, 2, 3, 4, 5] as const;
