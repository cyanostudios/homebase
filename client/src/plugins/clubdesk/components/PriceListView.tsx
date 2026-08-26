import { ArrowDown, ArrowUp, Copy, Edit, Info, Tags, Trash2, Zap } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import { RichTextContent } from '@/core/ui/RichTextContent';
import {
  DETAIL_INFO_ROW_CLASS,
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_QUICK_ACTION_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';

import { useClubdesk } from '../hooks/useClubdesk';
import { formatPriceListPrice } from '../utils/formatPriceListPrice';
import { groupItemsByCategory } from '../utils/priceListItemOps';

export const PriceListView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const {
    currentPriceList,
    closeClubdeskPanel,
    deletePriceList,
    openPriceListForEdit,
    getPriceListDuplicateConfig,
    executePriceListDuplicate,
    setRecentlyDuplicatedPriceListId,
    getPriceListDeleteMessage,
    reorderPriceListItems,
    priceListCategories,
    isSaving,
  } = useClubdesk();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  const viewItem = currentPriceList;

  const catalogOrder = useMemo(() => priceListCategories.map((c) => c.name), [priceListCategories]);

  const groups = useMemo(
    () => groupItemsByCategory(viewItem?.items || [], catalogOrder),
    [viewItem?.items, catalogOrder],
  );

  if (!viewItem) {
    return null;
  }

  const isPublished = viewItem.publicationStatus === 'published';
  const canDuplicate = Boolean(getPriceListDuplicateConfig(viewItem));

  const handleConfirmDelete = async () => {
    await deletePriceList(viewItem.id);
    setShowDeleteConfirm(false);
    closeClubdeskPanel();
  };

  return (
    <>
      <DetailLayout
        sidebar={
          <div className="space-y-4">
            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('clubdesk.quickActions')}
                icon={Zap}
                iconPlugin="clubdesk"
                subtleTitle
                className="p-4"
              >
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
                    onClick={() => openPriceListForEdit(viewItem)}
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
                title={t('clubdesk.information')}
                icon={Info}
                iconPlugin="clubdesk"
                subtleTitle
                className="p-4"
                collapsible
              >
                <div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">ID</span>
                    <span className="font-mono font-extrabold text-foreground">
                      {formatDisplayNumber('clubdesk', viewItem.id)}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('clubdesk.priceList.currency')}
                    </span>
                    <span className="font-mono font-extrabold text-foreground">
                      {viewItem.currency || 'SEK'}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('common.created')}
                    </span>
                    <span className="font-mono font-extrabold text-foreground">
                      {viewItem.createdAt ? new Date(viewItem.createdAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('common.updated')}
                    </span>
                    <span className="font-mono font-extrabold text-foreground">
                      {viewItem.updatedAt ? new Date(viewItem.updatedAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                </div>
              </DetailSection>
            </Card>

            <DetailActivityLog
              entityType="clubdesk"
              entityId={viewItem.id}
              limit={30}
              title={t('clubdesk.activity')}
              showClearButton
              refreshKey={String(viewItem.updatedAt ?? viewItem.id)}
            />
          </div>
        }
      >
        <div className="space-y-4">
          <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
            <DetailSection
              title={(viewItem.title || '').trim() || '—'}
              iconPlugin="clubdesk"
              className="p-6"
              prominentTitle
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge
                  variant={isPublished ? 'default' : 'secondary'}
                  className={cn(
                    'text-[10px] font-extrabold',
                    isPublished &&
                      'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200',
                  )}
                >
                  {isPublished ? t('clubdesk.status.published') : t('clubdesk.status.draft')}
                </Badge>
                {viewItem.slug ? (
                  <span className="font-mono text-xs text-muted-foreground">/{viewItem.slug}</span>
                ) : null}
              </div>

              {!isPublished ? (
                <div
                  className={cn(DETAIL_NOTE_CALLOUT_CLASS, 'mb-3 text-xs text-muted-foreground')}
                >
                  {t('clubdesk.priceList.notVisiblePublic')}
                </div>
              ) : null}

              {viewItem.description ? (
                <div className="text-sm text-foreground">
                  <RichTextContent content={viewItem.description} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </DetailSection>
          </Card>

          <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
            <DetailSection
              title={t('clubdesk.priceList.itemsCard')}
              icon={Tags}
              iconPlugin="clubdesk"
              className="p-6"
            >
              {groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('clubdesk.priceList.noItemsYet')}
                </p>
              ) : (
                <div className="space-y-6">
                  {groups.map((group) => (
                    <div key={group.category ?? '__uncategorized__'}>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.category?.trim()
                          ? group.category
                          : t('clubdesk.priceList.uncategorized')}
                      </h4>
                      <ul className="space-y-2">
                        {group.items.map((item, index) => (
                          <li
                            key={item.id ?? `${group.category}-${index}`}
                            className="rounded-lg border border-border/50 p-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="min-w-0 flex-1 truncate text-sm font-medium">
                                {item.title}
                              </div>
                              <div className="flex-shrink-0 font-mono text-sm font-semibold tabular-nums">
                                {formatPriceListPrice(
                                  item.price,
                                  viewItem.currency || 'SEK',
                                  i18n.language,
                                )}
                              </div>
                              <div className="flex flex-shrink-0 flex-row items-center gap-0.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  icon={ArrowUp}
                                  className="h-8 w-8 px-0"
                                  disabled={isSaving || index === 0}
                                  aria-label={t('clubdesk.priceList.moveItemUp')}
                                  onClick={() =>
                                    void reorderPriceListItems(viewItem, group.category, index, -1)
                                  }
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  icon={ArrowDown}
                                  className="h-8 w-8 px-0"
                                  disabled={isSaving || index === group.items.length - 1}
                                  aria-label={t('clubdesk.priceList.moveItemDown')}
                                  onClick={() =>
                                    void reorderPriceListItems(viewItem, group.category, index, 1)
                                  }
                                />
                              </div>
                            </div>
                            {item.description ? (
                              <div className="mt-1 text-xs text-muted-foreground">
                                <RichTextContent content={item.description} />
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </DetailSection>
          </Card>
        </div>
      </DetailLayout>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('dialog.deleteItem', { label: t('nav.clubdesk-price-list') })}
        message={getPriceListDeleteMessage(viewItem)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />

      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          executePriceListDuplicate(viewItem, newName)
            .then(({ closePanel, highlightId }) => {
              closePanel();
              if (highlightId) {
                setRecentlyDuplicatedPriceListId(highlightId);
              }
              setShowDuplicateDialog(false);
            })
            .catch(() => {
              setShowDuplicateDialog(false);
            });
        }}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={getPriceListDuplicateConfig(viewItem)?.defaultName ?? ''}
        nameLabel={
          getPriceListDuplicateConfig(viewItem)?.nameLabel ?? t('clubdesk.priceList.title')
        }
        confirmOnly={Boolean(getPriceListDuplicateConfig(viewItem)?.confirmOnly)}
      />
    </>
  );
};
