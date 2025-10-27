import React from 'react';

import { useApp } from '@/core/api/AppContext';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { useNotes } from '@/plugins/notes/hooks/useNotes';

interface MentionContentProps {
  content: string;
  mentions: any[];
}

export const MentionContent: React.FC<MentionContentProps> = ({ content, mentions = [] }) => {
  // Use ContactContext for opening contacts
  const { openContactForView } = useContacts();

  // Use NoteContext to close note panel when navigating to contact
  const { closeNotePanel } = useNotes();

  // Get contacts from AppContext for cross-plugin references
  const { refreshData } = useApp();

  // State to track which contacts exist
  const [contactsData, setContactsData] = React.useState<any[]>([]);
  const [contactsLoaded, setContactsLoaded] = React.useState(false);

  // Load contacts data once
  React.useEffect(() => {
    const loadContacts = async () => {
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
      } finally {
        setContactsLoaded(true);
      }
    };

    loadContacts();
  }, []);

  const handleMentionClick = async (contactId: string) => {
    // Refresh data to get latest contacts
    await refreshData();

    // Use the contacts data from AppContext to get full contact info
    // We'll get it via a fetch since AppContext has the data but doesn't expose it directly
    try {
      const response = await fetch('/api/contacts', {
        credentials: 'include',
      });

      if (response.ok) {
        const contactsData = await response.json();
        const contact = contactsData.find((c: any) => c.id === contactId);

        if (contact) {
          // Transform the contact data to match expected format
          const transformedContact = {
            ...contact,
            createdAt: new Date(contact.createdAt),
            updatedAt: new Date(contact.updatedAt),
          };

          closeNotePanel(); // Close note panel first
          openContactForView(transformedContact); // Then open contact panel with full data
        }
      }
    } catch (error) {
      console.error('Failed to load contact data:', error);
    }
  };

  const renderContentWithMentions = () => {
    if (!mentions || mentions.length === 0) {
      return content;
    }

    // Create segments from content with mention positions
    const segments: Array<{
      text: string;
      type: 'text' | 'mention';
      mention?: any;
    }> = [];

    // Sort mentions by position (ascending) to process in order
    const sortedMentions = [...mentions].sort((a, b) => a.position - b.position);

    let currentPos = 0;

    sortedMentions.forEach((mention) => {
      // Add text before mention
      if (mention.position > currentPos) {
        segments.push({
          text: content.substring(currentPos, mention.position),
          type: 'text',
        });
      }

      // Add mention segment
      segments.push({
        text: content.substring(mention.position, mention.position + mention.length),
        type: 'mention',
        mention: mention,
      });

      currentPos = mention.position + mention.length;
    });

    // Add remaining text after last mention
    if (currentPos < content.length) {
      segments.push({
        text: content.substring(currentPos),
        type: 'text',
      });
    }

    // Render segments
    return segments.map((segment, index) => {
      if (segment.type === 'mention' && segment.mention) {
        // Check if contact still exists
        const contactExists =
          contactsLoaded && contactsData.some((c) => c.id === segment.mention.contactId);

        if (contactExists) {
          // Active contact - clickable blue styling
          return (
            <button
              key={`mention-${segment.mention.contactId}-${index}`}
              onClick={() => handleMentionClick(segment.mention.contactId)}
              className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer bg-blue-50 px-1 rounded"
            >
              @{segment.mention.contactName}
            </button>
          );
        } else {
          // Deleted contact - gray styling, not clickable
          return (
            <span
              key={`mention-${segment.mention.contactId}-${index}`}
              className="text-gray-500 bg-gray-100 px-1 rounded font-medium"
            >
              @{segment.mention.contactName} (deleted contact)
            </span>
          );
        }
      } else {
        // Handle text segments with line breaks
        return segment.text.split('\n').map((line, lineIndex) => (
          <React.Fragment key={`text-${index}-${lineIndex}`}>
            {line}
            {lineIndex < segment.text.split('\n').length - 1 && <br />}
          </React.Fragment>
        ));
      }
    });
  };

  return <div className="whitespace-pre-wrap leading-relaxed">{renderContentWithMentions()}</div>;
};
