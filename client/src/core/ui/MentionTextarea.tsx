import React, { useState, useRef, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { apiFetch } from '@/core/api/apiFetch';
import type { Mention } from '@/core/types/mention';

interface MentionTextareaProps {
  value: string;
  onChange: (value: string, mentions: Mention[]) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

export const MentionTextarea: React.FC<MentionTextareaProps> = ({
  value,
  onChange,
  placeholder,
  rows = 12,
  className = '',
}) => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(0);
  const [suggestionPosition, setSuggestionPosition] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadContacts = async () => {
      try {
        const response = await apiFetch('/api/contacts');
        if (response.ok) {
          const contactsData = await response.json();
          setContacts(contactsData);
        }
      } catch (error) {
        console.error('Failed to load contacts for mentions:', error);
      }
    };

    loadContacts();
  }, []);

  const extractMentions = (text: string): Mention[] => {
    const mentions: Mention[] = [];
    const mentionRegex = /@([^@\s]+(?:\s+[^@\s]+)*)/g;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const mentionText = match[1];
      const contact = contacts.find(
        (c) => c.companyName.toLowerCase() === mentionText.toLowerCase(),
      );

      if (contact) {
        mentions.push({
          contactId: contact.id,
          contactName: contact.companyName,
          companyName: contact.contactType === 'company' ? contact.companyName : undefined,
          position: match.index,
          length: match[0].length,
        });
      }
    }

    return mentions;
  };

  const calculateSuggestionPosition = (
    textarea: HTMLTextAreaElement,
    mentionStartPos: number,
    textValue: string,
  ) => {
    const textBeforeMention = textValue.substring(0, mentionStartPos);
    const textareaStyle = window.getComputedStyle(textarea);

    const measureDiv = document.createElement('div');
    measureDiv.style.position = 'absolute';
    measureDiv.style.visibility = 'hidden';
    measureDiv.style.whiteSpace = 'pre-wrap';
    measureDiv.style.font = textareaStyle.font;
    measureDiv.style.padding = textareaStyle.padding;
    measureDiv.style.width = textareaStyle.width;
    measureDiv.style.wordWrap = 'break-word';
    measureDiv.textContent = textBeforeMention;
    document.body.appendChild(measureDiv);

    const lineHeight =
      parseFloat(textareaStyle.lineHeight) || parseFloat(textareaStyle.fontSize) * 1.2;
    const paddingTop = parseFloat(textareaStyle.paddingTop) || 0;
    const paddingLeft = parseFloat(textareaStyle.paddingLeft) || 0;

    const linesBeforeMention = textBeforeMention.split('\n').length - 1;
    const textInCurrentLine = textBeforeMention.split('\n').pop() || '';

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      document.body.removeChild(measureDiv);
      return { top: 0, left: 0 };
    }
    context.font = textareaStyle.font;
    const textWidth = context.measureText(textInCurrentLine).width;

    const rect = textarea.getBoundingClientRect();
    const scrollTop = textarea.scrollTop;
    let top = rect.top + paddingTop + linesBeforeMention * lineHeight - scrollTop + lineHeight;
    let left = rect.left + paddingLeft + textWidth;

    const dropdownHeight = 160;
    const dropdownWidth = 300;

    if (top + dropdownHeight > window.innerHeight) {
      top = rect.top + paddingTop + linesBeforeMention * lineHeight - scrollTop - dropdownHeight;
    }

    if (left + dropdownWidth > window.innerWidth) {
      left = window.innerWidth - dropdownWidth - 10;
    }

    if (left < 10) {
      left = 10;
    }

    document.body.removeChild(measureDiv);

    return { top, left };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;

    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);

      if (!textAfterAt.includes('\n') && textAfterAt.length <= 50) {
        const query = textAfterAt.toLowerCase();
        const filteredContacts = contacts
          .filter((contact) => contact.companyName.toLowerCase().includes(query))
          .slice(0, 5);

        if (filteredContacts.length > 0 && query.length > 0) {
          setSuggestions(filteredContacts);
          setMentionStart(lastAtIndex);
          setSelectedIndex(0);
          if (textareaRef.current) {
            const position = calculateSuggestionPosition(
              textareaRef.current,
              lastAtIndex,
              newValue,
            );
            setSuggestionPosition(position);
            setShowSuggestions(true);
          }
        } else if (query.length === 0) {
          setSuggestions(contacts.slice(0, 5));
          setMentionStart(lastAtIndex);
          setSelectedIndex(0);
          if (textareaRef.current) {
            const position = calculateSuggestionPosition(
              textareaRef.current,
              lastAtIndex,
              newValue,
            );
            setSuggestionPosition(position);
            setShowSuggestions(true);
          }
        } else {
          setShowSuggestions(false);
        }
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }

    const mentions = extractMentions(newValue);
    onChange(newValue, mentions);
  };

  const insertMention = (contact: any) => {
    if (!textareaRef.current) {
      return;
    }

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const beforeMention = value.substring(0, mentionStart);
    const afterCursor = value.substring(cursorPos);

    const mentionText = `@${contact.companyName}`;
    const newValue = beforeMention + mentionText + ' ' + afterCursor;

    const mentions = extractMentions(newValue);
    onChange(newValue, mentions);

    setShowSuggestions(false);

    setTimeout(() => {
      const newCursorPos = mentionStart + mentionText.length + 1;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          insertMention(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  useEffect(() => {
    if (!showSuggestions || !textareaRef.current) {
      return;
    }

    const updatePosition = () => {
      if (textareaRef.current) {
        const position = calculateSuggestionPosition(textareaRef.current, mentionStart, value);
        setSuggestionPosition(position);
      }
    };

    const textarea = textareaRef.current;
    textarea.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      textarea.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [showSuggestions, mentionStart, value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={`w-full px-3 py-2 text-base border border-input bg-background text-foreground placeholder:text-muted-foreground rounded-md focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none resize-vertical ${className}`}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="fixed z-50 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto min-w-[200px] max-w-[300px]"
          style={{
            top: `${suggestionPosition.top}px`,
            left: `${suggestionPosition.left}px`,
          }}
        >
          {suggestions.map((contact, index) => (
            <Button
              key={contact.id}
              variant="ghost"
              size="sm"
              onClick={() => insertMention(contact)}
              className={`w-full justify-start h-auto px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-950/30 border-b border-gray-100 dark:border-gray-800 last:border-b-0 rounded-none ${
                index === selectedIndex ? 'bg-blue-50 dark:bg-blue-950/30' : ''
              }`}
            >
              <div className="flex flex-col items-start">
                <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  {contact.companyName}
                </div>
                {contact.contactType === 'company' && contact.organizationNumber && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {contact.organizationNumber}
                  </div>
                )}
                {contact.contactType === 'private' && contact.personalNumber && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {contact.personalNumber.substring(0, 9)}XXXX
                  </div>
                )}
              </div>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};
