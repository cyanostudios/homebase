import { useContext } from 'react';
import { MailContext } from '../context/MailContext';

export function useMail() {
  const context = useContext(MailContext);
  if (context === undefined) {
    throw new Error('useMail must be used within MailProvider');
  }
  return context;
}
