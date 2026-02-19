import { useNoteContext } from '../context/NoteContext';

export function useNotes() {
  return useNoteContext();
}
