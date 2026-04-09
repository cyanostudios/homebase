import React, { useState, useEffect } from 'react';

import { RichTextContent } from '@/core/ui/RichTextContent';

import { noteShareApi } from '../api/notesApi';
import type { PublicNote } from '../types/notes';

interface PublicNoteViewProps {
  token: string;
}

export function PublicNoteView({ token }: PublicNoteViewProps) {
  const [note, setNote] = useState<PublicNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid share link');
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const publicNote = await noteShareApi.getPublicNote(token);
        if (!cancelled) {
          setNote(publicNote);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load note');
          setNote(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <div className="text-gray-600">Loading note…</div>
        </div>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Note not available</h2>
            <p className="text-gray-600 mb-4">
              {error || 'This note could not be found or the share link has expired.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const title = (note.title || '').trim() || '—';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="border-b border-border px-6 py-4 bg-muted/30">
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Shared note · link expires{' '}
              {new Date(note.shareValidUntil).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>
          <div className="p-6 prose prose-sm max-w-none dark:prose-invert">
            <RichTextContent content={note.content} mentions={note.mentions || []} />
          </div>
        </div>
      </div>
    </div>
  );
}
