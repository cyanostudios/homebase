import { Edit, Home, Info, QrCode as QrCodeIcon, Users, X } from 'lucide-react';
import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { Textarea } from '@/components/ui/textarea';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';
import { DetailSection } from '@/core/ui/DetailSection';
import { FORM_INPUT_CLASS, FORM_TEXTAREA_CLASS } from '@/core/ui/formFieldStyles';
import { PLUGIN_PAGE_LIST_SHELL_CLASS } from '@/core/ui/pluginPageStyles';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { RichTextContent } from '@/core/ui/RichTextContent';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { clubdeskApi } from '../api/clubdeskApi';

import { ClubdeskInfoContactsPanel } from './ClubdeskInfoContactsPanel';
import { ClubdeskPublicVisibleSwitch } from './ClubdeskPublicVisibleSwitch';
import { ClubdeskSwishProfilesPanel } from './ClubdeskSwishProfilesPanel';

const RichTextEditor = React.lazy(() =>
  import('@/core/ui/RichTextEditor').then((m) => ({ default: m.RichTextEditor })),
);

type InfoCardTab = 'home' | 'info' | 'contacts' | 'swish';
type CardMode = 'view' | 'edit';

function EditorFallback({ className }: { className?: string }) {
  return (
    <textarea
      disabled
      className={cn(FORM_TEXTAREA_CLASS, 'min-h-[160px] w-full resize-y', className)}
      placeholder="…"
    />
  );
}

function readCardTitle(meta: Record<string, unknown> | undefined): string {
  const raw = meta?.title;
  return typeof raw === 'string' ? raw : '';
}

/** Public visibility — missing/undefined means visible (legacy rows). */
function readCardVisible(meta: Record<string, unknown> | undefined): boolean {
  return meta?.visible !== false;
}

