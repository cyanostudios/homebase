import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { MentionContent } from '@/core/ui/MentionContent';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { useNotes } from '@/plugins/notes/hooks/useNotes';

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
    <DetailLayout
      sidebar={
        <div className="space-y-6">
          {note.mentions && note.mentions.length > 0 && (
            <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
              <DetailSection title="Mentioned Contacts" className="p-4">
                <div className="space-y-2">
                  {(() => {
                    // De-duplicate mentions by contactId
                    const uniqueMentions = Array.from(
                      new Map((note.mentions || []).map((m: any) => [m.contactId, m])).values(),
                    );

                    return uniqueMentions.map((mention: any) => {
                      const contactData = contactsData.find((c: any) => c.id === mention.contactId);

                      const getDisplayText = () => {
                        if (!contactData) {
                          const contactNumber = formatDisplayNumber('contacts', mention.contactId);
                          const name = mention.contactName;
                          return `${contactNumber} • ${name} (deleted)`;
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
                        <div
                          key={`mention-${mention.contactId}`}
                          className="flex justify-between items-center text-[11px] plugin-contacts bg-plugin-subtle px-2 py-1.5 rounded-md border border-border/50"
                        >
                          <span className="text-muted-foreground truncate mr-4">
                            {getDisplayText()}
                          </span>
                          <Button
                            size="sm"
                            variant="link"
                            onClick={() =>
                              contactData ? handleContactClick(mention.contactId) : null
                            }
                            disabled={!contactData}
                            className={cn(
                              'h-auto p-0 text-[10px] shrink-0 font-medium',
                              contactData ? 'text-plugin' : 'text-muted-foreground',
                            )}
                          >
                            {contactData ? 'View' : 'Deleted'}
                          </Button>
                        </div>
                      );
                    });
                  })()}
                </div>
              </DetailSection>
            </Card>
          )}

          <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
            <DetailSection title="Information" className="p-4">
              <div className="space-y-4 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">ID</span>
                  <span className="font-mono font-medium">
                    {formatDisplayNumber('notes', note.id)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">
                    {new Date(note.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Updated</span>
                  <span className="font-medium">
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </DetailSection>
          </Card>
        </div>
      }
    >
      <div className="space-y-6">
        <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
          <DetailSection title="Note Content" className="p-6">
            <div className="prose prose-sm max-w-none text-sm dark:prose-invert">
              <MentionContent
                content={note.content}
                mentions={note.mentions || []}
                onMentionClick={handleContactClick}
              />
            </div>
          </DetailSection>
        </Card>
      </div>
    </DetailLayout>
  );
};
