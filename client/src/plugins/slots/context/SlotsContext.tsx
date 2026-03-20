import { Mail, MessageCircle, Store } from 'lucide-react';
import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

import { useActionRegistry } from '@/core/api/ActionContext';
import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import type { BulkEmailRecipient } from '@/core/ui/BulkEmailDialog';
import type { BulkMessageRecipient } from '@/core/ui/BulkMessageDialog';
import { resolveSlug } from '@/core/utils/slugUtils';

import { slotsApi } from '../api/slotsApi';
import { Slot, ValidationError, type SlotMention } from '../types/slots';
import { resolveSlotsToContacts, resolveSlotsToEmailContacts } from '../utils/slotContactUtils';
import { isSlotTimePast } from '../utils/slotTimeUtils';

function extractErrorMsg(error: unknown, fallback: string): string {
  const e = error as { message?: string; error?: string };
  return e?.message || e?.error || fallback;
}

interface SlotsContextType {
  isSlotsPanelOpen: boolean;
  currentSlot: Slot | null;
  panelMode: 'create' | 'edit' | 'view' | 'settings';
  validationErrors: ValidationError[];
  slots: Slot[];

  openSlotPanel: (slot: Slot | null) => void;
  openSlotForEdit: (slot: Slot) => void;
  openSlotForView: (slot: Slot) => void;
  openSlotSettings: () => void;
  closeSlotSettingsView: () => void;
  closeSlotPanel: () => void;
  slotsContentView: 'list' | 'settings';
  saveSlot: (data: Record<string, unknown>, slotId?: string) => Promise<boolean>;
  saveSlots: (dataArray: Record<string, unknown>[]) => Promise<boolean>;
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

  canSendMessages: boolean;
  canSendEmail: boolean;

  // Quick-edit in view mode (contacts/mentions, visible, notifications): draft until "Update" is clicked (same UX as task properties)
  displayMentions: SlotMention[];
  addContactToDraft: (contact: { id: number | string; companyName?: string }) => void;
  removeContactFromDraft: (contactId: string) => void;
  /** Draft for visible/notifications/location in view mode; used by SlotView switches and inline location edit. */
  propertyDraft: Partial<Pick<Slot, 'visible' | 'notifications_enabled' | 'location'>> | null;
  setPropertyDraftField: (
    field: 'visible' | 'notifications_enabled' | 'location',
    value: boolean | string | null,
  ) => void;
  hasQuickEditChanges: boolean;
  onApplyQuickEdit: () => Promise<void>;
  showDiscardQuickEditDialog: boolean;
  setShowDiscardQuickEditDialog: (show: boolean) => void;
  getCloseHandler: (defaultClose: () => void) => () => void;
  onDiscardQuickEditAndClose: () => void;

  navigateToPrevItem: () => void;
  navigateToNextItem: () => void;
  hasPrevItem: boolean;
  hasNextItem: boolean;
  currentItemIndex: number;
  totalItems: number;

  // Single-item "Send message" from detail footer (same dialog as bulk)
  detailFooterActions?: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: (item: Slot) => void;
    className?: string;
    disabled?: boolean;
  }>;
  showSendMessageDialog: boolean;
  sendMessageRecipients: BulkMessageRecipient[];
  closeSendMessageDialog: () => void;

  // Single-item "Send email" from detail footer
  showSendEmailDialog: boolean;
  sendEmailRecipients: BulkEmailRecipient[];
  sendEmailSlot: Slot | null;
  closeSendEmailDialog: () => void;
}

const SlotsContext = createContext<SlotsContextType | undefined>(undefined);

