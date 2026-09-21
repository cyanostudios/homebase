import {
  ClipboardList,
  History,
  Info,
  Paperclip,
  Search,
  SlidersHorizontal,
  StickyNote,
  User,
  Users,
} from 'lucide-react';
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/core/api/AppContext';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { BADGE_CHIP_CLASS } from '@/core/ui/badgeStyles';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_PROP_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import {
  FORM_GHOST_INPUT_CLASS,
  FORM_GHOST_TEXTAREA_CLASS,
  FORM_INPUT_ERROR_CLASS,
} from '@/core/ui/formFieldStyles';
import { DETAIL_FORM_TITLE_INPUT_CLASS, PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { syncTextareaHeight } from '@/core/ui/syncTextareaHeight';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';
import { FileAttachmentsSection } from '@/plugins/files/components/FileAttachmentsSection';

import type { RequestPayload } from '../api/requestsApi';
import { useRequests } from '../hooks/useRequests';
import type { Request } from '../types/requests';
import { REQUEST_SOURCE_COLORS, responseDueAtFromDays } from '../types/requests';
import { findRequestTypeConfig, intakeFieldLabelKey } from '../utils/requestTypeConfig';

import { RequestAssignedTeamSelect } from './RequestAssignedTeamSelect';
import { RequestAssigneeSelect } from './RequestAssigneeSelect';
import { RequestPrioritySelect } from './RequestPrioritySelect';
import { RequestResponseDueControl } from './RequestResponseDueControl';
import { RequestStatusSelect } from './RequestStatusSelect';
import { RequestTypeSelect } from './RequestTypeSelect';

type RequestFormTab = 'information' | 'assignees' | 'files' | 'activity';

const REQUEST_FORM_TABS: RequestFormTab[] = ['information', 'assignees', 'files', 'activity'];

/** Visible in edit for shell parity with View, but not selectable while editing. */
const REQUEST_FORM_EDIT_DISABLED_TABS: ReadonlySet<RequestFormTab> = new Set(['activity']);

function parseRequestFormTab(value: string | null): RequestFormTab {
  if (value === 'properties') {
    return 'information';
  }
  if (value && REQUEST_FORM_TABS.includes(value as RequestFormTab)) {
    return value as RequestFormTab;
  }
  return 'information';
}

const FACT_LABEL_CLASS =
  'mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';

interface RequestFormProps {
  currentRequest?: Request | null;
  currentItem?: Request | null;
  onSave: (data: RequestPayload) => Promise<boolean>;
  onCancel: () => void;
  /** Reserved for mail-style list detail column (form is already single-column). */
  stacked?: boolean;
}

export const RequestForm = React.forwardRef<PanelFormHandle, RequestFormProps>(function RequestForm(
  { currentRequest, currentItem, onSave, onCancel, stacked: _stacked = false },
  ref,
) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseRequestFormTab(searchParams.get('tab'));
  const setActiveTab = useCallback(
    (tab: RequestFormTab, replace = false) => {
      if (REQUEST_FORM_EDIT_DISABLED_TABS.has(tab)) {
        return;
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'information') {
            next.delete('tab');
          } else {
            next.set('tab', tab);
          }
          return next;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  const { validationErrors, clearValidationErrors, requestTypes } = useRequests();
  const { contacts, user } = useApp();
  const hasFilesPlugin = (user?.plugins ?? []).includes('files');
  const enabledPlugins = useEnabledPlugins();
  const hasTeamsPlugin = enabledPlugins.has('teams');
  const item = currentRequest ?? currentItem ?? null;

  const { showWarning, markDirty, markClean, attemptAction, confirmDiscard, cancelDiscard } =
    useUnsavedChanges();
  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
    useGlobalNavigationGuard();

  const createCreatedAtRef = React.useRef(new Date().toISOString());

  const [form, setForm] = useState({
    title: '',
    description: '',
    requestType: 'general' as Request['requestType'],
    status: 'not started' as Request['status'],
    priority: 'Medium' as Request['priority'],
    teamId: '' as string,
    submitterName: '',
    submitterEmail: '',
    contactId: '' as string,
    assignedToIds: [] as string[],
    internalNotes: '',
    responseDueAt: responseDueAtFromDays(7, createCreatedAtRef.current),
  });
  const [extraData, setExtraData] = useState<Record<string, string>>({});
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const internalNotesTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [contactSearch, setContactSearch] = useState('');
  const [showContactSuggestions, setShowContactSuggestions] = useState(false);

  useEffect(() => {
    const formKey = `request-form-${item?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => true);
    return () => {
      unregisterUnsavedChangesChecker(formKey);
    };
  }, [item, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  useEffect(() => {
    if (!REQUEST_FORM_EDIT_DISABLED_TABS.has(activeTab)) {
      return;
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('tab');
        return next;
      },
      { replace: true },
    );
  }, [activeTab, setSearchParams]);

  useEffect(() => {
    if (activeTab === 'files' && !hasFilesPlugin) {
      setActiveTab('information', true);
    }
  }, [activeTab, hasFilesPlugin, setActiveTab]);

  useEffect(() => {
    if (item) {
      setForm({
        title: item.title || '',
        description: item.description || '',
        requestType: item.requestType || 'general',
        status: item.status || 'not started',
        priority: item.priority || 'Medium',
        teamId: item.teamId != null ? String(item.teamId) : '',
        submitterName: item.submitterName || '',
        submitterEmail: item.submitterEmail || '',
        contactId: item.contactId || '',
        assignedToIds: item.assignedToIds || [],
        internalNotes: item.internalNotes || '',
        responseDueAt:
          item.responseDueAt ||
          responseDueAtFromDays(7, item.created_at || createCreatedAtRef.current),
      });
      setExtraData(item.extraData ? { ...item.extraData } : {});
    } else {
      createCreatedAtRef.current = new Date().toISOString();
      setForm({
        title: '',
        description: '',
        requestType: 'general',
        status: 'not started',
        priority: 'Medium',
        teamId: '',
        submitterName: '',
        submitterEmail: '',
        contactId: '',
        assignedToIds: [],
        internalNotes: '',
        responseDueAt: responseDueAtFromDays(7, createCreatedAtRef.current),
      });
      setExtraData({});
    }
    markClean();
  }, [item?.id, markClean]);

  useLayoutEffect(() => {
    if (activeTab !== 'information') {
      return;
    }
    syncTextareaHeight(descriptionTextareaRef.current);
    syncTextareaHeight(internalNotesTextareaRef.current);
  }, [activeTab, form.description, form.internalNotes, extraData]);

  const typeConfig = useMemo(
    () => findRequestTypeConfig(requestTypes, form.requestType),
    [requestTypes, form.requestType],
  );
  const intakeSchema =
    typeConfig?.plugin === 'garments' && Array.isArray(typeConfig.intakeSchema)
      ? typeConfig.intakeSchema
      : null;
  const showPluginIntake = Boolean(intakeSchema && intakeSchema.length > 0);

  const updateForm = useCallback(
    <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      markDirty();
      clearValidationErrors();
    },
    [markDirty, clearValidationErrors],
  );

  const handleTypeChange = useCallback(
    (requestType: string) => {
      setForm((prev) => ({ ...prev, requestType }));
      setExtraData({});
      markDirty();
      clearValidationErrors();
    },
    [markDirty, clearValidationErrors],
  );

  const updateExtraField = useCallback(
    (key: string, value: string) => {
      setExtraData((prev) => ({ ...prev, [key]: value }));
      markDirty();
      clearValidationErrors();
    },
    [markDirty, clearValidationErrors],
  );

  const blockingValidationErrors = validationErrors.filter(
    (error) => !error.message.includes('Warning'),
  );
  const titleError = validationErrors.find((e) => e.field === 'title')?.message;

  const createdAtForDue = item?.created_at ?? createCreatedAtRef.current;

  const formRequestStub = useMemo(
    () =>
      ({
        ...(item ?? {}),
        id: item?.id ?? 'new',
        title: form.title,
        description: form.description,
        requestType: form.requestType,
        status: form.status,
        priority: form.priority,
        teamId: form.teamId || null,
        submitterName: form.submitterName,
        submitterEmail: form.submitterEmail,
        contactId: form.contactId || null,
        assignedToIds: form.assignedToIds,
        internalNotes: form.internalNotes,
        source: item?.source ?? 'internal',
        responseDueAt: form.responseDueAt,
        created_at: createdAtForDue,
        updated_at: item?.updated_at ?? createdAtForDue,
      }) as Request,
    [item, form, createdAtForDue],
  );

  const handleSubmit = useCallback(async () => {
    const payloadExtra = showPluginIntake
      ? Object.fromEntries(
          Object.entries(extraData)
            .map(([key, value]) => [key, value.trim()] as const)
            .filter(([, value]) => value.length > 0),
        )
      : null;

    const payload: RequestPayload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      request_type: form.requestType,
      status: form.status,
      priority: form.priority,
      team_id: form.teamId ? Number(form.teamId) : null,
      submitter_name: form.submitterName.trim() || null,
      submitter_email: form.submitterEmail.trim() || null,
      contact_id: form.contactId || null,
      assigned_to_ids: form.assignedToIds,
      internal_notes: form.internalNotes.trim() || null,
      response_due_at: form.responseDueAt || null,
      extra_data: showPluginIntake ? (payloadExtra ?? {}) : null,
    };
    const success = await onSave(payload);
    if (success) {
      markClean();
    }
    return success;
  }, [form, extraData, showPluginIntake, onSave, markClean]);

  const handleCancel = useCallback(() => {
    attemptAction(
      () => {
        onCancel();
      },
      { force: true },
    );
  }, [attemptAction, onCancel]);

  useImperativeHandle(ref, () => ({ submit: handleSubmit, cancel: handleCancel }), [
    handleSubmit,
    handleCancel,
  ]);

  const linkedContact = useMemo(
    () =>
      form.contactId ? (contacts as any[]).find((c) => String(c.id) === form.contactId) : null,
    [contacts, form.contactId],
  );

  const contactSuggestions = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    return (contacts as any[])
      .filter((c) => {
        if (form.contactId && String(c.id) === form.contactId) {
          return false;
        }
        if (!q) {
          return true;
        }
        return [c.companyName, c.email, c.phone]
          .filter(Boolean)
          .some((v: string) => v.toLowerCase().includes(q));
      })
      .slice(0, 20);
  }, [contacts, contactSearch, form.contactId]);

  const assigneeCount = form.assignedToIds.length;

  const tabs = useMemo(() => {
    const next: Array<{
      id: RequestFormTab;
      label: string;
      icon: typeof Info;
      count: number | null;
    }> = [
      {
        id: 'information',
        label: t('requests.tabs.information'),
        icon: Info,
        count: null,
      },
      {
        id: 'assignees',
        label: t('requests.tabs.assignees'),
        icon: Users,
        count: assigneeCount > 0 ? assigneeCount : null,
      },
    ];
    if (hasFilesPlugin) {
      next.push({
        id: 'files',
        label: t('requests.tabs.files'),
        icon: Paperclip,
        count: null,
      });
    }
    next.push({
      id: 'activity',
      label: t('requests.tabs.activity'),
      icon: History,
      count: null,
    });
    return next;
  }, [assigneeCount, hasFilesPlugin, t]);

  const tabChips = (
    <div className={LIST_FILTER_CHIP_ROW_CLASS}>
      {tabs.map((tab) => {
        const TabIcon = tab.icon;
        const isDisabled = REQUEST_FORM_EDIT_DISABLED_TABS.has(tab.id);
        const isActive = !isDisabled && activeTab === tab.id;
        return (
          <Button
            key={tab.id}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isActive}
            aria-disabled={isDisabled}
            disabled={isDisabled}
            title={
              isDisabled
                ? t('requests.tabUnavailableInEdit', {
                    defaultValue: 'Available in view mode only',
                  })
                : undefined
            }
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              isDisabled && 'pointer-events-none opacity-40',
            )}
          >
            <TabIcon className="h-3.5 w-3.5" />
            <span>
              {tab.label}
              {tab.count != null ? (
                <>
                  {' '}
                  <span className="tabular-nums font-semibold">({tab.count})</span>
                </>
              ) : null}
            </span>
          </Button>
        );
      })}
    </div>
  );

  const formHeader = (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex flex-col')}>
      <div className="px-4 py-5">
        <div className="min-w-0 flex-1">
          <Input
            id="request-title"
            value={form.title}
            onChange={(e) => updateForm('title', e.target.value)}
            placeholder={t('requests.form.titlePlaceholder')}
            aria-label={t('requests.form.title')}
            className={cn(
              DETAIL_FORM_TITLE_INPUT_CLASS,
              PLUGIN_PAGE_TITLE_CLASS,
              'min-w-0 tracking-[0.003em]',
              titleError && FORM_INPUT_ERROR_CLASS,
            )}
            required
          />
          {titleError ? (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{titleError}</p>
          ) : null}
        </div>
        <div className="mt-4">{tabChips}</div>
      </div>
    </Card>
  );

  const informationTab = (
    <>
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection title={t('requests.form.details')} className="p-6" prominentTitle>
          <div>
            <Label className="mb-1">{t('requests.form.description')}</Label>
            <Textarea
              ref={descriptionTextareaRef}
              value={form.description}
              onChange={(e) => {
                updateForm('description', e.target.value);
                syncTextareaHeight(e.currentTarget);
              }}
              placeholder={t('requests.form.descriptionPlaceholder')}
              rows={3}
              className={FORM_GHOST_TEXTAREA_CLASS}
            />
          </div>
        </DetailSection>
      </Card>

      {showPluginIntake && intakeSchema ? (
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection
            title={t('requests.form.pluginDetails')}
            icon={ClipboardList}
            iconPlugin="requests"
            subtleTitle
            className="p-6"
          >
            <p className="mb-4 text-xs text-muted-foreground">
              {t('requests.form.pluginDetailsHint')}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {intakeSchema.map((field) => {
                const required = field.required === true;
                const isComment = field.key === 'comment';
                return (
                  <div key={field.key} className={cn('space-y-1', isComment && 'sm:col-span-2')}>
                    <Label className="text-xs">
                      {t(intakeFieldLabelKey(field.key))}
                      {required ? <span className="text-red-500"> *</span> : null}
                    </Label>
                    {isComment ? (
                      <Textarea
                        value={extraData[field.key] || ''}
                        onChange={(e) => {
                          updateExtraField(field.key, e.target.value);
                          syncTextareaHeight(e.currentTarget);
                        }}
                        rows={2}
                        required={required}
                        aria-required={required}
                        className={FORM_GHOST_TEXTAREA_CLASS}
                      />
                    ) : (
                      <Input
                        value={extraData[field.key] || ''}
                        onChange={(e) => updateExtraField(field.key, e.target.value)}
                        required={required}
                        aria-required={required}
                        className={FORM_GHOST_INPUT_CLASS}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </DetailSection>
        </Card>
      ) : null}

      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('requests.view.properties')}
          icon={SlidersHorizontal}
          subtleTitle
          className="p-6"
        >
          <div>
            <div className={DETAIL_PROP_ROW_CLASS}>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('requests.form.requestType')}
              </span>
              <RequestTypeSelect
                request={formRequestStub}
                onTypeChange={handleTypeChange}
                hideInlineLabel
              />
            </div>
            <div className={DETAIL_PROP_ROW_CLASS}>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('requests.form.status')}
              </span>
              <RequestStatusSelect
                request={formRequestStub}
                onStatusChange={(status) => updateForm('status', status)}
                hideInlineLabel
              />
            </div>
            <div className={DETAIL_PROP_ROW_CLASS}>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('requests.form.priority')}
              </span>
              <RequestPrioritySelect
                request={formRequestStub}
                onPriorityChange={(priority) => updateForm('priority', priority)}
                hideInlineLabel
              />
            </div>
            <div className={DETAIL_PROP_ROW_CLASS}>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('requests.responseDue.label')}
              </span>
              <RequestResponseDueControl
                request={{
                  responseDueAt: form.responseDueAt,
                  created_at: createdAtForDue,
                }}
                onDaysChange={(_days, responseDueAt) => updateForm('responseDueAt', responseDueAt)}
                hideInlineLabel
              />
            </div>
            {item ? (
              <div className={DETAIL_PROP_ROW_CLASS}>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {t('requests.view.source')}
                </span>
                <Badge
                  variant="outline"
                  className={cn(BADGE_CHIP_CLASS, REQUEST_SOURCE_COLORS[item.source])}
                >
                  {item.source === 'external'
                    ? t('requests.sourceExternal')
                    : t('requests.sourceInternal')}
                </Badge>
              </div>
            ) : null}
          </div>
        </DetailSection>
      </Card>

      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('requests.view.submitter')}
          icon={User}
          iconPlugin="requests"
          subtleTitle
          className="p-6"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">{t('requests.form.submitterName')}</Label>
                <Input
                  value={form.submitterName}
                  onChange={(e) => updateForm('submitterName', e.target.value)}
                  placeholder={t('requests.form.submitterNamePlaceholder')}
                  className={FORM_GHOST_INPUT_CLASS}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('requests.form.submitterEmail')}</Label>
                <Input
                  type="email"
                  value={form.submitterEmail}
                  onChange={(e) => updateForm('submitterEmail', e.target.value)}
                  placeholder={t('requests.form.submitterEmailPlaceholder')}
                  className={FORM_GHOST_INPUT_CLASS}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">{t('requests.form.linkedContact')}</Label>
              {linkedContact ? (
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-xs font-medium">
                      {linkedContact.companyName ?? `Contact ${linkedContact.id}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateForm('contactId', '')}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {t('common.remove')}
                  </button>
                </div>
              ) : (
                <Popover
                  open={showContactSuggestions && contactSuggestions.length > 0}
                  onOpenChange={setShowContactSuggestions}
                >
                  <PopoverAnchor asChild>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={contactSearch}
                        onChange={(e) => {
                          setContactSearch(e.target.value);
                          setShowContactSuggestions(true);
                        }}
                        onFocus={() => setShowContactSuggestions(true)}
                        placeholder={t('requests.form.searchContact')}
                        className={cn(FORM_GHOST_INPUT_CLASS, 'pl-9')}
                      />
                    </div>
                  </PopoverAnchor>
                  <PopoverContent
                    align="start"
                    side="bottom"
                    sideOffset={4}
                    className="z-[120] w-[var(--radix-popover-trigger-width)] max-h-52 overflow-y-auto rounded-xl border border-border/60 bg-popover p-1 shadow-xl"
                  >
                    {contactSuggestions.map((c: any) => (
                      <button
                        key={c.id}
                        type="button"
                        className="flex w-full items-start rounded-lg px-2.5 py-2 text-left hover:bg-accent"
                        onClick={() => {
                          updateForm('contactId', String(c.id));
                          setContactSearch('');
                          setShowContactSuggestions(false);
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium">
                            {c.companyName ?? `Contact ${c.id}`}
                          </span>
                          {c.email && (
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {c.email}
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              )}
            </div>

            <div>
              <Label htmlFor="request-internal-notes" className={FACT_LABEL_CLASS}>
                <StickyNote className="h-3 w-3" />
                {t('requests.form.internalNotes')}
              </Label>
              <Textarea
                ref={internalNotesTextareaRef}
                id="request-internal-notes"
                value={form.internalNotes}
                onChange={(e) => {
                  updateForm('internalNotes', e.target.value);
                  syncTextareaHeight(e.currentTarget);
                }}
                placeholder={t('requests.form.internalNotesPlaceholder')}
                rows={3}
                className={FORM_GHOST_TEXTAREA_CLASS}
              />
            </div>
          </div>
        </DetailSection>
      </Card>
    </>
  );

  const assigneesTab = (
    <div className="space-y-6">
      <RequestAssigneeSelect
        request={{ assignedToIds: form.assignedToIds }}
        onAssigneeChange={(ids) => updateForm('assignedToIds', ids)}
      />
      {hasTeamsPlugin ? (
        <RequestAssignedTeamSelect
          request={{ teamId: form.teamId || null }}
          onTeamChange={(teamId) => updateForm('teamId', teamId ?? '')}
        />
      ) : null}
    </div>
  );

  const filesTab = hasFilesPlugin ? (
    <div className="space-y-2">
      {!item ? (
        <p className="px-1 text-xs text-muted-foreground">
          {t('requests.form.attachmentsAfterSave')}
        </p>
      ) : null}
      <FileAttachmentsSection pluginName="requests" entityId={item?.id} />
    </div>
  ) : null;

  return (
    <>
      <DetailLayout gridClassName="grid-cols-1">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          {formHeader}

          {blockingValidationErrors.length > 0 ? (
            <Card className="border-destructive/50 bg-destructive/5 p-4 shadow-none">
              <div className="text-sm font-medium text-destructive">{t('common.cannotSave')}</div>
              <ul className="mt-2 list-inside list-disc text-sm text-destructive/90">
                {blockingValidationErrors.map((error) => (
                  <li key={`${error.field}-${error.message}`}>{error.message}</li>
                ))}
              </ul>
            </Card>
          ) : null}

          {activeTab === 'information' ? informationTab : null}
          {activeTab === 'assignees' ? assigneesTab : null}
          {activeTab === 'files' ? filesTab : null}
        </form>
      </DetailLayout>
      <ConfirmDialog
        isOpen={showWarning}
        title={t('dialog.unsavedChanges')}
        message={item ? t('dialog.discardAndReturn') : t('dialog.discardAndClose')}
        confirmText={t('dialog.discardChanges')}
        cancelText={t('dialog.continueEditing')}
        onConfirm={confirmDiscard}
        onCancel={cancelDiscard}
        variant="warning"
      />
    </>
  );
});
