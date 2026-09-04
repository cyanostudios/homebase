import { Search, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { LIST_SEARCH_FIELD_PROPS } from '@/core/ui/listSearchFieldProps';
import { cn } from '@/lib/utils';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import type { Contact } from '@/plugins/contacts/types/contacts';

import { INVOICE_FORM_INPUT_CLASS } from '../utils/invoiceLineItemStyles';

interface InvoiceCustomerSelectProps {
  contactId?: string | null;
  contactName?: string;
  invoiceNumber?: string | number | null;
  /** Customer can only be changed while the invoice is a draft. */
  editable: boolean;
  onCustomerChange: (contact: Contact | null) => void;
  errorMessage?: string | null;
}

function customerInitials(contactName: string, invoiceNumber?: string | number | null): string {
  const fromContact = String(contactName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
  if (fromContact) {
    return fromContact;
  }
  const raw = String(invoiceNumber || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length > 0) {
    return digits.slice(-2);
  }
  return raw.slice(0, 2).toUpperCase() || '—';
}

/**
 * Compact customer row (badge + field) with search popover dropdown.
 * Locked when `editable` is false (non-draft invoices).
 */
export function InvoiceCustomerSelect({
  contactId,
  contactName,
  invoiceNumber,
  editable,
  onCustomerChange,
  errorMessage,
}: InvoiceCustomerSelectProps) {
  const { t } = useTranslation();
  const { contacts } = useContacts();
  const [contactSearch, setContactSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const selectedId = contactId ? String(contactId) : '';
  const displayName =
    (contacts as Contact[]).find((c) => String(c.id) === selectedId)?.companyName ||
    contactName ||
    '';

  const suggestions = useMemo(() => {
    const list = (contacts as Contact[]).filter((c) => String(c.id) !== selectedId);
    const q = contactSearch.trim().toLowerCase();
    if (!q) {
      return list;
    }
    return list.filter((c) => {
      const name = (c.companyName ?? '').toLowerCase();
      const email = (c.email ?? '').toLowerCase();
      const org = (c.organizationNumber ?? '').toLowerCase();
      return name.includes(q) || email.includes(q) || org.includes(q);
    });
  }, [contactSearch, contacts, selectedId]);

  const openPopover = editable && showSuggestions;

  return (
    <div className="border-b border-border/50 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold plugin-invoices bg-plugin-subtle text-plugin"
          aria-hidden
        >
          {customerInitials(displayName, invoiceNumber)}
        </div>

        <div className="min-w-0 flex-1">
          {editable ? (
            <Popover open={openPopover} onOpenChange={setShowSuggestions}>
              <PopoverAnchor asChild>
                <div className="relative w-full min-w-0">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    {...LIST_SEARCH_FIELD_PROPS}
                    id="invoice-contact"
                    name="homebase-invoice-customer-search"
                    value={showSuggestions || !displayName ? contactSearch : displayName}
                    onChange={(event) => {
                      setContactSearch(event.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => {
                      setContactSearch('');
                      setShowSuggestions(true);
                    }}
                    placeholder={t('invoices.selectCustomer', {
                      defaultValue: 'Select a customer…',
                    })}
                    className={cn(
                      INVOICE_FORM_INPUT_CLASS,
                      'pl-7 font-semibold',
                      displayName && !showSuggestions ? 'pr-8' : '',
                      errorMessage ? 'ring-1 ring-destructive' : '',
                    )}
                    aria-invalid={Boolean(errorMessage)}
                  />
                  {displayName && !showSuggestions ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={X}
                      className="absolute right-0.5 top-1/2 h-6 w-6 -translate-y-1/2 p-0 text-muted-foreground hover:text-foreground"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCustomerChange(null);
                        setContactSearch('');
                      }}
                      aria-label={t('invoices.removeCustomer', {
                        defaultValue: 'Remove customer',
                      })}
                    />
                  ) : null}
                </div>
              </PopoverAnchor>
              <PopoverContent
                align="start"
                side="bottom"
                sideOffset={6}
                className="z-[120] w-[var(--radix-popover-trigger-width)] max-h-64 overflow-y-auto rounded-xl border border-border/60 bg-popover p-1 shadow-xl"
              >
                {suggestions.length > 0 ? (
                  suggestions.map((contact) => {
                    const name = contact.companyName ?? `Contact ${contact.id}`;
                    const contactMeta = [contact.organizationNumber, contact.email]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <button
                        key={contact.id}
                        type="button"
                        className="flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-accent"
                        onClick={() => {
                          onCustomerChange(contact);
                          setContactSearch('');
                          setShowSuggestions(false);
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium">{name}</span>
                          {contactMeta ? (
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {contactMeta}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-2.5 py-2 text-[11px] text-muted-foreground">
                    {contactSearch.trim()
                      ? t('common.noResults')
                      : t('invoices.selectCustomer', { defaultValue: 'Select a customer…' })}
                  </div>
                )}
              </PopoverContent>
            </Popover>
          ) : (
            <Input
              type="text"
              value={displayName || t('invoices.noCustomer', { defaultValue: 'No customer' })}
              readOnly
              className={cn(
                INVOICE_FORM_INPUT_CLASS,
                'cursor-not-allowed font-semibold text-muted-foreground',
              )}
              title={t('invoices.customerLockedHint', {
                defaultValue: 'Customer can only be changed while the invoice is a draft.',
              })}
            />
          )}
          {errorMessage ? <p className="mt-1 text-sm text-destructive">{errorMessage}</p> : null}
        </div>
      </div>
    </div>
  );
}
