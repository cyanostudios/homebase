import { User, Users } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';

import type { Contact } from '../types/contacts';
import { CONTACT_TYPE_ICON_SHELL_CLASS } from '../types/contacts';

import { ContactDetailHeaderMenus } from './ContactDetailHeaderMenus';

export function ContactQuickContextPanel({
  contact,
  headerBelow = null,
}: {
  contact: Contact;
  headerBelow?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const isCompany = contact.contactType === 'company';
  const ContactTypeIcon = isCompany ? Users : User;
  const contactTypeLabel = t(`contacts.type.${contact.contactType}`, {
    defaultValue: isCompany ? 'Company' : 'Private',
  });

  const titleLeading = (
    <div className="flex min-w-0 items-center gap-2">
      <span title={contactTypeLabel} className="inline-flex shrink-0">
        <SectionCategoryIcon
          icon={ContactTypeIcon}
          className={CONTACT_TYPE_ICON_SHELL_CLASS[isCompany ? 'company' : 'private']}
        />
      </span>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>
        {contact.companyName}
      </h3>
    </div>
  );

  return (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex flex-col')}>
      <div className="px-4 py-5">
        <ContactDetailHeaderMenus contact={contact} leading={titleLeading} />
        {headerBelow ? <div className="mt-4">{headerBelow}</div> : null}
      </div>
    </Card>
  );
}
