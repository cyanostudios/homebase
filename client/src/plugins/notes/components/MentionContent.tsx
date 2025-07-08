import React from 'react';
import { useApp } from '@/core/api/AppContext';

interface MentionContentProps {
  content: string;
  mentions: any[];
}

export const MentionContent: React.FC<MentionContentProps> = ({ content, mentions = [] }) => {
  const { openContactForView, contacts } = useApp();

  const handleMentionClick = (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (contact) {
      openContactForView(contact);
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