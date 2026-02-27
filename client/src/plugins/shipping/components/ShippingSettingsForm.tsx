import React, { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useShipping } from '../hooks/useShipping';
import type { LabelFormatMode } from '../types/shipping';

export const ShippingSettingsForm: React.FC = () => {
  const {
    settings,
    validationErrors,
    saveShipping,
    isSaving,
    closeShippingPanel,
    senders,
    services,
    createSender,
    updateSender,
    deleteSender,
    createService,
    updateService,
    deleteService,
  } = useShipping();

  const [settingsForm, setSettingsForm] = useState({
    bookingUrl: '',
    authScheme: 'BASIC_INTEGRATIONID_APIKEY',
    integrationId: '',
    apiKey: '',
    apiSecret: '',
    apiKeyHeaderName: 'X-Api-Key',
    labelFormat: 'PDF' as LabelFormatMode,
  });

  const [senderForm, setSenderForm] = useState({
    id: '',
    name: '',
    street: '',
    postalCode: '',
    city: '',
    country: 'SE',
    contactName: '',
    contactPhone: '',
  });

  const [serviceForm, setServiceForm] = useState({
    id: '',
    code: '',
    name: '',
  });

  useEffect(() => {
    setSettingsForm({
      bookingUrl: settings?.bookingUrl || '',
      authScheme: settings?.authScheme || 'BASIC_INTEGRATIONID_APIKEY',
      integrationId: settings?.integrationId || '',
      apiKey: settings?.apiKey || '',
      apiSecret: settings?.apiSecret || '',
      apiKeyHeaderName: settings?.apiKeyHeaderName || 'X-Api-Key',
      labelFormat: (settings?.labelFormat || 'PDF') as LabelFormatMode,
    });
  }, [settings]);

  const hasGeneralError = useMemo(
    () => validationErrors.find((e) => e.field === 'general'),
    [validationErrors],
  );

  const saveSettings = async () => {
    await saveShipping(settingsForm);
  };

  const saveSender = async () => {
    if (!senderForm.name.trim()) return;
    if (senderForm.id) {
      await updateSender(senderForm.id, senderForm);
    } else {
      await createSender(senderForm);
    }
    setSenderForm({
      id: '',
      name: '',
      street: '',
      postalCode: '',
      city: '',
      country: 'SE',
      contactName: '',
      contactPhone: '',
    });
  };

  const saveService = async () => {
    if (!serviceForm.code.trim() || !serviceForm.name.trim()) return;
    if (serviceForm.id) {
      await updateService(serviceForm.id, serviceForm);
    } else {
      await createService(serviceForm);
    }
    setServiceForm({ id: '', code: '', name: '' });
  };

  useEffect(() => {
    const onSubmit = () => void saveSettings();
    const onCancel = () => void closeShippingPanel();
    window.addEventListener('submitShippingForm', onSubmit as EventListener);
    window.addEventListener('cancelShippingForm', onCancel as EventListener);
    return () => {
      window.removeEventListener('submitShippingForm', onSubmit as EventListener);
      window.removeEventListener('cancelShippingForm', onCancel as EventListener);
    };
  }, [closeShippingPanel]);

  return (
    <div className="space-y-4">
      {hasGeneralError && <div className="text-sm text-red-600">{hasGeneralError.message}</div>}

      <Card padding="sm" className="shadow-none px-0">
        <h3 className="text-lg font-semibold mb-3">PostNord settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Label htmlFor="shipping-booking-url" className="mb-1">
              Booking URL *
            </Label>
            <Input
              id="shipping-booking-url"
              value={settingsForm.bookingUrl}
              onChange={(e) => setSettingsForm((p) => ({ ...p, bookingUrl: e.target.value }))}
              placeholder="https://... (exact URL from PostNord)"
            />
          </div>
          <div>
            <Label htmlFor="shipping-auth-scheme" className="mb-1">
              Auth scheme *
            </Label>
            <select
              id="shipping-auth-scheme"
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
              value={settingsForm.authScheme}
              onChange={(e) => setSettingsForm((p) => ({ ...p, authScheme: e.target.value }))}
            >
              <option value="BASIC_INTEGRATIONID_APIKEY">Basic (IntegrationId + ApiKey)</option>
              <option value="BASIC_APIKEY_APISECRET">Basic (ApiKey + ApiSecret)</option>
              <option value="HEADER_APIKEY">Header (ApiKey in custom header)</option>
            </select>
          </div>
          <div>
            <Label htmlFor="shipping-label-format" className="mb-1">
              Label-lage
            </Label>
            <select
              id="shipping-label-format"
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
              value={settingsForm.labelFormat}
              onChange={(e) =>
                setSettingsForm((p) => ({ ...p, labelFormat: e.target.value as LabelFormatMode }))
              }
            >
              <option value="PDF">PDF</option>
              <option value="ZPL">ZPL</option>
              <option value="BOTH">Bade (PDF + ZPL nar mojligt)</option>
            </select>
          </div>
          <div>
            <Label htmlFor="shipping-integration-id" className="mb-1">
              IntegrationId
            </Label>
            <Input
              id="shipping-integration-id"
              value={settingsForm.integrationId}
              onChange={(e) => setSettingsForm((p) => ({ ...p, integrationId: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="shipping-api-key" className="mb-1">
              ApiKey
            </Label>
            <Input
              id="shipping-api-key"
              value={settingsForm.apiKey}
              onChange={(e) => setSettingsForm((p) => ({ ...p, apiKey: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="shipping-api-secret" className="mb-1">
              ApiSecret
            </Label>
            <Input
              id="shipping-api-secret"
              type="password"
              value={settingsForm.apiSecret}
              onChange={(e) => setSettingsForm((p) => ({ ...p, apiSecret: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="shipping-api-header" className="mb-1">
              ApiKey header name
            </Label>
            <Input
              id="shipping-api-header"
              value={settingsForm.apiKeyHeaderName}
              onChange={(e) =>
                setSettingsForm((p) => ({ ...p, apiKeyHeaderName: e.target.value }))
              }
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={saveSettings} disabled={isSaving}>
            {isSaving ? 'Sparar…' : 'Save settings'}
          </Button>
          <Button variant="outline" onClick={() => closeShippingPanel()}>
            Cancel
          </Button>
        </div>
      </Card>

      <Card padding="sm" className="shadow-none px-0">
        <h3 className="text-lg font-semibold mb-3">Avsändare</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Input
            placeholder="Namn *"
            value={senderForm.name}
            onChange={(e) => setSenderForm((p) => ({ ...p, name: e.target.value }))}
          />
          <Input
            placeholder="Adress"
            value={senderForm.street}
            onChange={(e) => setSenderForm((p) => ({ ...p, street: e.target.value }))}
          />
          <Input
            placeholder="Postnummer"
            value={senderForm.postalCode}
            onChange={(e) => setSenderForm((p) => ({ ...p, postalCode: e.target.value }))}
          />
          <Input
            placeholder="Stad"
            value={senderForm.city}
            onChange={(e) => setSenderForm((p) => ({ ...p, city: e.target.value }))}
          />
        </div>
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={saveSender}>
            {senderForm.id ? 'Update sender' : 'Add sender'}
          </Button>
          {senderForm.id && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setSenderForm({
                  id: '',
                  name: '',
                  street: '',
                  postalCode: '',
                  city: '',
                  country: 'SE',
                  contactName: '',
                  contactPhone: '',
                })
              }
            >
              Reset
            </Button>
          )}
        </div>
        <div className="mt-3 space-y-2">
          {senders.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
              <div>
                <span className="font-medium">{s.name}</span> — {s.street}, {s.postalCode}{' '}
                {s.city}
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setSenderForm({
                      id: s.id,
                      name: s.name,
                      street: s.street,
                      postalCode: s.postalCode,
                      city: s.city,
                      country: s.country,
                      contactName: s.contactName,
                      contactPhone: s.contactPhone,
                    })
                  }
                >
                  Edit
                </Button>
                <Button size="sm" variant="destructive" onClick={() => deleteSender(s.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card padding="sm" className="shadow-none px-0">
        <h3 className="text-lg font-semibold mb-3">Tjänster</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Input
            placeholder="Service code *"
            value={serviceForm.code}
            onChange={(e) => setServiceForm((p) => ({ ...p, code: e.target.value }))}
          />
          <Input
            placeholder="Namn *"
            value={serviceForm.name}
            onChange={(e) => setServiceForm((p) => ({ ...p, name: e.target.value }))}
          />
        </div>
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={saveService}>
            {serviceForm.id ? 'Update service' : 'Add service'}
          </Button>
          {serviceForm.id && (
            <Button size="sm" variant="outline" onClick={() => setServiceForm({ id: '', code: '', name: '' })}>
              Reset
            </Button>
          )}
        </div>
        <div className="mt-3 space-y-2">
          {services.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
              <div>
                <span className="font-medium">{s.name}</span> ({s.code})
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setServiceForm({ id: s.id, code: s.code, name: s.name })}
                >
                  Edit
                </Button>
                <Button size="sm" variant="destructive" onClick={() => deleteService(s.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