interface SlotsProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function SlotsProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
}: SlotsProviderProps) {
  const { t } = useTranslation();
  const {
    registerPanelCloseFunction,
    unregisterPanelCloseFunction,
    registerSlotsNavigation,
    contacts: appContacts = [],
    user,
  } = useApp();
  const { navigateToItem, navigateToBase } = useItemUrl('/slots');
  const { registerAction } = useActionRegistry();
  const canSendMessages =
    user?.role === 'superuser' || (Array.isArray(user?.plugins) && user.plugins.includes('pulses'));
  const canSendEmail =
    user?.role === 'superuser' || (Array.isArray(user?.plugins) && user.plugins.includes('mail'));

  // Register "To Slot" action on match entity (MatchContext wires openToSlotDialog when showing footer)
  useEffect(() => {
    const unregister = registerAction('match', {
      id: 'create-slot-from-match',
      label: 'To Slot',
      icon: Store,
      variant: 'primary',
      className:
        'h-9 text-xs px-3 text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-950/30',
      onClick: () => {},
    });
    return () => unregister?.();
  }, [registerAction]);

  const [isSlotsPanelOpen, setIsSlotsPanelOpen] = useState(false);
  const [currentSlot, setCurrentSlot] = useState<Slot | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view' | 'settings'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsContentView, setSlotsContentView] = useState<'list' | 'settings'>('list');
  const [recentlyDuplicatedSlotId, setRecentlyDuplicatedSlotId] = useState<string | null>(null);
  const [mentionsDraft, setMentionsDraft] = useState<SlotMention[] | null>(null);
  /** Draft for visible/notifications/location in view mode (like task status/priority). */
  const [propertyDraft, setPropertyDraft] =
    useState<Partial<Pick<Slot, 'visible' | 'notifications_enabled' | 'location'>>>(null);
  const [showDiscardQuickEditDialog, setShowDiscardQuickEditDialog] = useState(false);
  const [showSendMessageDialog, setShowSendMessageDialog] = useState(false);
  const [sendMessageRecipients, setSendMessageRecipients] = useState<BulkMessageRecipient[]>([]);
  const [showSendEmailDialog, setShowSendEmailDialog] = useState(false);
  const [sendEmailRecipients, setSendEmailRecipients] = useState<BulkEmailRecipient[]>([]);
  const [sendEmailSlot, setSendEmailSlot] = useState<Slot | null>(null);
  const pendingCloseRef = useRef<(() => void) | null>(null);

  const closeSendMessageDialog = useCallback(() => {
    setShowSendMessageDialog(false);
    setSendMessageRecipients([]);
  }, []);

  const closeSendEmailDialog = useCallback(() => {
    setShowSendEmailDialog(false);
    setSendEmailRecipients([]);
    setSendEmailSlot(null);
  }, []);

  const openSlotSendMessage = useCallback(
    (item: Slot) => {
      const base = resolveSlotsToContacts(
        [item.id],
        slots,
        appContacts as Array<{
          id: string | number;
          companyName?: string;
          phone?: string;
          phone2?: string;
        }>,
      );
      setSendMessageRecipients(base);
      setShowSendMessageDialog(true);
    },
    [slots, appContacts],
  );

  const openSlotSendEmail = useCallback(
    (item: Slot) => {
      const base = resolveSlotsToEmailContacts(
        [item.id],
        slots,
        appContacts as Array<{
          id: string | number;
          companyName?: string;
          email?: string;
        }>,
      );
      setSendEmailRecipients(base);
      setSendEmailSlot(item);
      setShowSendEmailDialog(true);
    },
    [slots, appContacts],
  );

  const detailFooterActions = useMemo(() => {
    const actions: Array<{
      id: string;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      onClick: (item: Slot) => void;
      className?: string;
    }> = [];

    if (canSendMessages) {
      actions.push({
        id: 'send-message',
        label: t('bulk.sendMessageTitle'),
        icon: MessageCircle,
        onClick: openSlotSendMessage,
        className: 'h-9 text-xs px-3',
      });
    }

    if (canSendEmail) {
      actions.push({
        id: 'send-email',
        label: t('bulk.sendEmailTitle'),
        icon: Mail,
        onClick: openSlotSendEmail,
        className: 'h-9 text-xs px-3',
      });
    }

    return actions;
  }, [t, canSendMessages, canSendEmail, openSlotSendMessage, openSlotSendEmail]);

  const {
    selectedIds: selectedSlotIds,
    toggleSelection: toggleSlotSelectedCore,
    selectAll: selectAllSlotsCore,
    clearSelection: clearSlotSelectionCore,
    isSelected,
    selectedCount,
  } = useBulkSelection();

  const closeSlotPanel = useCallback(() => {
    setIsSlotsPanelOpen(false);
    setCurrentSlot(null);
    setPanelMode('create');
    setValidationErrors([]);
    setMentionsDraft(null);
    setShowDiscardQuickEditDialog(false);
    navigateToBase();
  }, [navigateToBase]);

  useEffect(() => {
    registerPanelCloseFunction('slots', closeSlotPanel);
    return () => unregisterPanelCloseFunction('slots');
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction, closeSlotPanel]);

  const loadSlots = useCallback(async () => {
    try {
      const data = await slotsApi.getSlots();
      setSlots(data);
    } catch (error: unknown) {
      setValidationErrors([
        { field: 'general', message: extractErrorMsg(error, t('slots.loadFailed')) },
      ]);
    }
  }, [t]);

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

  const didOpenFromUrlRef = useRef(false);
  useEffect(() => {
    if (didOpenFromUrlRef.current || slots.length === 0) {
      return;
    }
    const parts = window.location.pathname.split('/');
    if (parts[1] !== 'slots' || !parts[2]) {
      return;
    }
    const item = resolveSlug(parts[2], slots, (i: any) =>
      i.slot_time ? String(i.slot_time).slice(0, 10) : '',
    );
    if (item) {
      didOpenFromUrlRef.current = true;
      openSlotForViewRef.current(item as Slot);
    }
  }, [slots]);

  // Auto-refresh slots every 30 seconds to catch public bookings
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const intervalId = setInterval(() => {
      loadSlots();
    }, 30000);

    return () => clearInterval(intervalId);
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
      setIsSlotsPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      if (slot) {
        navigateToItem(slot, slots, (i: any) =>
          i.slot_time ? String(i.slot_time).slice(0, 10) : '',
        );
      }
    },
    [onCloseOtherPanels, clearSlotSelectionCore, navigateToItem, slots],
  );

  const openSlotForEdit = useCallback(
    (slot: Slot) => {
      clearSlotSelectionCore();
      setRecentlyDuplicatedSlotId(null);
      setCurrentSlot(slot);
      setMentionsDraft(null);
      setPropertyDraft(null);
      setPanelMode('edit');
      setIsSlotsPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(slot, slots, (i: any) =>
        i.slot_time ? String(i.slot_time).slice(0, 10) : '',
      );
    },
    [onCloseOtherPanels, clearSlotSelectionCore, navigateToItem, slots],
  );

  const openSlotForView = useCallback(
    (slot: Slot) => {
      setRecentlyDuplicatedSlotId(null);
      setCurrentSlot(slot);
      setMentionsDraft(null);
      setPropertyDraft(null);
      setPanelMode('view');
      setIsSlotsPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(slot, slots, (i: any) =>
        i.slot_time ? String(i.slot_time).slice(0, 10) : '',
      );
    },
    [onCloseOtherPanels, navigateToItem, slots],
  );

  const openSlotForViewRef = useRef(openSlotForView);
  useEffect(() => {
    openSlotForViewRef.current = openSlotForView;
  }, [openSlotForView]);
  const openSlotForViewBridge = useCallback((slot: Slot) => {
    openSlotForViewRef.current(slot);
  }, []);

  useEffect(() => {
    registerSlotsNavigation(openSlotForViewBridge);
    return () => registerSlotsNavigation(null);
  }, [registerSlotsNavigation, openSlotForViewBridge]);

  const currentItemIndex = currentSlot ? slots.findIndex((s) => s.id === currentSlot.id) : -1;
  const totalItems = slots.length;
  const hasPrevItem = currentItemIndex > 0;
  const hasNextItem = currentItemIndex >= 0 && currentItemIndex < totalItems - 1;

  const navigateToPrevItem = useCallback(() => {
    if (!hasPrevItem || currentItemIndex <= 0) {
      return;
    }
    const prev = slots[currentItemIndex - 1];
    if (prev) {
      openSlotForView(prev);
    }
  }, [hasPrevItem, currentItemIndex, slots, openSlotForView]);

  const navigateToNextItem = useCallback(() => {
    if (!hasNextItem || currentItemIndex < 0 || currentItemIndex >= slots.length - 1) {
      return;
    }
    const next = slots[currentItemIndex + 1];
    if (next) {
      openSlotForView(next);
    }
  }, [hasNextItem, currentItemIndex, slots, openSlotForView]);

  // Clear quick-edit drafts when slot changes (e.g. navigate or after save)
  useEffect(() => {
    setMentionsDraft(null);
    setPropertyDraft(null);
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
        const mentionsChanged =
          draft.length !== saved.length ||
          [...saved]
            .map((m) => String(m.contactId))
            .sort()
            .join() !==
            [...draft]
              .map((m) => String(m.contactId))
              .sort()
              .join();
        if (mentionsChanged) {
          return true;
        }
        if (propertyDraft) {
          if (
            propertyDraft.visible !== undefined &&
            Boolean(propertyDraft.visible) !== Boolean(currentSlot.visible)
          ) {
            return true;
          }
          if (
            propertyDraft.notifications_enabled !== undefined &&
            Boolean(propertyDraft.notifications_enabled) !==
              Boolean(currentSlot.notifications_enabled)
          ) {
            return true;
          }
          if (
            propertyDraft.location !== undefined &&
            (propertyDraft.location ?? '') !== (currentSlot.location ?? '')
          ) {
            return true;
          }
        }
        return false;
      })(),
  );

  const openSlotSettings = useCallback(() => {
    clearSlotSelectionCore();
    setRecentlyDuplicatedSlotId(null);
    setSlotsContentView('settings');
    onCloseOtherPanels();
  }, [onCloseOtherPanels, clearSlotSelectionCore]);

  const closeSlotSettingsView = useCallback(() => {
    setSlotsContentView('list');
  }, []);

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
          const saved = await slotsApi.updateSlot(id, data as Partial<Slot>);
          setSlots((prev) => prev.map((s) => (s.id === id ? saved : s)));
          setCurrentSlot(saved);
          setPanelMode('view');
        } else {
          const saved = await slotsApi.createSlot(
            data as Parameters<typeof slotsApi.createSlot>[0],
          );
          setSlots((prev) => [saved, ...prev]);
          closeSlotPanel();
        }
        setValidationErrors([]);
        return true;
      } catch (error: unknown) {
        setValidationErrors([
          { field: 'general', message: extractErrorMsg(error, 'Failed to save slot') },
        ]);
        return false;
      }
    },
    [currentSlot, validateSlot, closeSlotPanel],
  );

  const saveSlots = useCallback(
    async (dataArray: Record<string, unknown>[]): Promise<boolean> => {
      const errors: ValidationError[] = [];
      for (let i = 0; i < dataArray.length; i++) {
        const errs = validateSlot(dataArray[i]);
        for (const e of errs) {
          errors.push({ field: e.field, message: `Slot ${i + 1}: ${e.message}` });
        }
      }
      if (errors.length > 0) {
        setValidationErrors(errors);
        return false;
      }
      try {
        const created = await slotsApi.createBatchSlots(
          dataArray as Parameters<typeof slotsApi.createBatchSlots>[0],
        );
        setSlots((prev) => [...created, ...prev]);
        setValidationErrors([]);
        closeSlotPanel();
        return true;
      } catch (error: unknown) {
        setValidationErrors([
          { field: 'general', message: extractErrorMsg(error, 'Failed to create slots') },
        ]);
        return false;
      }
    },
    [validateSlot, closeSlotPanel],
  );

  const onApplyQuickEdit = useCallback(async () => {
    if (!currentSlot) {
      return;
    }
    const nextMentions =
      mentionsDraft ?? (Array.isArray(currentSlot.mentions) ? currentSlot.mentions : []);
    const payload = {
      name: currentSlot.name ?? null,
      location: propertyDraft?.location ?? currentSlot.location,
      slot_time: currentSlot.slot_time,
      slot_end: currentSlot.slot_end ?? null,
      address: currentSlot.address ?? null,
      category: currentSlot.category ?? null,
      capacity: currentSlot.capacity,
      visible: propertyDraft?.visible ?? currentSlot.visible,
      notifications_enabled:
        propertyDraft?.notifications_enabled ?? currentSlot.notifications_enabled,
      contact_id: nextMentions[0]?.contactId ?? null,
      mentions: nextMentions,
    };
    const success = await saveSlot(payload, currentSlot.id);
    if (success) {
      setMentionsDraft(null);
      setPropertyDraft(null);
    }
  }, [currentSlot, mentionsDraft, propertyDraft, saveSlot]);

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
    setPropertyDraft(null);
    setShowDiscardQuickEditDialog(false);
  }, []);

  const setPropertyDraftField = useCallback(
    (field: 'visible' | 'notifications_enabled' | 'location', value: boolean | string | null) => {
      setPropertyDraft((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const deleteSlot = useCallback(
    async (id: string) => {
      try {
        await slotsApi.deleteSlot(id);
        setSlots((prev) => prev.filter((s) => s.id !== id));
        if (currentSlot?.id === id) {
          closeSlotPanel();
        }
      } catch (error: unknown) {
        const detail = extractErrorMsg(error, '');
        alert(detail ? `${t('slots.deleteSlotFailed')}: ${detail}` : t('slots.deleteSlotFailed'));
      }
    },
    [currentSlot, closeSlotPanel, t],
  );

  const deleteSlots = useCallback(
    async (ids: string[]) => {
      const unique = Array.from(new Set(ids.map(String).filter(Boolean)));
      if (unique.length === 0) {
        return;
      }
      try {
        await bulkApi.bulkDelete('slots', unique);
        setSlots((prev) => prev.filter((s) => !unique.includes(s.id)));
        if (currentSlot && unique.includes(currentSlot.id)) {
          closeSlotPanel();
        }
        clearSlotSelectionCore();
      } catch (error: unknown) {
        alert(extractErrorMsg(error, 'Failed to delete slots'));
      }
    },
    [currentSlot, closeSlotPanel, clearSlotSelectionCore],
  );

  const getPanelTitle = useCallback(
    (mode: string, item: Slot | null) => {
      if (mode === 'view' && item) {
        return item.location
          ? `${item.location} · ${new Date(item.slot_time).toLocaleString('sv-SE')}`
          : new Date(item.slot_time).toLocaleString('sv-SE');
      }
      if (mode === 'edit') {
        return t('slots.editSlot');
      }
      if (mode === 'create') {
        return t('slots.newSlot');
      }
      if (mode === 'settings') {
        return t('slots.settingsSlots');
      }
      return t('slots.slot');
    },
    [t],
  );

  const getPanelSubtitle = useCallback(
    (mode: string, item: Slot | null) => {
      if (mode === 'view' && item) {
        const d = item.slot_time ? new Date(item.slot_time) : null;
        const passed = isSlotTimePast(item.slot_time);
        return (
          <span className="flex flex-col gap-1 items-start">
            <span className="text-xs text-muted-foreground">
              {item.location || '—'}
              {d ? ` · ${d.toLocaleString('sv-SE')}` : ''}
            </span>
            {passed && (
              <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                {t('slots.slotDatePassed')}
              </span>
            )}
          </span>
        );
      }
      if (mode === 'edit') {
        return t('slots.editSlotDetails');
      }
      if (mode === 'create') {
        return t('slots.addNewSlot');
      }
      return '';
    },
    [t],
  );

  const getDeleteMessage = useCallback(
    (item: Slot | null) => {
      if (!item) {
        return t('slots.deleteSlotConfirm');
      }
      const loc = item.location || t('slots.slot');
      return t('slots.deleteSlotConfirmNamed', { location: loc });
    },
    [t],
  );

  const getDuplicateConfig = useCallback((item: Slot | null) => {
    if (!item) {
      return null;
    }
    const baseName =
      item.name?.trim() ||
      item.location?.trim() ||
      (item.slot_time ? new Date(item.slot_time).toLocaleString('sv-SE') : 'Slot');
    return {
      defaultName: `Copy of ${baseName}`,
      nameLabel: 'Name',
      confirmOnly: false,
    };
  }, []);

  const executeDuplicate = useCallback(
    async (
      item: Slot,
      newName: string,
    ): Promise<{ closePanel: () => void; highlightId?: string }> => {
      const nextName = (newName ?? '').trim();
      const copy = {
        name: nextName || (item.name ?? null),
        location: item.location ?? null,
        slot_time: item.slot_time,
        slot_end: item.slot_end ?? null,
        address: item.address ?? null,
        category: item.category ?? null,
        capacity: item.capacity,
        visible: item.visible,
        notifications_enabled: item.notifications_enabled,
        contact_id: item.contact_id ?? null,
        mentions: item.mentions ?? [],
        description: item.description ?? null,
      };
      const newSlot = await slotsApi.createSlot(copy);
      setSlots((prev) => [newSlot, ...prev]);
      const highlightId =
        newSlot?.id !== null && newSlot?.id !== undefined ? String(newSlot.id) : undefined;
      return { closePanel: closeSlotPanel, highlightId };
    },
    [closeSlotPanel],
  );

  const value: SlotsContextType = {
    isSlotsPanelOpen,
    currentSlot,
    panelMode,
    validationErrors,
    slots,
    openSlotPanel,
    openSlotForEdit,
    openSlotForView,
    openSlotSettings,
    closeSlotSettingsView,
    closeSlotPanel,
    slotsContentView,
    saveSlot,
    saveSlots,
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
    canSendMessages,
    canSendEmail,
    displayMentions,
    addContactToDraft,
    removeContactFromDraft,
    propertyDraft,
    setPropertyDraftField,
    hasQuickEditChanges,
    onApplyQuickEdit,
    showDiscardQuickEditDialog,
    setShowDiscardQuickEditDialog,
    getCloseHandler,
    onDiscardQuickEditAndClose,

    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex: currentItemIndex === -1 ? 0 : currentItemIndex + 1,
    totalItems,

    detailFooterActions,
    showSendMessageDialog,
    sendMessageRecipients,
    closeSendMessageDialog,

    showSendEmailDialog,
    sendEmailRecipients,
    sendEmailSlot,
    closeSendEmailDialog,
  };

  return <SlotsContext.Provider value={value}>{children}</SlotsContext.Provider>;
}

export function useSlotsContext() {
  const ctx = useContext(SlotsContext);
  if (ctx === undefined) {
    throw new Error('useSlotsContext must be used within SlotsProvider');
  }
  return ctx;
}