/** TipTap/HTML → plain text for the home textarea (no font styles). */
function htmlToPlainText(html: string): string {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Plain textarea → simple paragraph HTML for public rendering. */
function plainTextToHtml(text: string): string {
  const parts = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (parts.length === 0) return '';
  return parts.map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`).join('');
}

function isBlankHtml(html: string): boolean {
  return htmlToPlainText(html).length === 0;
}

export function ClubdeskInfoView() {
  const { t } = useTranslation();
  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
    useGlobalNavigationGuard();

  const [activeTab, setActiveTab] = useState<InfoCardTab>('home');
  const [homeMode, setHomeMode] = useState<CardMode>('view');
  const [infoMode, setInfoMode] = useState<CardMode>('view');
  const [homeTitle, setHomeTitle] = useState('');
  const [homeContent, setHomeContent] = useState('');
  const [infoContent, setInfoContent] = useState('');
  const [infoTitle, setInfoTitle] = useState('');
  const [infoVisible, setInfoVisible] = useState(true);
  const [contactsVisible, setContactsVisible] = useState(true);
  const [swishVisible, setSwishVisible] = useState(true);
  const [initialHomeTitle, setInitialHomeTitle] = useState('');
  const [initialHome, setInitialHome] = useState('');
  const [initialInfo, setInitialInfo] = useState('');
  const [initialInfoTitle, setInitialInfoTitle] = useState('');
  const [initialInfoVisible, setInitialInfoVisible] = useState(true);
  const [initialContactsVisible, setInitialContactsVisible] = useState(true);
  const [initialSwishVisible, setInitialSwishVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDirty =
    homeTitle !== initialHomeTitle ||
    homeContent !== initialHome ||
    infoContent !== initialInfo ||
    infoTitle !== initialInfoTitle ||
    infoVisible !== initialInfoVisible ||
    contactsVisible !== initialContactsVisible ||
    swishVisible !== initialSwishVisible;

  const showSave = isDirty;

  const shellCategories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'home',
        label: t('clubdesk.siteContent.cards.home'),
        description: t('clubdesk.siteContent.cards.homeDescription'),
        icon: Home,
      },
      {
        id: 'info',
        label: t('clubdesk.siteContent.cards.info'),
        description: t('clubdesk.siteContent.cards.infoDescription'),
        icon: Info,
      },
      {
        id: 'contacts',
        label: t('clubdesk.siteContent.cards.contacts'),
        description: t('clubdesk.siteContent.cards.contactsDescription'),
        icon: Users,
      },
      {
        id: 'swish',
        label: t('clubdesk.siteContent.cards.swish'),
        description: t('clubdesk.siteContent.cards.swishDescription'),
        icon: QrCodeIcon,
      },
    ],
    [t],
  );

  useEffect(() => {
    registerUnsavedChangesChecker('clubdesk-info', () => isDirty);
    return () => unregisterUnsavedChangesChecker('clubdesk-info');
  }, [isDirty, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  /** Leave edit mode; discard unsaved title/body drafts so view never shows dirty edits. */
  const handleCategoryChange = useCallback(
    (id: string) => {
      if (homeMode === 'edit') {
        setHomeTitle(initialHomeTitle);
        setHomeContent(initialHome);
        setHomeMode('view');
      } else {
        setHomeMode('view');
      }
      if (infoMode === 'edit') {
        setInfoTitle(initialInfoTitle);
        setInfoContent(initialInfo);
        setInfoMode('view');
      } else {
        setInfoMode('view');
      }
      setActiveTab(id as InfoCardTab);
    },
    [homeMode, infoMode, initialHome, initialHomeTitle, initialInfo, initialInfoTitle],
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);
    clubdeskApi
      .getSiteContent()
      .then((cards) => {
        if (cancelled) return;
        const homePlain = htmlToPlainText(cards.home?.content ?? '');
        const homeTitleValue = readCardTitle(cards.home?.meta);
        const info = cards.info?.content ?? '';
        const infoTitleValue = readCardTitle(cards.info?.meta);
        const infoVisibleValue = readCardVisible(cards.info?.meta);
        const contactsVisibleValue = readCardVisible(cards.contacts?.meta);
        const swishVisibleValue = readCardVisible(cards.swish?.meta);
        setHomeTitle(homeTitleValue);
        setHomeContent(homePlain);
        setInfoContent(info);
        setInfoTitle(infoTitleValue);
        setInfoVisible(infoVisibleValue);
        setContactsVisible(contactsVisibleValue);
        setSwishVisible(swishVisibleValue);
        setInitialHomeTitle(homeTitleValue);
        setInitialHome(homePlain);
        setInitialInfo(info);
        setInitialInfoTitle(infoTitleValue);
        setInitialInfoVisible(infoVisibleValue);
        setInitialContactsVisible(contactsVisibleValue);
        setInitialSwishVisible(swishVisibleValue);
        setHomeMode('view');
        setInfoMode('view');
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage(t('clubdesk.siteContent.loadFailed'));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const trimmedHomeTitle = homeTitle.trim().slice(0, 255);
      const trimmedInfoTitle = infoTitle.trim().slice(0, 255);
      const homeHtml = plainTextToHtml(homeContent);
      const saved = await clubdeskApi.saveSiteContent([
        {
          cardKey: 'home',
          content: homeHtml,
          meta: trimmedHomeTitle ? { title: trimmedHomeTitle } : {},
        },
        {
          cardKey: 'info',
          content: infoContent,
          meta: {
            ...(trimmedInfoTitle ? { title: trimmedInfoTitle } : {}),
            visible: infoVisible,
          },
        },
        {
          cardKey: 'contacts',
          content: '',
          meta: { visible: contactsVisible },
        },
        {
          cardKey: 'swish',
          content: '',
          meta: { visible: swishVisible },
        },
      ]);
      const homePlain = htmlToPlainText(saved.home?.content ?? homeHtml);
      const nextHomeTitle = readCardTitle(saved.home?.meta) || trimmedHomeTitle;
      const info = saved.info?.content ?? infoContent;
      const nextInfoTitle = readCardTitle(saved.info?.meta) || trimmedInfoTitle;
      const nextInfoVisible = readCardVisible(saved.info?.meta);
      const nextContactsVisible = readCardVisible(saved.contacts?.meta);
      const nextSwishVisible = readCardVisible(saved.swish?.meta);
      setHomeTitle(nextHomeTitle);
      setHomeContent(homePlain);
      setInfoContent(info);
      setInfoTitle(nextInfoTitle);
      setInfoVisible(nextInfoVisible);
      setContactsVisible(nextContactsVisible);
      setSwishVisible(nextSwishVisible);
      setInitialHomeTitle(nextHomeTitle);
      setInitialHome(homePlain);
      setInitialInfo(info);
      setInitialInfoTitle(nextInfoTitle);
      setInitialInfoVisible(nextInfoVisible);
      setInitialContactsVisible(nextContactsVisible);
      setInitialSwishVisible(nextSwishVisible);
      setHomeMode('view');
      setInfoMode('view');
    } catch {
      setErrorMessage(t('clubdesk.siteContent.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }, [
    contactsVisible,
    homeContent,
    homeTitle,
    infoContent,
    infoTitle,
    infoVisible,
    swishVisible,
    t,
  ]);

  const cancelHomeEdit = useCallback(() => {
    setHomeTitle(initialHomeTitle);
    setHomeContent(initialHome);
    setHomeMode('view');
  }, [initialHome, initialHomeTitle]);

  const cancelInfoEdit = useCallback(() => {
    setInfoTitle(initialInfoTitle);
    setInfoContent(initialInfo);
    setInfoMode('view');
  }, [initialInfo, initialInfoTitle]);

  const homeEditActions = useMemo(
    (): DetailHeaderMenuAction[] => [
      {
        id: 'edit',
        icon: Edit,
        label: t('common.edit'),
        variant: 'soft',
        disabled: isLoading,
        onClick: () => setHomeMode('edit'),
      },
    ],
    [isLoading, t],
  );

  const infoEditActions = useMemo(
    (): DetailHeaderMenuAction[] => [
      {
        id: 'edit',
        icon: Edit,
        label: t('common.edit'),
        variant: 'soft',
        disabled: isLoading,
        onClick: () => setInfoMode('edit'),
      },
    ],
    [isLoading, t],
  );

  const saveButton = showSave ? (
    <SettingsHeaderSaveButton onClick={handleSave} isSaving={isSaving} disabled={isLoading} />
  ) : null;

  const homeHeading = homeTitle.trim() || t('clubdesk.siteContent.cards.home');
  const infoHeading = infoTitle.trim() || t('clubdesk.siteContent.cards.info');

  return (
    <div
      className={cn(
        'plugin-clubdesk flex min-h-0 flex-1 flex-col overflow-y-auto',
        PLUGIN_PAGE_LIST_SHELL_CLASS,
      )}
    >
      <PluginSettingsPageShell
        title={t('nav.clubdesk-info')}
        categories={shellCategories}
        activeCategory={activeTab}
        onCategoryChange={handleCategoryChange}
        saveAction={saveButton}
      >
        {/* Phone: page header is hidden; keep categories and Save reachable. */}
        <div className="mb-4 flex flex-wrap items-center gap-1 md:hidden">
          {shellCategories.map((category) => {
            const isActive = activeTab === category.id;
            return (
              <RoundIconLabelButton
                key={category.id}
                type="button"
                icon={category.icon}
                label={category.label}
                variant={isActive ? 'primary' : 'soft'}
                alwaysExpanded
                className="shrink-0"
                aria-pressed={isActive}
                onClick={() => handleCategoryChange(category.id)}
              />
            );
          })}
          {saveButton}
        </div>

        {errorMessage ? (
          <p className="mb-4 text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {activeTab === 'home' ? (
          <DetailSection
            title={t('clubdesk.siteContent.cards.home')}
            icon={Home}
            iconPlugin="clubdesk"
            className="pt-0"
            subtleTitle
            action={
              homeMode === 'edit' ? (
                <RoundIconLabelButton
                  type="button"
                  icon={X}
                  label={t('common.cancel')}
                  variant="soft"
                  size="xs"
                  alwaysExpanded
                  disabled={isLoading}
                  onClick={cancelHomeEdit}
                />
              ) : (
                <DetailHeaderMenus
                  actions={homeEditActions}
                  actionsLabel={t('common.headerActions')}
                />
              )
            }
          >
            {homeMode === 'view' ? (
              <div className="space-y-4">
                <h2 className="text-base font-semibold text-foreground">{homeHeading}</h2>
                {homeContent.trim() ? (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {homeContent}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('clubdesk.siteContent.emptyBody')}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="clubdesk-home-title">{t('clubdesk.siteContent.infoTitle')}</Label>
                  <Input
                    id="clubdesk-home-title"
                    value={homeTitle}
                    onChange={(e) => setHomeTitle(e.target.value)}
                    placeholder={t('clubdesk.siteContent.homeTitlePlaceholder')}
                    maxLength={255}
                    disabled={isLoading}
                    className={FORM_INPUT_CLASS}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="clubdesk-home-body">{t('clubdesk.siteContent.infoBody')}</Label>
                  <Textarea
                    id="clubdesk-home-body"
                    value={homeContent}
                    onChange={(e) => setHomeContent(e.target.value)}
                    placeholder={t('clubdesk.siteContent.editorPlaceholder')}
                    disabled={isLoading}
                    className={cn(FORM_TEXTAREA_CLASS, 'min-h-[160px]')}
                  />
                </div>
              </div>
            )}
          </DetailSection>
        ) : null}

        {activeTab === 'info' ? (
          <DetailSection
            title={t('clubdesk.siteContent.cards.info')}
            icon={Info}
            iconPlugin="clubdesk"
            className="pt-0"
            subtleTitle
            titleAside={
              <ClubdeskPublicVisibleSwitch
                id="clubdesk-info-visible"
                checked={infoVisible}
                onCheckedChange={setInfoVisible}
                disabled={isLoading}
              />
            }
            action={
              infoMode === 'edit' ? (
                <RoundIconLabelButton
                  type="button"
                  icon={X}
                  label={t('common.cancel')}
                  variant="soft"
                  size="xs"
                  alwaysExpanded
                  disabled={isLoading}
                  onClick={cancelInfoEdit}
                />
              ) : (
                <DetailHeaderMenus
                  actions={infoEditActions}
                  actionsLabel={t('common.headerActions')}
                />
              )
            }
          >
            {infoMode === 'view' ? (
              <div className="space-y-4">
                <h2 className="text-base font-semibold text-foreground">{infoHeading}</h2>
                {isBlankHtml(infoContent) ? (
                  <p className="text-sm text-muted-foreground">
                    {t('clubdesk.siteContent.emptyBody')}
                  </p>
                ) : (
                  <div className="text-sm leading-relaxed text-foreground">
                    <RichTextContent content={infoContent} />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="clubdesk-info-title">{t('clubdesk.siteContent.infoTitle')}</Label>
                  <Input
                    id="clubdesk-info-title"
                    value={infoTitle}
                    onChange={(e) => setInfoTitle(e.target.value)}
                    placeholder={t('clubdesk.siteContent.infoTitlePlaceholder')}
                    maxLength={255}
                    disabled={isLoading}
                    className={FORM_INPUT_CLASS}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('clubdesk.siteContent.infoBody')}</Label>
                  {isLoading ? (
                    <EditorFallback />
                  ) : (
                    <Suspense fallback={<EditorFallback />}>
                      <RichTextEditor
                        value={infoContent}
                        onChange={(html) => setInfoContent(html)}
                        placeholder={t('clubdesk.siteContent.editorPlaceholder')}
                      />
                    </Suspense>
                  )}
                </div>
              </div>
            )}
          </DetailSection>
        ) : null}

        {activeTab === 'contacts' ? (
          <ClubdeskInfoContactsPanel
            disabled={isLoading}
            publicVisible={contactsVisible}
            onPublicVisibleChange={setContactsVisible}
          />
        ) : null}

        {activeTab === 'swish' ? (
          <ClubdeskSwishProfilesPanel
            disabled={isLoading}
            publicVisible={swishVisible}
            onPublicVisibleChange={setSwishVisible}
          />
        ) : null}
      </PluginSettingsPageShell>
    </div>
  );
}
