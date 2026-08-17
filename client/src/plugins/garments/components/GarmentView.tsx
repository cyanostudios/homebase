import { Edit, Info, Share2, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_FIELD_LABEL_CLASS,
  DETAIL_INFO_ROW_CLASS,
  DETAIL_QUICK_ACTION_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { formatDate } from '@/core/utils/dateFormat';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';
import { useTeams } from '@/plugins/teams/hooks/useTeams';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';

import { useGarments } from '../hooks/useGarments';
import type { GarmentList, InventoryItem } from '../types/garments';

import { GarmentShareBlock } from './GarmentShareBlock';
import { PersonMatrix } from './PersonMatrix';

interface GarmentViewProps {
  garment?: GarmentList | null;
  item?: GarmentList | null;
}

function InventoryDetailView({ item }: { item: InventoryItem }) {
  const { t } = useTranslation();
  const { openInventoryForEdit, deleteInventoryItem, getDeleteMessage } = useGarments();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <>
      <DetailLayout
        sidebar={
          <div className="space-y-4">
            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('garments.quickActions')}
                icon={Edit}
                iconPlugin="garments"
                className="p-4"
              >
                <div className="flex flex-col items-start gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={Edit}
                    className={cn(DETAIL_QUICK_ACTION_ROW_CLASS)}
                    onClick={() => openInventoryForEdit(item)}
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    className="h-9 justify-start rounded-md px-3 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </DetailSection>
            </Card>
            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('garments.information')}
                icon={Info}
                iconPlugin="garments"
                subtleTitle
                className="p-4"
                collapsible
              >
                <div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">ID</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatDisplayNumber('garments', item.id)}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('common.created')}
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('common.updated')}
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatDate(item.updatedAt)}
                    </span>
                  </div>
                </div>
              </DetailSection>
            </Card>
          </div>
        }
      >
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection title={t('garments.details')} className="p-6">
            <div className="space-y-4">
              <div>
                <div className={DETAIL_FIELD_LABEL_CLASS}>{t('garments.articleName')}</div>
                <div className="text-lg font-semibold">{item.articleName}</div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3 border-t border-border/50 pt-4">
                <div>
                  <div className={DETAIL_FIELD_LABEL_CLASS}>{t('garments.brand')}</div>
                  <div className="text-sm">{item.brand || '—'}</div>
                </div>
                <div>
                  <div className={DETAIL_FIELD_LABEL_CLASS}>{t('garments.size')}</div>
                  <div className="text-sm">{item.size || '—'}</div>
                </div>
                <div>
                  <div className={DETAIL_FIELD_LABEL_CLASS}>{t('garments.quantity')}</div>
                  <div className="text-sm">{item.quantity}</div>
                </div>
              </div>
              <div className="border-t border-border/50 pt-4">
                <div className={DETAIL_FIELD_LABEL_CLASS}>{t('garments.comment')}</div>
                <div className="whitespace-pre-wrap text-sm">{item.comment ?? '—'}</div>
              </div>
            </div>
          </DetailSection>
        </Card>
      </DetailLayout>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('dialog.deleteItem', { label: t('garments.inventoryItem') })}
        message={getDeleteMessage(item)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          void deleteInventoryItem(item.id);
          setShowDeleteConfirm(false);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />
    </>
  );
}

export const GarmentView: React.FC<GarmentViewProps> = ({ garment, item }) => {
  const { t } = useTranslation();
  const {
    panelKind,
    currentInventoryItem,
    openGarmentForEdit,
    deleteGarment,
    getDeleteMessage,
    handleGarmentShareClick,
    garmentShareIsCreatingShare,
  } = useGarments();
  const { teams } = useTeams();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (panelKind === 'inventory') {
    if (!currentInventoryItem) {
      return null;
    }
    return <InventoryDetailView item={currentInventoryItem} />;
  }

  const list = garment ?? item;
  if (!list) {
    return null;
  }

  const matchedTeam = list.teamId
    ? teams.find((team) => String(team.id) === String(list.teamId))
    : undefined;
  const teamLabel = matchedTeam ? formatTeamLabel(matchedTeam) : list.teamId;

  return (
    <>
      <DetailLayout
        sidebar={
          <div className="space-y-4">
            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('garments.quickActions')}
                icon={Edit}
                iconPlugin="garments"
                className="p-4"
              >
                <div className="flex flex-col items-start gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={Edit}
                    className={cn(DETAIL_QUICK_ACTION_ROW_CLASS)}
                    onClick={() => openGarmentForEdit(list)}
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={Share2}
                    className={cn(DETAIL_QUICK_ACTION_ROW_CLASS)}
                    disabled={garmentShareIsCreatingShare}
                    onClick={() => void handleGarmentShareClick(list)}
                  >
                    {garmentShareIsCreatingShare
                      ? t('garments.creatingShare')
                      : t('garments.shareList')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    className="h-9 justify-start rounded-md px-3 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </DetailSection>
            </Card>
            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('garments.information')}
                icon={Info}
                iconPlugin="garments"
                subtleTitle
                className="p-4"
                collapsible
              >
                <div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">ID</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatDisplayNumber('garments', list.id)}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('common.created')}
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatDate(list.createdAt)}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('common.updated')}
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatDate(list.updatedAt)}
                    </span>
                  </div>
                </div>
              </DetailSection>
            </Card>
          </div>
        }
      >
        <div className="space-y-4">
          <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
            <DetailSection title={t('garments.details')} className="p-6">
              <div className="space-y-1">
                <div className={DETAIL_FIELD_LABEL_CLASS}>{t('garments.name')}</div>
                <div className="text-lg font-semibold">{list.name}</div>
              </div>
              {teamLabel ? (
                <div className="border-t border-border/50 pt-4 mt-4">
                  <div className={DETAIL_FIELD_LABEL_CLASS}>{t('garments.team')}</div>
                  <div className="text-sm">{teamLabel}</div>
                </div>
              ) : null}
            </DetailSection>
          </Card>

          <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
            <DetailSection title={t('garments.persons')} className="p-6">
              <PersonMatrix list={list} />
            </DetailSection>
          </Card>

          <GarmentShareBlock list={list} />
        </div>
      </DetailLayout>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('dialog.deleteItem', { label: t('garments.list') })}
        message={getDeleteMessage(list)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          void deleteGarment(list.id);
          setShowDeleteConfirm(false);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />
    </>
  );
};
