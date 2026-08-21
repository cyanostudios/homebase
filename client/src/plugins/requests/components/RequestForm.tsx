import { Search, SlidersHorizontal, StickyNote, User } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/core/api/AppContext';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_PROP_ROW_CLASS, DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';
import { FileAttachmentsSection } from '@/plugins/files/components/FileAttachmentsSection';

import type { RequestPayload } from '../api/requestsApi';
import { useRequests } from '../hooks/useRequests';
import type { Request } from '../types/requests';
import { REQUEST_SOURCE_COLORS, responseDueAtFromDays } from '../types/requests';

import { RequestAssignedTeamSelect } from './RequestAssignedTeamSelect';
import { RequestAssigneeSelect } from './RequestAssigneeSelect';
import { RequestPrioritySelect } from './RequestPrioritySelect';
import { RequestResponseDueControl } from './RequestResponseDueControl';
import { RequestStatusSelect } from './RequestStatusSelect';
import { RequestTypeSelect } from './RequestTypeSelect';

const FACT_LABEL_CLASS =
  'mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';

interface RequestFormProps {
  currentRequest?: Request | null;
  currentItem?: Request | null;
  onSave: (data: RequestPayload) => Promise<boolean>;
  onCancel: () => void;
}

export const RequestForm = React.forwardRef<PanelFormHandle, RequestFormProps>(function RequestForm(
  { currentRequest, currentItem, onSave, onCancel },
  ref,
) {
  const { t } = useTranslation();
  const { validationErrors, clearValidationErrors } = useRequests();
  const { contacts, user } = useApp();
  const hasFilesPlugin = (user?.plugins ?? []).includes('files');
  const enabledPlugins = useEnabledPlugins();
  const hasTeamsPlugin = enabledPlugins.has('teams');
  const item = currentRequest ?? currentItem ?? null;

  const { showWarning, markDirty, markClean, attemptAction, confirmDiscard, cancelDiscard } =
    useUnsavedChanges();

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

  const [contactSearch, setContactSearch] = useState('');
  const [showContactSuggestions, setShowContactSuggestions] = useState(false);

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
    }
    markClean();
  }, [item?.id, markClean]);

  const updateForm = useCallback(
    <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
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
    };
    const success = await onSave(payload);
    if (success) {
      markClean();
    }
    return success;
  }, [form, onSave, markClean]);

  const handleCancel = useCallback(() => {
    attemptAction(onCancel);
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

  const formLeftSidebar = (
    <div className="space-y-6">
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection title={t('requests.form.details')} className="p-6" prominentTitle>
          <div className="space-y-4">
            <div>
              <Label htmlFor="request-title" className="mb-1">
                {t('requests.form.title')} *
              </Label>
              <Input
                id="request-title"
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
                placeholder={t('requests.form.titlePlaceholder')}
                className={cn(titleError && 'border-red-500')}
                required
              />
              {titleError ? (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{titleError}</p>
              ) : null}
            </div>

            <div>
              <Label className="mb-1">{t('requests.form.description')}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder={t('requests.form.descriptionPlaceholder')}
                rows={5}
                className="text-sm"
              />
            </div>
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
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('requests.form.submitterEmail')}</Label>
                <Input
                  type="email"
                  value={form.submitterEmail}
                  onChange={(e) => updateForm('submitterEmail', e.target.value)}
                  placeholder={t('requests.form.submitterEmailPlaceholder')}
                  className="text-sm"
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
                        className="h-9 pl-9 text-xs"
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
                id="request-internal-notes"
                value={form.internalNotes}
                onChange={(e) => updateForm('internalNotes', e.target.value)}
                placeholder={t('requests.form.internalNotesPlaceholder')}
                rows={4}
                className="text-sm"
              />
            </div>
          </div>
        </DetailSection>
      </Card>

      {hasFilesPlugin ? (
        <div className="space-y-2">
          {!item ? (
            <p className="px-1 text-xs text-muted-foreground">
              {t('requests.form.attachmentsAfterSave')}
            </p>
          ) : null}
          <FileAttachmentsSection pluginName="requests" entityId={item?.id} />
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <DetailLayout leftSidebar={formLeftSidebar}>
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
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
                    onTypeChange={(requestType) => updateForm('requestType', requestType)}
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
                    onDaysChange={(_days, responseDueAt) =>
                      updateForm('responseDueAt', responseDueAt)
                    }
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
                      className={cn(
                        'border-transparent text-xs font-medium',
                        REQUEST_SOURCE_COLORS[item.source],
                      )}
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
