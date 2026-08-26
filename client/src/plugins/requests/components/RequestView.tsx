import {
  CalendarDays,
  ClipboardList,
  Edit,
  ExternalLink,
  Info,
  ListPlus,
  Mail,
  Phone,
  SlidersHorizontal,
  Trash2,
  User,
  Zap,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_ENTITY_LINK_TRIGGER_CLASS,
  DETAIL_FIELD_VALUE_CLASS,
  DETAIL_INFO_ROW_CLASS,
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_PROP_ROW_CLASS,
  DETAIL_QUICK_ACTION_ROW_CLASS,
  DETAIL_SURFACE_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { buildSlug } from '@/core/utils/slugUtils';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { cn } from '@/lib/utils';
import {
  ContactCopyableLink,
  mailtoHref,
  telHref,
} from '@/plugins/contacts/components/ContactCopyableLink';
import { ContactQuickInfoDialog } from '@/plugins/contacts/components/ContactQuickInfoDialog';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import {
  CONTACT_TYPE_BADGE_CLASS,
  CONTACT_TYPE_COLORS,
  type Contact,
} from '@/plugins/contacts/types/contacts';
import { FileAttachmentsSection } from '@/plugins/files/components/FileAttachmentsSection';
import { garmentsApi } from '@/plugins/garments/api/garmentsApi';

import { useRequests } from '../hooks/useRequests';
import type { Request } from '../types/requests';
import { REQUEST_SOURCE_COLORS, formatSubmittedDateWithAge, getTypeLabel } from '../types/requests';
import {
  buildRequestAssigneesSavePayload,
  buildRequestResponseDueSavePayload,
  buildRequestTeamSavePayload,
  buildRequestTypeSavePayload,
} from '../utils/requestListSave';
import { findRequestTypeConfig, intakeFieldLabelKey } from '../utils/requestTypeConfig';

import { RequestAssignedTeamSelect } from './RequestAssignedTeamSelect';
import { RequestAssigneeSelect } from './RequestAssigneeSelect';
import { RequestPrioritySelect } from './RequestPrioritySelect';
import { RequestResponseDueControl } from './RequestResponseDueControl';
import { RequestStatusSelect } from './RequestStatusSelect';
import { RequestTypeSelect } from './RequestTypeSelect';

interface RequestViewProps {
  request?: Request | null;
  item?: Request | null;
}

const FACT_LABEL_CLASS =
  'mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';

function RequestQuickActionsCard({
  request,
  onEdit,
  onDeleteClick,
  canSendToList,
  onSendToListClick,
  sentToListName,
  sendError,
}: {
  request: Request;
  onEdit: (request: Request) => void;
  onDeleteClick: () => void;
  canSendToList: boolean;
  onSendToListClick: () => void;
  sentToListName: string | null;
  sendError: string | null;
}) {
  const { t } = useTranslation();

  return (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection title={t('requests.view.quickActions')} icon={Zap} subtleTitle className="p-4">
        <div className="flex flex-col items-start gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={(props) => (
              <Edit
                {...props}
                className={cn(props.className, 'text-blue-600 dark:text-blue-400')}
              />
            )}
            className={DETAIL_QUICK_ACTION_ROW_CLASS}
            onClick={() => onEdit(request)}
          >
            {t('common.edit')}
          </Button>
          {canSendToList ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={(props) => (
                <ListPlus
                  {...props}
                  className={cn(props.className, 'text-emerald-600 dark:text-emerald-400')}
                />
              )}
              className={DETAIL_QUICK_ACTION_ROW_CLASS}
              onClick={onSendToListClick}
            >
              {t('requests.view.sendToList')}
            </Button>
          ) : null}
          {sentToListName ? (
            <p className="px-3 py-1 text-xs text-muted-foreground">
              {t('requests.view.sendToListSuccess', { listName: sentToListName })}
            </p>
          ) : null}
          {sendError ? (
            <p role="alert" className="px-3 py-1 text-xs text-destructive">
              {sendError}
            </p>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={(props) => (
              <Trash2
                {...props}
                className={cn(props.className, 'text-red-600 dark:text-red-400')}
              />
            )}
            className="h-9 justify-start rounded-md px-3 text-xs text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            onClick={onDeleteClick}
          >
            {t('common.delete')}
          </Button>
        </div>
      </DetailSection>
    </Card>
  );
}

