// client/src/plugins/files/components/CloudStorageSettings.tsx
import { Check, Cloud, ExternalLink, Key, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DetailSection } from '@/core/ui/DetailSection';
import { cn } from '@/lib/utils';

import { cloudStorageApi, type CloudStorageService } from '../api/cloudStorageApi';
import { useFiles } from '../hooks/useFiles';

const SERVICES = [
  'onedrive',
  'dropbox',
  'googledrive',
] as const satisfies readonly CloudStorageService[];

const serviceConfig = {
  onedrive: {
    name: 'OneDrive',
    descriptionKey: 'files.cloudServiceOnedriveDesc' as const,
  },
  dropbox: {
    name: 'Dropbox',
    descriptionKey: 'files.cloudServiceDropboxDesc' as const,
  },
  googledrive: {
    name: 'Google Drive',
    descriptionKey: 'files.cloudServiceGoogledriveDesc' as const,
  },
};

export const CloudStorageSettings: React.FC = () => {
  const { t } = useTranslation();
  const {
    cloudStorageSettings,
    connectCloudStorage,
    disconnectCloudStorage,
    getCloudStorageEmbedUrl,
  } = useFiles();
  const [selectedService, setSelectedService] = useState<CloudStorageService>('onedrive');
  const [openingService, setOpeningService] = useState<CloudStorageService | null>(null);
  const [credentials, setCredentials] = useState<
    Record<CloudStorageService, { clientId: string; clientSecret: string }>
  >({
    onedrive: { clientId: '', clientSecret: '' },
    dropbox: { clientId: '', clientSecret: '' },
    googledrive: { clientId: '', clientSecret: '' },
  });
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null,
  );

  const selectService = (service: CloudStorageService) => {
    setSelectedService(service);
    setFeedback(null);
  };

  const handleConnect = async (service: CloudStorageService) => {
    setFeedback(null);
    try {
      await connectCloudStorage(service);
    } catch (err) {
      console.error(`Failed to connect ${service}:`, err);
    }
  };

  const handleDisconnect = async (service: CloudStorageService) => {
    if (!confirm(t('files.cloudDisconnectConfirm', { name: serviceConfig[service].name }))) {
      return;
    }
    setFeedback(null);
    try {
      await disconnectCloudStorage(service);
    } catch (err) {
      console.error(`Failed to disconnect ${service}:`, err);
    }
  };

  const handleOpenFileManager = async (service: CloudStorageService) => {
    setFeedback(null);
    setOpeningService(service);
    try {
      const embedUrl = await getCloudStorageEmbedUrl(service);
      if (embedUrl) {
        window.open(embedUrl, '_blank', 'width=1200,height=800');
      }
    } catch (err) {
      console.error(`Failed to open ${service} file manager:`, err);
      setFeedback({ type: 'error', text: t('files.cloudOpenFailed') });
    } finally {
      setOpeningService(null);
    }
  };

  const handleSaveCredentials = async (service: CloudStorageService) => {
    const creds = credentials[service];
    if (!creds.clientId || !creds.clientSecret) {
      setFeedback({ type: 'error', text: t('files.cloudCredentialsBothRequired') });
      return;
    }

    setFeedback(null);
    setSavingCredentials(true);
    try {
      await cloudStorageApi.saveOAuthCredentials(service, creds.clientId, creds.clientSecret);
      setFeedback({ type: 'success', text: t('files.cloudCredentialsSaved') });
    } catch (err: unknown) {
      console.error(`Failed to save ${service} credentials:`, err);
      const message = err instanceof Error ? err.message : t('files.cloudSaveCredentialsFailed');
      setFeedback({ type: 'error', text: message });
    } finally {
      setSavingCredentials(false);
    }
  };

  const activeConfig = serviceConfig[selectedService];
  const isConnected = cloudStorageSettings[selectedService]?.connected || false;

  return (
    <div className="space-y-6">
      <DetailSection title={t('mail.provider')} icon={Cloud} iconPlugin="files">
        <p className="mb-4 text-sm text-muted-foreground">{t('files.cloudStorageDescription')}</p>
        <div className="flex flex-wrap gap-2">
          {SERVICES.map((service) => {
            const config = serviceConfig[service];
            const connected = cloudStorageSettings[service]?.connected || false;
            const isActive = selectedService === service;
            return (
              <button
                key={service}
                type="button"
                onClick={() => selectService(service)}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-muted',
                )}
              >
                <span
                  className={cn('h-2 w-2 rounded-full', connected ? 'bg-green-500' : 'bg-red-500')}
                />
                {config.name}
                {isActive && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
      </DetailSection>

      <DetailSection
        title={t('mail.credentials')}
        icon={Key}
        className="border-t border-border pt-6"
      >
        <p className="mb-4 text-sm text-muted-foreground">{t(activeConfig.descriptionKey)}</p>

        {feedback && (
          <p
            className={cn(
              'mb-4 text-sm',
              feedback.type === 'error' ? 'text-destructive' : 'text-green-600 dark:text-green-400',
            )}
            role="status"
          >
            {feedback.text}
          </p>
        )}

        {isConnected ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 text-xs"
              onClick={() => void handleOpenFileManager(selectedService)}
              disabled={openingService === selectedService}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {openingService === selectedService ? t('files.cloudOpening') : t('files.cloudOpen')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => void handleDisconnect(selectedService)}
              title={t('files.cloudDisconnect')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">{t('files.cloudOAuthHint')}</p>
            <div className="space-y-4">
              <div>
                <Label htmlFor={`${selectedService}-client-id`}>{t('files.cloudClientId')}</Label>
                <Input
                  id={`${selectedService}-client-id`}
                  type="text"
                  value={credentials[selectedService].clientId}
                  onChange={(e) =>
                    setCredentials({
                      ...credentials,
                      [selectedService]: {
                        ...credentials[selectedService],
                        clientId: e.target.value,
                      },
                    })
                  }
                  placeholder={t('files.cloudClientIdPlaceholder')}
                  autoComplete="off"
                  className="mt-1.5 h-9 text-xs"
                />
              </div>
              <div>
                <Label htmlFor={`${selectedService}-client-secret`}>
                  {t('files.cloudClientSecret')}
                </Label>
                <Input
                  id={`${selectedService}-client-secret`}
                  type="password"
                  value={credentials[selectedService].clientSecret}
                  onChange={(e) =>
                    setCredentials({
                      ...credentials,
                      [selectedService]: {
                        ...credentials[selectedService],
                        clientSecret: e.target.value,
                      },
                    })
                  }
                  placeholder={t('files.cloudClientSecretPlaceholder')}
                  autoComplete="off"
                  className="mt-1.5 h-9 text-xs"
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="h-9 text-xs"
                onClick={() => void handleConnect(selectedService)}
              >
                <Cloud className="h-3.5 w-3.5" />
                {t('files.cloudConnect')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 text-xs"
                onClick={() => void handleSaveCredentials(selectedService)}
                disabled={savingCredentials}
              >
                {savingCredentials
                  ? t('files.cloudSavingCredentials')
                  : t('files.cloudSaveCredentials')}
              </Button>
            </div>
          </>
        )}
      </DetailSection>
    </div>
  );
};
