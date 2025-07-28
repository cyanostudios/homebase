import React from 'react';
import { StickyNote, User, CheckSquare, Share, Copy, Download } from 'lucide-react';
import { Heading, Text } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { MentionContent } from './MentionContent';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { useNotes } from '@/plugins/notes/hooks/useNotes';
import { useApp } from '@/core/api/AppContext';

interface NoteViewProps {
  note: any;
}

export const NoteView: React.FC<NoteViewProps> = ({ note }) => {
  // Use ContactContext for opening contacts
  const { openContactForView } = useContacts();
  
  // Use NoteContext to close note panel when navigating
  const { closeNotePanel, duplicateNote } = useNotes();
  
  // Get contacts from AppContext for cross-plugin references
  const { refreshData } = useApp();

  const handleContactClick = async (contactId: string) => {
    // Refresh data to get latest contacts
    await refreshData();
    
    // Get contact data via fetch since AppContext has the data but doesn't expose it directly
    try {
      const response = await fetch('/api/contacts', {
        credentials: 'include'
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

  // Mock functions for future implementation
  const handleConvertToTask = () => {
    // Future: Integration with tasks plugin
    alert('Convert to Task feature will be implemented when the tasks plugin is developed.');
  };

  const handleShareNote = () => {
    // Future: Share functionality
    alert('Share Note feature coming soon!');
  };

  const handleDuplicateNote = async () => {
    try {
      await duplicateNote(note);
    } catch (error) {
      console.error('Failed to duplicate note:', error);
      alert('Failed to duplicate note. Please try again.');
    }
  };

  const handleExportNote = () => {
    // Simple text export for now
    const content = `${note.title}\n\n${note.content}\n\nCreated: ${new Date(note.createdAt).toLocaleDateString()}`;
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

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

      {/* Mentioned Contacts - Updated with clickable cards */}
      {note.mentions && note.mentions.length > 0 && (
        <>
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Mentioned Contacts</Heading>
            <div className="space-y-2">
              {note.mentions.map((mention: any, index: number) => {
                // We need to fetch full contact data to get contactNumber and org/personal numbers
                const [contactData, setContactData] = React.useState<any>(null);
                
                React.useEffect(() => {
                  const fetchContactData = async () => {
                    try {
                      const response = await fetch('/api/contacts', {
                        credentials: 'include'
                      });
                      
                      if (response.ok) {
                        const contactsData = await response.json();
                        const contact = contactsData.find((c: any) => c.id === mention.contactId);
                        setContactData(contact);
                      }
                    } catch (error) {
                      console.error('Failed to load contact data:', error);
                    }
                  };
                  
                  fetchContactData();
                }, [mention.contactId]);

                const getDisplayText = () => {
                  if (!contactData) {
                    // Contact was deleted or not found
                    const contactNumber = `#${mention.contactId}`;
                    const name = mention.contactName;
                    return `${contactNumber} • ${name} (deleted contact)`;
                  }
                  
                  const contactNumber = `#${contactData.contactNumber || contactData.id}`;
                  const name = mention.contactName;
                  const orgPersonNumber = contactData.organizationNumber || contactData.personalNumber || '';
                  
                  return `${contactNumber} • ${name}${orgPersonNumber ? ` • ${orgPersonNumber}` : ''}`;
                };

                return (
                  <div key={index} className={`flex items-center justify-between p-3 rounded-lg border ${
                    contactData 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <User className={`w-4 h-4 flex-shrink-0 ${
                        contactData ? 'text-blue-600' : 'text-gray-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900">
                          {getDisplayText()}
                        </span>
                        {mention.companyName && mention.companyName !== mention.contactName && contactData && (
                          <div className="text-xs text-gray-500">({mention.companyName})</div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => contactData ? handleContactClick(mention.contactId) : null}
                      disabled={!contactData}
                      className={`ml-3 flex-shrink-0 ${
                        contactData 
                          ? 'text-blue-700 hover:text-blue-800' 
                          : 'text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {contactData ? 'View Contact' : 'Deleted'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>

          <hr className="border-gray-100" />
        </>
      )}

      {/* Quick Actions */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Quick Actions</Heading>
        
        {/* Note Actions */}
        <div className="mb-4">
          <div className="text-xs font-medium text-gray-700 mb-2">Note Actions</div>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="secondary" 
              size="sm"
              icon={Share}
              onClick={handleShareNote}
            >
              Share Note
            </Button>
            
            <Button 
              variant="secondary" 
              size="sm"
              icon={Download}
              onClick={handleExportNote}
            >
              Export as Text
            </Button>
            
            <Button 
              variant="secondary" 
              size="sm"
              icon={Copy}
              onClick={handleDuplicateNote}
            >
              Duplicate Note
            </Button>
            
            <Button 
              variant="primary" 
              size="sm"
              icon={CheckSquare}
              onClick={handleConvertToTask}
              className="bg-green-500 text-white hover:bg-green-600"
            >
              Convert to Task
            </Button>
          </div>
        </div>
      </Card>

      <hr className="border-gray-100" />

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