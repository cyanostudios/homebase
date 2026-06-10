import { Search, Trash2, User, Users } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/core/api/AppContext';
import { FileAttachmentsSection } from '@/plugins/files/components/FileAttachmentsSection';
import { useRequestTeams } from '../hooks/useRequestTeams';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import type { RequestPayload } from '../api/requestsApi';
import { useRequests } from '../hooks/useRequests';
import type { Request } from '../types/requests';
import { REQUEST_PRIORITIES, REQUEST_STATUSES, getTypeLabel } from '../types/requests';

const FORM_CARD_CLASS = 'overflow-hidden border border-border/70 bg-card shadow-sm rounded-lg';

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
  const { validationErrors, clearValidationErrors, requestTypes } = useRequests();
  const { contacts, user } = useApp();
  const hasFilesPlugin = (user?.plugins ?? []).includes('files');
  const teams = useRequestTeams();
  const item = currentRequest ?? currentItem ?? null;

  const { showWarning, markDirty, markClean, attemptAction, confirmDiscard, cancelDiscard } =
    useUnsavedChanges();

  const [form, setForm] = useState({
    title: '',
    description: '',
    requestType: (requestTypes[0] ?? 'general') as Request['requestType'],
    status: 'not started' as Request['status'],
    priority: 'Medium' as Request['priority'],
    teamId: '' as string,
    submitterName: '',
    submitterEmail: '',
    contactId: '' as string,
    assignedToIds: [] as string[],
    internalNotes: '',
  });

  const [contactSearch, setContactSearch] = useState('');
  const [showContactSuggestions, setShowContactSuggestions] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [showAssigneeSuggestions, setShowAssigneeSuggestions] = useState(false);

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
      });
    } else {
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

  const generalError = validationErrors.find((e) => e.field === 'general')?.message;
  const titleError = validationErrors.find((e) => e.field === 'title')?.message;

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
    };
    const success = await onSave(payload);
    if (success) markClean();
    return success;
  }, [form, onSave, markClean]);

  const handleCancel = useCallback(() => {
    attemptAction(onCancel);
  }, [attemptAction, onCancel]);

  useImperativeHandle(ref, () => ({ submit: handleSubmit, cancel: handleCancel }), [
    handleSubmit,
    handleCancel,
  ]);

  // Contacts for linked contact field
  const linkedContact = useMemo(
    () =>
      form.contactId ? (contacts as any[]).find((c) => String(c.id) === form.contactId) : null,
    [contacts, form.contactId],
  );

  const contactSuggestions = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    return (contacts as any[])
      .filter((c) => {
        if (form.contactId && String(c.id) === form.contactId) return false;
        if (!q) return true;
        return [c.companyName, c.email, c.phone]
          .filter(Boolean)
          .some((v: string) => v.toLowerCase().includes(q));
      })
      .slice(0, 20);
  }, [contacts, contactSearch, form.contactId]);

  // Assignees
  const assignedContacts = useMemo(
    () =>
      form.assignedToIds
        .map((id) => (contacts as any[]).find((c) => String(c.id) === id))
        .filter(Boolean),
    [contacts, form.assignedToIds],
  );

  const addableAssignees = useMemo(() => {
    const q = assigneeSearch.trim().toLowerCase();
    return (contacts as any[])
      .filter((c) => {
        if (form.assignedToIds.includes(String(c.id))) return false;
        if (!q) return true;
        return [c.companyName, c.email, c.phone]
          .filter(Boolean)
          .some((v: string) => v.toLowerCase().includes(q));
      })
      .slice(0, 20);
  }, [contacts, assigneeSearch, form.assignedToIds]);

  return (
    <>
      <DetailLayout>
        <div className="space-y-4">
          {generalError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
              {generalError}
            </div>
          )}

          {/* Title + Type */}
          <Card padding="none" className={FORM_CARD_CLASS}>
            <DetailSection title={t('requests.form.details')} className="p-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t('requests.form.title')} *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => updateForm('title', e.target.value)}
                    placeholder={t('requests.form.titlePlaceholder')}
                    className={cn('text-sm', titleError && 'border-red-500')}
                  />
                  {titleError && <p className="text-xs text-red-500">{titleError}</p>}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">{t('requests.form.description')}</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => updateForm('description', e.target.value)}
                    placeholder={t('requests.form.descriptionPlaceholder')}
                    rows={3}
                    className="text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('requests.form.requestType')}</Label>
                    <Select
                      value={form.requestType}
                      onValueChange={(v) => updateForm('requestType', v as Request['requestType'])}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {requestTypes.map((type) => (
                          <SelectItem key={type} value={type} className="text-xs">
                            {getTypeLabel(type, t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">{t('requests.form.team')}</Label>
                    <Select
                      value={form.teamId || 'none'}
                      onValueChange={(v) => updateForm('teamId', v === 'none' ? '' : v)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder={t('requests.form.generalRequest')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs">
                          {t('requests.form.generalRequest')}
                        </SelectItem>
                        {teams.map((team: any) => (
                          <SelectItem key={team.id} value={String(team.id)} className="text-xs">
                            {team.name}
                            {team.age_group ? ` · ${team.age_group}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </DetailSection>
          </Card>

          {/* Status + Priority */}
          <Card padding="none" className={FORM_CARD_CLASS}>
            <DetailSection title={t('requests.form.properties')} className="p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t('requests.form.status')}</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => updateForm('status', v as Request['status'])}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REQUEST_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">
                          {t(`requests.status.${s.replace(/ /g, '_')}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">{t('requests.form.priority')}</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => updateForm('priority', v as Request['priority'])}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REQUEST_PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p} className="text-xs">
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </DetailSection>
          </Card>

          {/* Submitter */}
          <Card padding="none" className={FORM_CARD_CLASS}>
            <DetailSection title={t('requests.form.submitter')} className="p-4">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
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
              </div>
            </DetailSection>
          </Card>

          {/* Assignees */}
          <Card padding="none" className={FORM_CARD_CLASS}>
            <DetailSection title={t('requests.form.assignees')} className="p-4">
              <div className="space-y-2">
                <Popover
                  open={showAssigneeSuggestions && addableAssignees.length > 0}
                  onOpenChange={setShowAssigneeSuggestions}
                >
                  <PopoverAnchor asChild>
                    <div className="relative">
                      <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={assigneeSearch}
                        onChange={(e) => {
                          setAssigneeSearch(e.target.value);
                          setShowAssigneeSuggestions(true);
                        }}
                        onFocus={() => setShowAssigneeSuggestions(true)}
                        placeholder={t('requests.form.addAssigneePlaceholder')}
                        className="h-9 pl-9 text-xs"
                        disabled={addableAssignees.length === 0 && !assigneeSearch}
                      />
                    </div>
                  </PopoverAnchor>
                  <PopoverContent
                    align="start"
                    side="bottom"
                    sideOffset={4}
                    className="z-[120] w-[var(--radix-popover-trigger-width)] max-h-52 overflow-y-auto rounded-xl border border-border/60 bg-popover p-1 shadow-xl"
                  >
                    {addableAssignees.map((c: any) => (
                      <button
                        key={c.id}
                        type="button"
                        className="flex w-full items-start rounded-lg px-2.5 py-2 text-left hover:bg-accent"
                        onClick={() => {
                          updateForm('assignedToIds', [...form.assignedToIds, String(c.id)]);
                          setAssigneeSearch('');
                          setShowAssigneeSuggestions(false);
                        }}
                      >
                        <span className="block truncate text-xs font-medium">
                          {c.companyName ?? `Contact ${c.id}`}
                        </span>
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>

                {assignedContacts.length > 0 && (
                  <div className="space-y-1.5">
                    {assignedContacts.map((c: any) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate text-xs font-medium">
                            {c.companyName ?? `Contact ${c.id}`}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          className="h-7 px-2 text-[10px] text-red-600 hover:bg-red-50 dark:text-red-400"
                          onClick={() =>
                            updateForm(
                              'assignedToIds',
                              form.assignedToIds.filter((id) => id !== String(c.id)),
                            )
                          }
                        >
                          {t('common.remove')}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DetailSection>
          </Card>

          {/* Internal notes */}
          <Card padding="none" className={FORM_CARD_CLASS}>
            <DetailSection title={t('requests.form.internalNotes')} className="p-4">
              <Textarea
                value={form.internalNotes}
                onChange={(e) => updateForm('internalNotes', e.target.value)}
                placeholder={t('requests.form.internalNotesPlaceholder')}
                rows={3}
                className="text-sm"
              />
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
