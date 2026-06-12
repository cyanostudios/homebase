import {
  Edit,
  ExternalLink,
  Info,
  Mail,
  Phone,
  SlidersHorizontal,
  Trash2,
  User,
  Users,
  Zap,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_INFO_ROW_CLASS,
  DETAIL_PROP_ROW_CLASS,
  DETAIL_QUICK_ACTION_ROW_CLASS,
  DETAIL_SURFACE_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { FileAttachmentsSection } from '@/plugins/files/components/FileAttachmentsSection';

import { useRequestTeams } from '../hooks/useRequestTeams';
import { useRequests } from '../hooks/useRequests';
import type { Request } from '../types/requests';
import { REQUEST_SOURCE_COLORS, formatSubmittedDateWithAge, getTypeLabel } from '../types/requests';

import { RequestPrioritySelect } from './RequestPrioritySelect';
import { RequestStatusSelect } from './RequestStatusSelect';

interface RequestViewProps {
  request?: Request | null;
  item?: Request | null;
}

function RequestQuickActionsCard({
  request,
  onEdit,
  onDeleteClick,
}: {
  request: Request;
  onEdit: (request: Request) => void;
  onDeleteClick: () => void;
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
  const request = requestProp ?? item ?? null;
  const teams = useRequestTeams();
  const { user } = useApp();
  const hasFilesPlugin = (user?.plugins ?? []).includes('files');
  const { openRequestForEdit, deleteRequest, saveRequest } = useRequests();
  const { contacts, openContactForView } = useContacts();
  const [showDelete, setShowDelete] = useState(false);

  const teamName = useMemo(() => {
    if (!request?.teamId) return null;
    const team = teams.find((t: any) => Number(t.id) === request.teamId);
    return team ? team.name : null;
  }, [request?.teamId, teams]);

  const linkedContact = useMemo(() => {
    if (!request?.contactId) return null;
    return contacts.find((c) => String(c.id) === request.contactId) ?? null;
  }, [request?.contactId, contacts]);

  const assignedContacts = useMemo(() => {
    if (!request?.assignedToIds?.length) return [];
    return request.assignedToIds
      .map((id) => contacts.find((c) => String(c.id) === id))
      .filter(Boolean);
  }, [request?.assignedToIds, contacts]);

  if (!request) return null;

  const handleStatusChange = async (newStatus: Request['status']) => {
    await saveRequest({ title: request.title, status: newStatus }, request.id);
  };

  const handlePriorityChange = async (newPriority: Request['priority']) => {
    await saveRequest({ title: request.title, priority: newPriority }, request.id);
  };

  return (
    <>
      <DetailLayout
        sidebar={
          <div className="space-y-6">
            <RequestQuickActionsCard
              request={request}
              onEdit={openRequestForEdit}
              onDeleteClick={() => setShowDelete(true)}
            />

            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('requests.view.information')}
                icon={Info}
                subtleTitle
                className="p-4"
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
          <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
            <DetailSection
              title={String(request.title || '').trim() || '—'}
              className="p-6"
              prominentTitle
            >
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {request.description?.trim() || '—'}
              </p>
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
              <div>
                <div className={DETAIL_PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t('requests.form.submitterName')}
                  </span>
                  <span className="max-w-[220px] truncate text-sm font-medium text-foreground">
                    {request.submitterName?.trim() || '—'}
                  </span>
                </div>
                <div className={DETAIL_PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t('requests.form.submitterEmail')}
                  </span>
                  {request.submitterEmail?.trim() ? (
                    <a
                      href={`mailto:${request.submitterEmail.trim()}`}
                      className="inline-flex max-w-[220px] items-center gap-1.5 truncate text-sm font-medium text-foreground hover:text-plugin hover:underline"
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {request.submitterEmail.trim()}
                    </a>
                  ) : (
                    <span className="text-sm font-medium text-foreground">—</span>
                  )}
                </div>
                <div className={DETAIL_PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t('requests.view.submittedOn')}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {formatSubmittedDateWithAge(request.created_at, t) ?? '—'}
                  </span>
                </div>
                <div className={DETAIL_PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t('requests.view.linkedContact')}
                  </span>
                  {linkedContact ? (
                    <button
                      type="button"
                      onClick={() => openContactForView(linkedContact)}
                      className="inline-flex max-w-[220px] items-center gap-1.5 truncate text-sm font-medium text-plugin hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      {linkedContact.companyName ?? `Contact ${linkedContact.id}`}
                    </button>
                  ) : (
                    <span className="text-sm font-medium text-foreground">—</span>
                  )}
                </div>
                {linkedContact && (linkedContact.phone || (linkedContact as any).phone2) && (
                  <div className={DETAIL_PROP_ROW_CLASS}>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {t('requests.view.phone')}
                    </span>
                    <a
                      href={`tel:${(linkedContact.phone || (linkedContact as any).phone2).replace(/\s/g, '')}`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-plugin hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {linkedContact.phone || (linkedContact as any).phone2}
                    </a>
                  </div>
                )}
              </div>
            </DetailSection>
          </Card>

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
                  <span className="text-sm font-medium text-foreground">
                    {getTypeLabel(request.requestType, t)}
                  </span>
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
                {teamName && (
                  <div className={DETAIL_PROP_ROW_CLASS}>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {t('requests.view.team')}
                    </span>
                    <span className="max-w-[200px] truncate text-sm font-medium text-foreground">
                      {teamName}
                    </span>
                  </div>
                )}
              </div>
            </DetailSection>
          </Card>

          {assignedContacts.length > 0 && (
            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('requests.view.assignees')}
                icon={Users}
                subtleTitle
                className="p-6"
              >
                <div className="space-y-1.5">
                  {assignedContacts.map((c: any) => (
                    <div key={c.id} className={cn(DETAIL_SURFACE_ROW_CLASS, 'plugin-contacts')}>
                      <span className="truncate text-xs text-muted-foreground">
                        {c.companyName ?? `Contact ${c.id}`}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon={ExternalLink}
                        className="plugin-contacts h-7 w-7 shrink-0 p-0 text-plugin hover:bg-accent"
                        onClick={() => openContactForView(c)}
                        aria-label={t('common.open')}
                      >
                        <span className="sr-only">{t('common.open')}</span>
                      </Button>
                    </div>
                  ))}
                </div>
              </DetailSection>
            </Card>
          )}

          {request.internalNotes?.trim() && (
            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection title={t('requests.view.internalNotes')} className="p-6" subtleTitle>
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {request.internalNotes}
                </p>
              </DetailSection>
            </Card>
          )}

          {hasFilesPlugin ? (
            <FileAttachmentsSection pluginName="requests" entityId={request.id} readOnly />
          ) : null}
        </div>
      </DetailLayout>

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
    </>
  );
}
