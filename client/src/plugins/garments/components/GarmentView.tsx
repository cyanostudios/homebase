import {
  Copy,
  Edit,
  Info,
  Layers,
  Share2,
  SlidersHorizontal,
  Trash2,
  Upload,
  Users,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import {
  DETAIL_FIELD_LABEL_CLASS,
  DETAIL_FIELD_VALUE_CLASS,
  DETAIL_INFO_ROW_CLASS,
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_PROP_ROW_CLASS,
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

import { GarmentPersonImportDialog } from './GarmentPersonImportDialog';
import { GarmentShareBlock } from './GarmentShareBlock';
import { VariantQuantityEditor } from './InventoryQuickContextPanel';
import { PersonMatrix } from './PersonMatrix';

interface GarmentViewProps {
  garment?: GarmentList | null;
  item?: GarmentList | null;
}

function formatPurchasePrice(price: number | null | undefined, currency: string): string {
  if (price == null || Number.isNaN(price)) {
    return '—';
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'SEK',
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${price.toFixed(2)} ${currency || 'SEK'}`;
  }
}

function InventoryDetailView({ item }: { item: InventoryItem }) {
  const { t } = useTranslation();
  const {
    openInventoryForEdit,
    deleteInventoryItem,
    getDeleteMessage,
    updateInventoryVariantQuantity,
    isSaving,
    getDuplicateConfig,
    executeDuplicate,
    setRecentlyDuplicatedInventoryId,
  } = useGarments();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const canDuplicate = Boolean(getDuplicateConfig(item));

  const description = item.description?.trim() || '';
  const comment = item.comment?.trim() || '';
  const material = item.material?.trim() || '';
  const variants = item.variants || [];

  const propertyRows: { label: string; value: string }[] = [
    { label: t('garments.brand'), value: item.brand?.trim() || '—' },
    {
      label: t('garments.purchasePrice'),
      value: formatPurchasePrice(item.purchasePrice, item.currency || 'SEK'),
    },
    { label: t('garments.totalQuantity'), value: String(item.totalQuantity ?? 0) },
    {
      label: t('garments.variantCount'),
      value: String(item.variantCount ?? variants.length),
    },
    ...(material ? [{ label: t('garments.material'), value: material }] : []),
  ];

  return (
    <>
      <DetailLayout
        leftSidebar={
          <div className="space-y-4">
            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <div className="border-b border-border/50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-semibold text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                    aria-hidden
                  >
                    {(item.articleName || '—').trim().slice(0, 2).toUpperCase()}
                  </div>
                  <h2 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight text-foreground">
                    {item.articleName || '—'}
                  </h2>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={Edit}
                    className="h-8 w-8 shrink-0 p-0"
                    onClick={() => openInventoryForEdit(item)}
                    aria-label={t('common.edit')}
                    title={t('common.edit')}
                  />
                </div>
              </div>
              <DetailSection
                title={t('garments.details')}
                icon={SlidersHorizontal}
                subtleTitle
                className="p-4"
              >
                <div className="space-y-4">
                  <div className="space-y-0">
                    {propertyRows.map((row) => (
                      <div key={row.label} className={DETAIL_PROP_ROW_CLASS}>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {row.label}
                        </span>
                        <span className={cn(DETAIL_FIELD_VALUE_CLASS, 'sm:text-right')}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                  {description ? (
                    <div>
                      <div className={DETAIL_FIELD_LABEL_CLASS}>{t('garments.description')}</div>
                      <p className="whitespace-pre-wrap text-sm text-foreground">{description}</p>
                    </div>
                  ) : null}
                  {comment ? (
                    <div>
                      <div className={DETAIL_FIELD_LABEL_CLASS}>{t('garments.comment')}</div>
                      <div className={DETAIL_NOTE_CALLOUT_CLASS}>
                        <p className="whitespace-pre-wrap text-sm font-medium text-amber-950 dark:text-amber-200">
                          {comment}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </DetailSection>
            </Card>
          </div>
        }
        sidebar={
          <div className="space-y-4">
            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('garments.quickActions')}
                icon={Zap}
                iconPlugin="garments"
                subtleTitle
                className="p-4"
              >
                <div className="flex flex-col items-start gap-1.5">
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
                    className={cn(DETAIL_QUICK_ACTION_ROW_CLASS)}
                    onClick={() => openInventoryForEdit(item)}
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
                    className="h-9 justify-start rounded-md px-3 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    {t('common.delete')}
                  </Button>
                  {canDuplicate ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={(props) => (
                        <Copy
                          {...props}
                          className={cn(props.className, 'text-green-600 dark:text-green-400')}
                        />
                      )}
                      className={DETAIL_QUICK_ACTION_ROW_CLASS}
                      onClick={() => setShowDuplicateDialog(true)}
                    >
                      {t('common.duplicate')}
                    </Button>
                  ) : null}
                </div>
              </DetailSection>
            </Card>
            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('garments.information')}
                icon={Info}
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
          <DetailSection title={t('garments.variants')} icon={Layers} subtleTitle className="p-6">
            {variants.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('garments.noVariantsYet')}</p>
            ) : (
              <div className="space-y-2">
                {variants.map((row) => {
                  const label =
                    [row.color?.trim(), row.size?.trim()].filter(Boolean).join(' · ') ||
                    row.sku?.trim() ||
                    '—';
                  return (
                    <div
                      key={row.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">{label}</div>
                        {row.sku?.trim() ? (
                          <div className="truncate text-xs text-muted-foreground">{row.sku}</div>
                        ) : null}
                      </div>
                      <VariantQuantityEditor
                        variant={row}
                        disabled={isSaving}
                        onQuantityChange={async (variantId, quantity) => {
                          await updateInventoryVariantQuantity(item.id, variantId, quantity);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
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

      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          executeDuplicate(item, newName)
            .then(({ closePanel, highlightId }) => {
              closePanel();
              if (highlightId) {
                setRecentlyDuplicatedInventoryId(highlightId);
              }
              setShowDuplicateDialog(false);
            })
            .catch(() => {
              setShowDuplicateDialog(false);
            });
        }}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={getDuplicateConfig(item)?.defaultName ?? ''}
        nameLabel={getDuplicateConfig(item)?.nameLabel ?? t('garments.articleName')}
        confirmOnly={Boolean(getDuplicateConfig(item)?.confirmOnly)}
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
    getDuplicateConfig,
    executeDuplicate,
    setRecentlyDuplicatedListId,
    importPersons,
  } = useGarments();
  const { teams } = useTeams();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

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

  const canDuplicate = Boolean(getDuplicateConfig(list));
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
                icon={Zap}
                iconPlugin="garments"
                subtleTitle
                className="p-4"
              >
                <div className="flex flex-col items-start gap-1.5">
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
                    className={cn(DETAIL_QUICK_ACTION_ROW_CLASS)}
                    onClick={() => openGarmentForEdit(list)}
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={(props) => (
                      <Upload
                        {...props}
                        className={cn(props.className, 'text-emerald-600 dark:text-emerald-400')}
                      />
                    )}
                    className={cn(DETAIL_QUICK_ACTION_ROW_CLASS)}
                    onClick={() => setIsImportDialogOpen(true)}
                  >
                    {t('garments.importPersons')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={(props) => (
                      <Share2
                        {...props}
                        className={cn(props.className, 'text-violet-600 dark:text-violet-400')}
                      />
                    )}
                    className={cn(DETAIL_QUICK_ACTION_ROW_CLASS)}
                    disabled={garmentShareIsCreatingShare}
                    onClick={() => void handleGarmentShareClick(list)}
                  >
                    {garmentShareIsCreatingShare
                      ? t('garments.creatingShare')
                      : t('garments.shareList')}
                  </Button>
                  {canDuplicate ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={(props) => (
                        <Copy
                          {...props}
                          className={cn(props.className, 'text-green-600 dark:text-green-400')}
                        />
                      )}
                      className={DETAIL_QUICK_ACTION_ROW_CLASS}
                      onClick={() => setShowDuplicateDialog(true)}
                    >
                      {t('common.duplicate')}
                    </Button>
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
                    className="h-9 justify-start rounded-md px-3 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors"
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
                  {teamLabel ? (
                    <div className={DETAIL_INFO_ROW_CLASS}>
                      <span className="text-slate-500 dark:text-slate-400">
                        {t('garments.team')}
                      </span>
                      <span className="font-semibold text-foreground">{teamLabel}</span>
                    </div>
                  ) : null}
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
            <div className="border-b border-border/50 px-6 py-4">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {list.name || '—'}
              </h2>
            </div>
            <DetailSection title={t('garments.persons')} icon={Users} subtleTitle className="p-6">
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

      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          executeDuplicate(list, newName)
            .then(({ closePanel, highlightId }) => {
              closePanel();
              if (highlightId) {
                setRecentlyDuplicatedListId(highlightId);
              }
              setShowDuplicateDialog(false);
            })
            .catch(() => {
              setShowDuplicateDialog(false);
            });
        }}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={getDuplicateConfig(list)?.defaultName ?? ''}
        nameLabel={getDuplicateConfig(list)?.nameLabel ?? t('garments.name')}
        confirmOnly={Boolean(getDuplicateConfig(list)?.confirmOnly)}
      />

      <GarmentPersonImportDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        listId={list.id}
        onImportRows={importPersons}
      />
    </>
  );
};
