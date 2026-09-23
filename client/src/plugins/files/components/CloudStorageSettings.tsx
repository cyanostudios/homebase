// client/src/plugins/files/components/CloudStorageSettings.tsx
import { Check, Cloud, ExternalLink, Key, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailSection } from '@/core/ui/DetailSection';
import { FORM_INPUT_CLASS } from '@/core/ui/formFieldStyles';
import { cn } from '@/lib/utils';

import { cloudStorageApi, type CloudStorageService } from '../api/cloudStorageApi';
import { useFiles } from '../hooks/useFiles';

const SERVICE: CloudStorageService = 'googledrive';

export const CloudStorageSettings: React.FC = () => {
  const { t } = useTranslation();
  const {
    cloudStorageSettings,
    connectCloudStorage,
    disconnectCloudStorage,
    getCloudStorageEmbedUrl,
    loadCloudStorageSettings,
  } = useFiles();
  const [opening, setOpening] = useState(false);
  const [credentials, setCredentials] = useState({ clientId: '', clientSecret: '' });
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null,
  );

  const settings = cloudStorageSettings.googledrive;
  const connected = Boolean(settings?.connected);

  const handleConnect = async () => {
    setFeedback(null);
    try {
      await connectCloudStorage(SERVICE);
    } catch (err) {
      console.error('Failed to connect googledrive:', err);
    }
  };

  const handleDisconnect = async () => {
    setFeedback(null);
    try {
      await disconnectCloudStorage(SERVICE);
      setShowDisconnectConfirm(false);
    } catch (err) {
      console.error('Failed to disconnect googledrive:', err);
    }
  };

  const handleOpenFileManager = async () => {
    setFeedback(null);
    setOpening(true);
    try {
      const embedUrl = await getCloudStorageEmbedUrl(SERVICE);
      if (embedUrl) {
        window.open(embedUrl, '_blank', 'width=1200,height=800');
      }
    } catch (err) {
      console.error('Failed to open googledrive file manager:', err);
      setFeedback({ type: 'error', text: t('files.cloudOpenFailed') });
    } finally {
      setOpening(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!credentials.clientId.trim() || !credentials.clientSecret.trim()) {
      setFeedback({ type: 'error', text: t('files.cloudCredentialsBothRequired') });
      return;
    }
    setSavingCredentials(true);
    setFeedback(null);
    try {
      await cloudStorageApi.saveOAuthCredentials(
        SERVICE,
        credentials.clientId.trim(),
        credentials.clientSecret.trim(),
      );
      setCredentials({ clientId: '', clientSecret: '' });
      setFeedback({ type: 'success', text: t('files.cloudCredentialsSaved') });
      await loadCloudStorageSettings();
    } catch {
      setFeedback({ type: 'error', text: t('files.cloudSaveCredentialsFailed') });
    } finally {
      setSavingCredentials(false);
    }
  };

  return (
    <div className="space-y-6">
      <DetailSection
        title={t('files.cloudStorageTitle')}
        icon={Cloud}
        iconPlugin="files"
        subtleTitle
        className="space-y-4"
      >
        <p className="text-sm text-muted-foreground">{t('files.settingsSubtitle')}</p>
        <p className="text-xs text-muted-foreground">{t('files.cloudR2Hint')}</p>

        <div className="rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="text-sm font-medium">Google Drive</div>
              <p className="text-xs text-muted-foreground">
                {t('files.cloudServiceGoogledriveDesc')}
              </p>
              <p
                className={cn(
                  'text-xs font-medium',
                  connected ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground',
                )}
              >
                {connected ? t('files.cloudConnected') : t('files.cloudNotConnected')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {connected ? (
                <>
                  <RoundIconLabelButton
                    type="button"
                    icon={ExternalLink}
                    label={opening ? t('files.cloudOpening') : t('files.cloudOpen')}
                    variant="soft"
                    size="xs"
                    alwaysExpanded
                    disabled={opening}
                    onClick={() => void handleOpenFileManager()}
                  />
                  <RoundIconLabelButton
                    type="button"
                    icon={X}
                    label={t('files.cloudDisconnect')}
                    variant="dangerSoft"
                    size="xs"
                    alwaysExpanded
                    onClick={() => setShowDisconnectConfirm(true)}
                  />
                </>
              ) : (
                <RoundIconLabelButton
                  type="button"
                  icon={Check}
                  label={t('files.cloudConnect')}
                  variant="soft"
                  size="xs"
                  alwaysExpanded
                  onClick={() => void handleConnect()}
                />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Key className="h-4 w-4" />
            {t('files.cloudConfigureOAuth')}
          </div>
          <p className="text-xs text-muted-foreground">{t('files.cloudOAuthHint')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="gd-client-id">{t('files.cloudClientId')}</Label>
              <Input
                id="gd-client-id"
                value={credentials.clientId}
                onChange={(e) => setCredentials((c) => ({ ...c, clientId: e.target.value }))}
                placeholder={t('files.cloudClientIdPlaceholder')}
                className={FORM_INPUT_CLASS}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gd-client-secret">{t('files.cloudClientSecret')}</Label>
              <Input
                id="gd-client-secret"
                type="password"
                value={credentials.clientSecret}
                onChange={(e) => setCredentials((c) => ({ ...c, clientSecret: e.target.value }))}
                placeholder={t('files.cloudClientSecretPlaceholder')}
                className={FORM_INPUT_CLASS}
                autoComplete="new-password"
              />
            </div>
          </div>
          <RoundIconLabelButton
            type="button"
            icon={Check}
            label={
              savingCredentials
                ? t('files.cloudSavingCredentials')
                : t('files.cloudSaveCredentials')
            }
            variant="soft"
            size="xs"
            alwaysExpanded
            disabled={savingCredentials}
            onClick={() => void handleSaveCredentials()}
          />
          {feedback ? (
            <p
              className={cn(
                'text-xs',
                feedback.type === 'error'
                  ? 'text-destructive'
                  : 'text-green-600 dark:text-green-400',
              )}
            >
              {feedback.text}
            </p>
          ) : null}
        </div>
      </DetailSection>

      <ConfirmDialog
        isOpen={showDisconnectConfirm}
        title={t('files.cloudDisconnect')}
        message={t('files.cloudDisconnectConfirm', { name: 'Google Drive' })}
        confirmText={t('files.cloudDisconnect')}
        cancelText={t('common.cancel')}
        variant="danger"
        onConfirm={() => void handleDisconnect()}
        onCancel={() => setShowDisconnectConfirm(false)}
      />
    </div>
  );
};
