// Profile settings: personal user profile + shared tenant organization cards.

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import {
  EMPTY_ORGANIZATION,
  organizationApi,
  type OrganizationProfile,
} from '@/core/api/organizationApi';
import { DETAIL_FIELD_LABEL_CLASS, DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { DetailSection } from '@/core/ui/DetailSection';
import { filesApi } from '@/plugins/files/api/filesApi';
import { useSettingsContext } from '@/plugins/settings/context/SettingsContext';

interface ProfileSettingsFormProps {
  onCancel: () => void;
}

function cloneOrganization(value: OrganizationProfile): OrganizationProfile {
  return {
    name: value.name,
    logoUrl: value.logoUrl,
    address: { ...value.address },
    billing: { ...value.billing },
  };
}

function organizationsEqual(a: OrganizationProfile, b: OrganizationProfile): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function ProfileSettingsForm({ onCancel }: ProfileSettingsFormProps) {
  const { user, getSettings, updateSettings, refreshOrganization } = useApp();
  const { registerSaveHandler, setIsSaving, setHasChanges } = useSettingsContext();
  const [isLoading, setIsLoading] = useState(true);
  const [canEditOrganization, setCanEditOrganization] = useState(true);
  const [logoUploadBusy, setLogoUploadBusy] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);

  const [personal, setPersonal] = useState({
    name: '',
    title: '',
    email: user?.email || '',
  });
  const [initialPersonal, setInitialPersonal] = useState({ name: '', title: '' });

  const [organization, setOrganization] = useState<OrganizationProfile>(
    cloneOrganization(EMPTY_ORGANIZATION),
  );
  const [initialOrganization, setInitialOrganization] = useState<OrganizationProfile>(
    cloneOrganization(EMPTY_ORGANIZATION),
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSettings('profile', {
        name: personal.name,
        title: personal.title,
      });
      setInitialPersonal({ name: personal.name, title: personal.title });

      if (canEditOrganization) {
        const saved = await organizationApi.updateOrganization(organization);
        setOrganization(cloneOrganization(saved));
        setInitialOrganization(cloneOrganization(saved));
        await refreshOrganization();
      }

      setHasChanges(false);
      onCancel();
    } catch (error) {
      console.error('Failed to save profile settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [
    personal.name,
    personal.title,
    organization,
    canEditOrganization,
    onCancel,
    updateSettings,
    refreshOrganization,
    setIsSaving,
    setHasChanges,
  ]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const [profileSettings, org, meRes] = await Promise.all([
          getSettings('profile'),
          organizationApi.getOrganization().catch(() => cloneOrganization(EMPTY_ORGANIZATION)),
          fetch('/api/auth/me', { credentials: 'include' })
            .then((res) => (res.ok ? res.json() : null))
            .catch(() => null),
        ]);

        if (cancelled) {
          return;
        }

        const name = profileSettings?.name || '';
        const title = profileSettings?.title || '';
        setPersonal({
          name,
          title,
          email: user?.email || '',
        });
        setInitialPersonal({ name, title });

        const nextOrg = cloneOrganization(org);
        setOrganization(nextOrg);
        setInitialOrganization(cloneOrganization(nextOrg));

        const role = typeof meRes?.tenantRole === 'string' ? meRes.tenantRole : 'user';
        setCanEditOrganization(role === 'admin' || role === 'editor');
        setHasChanges(false);
      } catch (error) {
        console.error('Failed to load profile settings:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [getSettings, setHasChanges, user?.email]);

  const isDirty = useMemo(() => {
    const personalDirty =
      personal.name !== initialPersonal.name || personal.title !== initialPersonal.title;
    const orgDirty = canEditOrganization && !organizationsEqual(organization, initialOrganization);
    return personalDirty || orgDirty;
  }, [
    personal.name,
    personal.title,
    initialPersonal.name,
    initialPersonal.title,
    organization,
    initialOrganization,
    canEditOrganization,
  ]);

  useEffect(() => {
    setHasChanges(isDirty);
    return () => setHasChanges(false);
  }, [isDirty, setHasChanges]);

  useEffect(() => {
    registerSaveHandler(handleSave);
    return () => registerSaveHandler(null);
  }, [registerSaveHandler, handleSave]);

  const updateAddress = (field: keyof OrganizationProfile['address'], value: string) => {
    setOrganization((prev) => ({
      ...prev,
      address: { ...prev.address, [field]: value },
    }));
  };

  const updateBilling = (field: keyof OrganizationProfile['billing'], value: string) => {
    setOrganization((prev) => ({
      ...prev,
      billing: { ...prev.billing, [field]: value },
    }));
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  const readOnlyOrg = !canEditOrganization;

  return (
    <div className="space-y-3">
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection title="Personal" className="p-4">
          <div className="space-y-3">
            <div>
              <Label htmlFor="profile-name" className={DETAIL_FIELD_LABEL_CLASS}>
                Name
              </Label>
              <Input
                id="profile-name"
                type="text"
                value={personal.name}
                onChange={(e) => setPersonal({ ...personal, name: e.target.value })}
                placeholder="Enter your name"
              />
            </div>
            <div>
              <Label htmlFor="profile-title" className={DETAIL_FIELD_LABEL_CLASS}>
                Title
              </Label>
              <Input
                id="profile-title"
                type="text"
                value={personal.title}
                onChange={(e) => setPersonal({ ...personal, title: e.target.value })}
                placeholder="Enter your job title"
              />
            </div>
            <div>
              <Label htmlFor="profile-email" className={DETAIL_FIELD_LABEL_CLASS}>
                Email
              </Label>
              <Input
                id="profile-email"
                type="email"
                value={personal.email}
                disabled
                className="bg-muted"
              />
              <p className="mt-1 text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
          </div>
        </DetailSection>
      </Card>

      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection title="Account name" className="p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Display name for this Homebase account (shared with your team).
          </p>
          <Label htmlFor="org-name" className={DETAIL_FIELD_LABEL_CLASS}>
            Tenant name
          </Label>
          <Input
            id="org-name"
            type="text"
            value={organization.name}
            disabled={readOnlyOrg}
            onChange={(e) => setOrganization({ ...organization, name: e.target.value })}
            placeholder="e.g. Homebase AB"
          />
        </DetailSection>
      </Card>

      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection title="Logo" className="p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Account logo used on documents and public surfaces.
          </p>
          {organization.logoUrl ? (
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <img
                src={organization.logoUrl}
                alt=""
                className="h-20 w-20 rounded-md border border-border object-contain bg-muted/30"
              />
              {!readOnlyOrg ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOrganization({ ...organization, logoUrl: '' })}
                >
                  Remove logo
                </Button>
              ) : null}
            </div>
          ) : null}
          {!readOnlyOrg ? (
            <>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                disabled={logoUploadBusy}
                className="cursor-pointer"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) {
                    return;
                  }
                  setLogoUploadError(null);
                  setLogoUploadBusy(true);
                  try {
                    const items = await filesApi.uploadFiles([file]);
                    const url = items[0]?.url;
                    if (url) {
                      setOrganization({ ...organization, logoUrl: url });
                    } else {
                      setLogoUploadError('No file URL returned');
                    }
                  } catch {
                    setLogoUploadError('Upload failed');
                  } finally {
                    setLogoUploadBusy(false);
                  }
                }}
              />
              {logoUploadBusy ? (
                <p className="mt-2 text-xs text-muted-foreground">Uploading…</p>
              ) : null}
              {logoUploadError ? (
                <p className="mt-2 text-xs text-destructive">{logoUploadError}</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {organization.logoUrl ? 'Logo is set.' : 'No logo uploaded.'}
            </p>
          )}
        </DetailSection>
      </Card>

      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection title="Address" className="p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Postal address for the account (invoices, estimates, mail).
          </p>
          <div className="space-y-3">
            <div>
              <Label htmlFor="org-address-line1" className={DETAIL_FIELD_LABEL_CLASS}>
                Address line 1
              </Label>
              <Input
                id="org-address-line1"
                value={organization.address.line1}
                disabled={readOnlyOrg}
                onChange={(e) => updateAddress('line1', e.target.value)}
                placeholder="Street and number"
              />
            </div>
            <div>
              <Label htmlFor="org-address-line2" className={DETAIL_FIELD_LABEL_CLASS}>
                Address line 2
              </Label>
              <Input
                id="org-address-line2"
                value={organization.address.line2}
                disabled={readOnlyOrg}
                onChange={(e) => updateAddress('line2', e.target.value)}
                placeholder="c/o, suite, etc."
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="org-postal" className={DETAIL_FIELD_LABEL_CLASS}>
                  Postal code
                </Label>
                <Input
                  id="org-postal"
                  value={organization.address.postalCode}
                  disabled={readOnlyOrg}
                  onChange={(e) => updateAddress('postalCode', e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="org-city" className={DETAIL_FIELD_LABEL_CLASS}>
                  City
                </Label>
                <Input
                  id="org-city"
                  value={organization.address.city}
                  disabled={readOnlyOrg}
                  onChange={(e) => updateAddress('city', e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="org-country" className={DETAIL_FIELD_LABEL_CLASS}>
                Country
              </Label>
              <Input
                id="org-country"
                value={organization.address.country}
                disabled={readOnlyOrg}
                onChange={(e) => updateAddress('country', e.target.value)}
                placeholder="Sweden"
              />
            </div>
          </div>
        </DetailSection>
      </Card>

      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection title="Billing details" className="p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Organization and payment details for invoicing.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="org-orgnr" className={DETAIL_FIELD_LABEL_CLASS}>
                Organization number
              </Label>
              <Input
                id="org-orgnr"
                value={organization.billing.organizationNumber}
                disabled={readOnlyOrg}
                onChange={(e) => updateBilling('organizationNumber', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="org-vat" className={DETAIL_FIELD_LABEL_CLASS}>
                VAT number
              </Label>
              <Input
                id="org-vat"
                value={organization.billing.vatNumber}
                disabled={readOnlyOrg}
                onChange={(e) => updateBilling('vatNumber', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="org-bankgiro" className={DETAIL_FIELD_LABEL_CLASS}>
                Bankgiro
              </Label>
              <Input
                id="org-bankgiro"
                value={organization.billing.bankgiro}
                disabled={readOnlyOrg}
                onChange={(e) => updateBilling('bankgiro', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="org-plusgiro" className={DETAIL_FIELD_LABEL_CLASS}>
                Plusgiro
              </Label>
              <Input
                id="org-plusgiro"
                value={organization.billing.plusgiro}
                disabled={readOnlyOrg}
                onChange={(e) => updateBilling('plusgiro', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="org-iban" className={DETAIL_FIELD_LABEL_CLASS}>
                IBAN
              </Label>
              <Input
                id="org-iban"
                value={organization.billing.iban}
                disabled={readOnlyOrg}
                onChange={(e) => updateBilling('iban', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="org-bic" className={DETAIL_FIELD_LABEL_CLASS}>
                BIC
              </Label>
              <Input
                id="org-bic"
                value={organization.billing.bic}
                disabled={readOnlyOrg}
                onChange={(e) => updateBilling('bic', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="org-invoice-email" className={DETAIL_FIELD_LABEL_CLASS}>
                Invoice email
              </Label>
              <Input
                id="org-invoice-email"
                type="email"
                value={organization.billing.invoiceEmail}
                disabled={readOnlyOrg}
                onChange={(e) => updateBilling('invoiceEmail', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="org-phone" className={DETAIL_FIELD_LABEL_CLASS}>
                Phone
              </Label>
              <Input
                id="org-phone"
                value={organization.billing.phone}
                disabled={readOnlyOrg}
                onChange={(e) => updateBilling('phone', e.target.value)}
              />
            </div>
          </div>
        </DetailSection>
      </Card>

      {readOnlyOrg ? (
        <p className="px-1 text-xs text-muted-foreground">
          Account identity fields can be edited by admins and editors.
        </p>
      ) : null}
    </div>
  );
}
