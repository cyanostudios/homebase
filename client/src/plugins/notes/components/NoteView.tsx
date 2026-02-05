import { CheckSquare, Copy, Download } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import { DetailCard } from '@/core/ui/DetailCard';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { useNotes } from '@/plugins/notes/hooks/useNotes';

import { MentionContent } from './MentionContent';

interface NoteViewProps {
  note: any;
}

export const NoteView: React.FC<NoteViewProps> = ({ note }) => {
  const { openContactForView } = useContacts();
  const { closeNotePanel } = useNotes();
  const { refreshData } = useApp();

  const [contactsData, setContactsData] = useState<any[]>([]);

  useEffect(() => {
    const fetchContactsData = async () => {
      try {
        const response = await fetch('/api/contacts', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setContactsData(data);
        }
      } catch (error) {
        console.error('Failed to load contacts data:', error);
      }
    };

    if (note?.mentions && note.mentions.length > 0) {
      fetchContactsData();
    }
  }, [note?.mentions]);

  const handleContactClick = async (contactId: string) => {
    await refreshData();

    try {
      const response = await fetch('/api/contacts', {
        credentials: 'include',
      });

      if (response.ok) {
        const contactsData = await response.json();
        const contact = contactsData.find((c: any) => c.id === contactId);

        if (contact) {
          const transformedContact = {
            ...contact,
            createdAt: new Date(contact.createdAt),
            updatedAt: new Date(contact.updatedAt),
          };

          closeNotePanel();
          openContactForView(transformedContact);
        }
      }
    } catch (error) {
      console.error('Failed to load contact data:', error);
    }
  };

  if (!note) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Content">
          <DetailCard>
            <div className="prose prose-sm max-w-none text-sm dark:prose-invert">
              <MentionContent content={note.content} mentions={note.mentions || []} />
            </div>
          </DetailCard>
        </DetailSection>
      </Card>

      <hr className="border-gray-100 dark:border-gray-800" />

      {note.mentions && note.mentions.length > 0 && (
        <>
          <Card padding="sm" className="shadow-none px-0">
            <DetailSection title="Mentioned Contacts">
              <div className="space-y-2">
                {note.mentions.map((mention: any) => {
                  const contactData = contactsData.find((c: any) => c.id === mention.contactId);

                  const getDisplayText = () => {
                    if (!contactData) {
                      const contactNumber = formatDisplayNumber('contacts', mention.contactId);
                      const name = mention.contactName;
                      return `${contactNumber} • ${name} (deleted contact)`;
                    }

                    const contactNumber = formatDisplayNumber(
                      'contacts',
                      contactData.contactNumber || contactData.id,
                    );
                    const name = mention.contactName;
                    const orgPersonNumber =
                      contactData.organizationNumber || contactData.personalNumber || '';

                    return `${contactNumber} • ${name}${orgPersonNumber ? ` • ${orgPersonNumber}` : ''}`;
                  };

                  return (
                    <DetailCard
                      key={`mention-${mention.contactId}-${mention.contactName || 'unknown'}`}
                      variant={contactData ? 'blue' : 'neutral'}
                      padding="sm"
                      className="flex items-center justify-between"
                    >
                      <div className="text-sm">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {getDisplayText()}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => (contactData ? handleContactClick(mention.contactId) : null)}
                        disabled={!contactData}
                        className={`ml-3 flex-shrink-0 ${contactData
                          ? 'text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300'
                          : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                          }`}
                      >
                        {contactData ? 'View Contact' : 'Deleted'}
                      </Button>
                    </DetailCard>
                  );
                })}
              </div>
            </DetailSection>
          </Card>

          <hr className="border-gray-100 dark:border-gray-800" />
        </>
      )}

      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Note Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">System ID</div>
              <div className="text-foreground font-medium font-mono">
                {formatDisplayNumber('notes', note.id)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Created</div>
              <div className="text-foreground">
                {new Date(note.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Last Updated</div>
              <div className="text-foreground">
                {new Date(note.updatedAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </DetailSection>
      </Card>
    </div>
  );
};

