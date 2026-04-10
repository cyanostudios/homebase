import { Mail, MessageCircle, Store } from 'lucide-react';
import React, { useEffect, useCallback, useMemo, useRef, useState, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { useActionRegistry } from '@/core/api/ActionContext';
import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { usePluginDuplicate } from '@/core/hooks/usePluginDuplicate';
import { usePluginNavigation } from '@/core/hooks/usePluginNavigation';
import { usePluginValidation } from '@/core/hooks/usePluginValidation';
import type { BulkEmailRecipient } from '@/core/ui/BulkEmailDialog';
import type { BulkMessageRecipient } from '@/core/ui/BulkMessageDialog';
import { buildDeleteMessage } from '@/core/utils/deleteUtils';
import { exportItems, type ExportFormat } from '@/core/utils/exportUtils';
import { resolveSlug } from '@/core/utils/slugUtils';

import { slotsApi } from '../api/slotsApi';
import { Slot, ValidationError, type SlotMention } from '../types/slots';
import { resolveSlotsToContacts, resolveSlotsToEmailContacts } from '../utils/slotContactUtils';
import { getSlotExportBaseFilename, slotExportConfig } from '../utils/slotExportConfig';
import { isSlotTimePast } from '../utils/slotTimeUtils';

import { SlotsContext } from './SlotsContext';
import type { SlotsContextType } from './SlotsContext';

function extractErrorMsg(error: unknown, fallback: string): string {
  const e = error as { message?: string; error?: string };
  return e?.message || e?.error || fallback;
}

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
  const location = useLocation();
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

  useEffect(() => {
    const unregister = registerAction('match', {
      id: 'create-slot-from-match',
      label: t('app.createSlotFromMatch'),
      icon: Store,
      variant: 'primary',
      className:
        'h-9 text-xs px-3 text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-950/30',
      onClick: () => {},
    });
    return () => unregister?.();
  }, [registerAction, t]);

  const [isSlotsPanelOpen, setIsSlotsPanelOpen] = useState(false);
  const [currentSlot, setCurrentSlot] = useState<Slot | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view' | 'settings'>('create');
  const { validationErrors, setValidationErrors, clearValidationErrors } =
    usePluginValidation<ValidationError>();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsContentView, setSlotsContentView] = useState<'list' | 'settings'>('list');
  const [recentlyDuplicatedSlotId, setRecentlyDuplicatedSlotId] = useState<string | null>(null);
  const [mentionsDraft, setMentionsDraft] = useState<SlotMention[] | null>(null);
  const [propertyDraft, setPropertyDraft] = useState<
    Partial<Pick<Slot, 'visible' | 'notifications_enabled' | 'location'>>
  >({});
  const [showDiscardQuickEditDialog, setShowDiscardQuickEditDialog] = useState(false);
  const [showSendMessageDialog, setShowSendMessageDialog] = useState(false);
  const [sendMessageRecipients, setSendMessageRecipients] = useState<BulkMessageRecipient[]>([]);
  const [showSendEmailDialog, setShowSendEmailDialog] = useState(false);
  const [sendEmailRecipients, setSendEmailRecipients] = useState<BulkEmailRecipient[]>([]);
  const [sendEmailSlot, setSendEmailSlot] = useState<Slot | null>(null);

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
    mergeIntoSelection: mergeIntoSlotSelectionCore,
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
  }, [navigateToBase, setValidationErrors]);

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
  }, [t, setValidationErrors]);

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
    if (data.slot_end && data.slot_time) {
      const start = new Date(data.slot_time as string).getTime();
      const end = new Date(data.slot_end as string).getTime();
      if (end <= start) {
        errors.push({ field: 'slot_end', message: 'End time must be after start time' });
      }
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
    [onCloseOtherPanels, clearSlotSelectionCore, navigateToItem, slots, setValidationErrors],
  );

  const openSlotForEdit = useCallback(
    (slot: Slot) => {
      clearSlotSelectionCore();
      setRecentlyDuplicatedSlotId(null);
      setCurrentSlot(slot);
      setMentionsDraft(null);
      setPropertyDraft({});
      setPanelMode('edit');
      setIsSlotsPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(slot, slots, (i: any) =>
        i.slot_time ? String(i.slot_time).slice(0, 10) : '',
      );
    },
    [onCloseOtherPanels, clearSlotSelectionCore, navigateToItem, slots, setValidationErrors],
  );

  const openSlotForView = useCallback(
    (slot: Slot) => {
      setRecentlyDuplicatedSlotId(null);
      setCurrentSlot(slot);
      setMentionsDraft(null);
      setPropertyDraft({});
      setPanelMode('view');
      setIsSlotsPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(slot, slots, (i: any) =>
        i.slot_time ? String(i.slot_time).slice(0, 10) : '',
      );
    },
    [onCloseOtherPanels, navigateToItem, slots, setValidationErrors],
  );

  const openSlotForViewRef = useRef(openSlotForView);
  useEffect(() => {
    openSlotForViewRef.current = openSlotForView;
  }, [openSlotForView]);

  const slotsSlugField = useCallback(
    (i: Record<string, any>) => (i.slot_time ? String(i.slot_time).slice(0, 10) : ''),
    [],
  );

  const slotsDeepLinkPathSyncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (slots.length === 0) {
      return;
    }
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments[0] !== 'slots') {
      return;
    }
    const slug = segments[1] ?? '';
    if (!slug) {
      slotsDeepLinkPathSyncedRef.current = location.pathname;
      return;
    }
    const pathKey = location.pathname;
    if (slotsDeepLinkPathSyncedRef.current === pathKey) {
      return;
    }
    const item = resolveSlug(slug, slots, slotsSlugField);
    slotsDeepLinkPathSyncedRef.current = pathKey;
    if (item) {
      openSlotForViewRef.current(item as Slot);
    }
  }, [location.pathname, slots, slotsSlugField]);

  const openSlotForViewBridge = useCallback((slot: Slot) => {
    openSlotForViewRef.current(slot);
  }, []);

  useEffect(() => {
    registerSlotsNavigation(openSlotForViewBridge);
    return () => registerSlotsNavigation(null);
  }, [registerSlotsNavigation, openSlotForViewBridge]);

  const {
    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex,
    totalItems,
  } = usePluginNavigation(slots, currentSlot, openSlotForView);

  useEffect(() => {
    setMentionsDraft(null);
    setPropertyDraft({});
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
    [currentSlot, validateSlot, closeSlotPanel, setValidationErrors],
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
    [validateSlot, closeSlotPanel, setValidationErrors],
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
      setPropertyDraft({});
    }
  }, [currentSlot, mentionsDraft, propertyDraft, saveSlot]);

  const getCloseHandler = useCallback(
    (defaultClose: () => void) => {
      return () => {
        if (hasQuickEditChanges) {
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
    setPropertyDraft({});
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
        setValidationErrors([
          {
            field: 'general',
            message: detail
              ? `${t('slots.deleteSlotFailed')}: ${detail}`
              : t('slots.deleteSlotFailed'),
          },
        ]);
      }
    },
    [currentSlot, closeSlotPanel, t, setValidationErrors],
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
        setValidationErrors([
          { field: 'general', message: extractErrorMsg(error, 'Failed to delete slots') },
        ]);
      }
    },
    [currentSlot, closeSlotPanel, clearSlotSelectionCore, setValidationErrors],
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
    (item: Slot | null) => buildDeleteMessage(t, 'slots', item?.location || undefined),
    [t],
  );

  const createSlotDuplicate = useCallback(async (item: Slot, newName: string): Promise<Slot> => {
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
    return newSlot;
  }, []);

  const { getDuplicateConfig, executeDuplicate } = usePluginDuplicate({
    getDefaultName: (item: Slot) => {
      const base =
        item.name?.trim() ||
        item.location?.trim() ||
        (item.slot_time ? new Date(item.slot_time).toLocaleString('sv-SE') : 'Slot');
      return `Copy of ${base}`;
    },
    nameLabel: 'Name',
    confirmOnly: false,
    createDuplicate: createSlotDuplicate,
    closePanel: closeSlotPanel,
  });

  const exportFormats: ExportFormat[] = ['txt', 'csv', 'pdf'];

  const onExportItem = useCallback(
    (format: ExportFormat, item: Slot) => {
      const result = exportItems({
        items: [item],
        format,
        config: slotExportConfig,
        filename: getSlotExportBaseFilename(item),
        title: 'Slots Export',
      });
      if (result && typeof (result as Promise<void>).then === 'function') {
        (result as Promise<void>).catch((err) => {
          console.error('Export failed:', err);
          setValidationErrors([{ field: 'general', message: 'Export failed. Please try again.' }]);
        });
      }
    },
    [setValidationErrors],
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
    mergeIntoSlotSelection: mergeIntoSlotSelectionCore,
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
    currentItemIndex,
    totalItems,
    exportFormats,
    onExportItem,
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
