import {
  CalendarDays,
  ClipboardList,
  ExternalLink,
  FileText,
  History,
  Info,
  Mail,
  Phone,
  Paperclip,
  SlidersHorizontal,
  User,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { BADGE_CHIP_CLASS } from '@/core/ui/badgeStyles';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { QuickContextLinkTile, QuickContextLinkTileGrid } from '@/core/ui/QuickContextLinkTile';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_ENTITY_LINK_TRIGGER_CLASS,
  DETAIL_FIELD_VALUE_CLASS,
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_PROP_ROW_CLASS,
  DETAIL_SURFACE_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
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
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';

import { useRequests } from '../hooks/useRequests';
import { useRequestTeams } from '../hooks/useRequestTeams';
import type { Request } from '../types/requests';
import {
  REQUEST_SOURCE_COLORS,
  formatRequestStatusForDisplay,
  formatSubmittedDate,
  formatSubmittedDateWithAge,
  getTypeLabel,
} from '../types/requests';
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
import { RequestQuickContextPanel } from './RequestQuickContextPanel';
import { RequestResponseDueControl } from './RequestResponseDueControl';
import { RequestStatusSelect } from './RequestStatusSelect';
import { RequestTypeSelect } from './RequestTypeSelect';

interface RequestViewProps {
  request?: Request | null;
  item?: Request | null;
  /** Single-column card stack (e.g. list detail column). Default is two-column full panel. */
  stacked?: boolean;
  /** Companion / browse-only: no edit chrome, local tabs (do not mutate URL). */
  readOnly?: boolean;
  /** Optional trailing control on the title row (e.g. companion Open full + Close). */
  headerTrailing?: React.ReactNode;
}

type RequestViewTab = 'information' | 'assignees' | 'files' | 'activity';

const REQUEST_VIEW_TABS: RequestViewTab[] = ['information', 'assignees', 'files', 'activity'];

/** Companion flyout: information, assignees, files — no activity. */
const REQUEST_VIEW_READONLY_TABS: RequestViewTab[] = ['information', 'assignees', 'files'];

function parseRequestViewTab(value: string | null): RequestViewTab {
  if (value === 'properties') {
    return 'information';
  }
  if (value && REQUEST_VIEW_TABS.includes(value as RequestViewTab)) {
    return value as RequestViewTab;
  }
  return 'information';
}

const FACT_LABEL_CLASS =
  'mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';

export function RequestView({
  request: requestProp,
  item,
  stacked: _stacked = false,
  readOnly = false,
  headerTrailing,
}: RequestViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const request = requestProp ?? item ?? null;
  const { user } = useApp();
  const hasFilesPlugin = (user?.plugins ?? []).includes('files');
  const enabledPlugins = useEnabledPlugins();
  const hasTeamsPlugin = enabledPlugins.has('teams');
  const garmentsEnabled = enabledPlugins.has('garments');
  const { saveRequest, closeRequestPanel, validationErrors, clearValidationErrors, requestTypes } =
    useRequests();
  const { contacts } = useContacts();
  const requestTeams = useRequestTeams();
  const [targetListName, setTargetListName] = useState<string | null>(null);
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);
  const [localTab, setLocalTab] = useState<RequestViewTab>('information');

  const urlTab = parseRequestViewTab(searchParams.get('tab'));
  const activeTab = readOnly ? localTab : urlTab;
  const setActiveTab = useCallback(
    (tab: RequestViewTab) => {
      if (readOnly) {
        setLocalTab(tab);
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
        { replace: false },
      );
    },
    [readOnly, setSearchParams],
  );

  useEffect(() => {
    if (readOnly) {
      setLocalTab('information');
    }
  }, [request?.id, readOnly]);

  const linkedContact = useMemo(() => {
    if (!request?.contactId) {
      return null;
    }
    return contacts.find((c) => String(c.id) === request.contactId) ?? null;
  }, [request?.contactId, contacts]);

  const submitterPhone = linkedContact?.phone?.trim() || linkedContact?.phone2?.trim() || '';

  const readOnlyAssignedContacts = useMemo(() => {
    if (!Array.isArray(request?.assignedToIds) || request.assignedToIds.length === 0) {
      return [];
    }
    const ids = request.assignedToIds.map((id) => String(id));
    return ids
      .map((id) => contacts.find((c) => String(c.id) === id))
      .filter((c): c is Contact => Boolean(c));
  }, [request?.assignedToIds, contacts]);

  const readOnlyAssignedTeamLabel = useMemo(() => {
    if (!request?.teamId) {
      return null;
    }
    const team = requestTeams.find((team) => String(team.id) === String(request.teamId));
    return team ? formatTeamLabel(team) || team.name : null;
  }, [request?.teamId, requestTeams]);

  const typeConfig = useMemo(
    () => (request ? findRequestTypeConfig(requestTypes, request.requestType) : null),
    [request, requestTypes],
  );

  const isGarmentsLinked =
    request?.pluginTarget === 'garments' || typeConfig?.plugin === 'garments';

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

  // If files tab is selected but plugin is off, fall back to information.
  useEffect(() => {
    if (activeTab === 'files' && !hasFilesPlugin) {
      setActiveTab('information');
    }
  }, [activeTab, hasFilesPlugin, setActiveTab]);

  const navigateToContact = (contact: Contact) => {
    closeRequestPanel();
    setViewingContact(null);
    navigate(`/contacts/${buildSlug(contact, contacts, 'companyName')}`);
  };

  const blockingValidationErrors = validationErrors.filter(
    (error) => !String(error.message || '').includes('Warning'),
  );

  const assigneeCount = Array.isArray(request?.assignedToIds) ? request.assignedToIds.length : 0;

  const tabs = useMemo(() => {
    const next: Array<{
      id: RequestViewTab;
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
    if (readOnly) {
      return next.filter((tab) => REQUEST_VIEW_READONLY_TABS.includes(tab.id));
    }
    return next;
  }, [assigneeCount, hasFilesPlugin, readOnly, t]);

  const tabChips = (
    <div className={LIST_FILTER_CHIP_ROW_CLASS}>
      {tabs.map((tab) => {
        const TabIcon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <Button
            key={tab.id}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isActive}
            onClick={() => setActiveTab(tab.id)}
            className={cn(isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
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

  const listDisplayName =
    targetListName ||
    (request.pluginTargetId
      ? t('requests.view.unknownList', { id: request.pluginTargetId })
      : t('requests.settings.targetListMissing'));

  const informationCard = (
    <div className="space-y-4">
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('requests.view.description')}
          icon={FileText}
          iconPlugin="requests"
          subtleTitle
          className="p-6"
        >
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
              <p className={DETAIL_EMPTY_STATE_CLASS}>{t('requests.view.noSubmittedDetails')}</p>
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
              {readOnly ? (
                <span className={cn(DETAIL_FIELD_VALUE_CLASS, 'text-right')}>
                  {getTypeLabel(request.requestType, t)}
                </span>
              ) : (
                <RequestTypeSelect
                  request={request}
                  onTypeChange={handleTypeChange}
                  hideInlineLabel
                />
              )}
            </div>
            <div className={DETAIL_PROP_ROW_CLASS}>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('requests.form.status')}
              </span>
              {readOnly ? (
                <span className={cn(DETAIL_FIELD_VALUE_CLASS, 'text-right')}>
                  {formatRequestStatusForDisplay(request.status, t)}
                </span>
              ) : (
                <RequestStatusSelect
                  request={request}
                  onStatusChange={handleStatusChange}
                  hideInlineLabel
                />
              )}
            </div>
            <div className={DETAIL_PROP_ROW_CLASS}>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('requests.form.priority')}
              </span>
              {readOnly ? (
                <span className={cn(DETAIL_FIELD_VALUE_CLASS, 'text-right')}>
                  {request.priority}
                </span>
              ) : (
                <RequestPrioritySelect
                  request={request}
                  onPriorityChange={handlePriorityChange}
                  hideInlineLabel
                />
              )}
            </div>
            <div className={DETAIL_PROP_ROW_CLASS}>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('requests.responseDue.label')}
              </span>
              {readOnly ? (
                <span className={cn(DETAIL_FIELD_VALUE_CLASS, 'text-right')}>
                  {formatSubmittedDate(request.responseDueAt ?? undefined) ?? '—'}
                </span>
              ) : (
                <RequestResponseDueControl
                  request={request}
                  onDaysChange={handleResponseDueChange}
                  hideInlineLabel
                />
              )}
            </div>
            <div className={DETAIL_PROP_ROW_CLASS}>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('requests.view.source')}
              </span>
              <Badge
                variant="outline"
                className={cn(BADGE_CHIP_CLASS, REQUEST_SOURCE_COLORS[request.source])}
              >
                {request.source === 'external'
                  ? t('requests.sourceExternal')
                  : t('requests.sourceInternal')}
              </Badge>
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
    </div>
  );

  const assigneesCard = readOnly ? (
    <div className="space-y-4">
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('requests.form.assignees')}
          icon={Users}
          iconPlugin="contacts"
          subtleTitle
          className="p-6"
        >
          {readOnlyAssignedContacts.length > 0 ? (
            <QuickContextLinkTileGrid>
              {readOnlyAssignedContacts.map((assignedContact) => (
                <QuickContextLinkTile
                  key={assignedContact.id}
                  label={t('nav.contact')}
                  icon={User}
                  iconClassName="text-sky-600"
                >
                  {assignedContact.companyName ?? `Contact ${assignedContact.id}`}
                </QuickContextLinkTile>
              ))}
            </QuickContextLinkTileGrid>
          ) : (
            <p className="text-xs text-muted-foreground">{t('requests.noAssigneesYet')}</p>
          )}
        </DetailSection>
      </Card>
      {hasTeamsPlugin ? (
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection
            title={t('requests.assignedTeam')}
            icon={Users}
            iconPlugin="teams"
            subtleTitle
            className="p-6"
          >
            {readOnlyAssignedTeamLabel ? (
              <QuickContextLinkTileGrid>
                <QuickContextLinkTile
                  label={t('nav.team')}
                  icon={Users}
                  iconClassName="text-emerald-600"
                >
                  {readOnlyAssignedTeamLabel}
                </QuickContextLinkTile>
              </QuickContextLinkTileGrid>
            ) : (
              <p className="text-xs text-muted-foreground">{t('requests.noAssignedTeamYet')}</p>
            )}
          </DetailSection>
        </Card>
      ) : null}
    </div>
  ) : (
    <div className="space-y-4">
      <RequestAssigneeSelect request={request} onAssigneeChange={handleAssigneeChange} />
      {hasTeamsPlugin ? (
        <RequestAssignedTeamSelect request={request} onTeamChange={handleAssignedTeamChange} />
      ) : null}
    </div>
  );

  const filesCard = hasFilesPlugin ? (
    <FileAttachmentsSection pluginName="requests" entityId={request.id} readOnly />
  ) : null;

  return (
    <>
      <DetailLayout gridClassName="grid-cols-1">
        <div className="space-y-4">
          <RequestQuickContextPanel
            request={request}
            headerBelow={tabChips}
            readOnly={readOnly}
            headerTrailing={headerTrailing}
          />

          {!readOnly && blockingValidationErrors.length > 0 ? (
            <Card className="border-destructive/50 bg-destructive/5 p-4 shadow-none">
              <div className="text-sm font-medium text-destructive">{t('common.cannotSave')}</div>
              <ul className="mt-2 list-inside list-disc text-sm text-destructive/90">
                {blockingValidationErrors.map((error) => (
                  <li key={`${error.field}-${error.message}`}>{error.message}</li>
                ))}
              </ul>
            </Card>
          ) : null}

          {activeTab === 'information' ? informationCard : null}
          {activeTab === 'assignees' ? assigneesCard : null}
          {activeTab === 'files' ? filesCard : null}
          {!readOnly && activeTab === 'activity' ? (
            <DetailActivityLog
              entityType="request"
              entityId={request.id}
              limit={30}
              title={t('requests.activity')}
              showClearButton
              refreshKey={String(request.updated_at ?? request.id)}
              systemId={formatDisplayNumber('requests', request.id)}
            />
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
    </>
  );
}
