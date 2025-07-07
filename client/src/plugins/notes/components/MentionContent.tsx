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

    // Sort mentions by position (descending) so we can replace from end to start
    const sortedMentions = [...mentions].sort((a, b) => b.position - a.position);
    
    let processedContent = content;
    
    sortedMentions.forEach((mention) => {
      const beforeMention = processedContent.substring(0, mention.position);
      const mentionText = processedContent.substring(mention.position, mention.position + mention.length);
      const afterMention = processedContent.substring(mention.position + mention.length);
      
      // Create a placeholder that we'll replace with JSX
      const placeholder = `__MENTION_${mention.contactId}__`;
      processedContent = beforeMention + placeholder + afterMention;
    });

    // Split the content by newlines to preserve formatting
    const lines = processedContent.split('\n');
    
    return lines.map((line, lineIndex) => (
      <React.Fragment key={lineIndex}>
        {line.split(/(__MENTION_\w+__)/).map((part, partIndex) => {
          const mentionMatch = part.match(/^__MENTION_(\w+)__$/);
          if (mentionMatch) {
            const contactId = mentionMatch[1];
            const mention = mentions.find(m => m.contactId === contactId);
            if (mention) {
              return (
                <button
                  key={partIndex}
                  onClick={() => handleMentionClick(contactId)}
                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer bg-blue-50 px-1 rounded"
                >
                  @{mention.contactName}
                </button>
              );
            }
          }
          return part;
        })}
        {lineIndex < lines.length - 1 && <br />}
      </React.Fragment>
    ));
  };

  return <div className="whitespace-pre-wrap leading-relaxed">{renderContentWithMentions()}</div>;
};