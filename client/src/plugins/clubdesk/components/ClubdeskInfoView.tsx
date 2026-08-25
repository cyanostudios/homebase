import { Home, Info, QrCode as QrCodeIcon, Users } from 'lucide-react';
import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { cn } from '@/lib/utils';

import { clubdeskApi } from '../api/clubdeskApi';

import { ClubdeskInfoContactsPanel } from './ClubdeskInfoContactsPanel';
import { ClubdeskSwishProfilesPanel } from './ClubdeskSwishProfilesPanel';

const RichTextEditor = React.lazy(() =>
  import('@/core/ui/RichTextEditor').then((m) => ({ default: m.RichTextEditor })),
);

type InfoCardTab = 'home' | 'info' | 'contacts' | 'swish';

function EditorFallback({ className }: { className?: string }) {
  return (
    <textarea
      disabled
      className={cn(
        'min-h-[160px] w-full resize-y rounded-md border border-input bg-muted/40 px-3 py-2 text-sm',
        className,
      )}
      placeholder="…"
    />
  );
}

function readCardTitle(meta: Record<string, unknown> | undefined): string {
  const raw = meta?.title;
  return typeof raw === 'string' ? raw : '';
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

export function ClubdeskInfoView() {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<InfoCardTab>('home');
  const [homeTitle, setHomeTitle] = useState('');
  const [homeContent, setHomeContent] = useState('');
  const [infoContent, setInfoContent] = useState('');
  const [infoTitle, setInfoTitle] = useState('');
  const [initialHomeTitle, setInitialHomeTitle] = useState('');
  const [initialHome, setInitialHome] = useState('');
  const [initialInfo, setInitialInfo] = useState('');
  const [initialInfoTitle, setInitialInfoTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDirty =
    homeTitle !== initialHomeTitle ||
    homeContent !== initialHome ||
    infoContent !== initialInfo ||
    infoTitle !== initialInfoTitle;

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
        setHomeTitle(homeTitleValue);
        setHomeContent(homePlain);
        setInfoContent(info);
        setInfoTitle(infoTitleValue);
        setInitialHomeTitle(homeTitleValue);
        setInitialHome(homePlain);
        setInitialInfo(info);
        setInitialInfoTitle(infoTitleValue);
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
          meta: trimmedInfoTitle ? { title: trimmedInfoTitle } : {},
        },
      ]);
      const homePlain = htmlToPlainText(saved.home?.content ?? homeHtml);
      const nextHomeTitle = readCardTitle(saved.home?.meta) || trimmedHomeTitle;
      const info = saved.info?.content ?? infoContent;
      const nextInfoTitle = readCardTitle(saved.info?.meta) || trimmedInfoTitle;
      setHomeTitle(nextHomeTitle);
      setHomeContent(homePlain);
      setInfoContent(info);
      setInfoTitle(nextInfoTitle);
      setInitialHomeTitle(nextHomeTitle);
      setInitialHome(homePlain);
      setInitialInfo(info);
      setInitialInfoTitle(nextInfoTitle);
    } catch {
      setErrorMessage(t('clubdesk.siteContent.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }, [homeContent, homeTitle, infoContent, infoTitle, t]);

  return (
    <div className="plugin-clubdesk min-h-full bg-background">
      <div className="px-6 py-4">
        <PluginSettingsPageShell
          title={t('nav.clubdesk-info')}
          subtitle={t('clubdesk.siteContent.subtitle')}
          categories={shellCategories}
          activeCategory={activeTab}
          onCategoryChange={(id) => setActiveTab(id as InfoCardTab)}
          saveAction={
            activeTab !== 'swish' && activeTab !== 'contacts' && isDirty ? (
              <SettingsHeaderSaveButton
                onClick={handleSave}
                isSaving={isSaving}
                disabled={isLoading}
              />
            ) : null
          }
        >
          {errorMessage && activeTab !== 'swish' && activeTab !== 'contacts' ? (
            <p className="mb-4 text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}

          {activeTab === 'home' ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('clubdesk.siteContent.cards.homeHelp')}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="clubdesk-home-title">{t('clubdesk.siteContent.infoTitle')}</Label>
                <Input
                  id="clubdesk-home-title"
                  value={homeTitle}
                  onChange={(e) => setHomeTitle(e.target.value)}
                  placeholder={t('clubdesk.siteContent.homeTitlePlaceholder')}
                  maxLength={255}
                  disabled={isLoading}
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
                  className="min-h-[160px]"
                />
              </div>
            </div>
          ) : null}

          {activeTab === 'info' ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('clubdesk.siteContent.cards.infoHelp')}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="clubdesk-info-title">{t('clubdesk.siteContent.infoTitle')}</Label>
                <Input
                  id="clubdesk-info-title"
                  value={infoTitle}
                  onChange={(e) => setInfoTitle(e.target.value)}
                  placeholder={t('clubdesk.siteContent.infoTitlePlaceholder')}
                  maxLength={255}
                  disabled={isLoading}
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
          ) : null}

          {activeTab === 'contacts' ? <ClubdeskInfoContactsPanel disabled={isLoading} /> : null}

          {activeTab === 'swish' ? <ClubdeskSwishProfilesPanel disabled={isLoading} /> : null}
        </PluginSettingsPageShell>
      </div>
    </div>
  );
}
