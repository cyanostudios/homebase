// client/src/plugins/files/components/CloudStorageSettings.tsx
import { Cloud, X, ExternalLink, Key } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heading, Text } from '@/core/ui/Typography';

import { cloudStorageApi, type CloudStorageService } from '../api/cloudStorageApi';
import { useFiles } from '../hooks/useFiles';

const serviceConfig: Record<
  CloudStorageService,
  { name: string; icon: string; color: string; description: string }
> = {
  googledrive: {
    name: 'Google Drive',
    icon: '☁️',
    color: 'bg-yellow-500',
    description: 'Access your Google Drive files directly from Homebase',
  },
};

export const CloudStorageSettings: React.FC = () => {
  const {
    cloudStorageSettings,
    connectCloudStorage,
    disconnectCloudStorage,
    getCloudStorageEmbedUrl,
  } = useFiles();
  const [openingService, setOpeningService] = useState<CloudStorageService | null>(null);
  const [configuringService, setConfiguringService] = useState<CloudStorageService | null>(null);
  const [credentials, setCredentials] = useState<
    Record<CloudStorageService, { clientId: string; clientSecret: string }>
  >({
    googledrive: { clientId: '', clientSecret: '' },
  });
  const [savingCredentials, setSavingCredentials] = useState(false);

  const handleConnect = async (service: CloudStorageService) => {
    try {
      await connectCloudStorage(service);
    } catch (err) {
      console.error(`Failed to connect ${service}:`, err);
    }
  };

  const handleDisconnect = async (service: CloudStorageService) => {
    if (!confirm(`Are you sure you want to disconnect ${serviceConfig[service].name}?`)) {
      return;
    }
    try {
      await disconnectCloudStorage(service);
    } catch (err) {
      console.error(`Failed to disconnect ${service}:`, err);
    }
  };

  const handleOpenFileManager = async (service: CloudStorageService) => {
    setOpeningService(service);
    try {
      const embedUrl = await getCloudStorageEmbedUrl(service);
      if (embedUrl) {
        window.open(embedUrl, '_blank', 'width=1200,height=800');
      }
    } catch (err) {
      console.error(`Failed to open ${service} file manager:`, err);
      alert(`Failed to open ${serviceConfig[service].name} file manager`);
    } finally {
      setOpeningService(null);
    }
  };

  const handleSaveCredentials = async (service: CloudStorageService) => {
    const creds = credentials[service];
    if (!creds.clientId || !creds.clientSecret) {
      alert('Please enter both Client ID and Client Secret');
      return;
    }

    setSavingCredentials(true);
    try {
      await cloudStorageApi.saveOAuthCredentials(service, creds.clientId, creds.clientSecret);
      setConfiguringService(null);
      alert('OAuth credentials saved successfully');
    } catch (err: any) {
      console.error(`Failed to save ${service} credentials:`, err);
      alert(`Failed to save credentials: ${err.message || 'Unknown error'}`);
    } finally {
      setSavingCredentials(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Heading level={3}>Cloud Storage Integration</Heading>
        <Text variant="caption">
          Connect your cloud storage accounts to access files directly from Homebase
        </Text>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['googledrive'] as CloudStorageService[]).map((service) => {
          const config = serviceConfig[service];
          const settings = cloudStorageSettings[service];
          const isConnected = settings?.connected || false;

          return (
            <Card key={service} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{config.icon}</span>
                  <Heading level={4} className="mb-0">
                    {config.name}
                  </Heading>
                </div>
                {isConnected && (
                  <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                    Connected
                  </span>
                )}
              </div>

              <Text variant="caption" className="mb-4 block">
                {config.description}
              </Text>

              {configuringService === service ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Client ID
                    </label>
                    <input
                      type="text"
                      value={credentials[service].clientId}
                      onChange={(e) =>
                        setCredentials({
                          ...credentials,
                          [service]: { ...credentials[service], clientId: e.target.value },
                        })
                      }
                      placeholder="Enter your OAuth Client ID"
                      className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-[hsl(var(--input-focus-ring))] focus:ring-offset-1 focus:ring-offset-background focus:border-[hsl(var(--input-focus-ring))]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Client Secret
                    </label>
                    <input
                      type="password"
                      value={credentials[service].clientSecret}
                      onChange={(e) =>
                        setCredentials({
                          ...credentials,
                          [service]: { ...credentials[service], clientSecret: e.target.value },
                        })
                      }
                      placeholder="Enter your OAuth Client Secret"
                      className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-[hsl(var(--input-focus-ring))] focus:ring-offset-1 focus:ring-offset-background focus:border-[hsl(var(--input-focus-ring))]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleSaveCredentials(service)}
                      disabled={savingCredentials}
                      className="flex-1"
                    >
                      {savingCredentials ? 'Saving...' : 'Save Credentials'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfiguringService(null)}>
                      Cancel
                    </Button>
                  </div>
                  <Text variant="caption" className="text-xs text-gray-500">
                    Optional: If you have your own OAuth app registered, enter the credentials here.
                    Otherwise, leave empty to use the default app.
                  </Text>
                </div>
              ) : (
                <div className="flex gap-2">
                  {isConnected ? (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenFileManager(service)}
                        disabled={openingService === service}
                        className="flex-1"
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        {openingService === service ? 'Opening...' : 'Open'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDisconnect(service)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleConnect(service)}
                        className="flex-1"
                      >
                        <Cloud className="w-4 h-4 mr-1" />
                        Connect
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfiguringService(service)}
                        title="Configure OAuth credentials"
                      >
                        <Key className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
