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

  const handleMentionClick = async (contactId: string) => {
    // Refresh data to get latest contacts
    await refreshData();
    
    // Find contact and open for view
    // Note: We'll need to get the contact from the mention data since
    // we don't have direct access to contacts list in this modular approach
    const mention = mentions.find(m => m.contactId === contactId);
    if (mention) {
      // For now, we can create a minimal contact object from mention data
      // This will work until we implement a proper cross-plugin contact lookup
      const contact = {
        id: mention.contactId,
        companyName: mention.contactName,
        // Add other required fields as needed
      };
      
      closeNotePanel(); // Close note panel first
      openContactForView(contact as any); // Then open contact panel
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
          type: 'text'
        });
      }
      
      // Add mention segment
      segments.push({
        text: content.substring(mention.position, mention.position + mention.length),
        type: 'mention',
        mention: mention
      });
      
      currentPos = mention.position + mention.length;
    });
    
    // Add remaining text after last mention
    if (currentPos < content.length) {
      segments.push({
        text: content.substring(currentPos),
        type: 'text'
      });
    }

    // Render segments
    return segments.map((segment, index) => {
      if (segment.type === 'mention' && segment.mention) {
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