// client/src/core/pluginRegistry.ts
import { ContactProvider } from '@/plugins/contacts/context/ContactContext';
import { NoteProvider } from '@/plugins/notes/context/NoteContext';
import { EstimateProvider } from '@/plugins/estimates/context/EstimateContext';
import { TaskProvider } from '@/plugins/tasks/context/TaskContext';
import { ImportProvider } from '@/plugins/import/context/ImportContext';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { useNotes } from '@/plugins/notes/hooks/useNotes';
import { useEstimates } from '@/plugins/estimates/hooks/useEstimates';
import { useTasks } from '@/plugins/tasks/hooks/useTasks';
import { useImport } from '@/plugins/import/hooks/useImport';
import { ContactList } from '@/plugins/contacts/components/ContactList';
import { ContactForm } from '@/plugins/contacts/components/ContactForm';
import { ContactView } from '@/plugins/contacts/components/ContactView';
import { NotesList } from '@/plugins/notes/components/NotesList';
import { NoteForm } from '@/plugins/notes/components/NoteForm';
import { NoteView } from '@/plugins/notes/components/NoteView';
import { EstimateList } from '@/plugins/estimates/components/EstimateList';
import { EstimateForm } from '@/plugins/estimates/components/EstimateForm';
import { EstimateView } from '@/plugins/estimates/components/EstimateView';
import { TaskList } from '@/plugins/tasks/components/TaskList';
import { TaskForm } from '@/plugins/tasks/components/TaskForm';
import { TaskView } from '@/plugins/tasks/components/TaskView';
import { ImportList } from '@/plugins/import/components/ImportList';
import { ImportPanel } from '@/plugins/import/components/ImportPanel';
import { ImportView } from '@/plugins/import/components/ImportView';

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
    View: React.ComponentType<{ item?: any; contact?: any; note?: any; estimate?: any; task?: any; }>;
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
  },
  {
    name: 'estimates',
    Provider: EstimateProvider,
    hook: useEstimates,
    panelKey: 'isEstimatePanelOpen',
    components: {
      List: EstimateList,
      Form: EstimateForm,
      View: EstimateView,
    }
  },
  {
    name: 'tasks',
    Provider: TaskProvider,
    hook: useTasks,
    panelKey: 'isTaskPanelOpen',
    components: {
      List: TaskList,
      Form: TaskForm,
      View: TaskView,
    }
  },
  {
    name: 'import',
    Provider: ImportProvider,
    hook: useImport,
    panelKey: 'isImportPanelOpen',
    components: {
      List: ImportList,
      Form: ImportPanel,
      View: ImportView,
    }
  }
  // New plugins just add entry here - no App.tsx changes needed
];