export function RequestView({ request: requestProp, item }: RequestViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const request = requestProp ?? item ?? null;
  const { user } = useApp();
  const hasFilesPlugin = (user?.plugins ?? []).includes('files');
  const enabledPlugins = useEnabledPlugins();
  const hasTeamsPlugin = enabledPlugins.has('teams');
  const garmentsEnabled = enabledPlugins.has('garments');
  const {
    openRequestForEdit,
    deleteRequest,
    saveRequest,
    closeRequestPanel,
    validationErrors,
    clearValidationErrors,
    sendRequestToList,
    requestTypes,
  } = useRequests();
  const { contacts } = useContacts();
  const [showDelete, setShowDelete] = useState(false);
  const [showSendToList, setShowSendToList] = useState(false);
  const [isSendingToList, setIsSendingToList] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [targetListName, setTargetListName] = useState<string | null>(null);
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);

  const linkedContact = useMemo(() => {
    if (!request?.contactId) {
      return null;
    }
    return contacts.find((c) => String(c.id) === request.contactId) ?? null;
  }, [request?.contactId, contacts]);

  const submitterPhone = linkedContact?.phone?.trim() || linkedContact?.phone2?.trim() || '';

  const typeConfig = useMemo(
    () => (request ? findRequestTypeConfig(requestTypes, request.requestType) : null),
    [request, requestTypes],
  );

  const isGarmentsLinked =
    request?.pluginTarget === 'garments' || typeConfig?.plugin === 'garments';

  const canSendToList = Boolean(
    garmentsEnabled &&
      request &&
      request.pluginTarget === 'garments' &&
      !request.pluginRoutedAt &&
      !request.pluginRoutedEntityId,
  );

  const extraDataEntries = useMemo(() => {
    if (!request?.extraData) {
      return [];
    }
    const schemaOrder =
      typeConfig?.intakeSchema?.map((field) => field.key) ?? Object.keys(request.extraData);
    const seen = new Set<string>();
    const ordered: Array<{ key: string; value: string }> = [];
    for (const key of schemaOrder) {
      const value = request.extraData[key];
      if (value === null || value === undefined || String(value).trim() === '') {
        continue;
      }
      seen.add(key);
      ordered.push({ key, value: String(value) });
    }
    for (const [key, value] of Object.entries(request.extraData)) {
      if (seen.has(key) || !String(value || '').trim()) {
        continue;
      }
      ordered.push({ key, value: String(value) });
    }
    return ordered;
  }, [request?.extraData, typeConfig?.intakeSchema]);

  const showSubmittedDetails = Boolean(
    request && (extraDataEntries.length > 0 || isGarmentsLinked),
  );

  useEffect(() => {
    if (!request?.pluginTargetId || !garmentsEnabled) {
      setTargetListName(null);
      return;
    }
    let cancelled = false;
    garmentsApi
      .getList(String(request.pluginTargetId))
      .then((list) => {
        if (!cancelled) {
          setTargetListName(list.name);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTargetListName(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [request?.pluginTargetId, garmentsEnabled]);

  const navigateToContact = (contact: Contact) => {
    closeRequestPanel();
    setViewingContact(null);
    navigate(`/contacts/${buildSlug(contact, contacts, 'companyName')}`);
  };

  const blockingValidationErrors = validationErrors.filter(
    (error) => !String(error.message || '').includes('Warning'),
  );

  if (!request) {
    return null;
  }

  const handleStatusChange = async (newStatus: Request['status']) => {
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
    await saveRequest({ title: request.title, status: newStatus }, request.id);
  };

  const handlePriorityChange = async (newPriority: Request['priority']) => {
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
    await saveRequest({ title: request.title, priority: newPriority }, request.id);
  };

  const handleTypeChange = async (newType: string) => {
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
    await saveRequest(buildRequestTypeSavePayload(request, newType), request.id);
  };

  const handleResponseDueChange = async (_days: number, responseDueAt: string) => {
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
    await saveRequest(buildRequestResponseDueSavePayload(request, responseDueAt), request.id);
  };

  const handleAssigneeChange = async (newAssigneeIds: string[]) => {
    if (!request?.id) {
      return;
    }
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
    await saveRequest(buildRequestAssigneesSavePayload(request, newAssigneeIds), request.id);
  };

  const handleAssignedTeamChange = async (teamId: string | null) => {
    if (!request?.id) {
      return;
    }
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
    await saveRequest(buildRequestTeamSavePayload(request, teamId), request.id);
  };

  const handleSendToListConfirm = async () => {
    setIsSendingToList(true);
    setSendError(null);
    try {
      await sendRequestToList(request.id);
      setShowSendToList(false);
    } catch (error: unknown) {
      setShowSendToList(false);
      const message =
        error instanceof Error && error.message
          ? error.message
          : t('requests.view.sendToListError');
      setSendError(message);
    } finally {
      setIsSendingToList(false);
    }
  };

  const updatedLabel = request.updated_at
    ? new Date(request.updated_at).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const listDisplayName =
    targetListName ||
    (request.pluginTargetId
      ? t('requests.view.unknownList', { id: request.pluginTargetId })
      : t('requests.settings.targetListMissing'));

  const contentColumn = (
    <div className="space-y-6">
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={String(request.title || '').trim() || '—'}
          className="p-6"
          prominentTitle
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={Edit}
              className="h-8 w-8 shrink-0 p-0 hidden md:inline-flex"
              onClick={() => openRequestForEdit(request)}
              aria-label={t('common.edit')}
              title={t('common.edit')}
            />
          }
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-0 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
            >
              {getTypeLabel(request.requestType, t)}
            </Badge>
            {updatedLabel ? (
              <span className="text-xs text-muted-foreground">
                {t('common.updated')} {updatedLabel}
              </span>
            ) : null}
          </div>
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {request.description?.trim() || '—'}
          </p>
        </DetailSection>
      </Card>

      {showSubmittedDetails ? (
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection
            title={t('requests.view.submittedDetails')}
            icon={ClipboardList}
            iconPlugin="requests"
            subtleTitle
            className="p-6"
          >
            {extraDataEntries.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {extraDataEntries.map(({ key, value }) => (
                  <div key={key}>
                    <div className={FACT_LABEL_CLASS}>{t(intakeFieldLabelKey(key))}</div>
                    <div className={DETAIL_FIELD_VALUE_CLASS}>{value || '—'}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('requests.view.noSubmittedDetails')}
              </p>
            )}
            {request.pluginRoutedAt && listDisplayName ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {t('requests.view.sendToListSuccess', { listName: listDisplayName })}
              </p>
            ) : null}
          </DetailSection>
        </Card>
      ) : null}

      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('requests.view.submitter')}
          icon={User}
          iconPlugin="requests"
          subtleTitle
          className="p-6"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <div className={FACT_LABEL_CLASS}>
                  <User className="h-3 w-3" />
                  {t('requests.form.submitterName')}
                </div>
                <div className={DETAIL_FIELD_VALUE_CLASS}>
                  {request.submitterName?.trim() || '—'}
                </div>
              </div>
              <div>
                <div className={FACT_LABEL_CLASS}>
                  <CalendarDays className="h-3 w-3" />
                  {t('requests.view.submittedOn')}
                </div>
                <div className={DETAIL_FIELD_VALUE_CLASS}>
                  {formatSubmittedDateWithAge(request.created_at, t) ?? '—'}
                </div>
              </div>
              <div>
                <div className={FACT_LABEL_CLASS}>
                  <Mail className="h-3 w-3" />
                  {t('requests.form.submitterEmail')}
                </div>
                <ContactCopyableLink
                  value={request.submitterEmail}
                  href={mailtoHref(request.submitterEmail)}
                />
              </div>
              <div>
                <div className={FACT_LABEL_CLASS}>
                  <Phone className="h-3 w-3" />
                  {t('requests.view.phone')}
                </div>
                <ContactCopyableLink value={submitterPhone} href={telHref(submitterPhone)} />
              </div>
            </div>

            <div className={DETAIL_PROP_ROW_CLASS}>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('requests.view.linkedContact')}
              </span>
              {linkedContact ? (
                <div
                  className={cn(
                    DETAIL_SURFACE_ROW_CLASS,
                    'plugin-contacts max-w-[240px] transition-colors hover:bg-muted/70',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {linkedContact.companyName ?? `Contact ${linkedContact.id}`}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={ExternalLink}
                    className={cn(DETAIL_ENTITY_LINK_TRIGGER_CLASS, 'plugin-contacts')}
                    onClick={() => setViewingContact(linkedContact)}
                  >
                    {t('contacts.quickInfo.openContact')}
                  </Button>
                </div>
              ) : (
                <span className="text-sm font-medium text-foreground">—</span>
              )}
            </div>

            {request.internalNotes?.trim() ? (
              <div>
                <div className="mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    {t('requests.view.internalNotes')}
                  </span>
                </div>
                <div className={DETAIL_NOTE_CALLOUT_CLASS}>
                  <p className="whitespace-pre-wrap text-sm font-medium text-amber-950 dark:text-amber-200">
                    {request.internalNotes}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </DetailSection>
      </Card>

      {hasFilesPlugin ? (
        <FileAttachmentsSection pluginName="requests" entityId={request.id} readOnly />
      ) : null}
    </div>
  );

  return (
    <>
      <DetailLayout
        gridClassName="grid-cols-1 lg:grid-cols-[1.3fr_1fr_260px]"
        leftSidebar={contentColumn}
        sidebar={
          <div className="space-y-6">
            <RequestQuickActionsCard
              request={request}
              onEdit={openRequestForEdit}
              onDeleteClick={() => setShowDelete(true)}
              canSendToList={canSendToList}
              onSendToListClick={() => {
                setSendError(null);
                setShowSendToList(true);
              }}
              sentToListName={
                request.pluginRoutedAt || request.pluginRoutedEntityId ? listDisplayName : null
              }
              sendError={sendError}
            />

            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('requests.view.information')}
                icon={Info}
                subtleTitle
                className="p-4"
                collapsible
              >
                <div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('requests.view.id')}
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatDisplayNumber('requests', request.id)}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('requests.view.created')}
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatSubmittedDateWithAge(request.created_at, t) ?? '—'}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('common.updated')}
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {request.updated_at ? new Date(request.updated_at).toLocaleDateString() : '—'}
                    </span>
                  </div>
                </div>
              </DetailSection>
            </Card>

            <DetailActivityLog
              entityType="request"
              entityId={request.id}
              title={t('requests.activity')}
              limit={30}
              refreshKey={request.updated_at}
            />
          </div>
        }
      >
        <div className="space-y-6">
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
                    request={request}
                    onTypeChange={handleTypeChange}
                    hideInlineLabel
                  />
                </div>
                <div className={DETAIL_PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t('requests.form.status')}
                  </span>
                  <RequestStatusSelect
                    request={request}
                    onStatusChange={handleStatusChange}
                    hideInlineLabel
                  />
                </div>
                <div className={DETAIL_PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t('requests.form.priority')}
                  </span>
                  <RequestPrioritySelect
                    request={request}
                    onPriorityChange={handlePriorityChange}
                    hideInlineLabel
                  />
                </div>
                <div className={DETAIL_PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t('requests.responseDue.label')}
                  </span>
                  <RequestResponseDueControl
                    request={request}
                    onDaysChange={handleResponseDueChange}
                    hideInlineLabel
                  />
                </div>
                <div className={DETAIL_PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t('requests.view.source')}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'border-transparent text-xs font-medium',
                      REQUEST_SOURCE_COLORS[request.source],
                    )}
                  >
                    {request.source === 'external'
                      ? t('requests.sourceExternal')
                      : t('requests.sourceInternal')}
                  </Badge>
                </div>
              </div>
            </DetailSection>
          </Card>

          <RequestAssigneeSelect request={request} onAssigneeChange={handleAssigneeChange} />

          {hasTeamsPlugin ? (
            <RequestAssignedTeamSelect request={request} onTeamChange={handleAssignedTeamChange} />
          ) : null}
        </div>
      </DetailLayout>

      <ContactQuickInfoDialog
        isOpen={viewingContact !== null}
        contact={viewingContact}
        onClose={() => setViewingContact(null)}
        onOpenContact={() => {
          if (viewingContact) {
            navigateToContact(viewingContact);
          }
        }}
        badges={
          viewingContact ? (
            <span
              className={cn(
                CONTACT_TYPE_BADGE_CLASS,
                CONTACT_TYPE_COLORS[viewingContact.contactType],
              )}
            >
              {t(`contacts.type.${viewingContact.contactType}`)}
            </span>
          ) : null
        }
      />

      <ConfirmDialog
        isOpen={showDelete}
        title={t('requests.view.deleteRequest')}
        message={t('requests.view.deleteConfirm', { title: request.title })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={async () => {
          setShowDelete(false);
          await deleteRequest(request.id);
        }}
        onCancel={() => setShowDelete(false)}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={showSendToList}
        title={t('requests.view.sendToListConfirmTitle')}
        message={t('requests.view.sendToListConfirm', { listName: listDisplayName })}
        confirmText={t('requests.view.sendToListConfirmAction')}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          void handleSendToListConfirm();
        }}
        onCancel={() => {
          if (!isSendingToList) {
            setShowSendToList(false);
          }
        }}
        variant="warning"
        confirmDisabled={isSendingToList}
      />
    </>
  );
}
