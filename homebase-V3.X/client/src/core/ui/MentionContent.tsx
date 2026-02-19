import React from 'react';

import { Button } from '@/components/ui/button';
import type { Mention } from '@/core/types/mention';

interface MentionContentProps {
  content: string;
  mentions: Mention[];
  /** Called when user clicks an active mention. Plugin should e.g. close own panel and open contact. */
  onMentionClick?: (contactId: string) => void;
}

export const MentionContent: React.FC<MentionContentProps> = ({
  content,
  mentions = [],
  onMentionClick,
}) => {
  const [contactsData, setContactsData] = React.useState<any[]>([]);
  const [contactsLoaded, setContactsLoaded] = React.useState(false);

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

  const renderContentWithMentions = () => {
    if (!mentions || mentions.length === 0) {
      return content;
    }

    const segments: Array<{
      text: string;
      type: 'text' | 'mention';
      mention?: Mention;
    }> = [];

    const sortedMentions = [...mentions].sort((a, b) => a.position - b.position);

    let currentPos = 0;

    sortedMentions.forEach((mention) => {
      if (mention.position > currentPos) {
        segments.push({
          text: content.substring(currentPos, mention.position),
          type: 'text',
        });
      }

      segments.push({
        text: content.substring(mention.position, mention.position + mention.length),
        type: 'mention',
        mention,
      });

      currentPos = mention.position + mention.length;
    });

    if (currentPos < content.length) {
      segments.push({
        text: content.substring(currentPos),
        type: 'text',
      });
    }

    return segments.map((segment, index) => {
      if (segment.type === 'mention' && segment.mention) {
        const contactExists =
          contactsLoaded && contactsData.some((c) => c.id === segment.mention!.contactId);

        if (contactExists && onMentionClick) {
          return (
            <Button
              variant="link"
              size="sm"
              // eslint-disable-next-line react/no-array-index-key -- index needed when same contact appears multiple times
              key={`mention-${segment.mention.contactId}-${index}`}
              onClick={() => onMentionClick(segment.mention!.contactId)}
              className="h-auto p-0 px-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium bg-blue-50 dark:bg-blue-950/30 rounded"
            >
              @{segment.mention.contactName}
            </Button>
          );
        }
        if (contactExists && !onMentionClick) {
          return (
            <span
              // eslint-disable-next-line react/no-array-index-key
              key={`mention-${segment.mention.contactId}-${index}`}
              className="text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950/30 px-1 rounded"
            >
              @{segment.mention.contactName}
            </span>
          );
        }
        return (
          <span
            // eslint-disable-next-line react/no-array-index-key
            key={`mention-${segment.mention.contactId}-${index}`}
            className="text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1 rounded font-medium"
          >
            @{segment.mention.contactName} (deleted contact)
          </span>
        );
      }
      return segment.text.split('\n').map((line, lineIndex) => (
        <React.Fragment
          // eslint-disable-next-line react/no-array-index-key
          key={`text-${index}-${lineIndex}`}
        >
          {line}
          {lineIndex < segment.text.split('\n').length - 1 ? <br /> : null}
        </React.Fragment>
      ));
    });
  };

  return <div className="whitespace-pre-wrap leading-relaxed">{renderContentWithMentions()}</div>;
};
