import { Store } from 'lucide-react';
import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
  useState,
  ReactNode,
} from 'react';

import { useActionRegistry } from '@/core/api/ActionContext';
import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';

import { kioskApi } from '../api/kioskApi';
import { Slot, ValidationError, type KioskMention } from '../types/kiosk';

interface KioskContextType {
  isKioskPanelOpen: boolean;
  currentSlot: Slot | null;
  panelMode: 'create' | 'edit' | 'view' | 'settings';
  validationErrors: ValidationError[];
  slots: Slot[];

  openSlotPanel: (slot: Slot | null) => void;
  openSlotForEdit: (slot: Slot) => void;
  openSlotForView: (slot: Slot) => void;
  openSlotSettings: () => void;
  closeSlotPanel: () => void;
  saveSlot: (data: Record<string, unknown>, slotId?: string) => Promise<boolean>;
  deleteSlot: (id: string) => Promise<void>;
  deleteSlots: (ids: string[]) => Promise<void>;
  clearValidationErrors: () => void;

  selectedSlotIds: string[];
  toggleSlotSelected: (id: string) => void;
  selectAllSlots: (ids: string[]) => void;
  clearSlotSelection: () => void;
  selectedCount: number;
  isSelected: (id: string) => boolean;

  getPanelTitle: (mode: string, item: Slot | null) => React.ReactNode;
  getPanelSubtitle: (mode: string, item: Slot | null) => React.ReactNode;
  getDeleteMessage: (item: Slot | null) => string;

  getDuplicateConfig: (item: Slot | null) => {
    defaultName: string;
    nameLabel: string;
    confirmOnly?: boolean;
  } | null;
  executeDuplicate: (
    item: Slot,
    newName: string,
  ) => Promise<{ closePanel: () => void; highlightId?: string }>;
  recentlyDuplicatedSlotId: string | null;
  setRecentlyDuplicatedSlotId: (id: string | null) => void;

  /** Refetch slots from API (e.g. after creating a slot from match in App). */
  refreshSlots: () => Promise<void>;

  // Quick-edit in view mode (contacts/mentions): draft until "Update" is clicked (same UX as task properties / contact tags)
  displayMentions: KioskMention[];
  addContactToDraft: (contact: { id: number | string; companyName?: string }) => void;
  removeContactFromDraft: (contactId: string) => void;
  hasQuickEditChanges: boolean;
  onApplyQuickEdit: () => Promise<void>;
  showDiscardQuickEditDialog: boolean;
  setShowDiscardQuickEditDialog: (show: boolean) => void;
  getCloseHandler: (defaultClose: () => void) => () => void;
  onDiscardQuickEditAndClose: () => void;
}

const KioskContext = createContext<KioskContextType | undefined>(undefined);

