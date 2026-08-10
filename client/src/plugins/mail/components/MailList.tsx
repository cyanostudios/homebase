import React from 'react';

import { useMail } from '../hooks/useMail';

import { MailHistoryView } from './MailHistoryView';
import { MailProvidersList } from './MailProvidersList';

export const MailList: React.FC = () => {
  const { mailContentView } = useMail();

  if (mailContentView === 'history') {
    return <MailHistoryView />;
  }

  return <MailProvidersList />;
};
