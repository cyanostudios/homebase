import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { apiFetch } from '@/core/api/apiFetch';
import { useApp } from '@/core/api/AppContext';
import type { Contact } from '@/plugins/contacts/types/contacts';
import { useOptionalTimeTrackingActivityDispatch } from '@/core/widgets/time-tracking/TimeTrackingActivityContext';

export const MAX_TIMERS = 3;

function contactLabel(contact: Contact): string {
  return contact.companyName?.trim() || contact.email?.trim() || `Contact ${contact.id}`;
}

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function createTimerId(): string {
  return `timer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type TimerSlotState = {
  id: string;
  isRunning: boolean;
  elapsedSeconds: number;
  selectedContactId: string;
  contactSearch: string;
  showSuggestions: boolean;
  useManualEntry: boolean;
  manualMinutes: string;
  manualDate: Date;
  manualDateOpen: boolean;
  addError: string | null;
  adding: boolean;
};

export type TimerSlotView = TimerSlotState & {
  timeDisplay: string;
  selectedContact: Contact | null;
  filteredSuggestions: Contact[];
  openPopover: boolean;
  canAddToContact: boolean;
};

export type TimerApi = {
  timers: TimerSlotView[];
  canAddTimer: boolean;
  contactLabel: (contact: Contact) => string;
  addTimer: () => void;
  removeTimer: (id: string) => void;
  start: (id: string) => void;
  stop: (id: string) => void;
  reset: (id: string) => void;
  setContactSearch: (id: string, value: string) => void;
  setShowSuggestions: (id: string, open: boolean) => void;
  selectContact: (id: string, contact: Contact) => void;
  clearContact: (id: string) => void;
  setUseManualEntry: (id: string, value: boolean) => void;
  setManualMinutes: (id: string, value: string) => void;
  setManualDate: (id: string, value: Date) => void;
  setManualDateOpen: (id: string, open: boolean) => void;
  addToContact: (id: string) => Promise<void>;
};

const TimerContext = createContext<TimerApi | null>(null);

function createEmptySlot(): TimerSlotState {
  return {
    id: createTimerId(),
    isRunning: false,
    elapsedSeconds: 0,
    selectedContactId: '',
    contactSearch: '',
    showSuggestions: false,
    useManualEntry: false,
    manualMinutes: '',
    manualDate: new Date(),
    manualDateOpen: false,
    addError: null,
    adding: false,
  };
}

function updateSlot(
  slots: TimerSlotState[],
  id: string,
  patch: Partial<TimerSlotState> | ((slot: TimerSlotState) => Partial<TimerSlotState>),
): TimerSlotState[] {
  return slots.map((slot) => {
    if (slot.id !== id) {
      return slot;
    }
    const next = typeof patch === 'function' ? patch(slot) : patch;
    return { ...slot, ...next };
  });
}

/** Shared stopwatch state so closing the flyout does not stop timers. Up to 3 parallel. */
export function TimerProvider({ children }: { children: ReactNode }) {
  const { contacts } = useApp();
  const setActiveTrackingContactId = useOptionalTimeTrackingActivityDispatch();
  const [slots, setSlots] = useState<TimerSlotState[]>(() => [createEmptySlot()]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const anyRunning = slots.some((slot) => slot.isRunning);

  useEffect(() => {
    const active = slots.find((slot) => slot.isRunning && slot.selectedContactId.trim());
    setActiveTrackingContactId(active?.selectedContactId.trim() || null);
  }, [slots, setActiveTrackingContactId]);

  useEffect(() => {
    if (anyRunning) {
      intervalRef.current = setInterval(() => {
        setSlots((current) =>
          current.map((slot) =>
            slot.isRunning ? { ...slot, elapsedSeconds: slot.elapsedSeconds + 1 } : slot,
          ),
        );
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [anyRunning]);

  const addTimer = useCallback(() => {
    setSlots((current) => {
      if (current.length >= MAX_TIMERS) {
        return current;
      }
      return [...current, createEmptySlot()];
    });
  }, []);

  const removeTimer = useCallback((id: string) => {
    setSlots((current) => {
      if (current.length <= 1) {
        return current;
      }
      return current.filter((slot) => slot.id !== id);
    });
  }, []);

  const start = useCallback((id: string) => {
    setSlots((current) => updateSlot(current, id, { isRunning: true }));
  }, []);

  const stop = useCallback((id: string) => {
    setSlots((current) => updateSlot(current, id, { isRunning: false }));
  }, []);

  const reset = useCallback((id: string) => {
    setSlots((current) => updateSlot(current, id, { isRunning: false, elapsedSeconds: 0 }));
  }, []);

  const setContactSearch = useCallback((id: string, value: string) => {
    setSlots((current) => updateSlot(current, id, { contactSearch: value }));
  }, []);

  const setShowSuggestions = useCallback((id: string, open: boolean) => {
    setSlots((current) => updateSlot(current, id, { showSuggestions: open }));
  }, []);

  const selectContact = useCallback((id: string, contact: Contact) => {
    setSlots((current) =>
      updateSlot(current, id, {
        selectedContactId: String(contact.id),
        contactSearch: '',
        showSuggestions: false,
      }),
    );
  }, []);

  const clearContact = useCallback((id: string) => {
    setSlots((current) => updateSlot(current, id, { selectedContactId: '', contactSearch: '' }));
  }, []);

  const setUseManualEntry = useCallback((id: string, value: boolean) => {
    setSlots((current) => updateSlot(current, id, { useManualEntry: value }));
  }, []);

  const setManualMinutes = useCallback((id: string, value: string) => {
    setSlots((current) => updateSlot(current, id, { manualMinutes: value }));
  }, []);

  const setManualDate = useCallback((id: string, value: Date) => {
    setSlots((current) => updateSlot(current, id, { manualDate: value }));
  }, []);

  const setManualDateOpen = useCallback((id: string, open: boolean) => {
    setSlots((current) => updateSlot(current, id, { manualDateOpen: open }));
  }, []);

  const addToContact = useCallback(
    async (id: string) => {
      const slot = slots.find((item) => item.id === id);
      if (!slot?.selectedContactId) {
        return;
      }
      const minutes = parseInt(slot.manualMinutes, 10);
      if (slot.useManualEntry && (Number.isNaN(minutes) || minutes <= 0)) {
        return;
      }
      if (!slot.useManualEntry && slot.elapsedSeconds <= 0) {
        return;
      }
      setSlots((current) => updateSlot(current, id, { addError: null, adding: true }));
      try {
        const seconds = slot.useManualEntry ? minutes * 60 : slot.elapsedSeconds;
        const loggedAt = slot.useManualEntry
          ? slot.manualDate.toISOString()
          : new Date().toISOString();
        const res = await apiFetch(`/api/contacts/${slot.selectedContactId}/time-entries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seconds, loggedAt }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to add time');
        }
        window.dispatchEvent(
          new CustomEvent('homebase:contact-time-entry-added', {
            detail: { contactId: slot.selectedContactId },
          }),
        );
        setSlots((current) =>
          updateSlot(current, id, (currentSlot) =>
            currentSlot.useManualEntry
              ? { manualMinutes: '', manualDate: new Date(), adding: false }
              : { elapsedSeconds: 0, adding: false },
          ),
        );
      } catch (e) {
        setSlots((current) =>
          updateSlot(current, id, {
            addError: e instanceof Error ? e.message : 'Failed to add time',
            adding: false,
          }),
        );
      }
    },
    [slots],
  );

  const timers = useMemo<TimerSlotView[]>(() => {
    const list = contacts as Contact[];
    return slots.map((slot) => {
      const q = slot.contactSearch.trim().toLowerCase();
      const filteredSuggestions = (
        q
          ? list.filter((c) => {
              const name = (c.companyName ?? '').toLowerCase();
              const email = (c.email ?? '').toLowerCase();
              const phone = (c.phone ?? '').toLowerCase();
              return name.includes(q) || email.includes(q) || phone.includes(q);
            })
          : list
      ).slice(0, 40);
      const selectedContact = list.find((c) => String(c.id) === slot.selectedContactId) ?? null;
      const canAddToContact = Boolean(
        slot.selectedContactId &&
          (slot.useManualEntry
            ? slot.manualMinutes.trim() !== '' && parseInt(slot.manualMinutes, 10) > 0
            : slot.elapsedSeconds > 0),
      );
      return {
        ...slot,
        timeDisplay: formatElapsed(slot.elapsedSeconds),
        selectedContact,
        filteredSuggestions,
        openPopover: slot.showSuggestions && contacts.length > 0 && !slot.selectedContactId,
        canAddToContact,
      };
    });
  }, [contacts, slots]);

  const value = useMemo<TimerApi>(
    () => ({
      timers,
      canAddTimer: slots.length < MAX_TIMERS,
      contactLabel,
      addTimer,
      removeTimer,
      start,
      stop,
      reset,
      setContactSearch,
      setShowSuggestions,
      selectContact,
      clearContact,
      setUseManualEntry,
      setManualMinutes,
      setManualDate,
      setManualDateOpen,
      addToContact,
    }),
    [
      timers,
      slots.length,
      addTimer,
      removeTimer,
      start,
      stop,
      reset,
      setContactSearch,
      setShowSuggestions,
      selectContact,
      clearContact,
      setUseManualEntry,
      setManualMinutes,
      setManualDate,
      setManualDateOpen,
      addToContact,
    ],
  );

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer(): TimerApi {
  const ctx = useContext(TimerContext);
  if (!ctx) {
    throw new Error('useTimer must be used within TimerProvider');
  }
  return ctx;
}
