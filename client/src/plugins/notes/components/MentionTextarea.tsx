import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '@/core/api/AppContext';

interface MentionTextareaProps {
  value: string;
  onChange: (value: string, mentions: any[]) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

export const MentionTextarea: React.FC<MentionTextareaProps> = ({
  value,
  onChange,
  placeholder,
  rows = 12,
  className = ''
}) => {
  const { contacts } = useApp();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const extractMentions = (text: string) => {
    const mentions: any[] = [];
    const mentionRegex = /@([^@\s]+(?:\s+[^@\s]+)*)/g;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const mentionText = match[1];
      const contact = contacts.find(c => 
        c.companyName.toLowerCase() === mentionText.toLowerCase()
      );
      
      if (contact) {
        mentions.push({
          contactId: contact.id,
          contactName: contact.companyName,
          companyName: contact.contactType === 'company' ? contact.companyName : undefined,
          position: match.index,
          length: match[0].length
        });
      }
    }

    return mentions;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    // Check if user typed @
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      
      // Check if we're in a mention (no spaces except within a valid mention)
      if (!textAfterAt.includes('\n') && textAfterAt.length <= 50) {
        const query = textAfterAt.toLowerCase();
        const filteredContacts = contacts.filter(contact =>
          contact.companyName.toLowerCase().includes(query)
        ).slice(0, 5);
        
        if (filteredContacts.length > 0 && query.length > 0) {
          setSuggestions(filteredContacts);
          setShowSuggestions(true);
          setMentionStart(lastAtIndex);
          setMentionQuery(textAfterAt);
          setSelectedIndex(0);
        } else if (query.length === 0) {
          setSuggestions(contacts.slice(0, 5));
          setShowSuggestions(true);
          setMentionStart(lastAtIndex);
          setMentionQuery('');
          setSelectedIndex(0);
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
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const beforeMention = value.substring(0, mentionStart);
    const afterCursor = value.substring(cursorPos);
    
    const mentionText = `@${contact.companyName}`;
    const newValue = beforeMention + mentionText + ' ' + afterCursor;
    
    const mentions = extractMentions(newValue);
    onChange(newValue, mentions);
    
    setShowSuggestions(false);
    
    // Set cursor position after the mention
    setTimeout(() => {
      const newCursorPos = mentionStart + mentionText.length + 1;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
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

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowSuggestions(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
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
        className={`w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical ${className}`}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
          {suggestions.map((contact, index) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => insertMention(contact)}
              className={`w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 ${
                index === selectedIndex ? 'bg-blue-50' : ''
              }`}
            >
              <div className="font-medium text-sm text-gray-900">{contact.companyName}</div>
              {contact.contactType === 'company' && contact.organizationNumber && (
                <div className="text-xs text-gray-500">{contact.organizationNumber}</div>
              )}
              {contact.contactType === 'private' && contact.personalNumber && (
                <div className="text-xs text-gray-500">{contact.personalNumber.substring(0, 9)}XXXX</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};