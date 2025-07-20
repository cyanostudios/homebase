// client/src/core/pluginRegistry.ts
import { ContactProvider } from '@/plugins/contacts/context/ContactContext';
import { NoteProvider } from '@/plugins/notes/context/NoteContext';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { useNotes } from '@/plugins/notes/hooks/useNotes';
import { ContactList } from '@/plugins/contacts/components/ContactList';
import { ContactForm } from '@/plugins/contacts/components/ContactForm';
import { ContactView } from '@/plugins/contacts/components/ContactView';
import { NotesList } from '@/plugins/notes/components/NotesList';
import { NoteForm } from '@/plugins/notes/components/NoteForm';
import { NoteView } from '@/plugins/notes/components/NoteView';

export interface PluginRegistryEntry {
  name: string;
  Provider: React.ComponentType<{
    children: React.ReactNode;
    isAuthenticated: boolean;
    onCloseOtherPanels: () => void;
  }>;
  hook: () => any;
  panelKey: string;
  components: {
    List: React.ComponentType;
    Form: React.ComponentType<{ currentItem?: any; onSave: (data: any) => void; onCancel: () => void; }>;
    View: React.ComponentType<{ item?: any; contact?: any; note?: any; }>;
  };
}

export const PLUGIN_REGISTRY: PluginRegistryEntry[] = [
  {
    name: 'contacts',
    Provider: ContactProvider,
    hook: useContacts,
    panelKey: 'isContactPanelOpen',
    components: {
      List: ContactList,
      Form: ContactForm,
      View: ContactView,
    }
  },
  {
    name: 'notes',
    Provider: NoteProvider,
    hook: useNotes,
    panelKey: 'isNotePanelOpen',
    components: {
      List: NotesList,
      Form: NoteForm,
      View: NoteView,
    }
  }
  // New plugins just add entry here - no App.tsx changes needed
];