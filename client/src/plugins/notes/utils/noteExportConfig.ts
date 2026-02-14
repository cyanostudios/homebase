import type { ExportFormatConfig } from '@/core/utils/exportUtils';

import type { Note } from '../types/notes';

function formatDate(date: Date | string | null | undefined): string {
  if (!date) {
    return '';
  }
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) {
      return '';
    }
    return d.toLocaleDateString('sv-SE');
  } catch {
    return '';
  }
}

export function noteToTxtContent(note: Note): string {
  return `${note.title}\n\n${note.content}\n\nCreated: ${formatDate(note.createdAt)}`;
}

/** Base filename (no extension) for exportItems filename option. */
export function getNoteExportBaseFilename(note: Note): string {
  return (note.title || 'note').replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

export function getNoteExportFilename(note: Note, extension: string): string {
  return `${getNoteExportBaseFilename(note)}.${extension}`;
}

export function noteToCsvRow(note: Note): Record<string, any> {
  return {
    title: note.title || '',
    content: (note.content || '').slice(0, 500),
    createdAt:
      note.createdAt instanceof Date ? note.createdAt.toISOString() : String(note.createdAt ?? ''),
    updatedAt:
      note.updatedAt instanceof Date ? note.updatedAt.toISOString() : String(note.updatedAt ?? ''),
    mentionsCount: Array.isArray(note.mentions) ? note.mentions.length : 0,
  };
}

export function noteToPdfRow(note: Note): Record<string, any> {
  return {
    title: note.title || '',
    content: (note.content || '').slice(0, 80) + ((note.content || '').length > 80 ? '…' : ''),
    createdAt:
      note.createdAt instanceof Date
        ? note.createdAt.toLocaleDateString('sv-SE')
        : String(note.createdAt ?? ''),
    updatedAt:
      note.updatedAt instanceof Date
        ? note.updatedAt.toLocaleDateString('sv-SE')
        : String(note.updatedAt ?? ''),
    mentionsCount: Array.isArray(note.mentions) ? note.mentions.length : 0,
  };
}

export const notesExportConfig: ExportFormatConfig = {
  txt: {
    getContent: noteToTxtContent,
    getFilename: (note: Note) => getNoteExportFilename(note, 'txt'),
    baseFilename: `notes-export-${new Date().toISOString().split('T')[0]}`,
  },
  csv: {
    headers: ['title', 'content', 'createdAt', 'updatedAt', 'mentionsCount'],
    mapItemToRow: noteToCsvRow,
  },
  pdf: {
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'content', label: 'Content' },
      { key: 'createdAt', label: 'Created' },
      { key: 'updatedAt', label: 'Updated' },
      { key: 'mentionsCount', label: 'Mentions' },
    ],
    mapItemToRow: noteToPdfRow,
    title: 'Notes Export',
  },
};
