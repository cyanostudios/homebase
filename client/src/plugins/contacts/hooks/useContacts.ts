import { useContactContext } from '../context/ContactContext';

export function useContacts() {
  return useContactContext();
}