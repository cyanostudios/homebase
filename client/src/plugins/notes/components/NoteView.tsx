import React from 'react';
import { StickyNote } from 'lucide-react';
import { Heading, Text } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { MentionContent } from './MentionContent';

interface NoteViewProps {
  note: any;
}

export const NoteView: React.FC<NoteViewProps> = ({ note }) => {
  if (!note) return null;

  return (
    <div className="space-y-4">
      {/* Note Content with clickable mentions */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Content</Heading>
        <div className="prose prose-sm max-w-none text-sm">
          <MentionContent content={note.content} mentions={note.mentions || []} />
        </div>
      </Card>

      <hr className="border-gray-100" />

      {/* Mentions Summary */}
      {note.mentions && note.mentions.length > 0 && (
        <>
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Mentioned Contacts</Heading>
            <div className="space-y-2">
              {note.mentions.map((mention: any, index: number) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-blue-600 font-medium">@{mention.contactName}</span>
                  {mention.companyName && mention.companyName !== mention.contactName && (
                    <span className="text-sm text-gray-500">({mention.companyName})</span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <hr className="border-gray-100" />
        </>
      )}

      {/* Metadata */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Note Information</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500">Created</div>
            <div className="text-sm text-gray-900">{new Date(note.createdAt).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Last Updated</div>
            <div className="text-sm text-gray-900">{new Date(note.updatedAt).toLocaleDateString()}</div>
          </div>
        </div>
      </Card>
    </div>
  );
};