interface KioskProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function KioskProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
}: KioskProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction, registerKioskNavigation } =
    useApp();
  const { registerAction } = useActionRegistry();

  // Register "To Kiosk" action on match entity (MatchContext wires openToSlotDialog when showing footer)
  useEffect(() => {
    const unregister = registerAction('match', {
      id: 'create-slot-from-match',
      label: 'To Kiosk',
      icon: Store,
      variant: 'primary',
      className:
        'h-7 text-[10px] px-2 text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-950/30',
      onClick: () => {},
    });
    return () => unregister?.();
  }, [registerAction]);

  const [isKioskPanelOpen, setIsKioskPanelOpen] = useState(false);
  const [currentSlot, setCurrentSlot] = useState<Slot | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view' | 'settings'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [recentlyDuplicatedSlotId, setRecentlyDuplicatedSlotId] = useState<string | null>(null);
  const [mentionsDraft, setMentionsDraft] = useState<KioskMention[] | null>(null);
  const [showDiscardQuickEditDialog, setShowDiscardQuickEditDialog] = useState(false);
  const pendingCloseRef = useRef<(() => void) | null>(null);

  const {
    selectedIds: selectedSlotIds,
    toggleSelection: toggleSlotSelectedCore,
    selectAll: selectAllSlotsCore,
    clearSelection: clearSlotSelectionCore,
    isSelected,
    selectedCount,
  } = useBulkSelection();

  const closeSlotPanel = useCallback(() => {
    setIsKioskPanelOpen(false);
    setCurrentSlot(null);
    setPanelMode('create');
    setValidationErrors([]);
    setMentionsDraft(null);
    setShowDiscardQuickEditDialog(false);
  }, []);

  useEffect(() => {
    registerPanelCloseFunction('kiosk', closeSlotPanel);
    return () => unregisterPanelCloseFunction('kiosk');
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction, closeSlotPanel]);

  const loadSlots = useCallback(async () => {
    try {
      const data = await kioskApi.getSlots();
      setSlots(data);
    } catch (error: unknown) {
      console.error('Failed to load kiosk slots:', error);
      const msg =
        (error as { message?: string; error?: string })?.message ||
        (error as { message?: string; error?: string })?.error ||
        'Failed to load kiosk slots';
      setValidationErrors([{ field: 'general', message: msg }]);
    }
  }, []);

  const refreshSlots = useCallback(async () => {
    await loadSlots();
  }, [loadSlots]);

  useEffect(() => {
    if (isAuthenticated) {
      loadSlots();
    } else {
      setSlots([]);
    }
  }, [isAuthenticated, loadSlots]);

  const validateSlot = useCallback((data: Record<string, unknown>): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!data.slot_time) {
      errors.push({ field: 'slot_time', message: 'Time is required' });
    }
    const cap = data.capacity !== undefined && data.capacity !== null ? Number(data.capacity) : 1;
    if (Number.isNaN(cap) || cap < 1 || cap > 5) {
      errors.push({ field: 'capacity', message: 'Capacity must be between 1 and 5' });
    }
    return errors;
  }, []);

  const openSlotPanel = useCallback(
    (slot: Slot | null) => {
      clearSlotSelectionCore();
      setRecentlyDuplicatedSlotId(null);
      setCurrentSlot(slot);
      setPanelMode(slot ? 'edit' : 'create');
      setIsKioskPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels, clearSlotSelectionCore],
  );

  const openSlotForEdit = useCallback(
    (slot: Slot) => {
      clearSlotSelectionCore();
      setRecentlyDuplicatedSlotId(null);
      setCurrentSlot(slot);
      setPanelMode('edit');
      setIsKioskPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels, clearSlotSelectionCore],
  );

  const openSlotForView = useCallback(
    (slot: Slot) => {
      setRecentlyDuplicatedSlotId(null);
      setCurrentSlot(slot);
      setPanelMode('view');
      setIsKioskPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels],
  );

  const openSlotForViewRef = useRef(openSlotForView);
  useEffect(() => {
    openSlotForViewRef.current = openSlotForView;
  }, [openSlotForView]);
  const openSlotForViewBridge = useCallback((slot: Slot) => {
    openSlotForViewRef.current(slot);
  }, []);

  useEffect(() => {
    registerKioskNavigation(openSlotForViewBridge);
    return () => registerKioskNavigation(null);
  }, [registerKioskNavigation, openSlotForViewBridge]);

  // Clear quick-edit draft when slot changes
  useEffect(() => {
    setMentionsDraft(null);
    setShowDiscardQuickEditDialog(false);
  }, [currentSlot?.id]);

  const displayMentions =
    currentSlot && mentionsDraft !== null
      ? mentionsDraft
      : Array.isArray(currentSlot?.mentions)
        ? currentSlot.mentions
        : [];

  const addContactToDraft = useCallback(
    (contact: { id: number | string; companyName?: string }) => {
      const id = String(contact.id);
      const name = contact.companyName ?? 'Contact';
      setMentionsDraft((prev) => {
        const base = prev ?? (Array.isArray(currentSlot?.mentions) ? currentSlot.mentions : []);
        if (base.some((m) => String(m.contactId) === id)) {
          return prev;
        }
        return [...base, { contactId: id, contactName: name, companyName: contact.companyName }];
      });
    },
    [currentSlot?.mentions],
  );

  const removeContactFromDraft = useCallback(
    (contactId: string) => {
      const id = String(contactId);
      setMentionsDraft((prev) => {
        if (prev === null) {
          const base = Array.isArray(currentSlot?.mentions) ? currentSlot.mentions : [];
          return base.filter((m) => String(m.contactId) !== id);
        }
        return prev.filter((m) => String(m.contactId) !== id);
      });
    },
    [currentSlot?.mentions],
  );

  const hasQuickEditChanges = Boolean(
    currentSlot &&
      panelMode === 'view' &&
      (() => {
        const saved = Array.isArray(currentSlot.mentions) ? currentSlot.mentions : [];
        const draft = mentionsDraft ?? saved;
        if (draft.length !== saved.length) {
          return true;
        }
        const savedIds = [...saved].map((m) => String(m.contactId)).sort();
        const draftIds = [...draft].map((m) => String(m.contactId)).sort();
        return savedIds.some((id, i) => draftIds[i] !== id);
      })(),
  );

  const openSlotSettings = useCallback(() => {
    clearSlotSelectionCore();
    setRecentlyDuplicatedSlotId(null);
    setCurrentSlot(null);
    setPanelMode('settings');
    setIsKioskPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  }, [onCloseOtherPanels, clearSlotSelectionCore]);

  const clearValidationErrors = useCallback(() => setValidationErrors([]), []);

  const saveSlot = useCallback(
    async (data: Record<string, unknown>, slotId?: string): Promise<boolean> => {
      const errors = validateSlot(data);
      setValidationErrors(errors);
      if (errors.length > 0) {
        return false;
      }

      try {
        if (slotId ?? currentSlot?.id) {
          const id = slotId ?? currentSlot!.id;
          const saved = await kioskApi.updateSlot(id, data as Partial<Slot>);
          setSlots((prev) => prev.map((s) => (s.id === id ? saved : s)));
          setCurrentSlot(saved);
          setPanelMode('view');
        } else {
          const saved = await kioskApi.createSlot(
            data as Parameters<typeof kioskApi.createSlot>[0],
          );
          setSlots((prev) => [saved, ...prev]);
          closeSlotPanel();
        }
        setValidationErrors([]);
        return true;
      } catch (error: unknown) {
        const msg =
          (error as { message?: string; error?: string })?.message ||
          (error as { message?: string; error?: string })?.error ||
          'Failed to save slot';
        setValidationErrors([{ field: 'general', message: msg }]);
        return false;
      }
    },
    [currentSlot, validateSlot, closeSlotPanel],
  );

  const onApplyQuickEdit = useCallback(async () => {
    if (!currentSlot) {
      return;
    }
    const nextMentions =
      mentionsDraft ?? (Array.isArray(currentSlot.mentions) ? currentSlot.mentions : []);
    const payload = {
      location: currentSlot.location,
      slot_time: currentSlot.slot_time,
      capacity: currentSlot.capacity,
      visible: currentSlot.visible,
      notifications_enabled: currentSlot.notifications_enabled,
      contact_id: nextMentions[0]?.contactId ?? null,
      mentions: nextMentions,
    };
    const success = await saveSlot(payload, currentSlot.id);
    if (success) {
      setMentionsDraft(null);
    }
  }, [currentSlot, mentionsDraft, saveSlot]);

  const getCloseHandler = useCallback(
    (defaultClose: () => void) => {
      return () => {
        if (hasQuickEditChanges) {
          pendingCloseRef.current = defaultClose;
          setShowDiscardQuickEditDialog(true);
        } else {
          defaultClose();
        }
      };
    },
    [hasQuickEditChanges],
  );

  const onDiscardQuickEditAndClose = useCallback(() => {
    setMentionsDraft(null);
    setShowDiscardQuickEditDialog(false);
  }, []);

  const deleteSlot = useCallback(
    async (id: string) => {
      try {
        await kioskApi.deleteSlot(id);
        setSlots((prev) => prev.filter((s) => s.id !== id));
        if (currentSlot?.id === id) {
          closeSlotPanel();
        }
      } catch (error: unknown) {
        const msg =
          (error as { message?: string; error?: string })?.message ||
          (error as { message?: string; error?: string })?.error ||
          'Failed to delete slot';
        alert(msg);
      }
    },
    [currentSlot, closeSlotPanel],
  );

  const deleteSlots = useCallback(
    async (ids: string[]) => {
      const unique = Array.from(new Set(ids.map(String).filter(Boolean)));
      if (unique.length === 0) {
        return;
      }
      try {
        await bulkApi.bulkDelete('kiosk', unique);
        setSlots((prev) => prev.filter((s) => !unique.includes(s.id)));
        if (currentSlot && unique.includes(currentSlot.id)) {
          closeSlotPanel();
        }
        clearSlotSelectionCore();
      } catch (error: unknown) {
        const msg =
          (error as { message?: string; error?: string })?.message ||
          (error as { message?: string; error?: string })?.error ||
          'Failed to delete slots';
        alert(msg);
      }
    },
    [currentSlot, closeSlotPanel, clearSlotSelectionCore],
  );

  const getPanelTitle = useCallback((mode: string, item: Slot | null) => {
    if (mode === 'view' && item) {
      return item.location
        ? `${item.location} · ${new Date(item.slot_time).toLocaleString('sv-SE')}`
        : new Date(item.slot_time).toLocaleString('sv-SE');
    }
    if (mode === 'edit') {
      return 'Edit slot';
    }
    if (mode === 'create') {
      return 'New slot';
    }
    if (mode === 'settings') {
      return 'Settings – Kiosk';
    }
    return 'Slot';
  }, []);

  const getPanelSubtitle = useCallback((mode: string, item: Slot | null) => {
    if (mode === 'view' && item) {
      const d = item.slot_time ? new Date(item.slot_time) : null;
      return (
        <span className="text-xs text-muted-foreground">
          {item.location || '—'}
          {d ? ` · ${d.toLocaleString('sv-SE')}` : ''}
        </span>
      );
    }
    if (mode === 'edit') {
      return 'Edit slot details';
    }
    if (mode === 'create') {
      return 'Add a new slot';
    }
    return '';
  }, []);

  const getDeleteMessage = useCallback((item: Slot | null) => {
    if (!item) {
      return 'Are you sure you want to delete this slot?';
    }
    const loc = item.location || 'this slot';
    return `Are you sure you want to delete the slot ${loc}?`;
  }, []);

  const getDuplicateConfig = useCallback((item: Slot | null) => {
    if (!item) {
      return null;
    }
    return { defaultName: '', nameLabel: '', confirmOnly: true };
  }, []);

  const executeDuplicate = useCallback(
    async (
      item: Slot,
      _newName: string,
    ): Promise<{ closePanel: () => void; highlightId?: string }> => {
      const copy = {
        location: item.location ?? null,
        slot_time: item.slot_time,
        capacity: item.capacity,
        visible: item.visible,
        notifications_enabled: item.notifications_enabled,
      };
      const newSlot = await kioskApi.createSlot(copy);
      setSlots((prev) => [newSlot, ...prev]);
      const highlightId =
        newSlot?.id !== null && newSlot?.id !== undefined ? String(newSlot.id) : undefined;
      return { closePanel: closeSlotPanel, highlightId };
    },
    [closeSlotPanel],
  );

  const value: KioskContextType = {
    isKioskPanelOpen,
    currentSlot,
    panelMode,
    validationErrors,
    slots,
    openSlotPanel,
    openSlotForEdit,
    openSlotForView,
    openSlotSettings,
    closeSlotPanel,
    saveSlot,
    deleteSlot,
    deleteSlots,
    clearValidationErrors,
    selectedSlotIds,
    toggleSlotSelected: toggleSlotSelectedCore,
    selectAllSlots: selectAllSlotsCore,
    clearSlotSelection: clearSlotSelectionCore,
    selectedCount,
    isSelected,
    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,
    getDuplicateConfig,
    executeDuplicate,
    recentlyDuplicatedSlotId,
    setRecentlyDuplicatedSlotId,
    refreshSlots,
    displayMentions,
    addContactToDraft,
    removeContactFromDraft,
    hasQuickEditChanges,
    onApplyQuickEdit,
    showDiscardQuickEditDialog,
    setShowDiscardQuickEditDialog,
    getCloseHandler,
    onDiscardQuickEditAndClose,
  };

  return <KioskContext.Provider value={value}>{children}</KioskContext.Provider>;
}

export function useKioskContext() {
  const ctx = useContext(KioskContext);
  if (ctx === undefined) {
    throw new Error('useKioskContext must be used within KioskProvider');
  }
  return ctx;
}
