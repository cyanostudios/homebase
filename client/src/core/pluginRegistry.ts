import {
  Users,
  StickyNote,
  CheckSquare,
  Calculator,
  Files as FilesIcon,
  LucideIcon,
} from 'lucide-react';
import React from 'react';

export interface PluginNavigationSubItem {
  label: string;
  icon: LucideIcon;
  page: string;
  order: number;
}

export interface PluginNavigationConfig {
  category: string;
  label: string;
  icon: LucideIcon;
  order: number;
  submenu?: PluginNavigationSubItem[]; // Optional submenu items
  badge?: {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
  };
}

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
    List?: React.ComponentType;
    Form?: React.ComponentType<any>;
    View?: React.ComponentType<any>;
  };
  navigation?: PluginNavigationConfig;
}

// Contacts
import { ContactForm } from '@/plugins/contacts/components/ContactForm';
import { ContactList } from '@/plugins/contacts/components/ContactList';
import { ContactView } from '@/plugins/contacts/components/ContactView';
import { ContactProvider } from '@/plugins/contacts/context/ContactContext';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
// Files
import { EstimateForm } from '@/plugins/estimates/components/EstimateForm';
import { EstimateList } from '@/plugins/estimates/components/EstimateList';
import { EstimateView } from '@/plugins/estimates/components/EstimateView';
import { EstimateProvider } from '@/plugins/estimates/context/EstimateContext';
import { useEstimates } from '@/plugins/estimates/hooks/useEstimates';
import { FileForm } from '@/plugins/files/components/FileForm';
import { FileList } from '@/plugins/files/components/FileList';
import { FileView } from '@/plugins/files/components/FileView';
import { FilesProvider } from '@/plugins/files/context/FilesContext';
import { useFiles } from '@/plugins/files/hooks/useFiles';
// Invoices
import { InvoicesForm } from '@/plugins/invoices/components/InvoicesForm';
import { InvoicesList } from '@/plugins/invoices/components/InvoicesList';
import { InvoicesView } from '@/plugins/invoices/components/InvoicesView';
import { InvoicesProvider } from '@/plugins/invoices/context/InvoicesContext';
import { useInvoices } from '@/plugins/invoices/hooks/useInvoices';
import { invoicesNavigation } from '@/plugins/invoices/navigation';
// Notes
import { NoteForm } from '@/plugins/notes/components/NoteForm';
import { NoteList } from '@/plugins/notes/components/NoteList';
import { NoteView } from '@/plugins/notes/components/NoteView';
import { NoteProvider } from '@/plugins/notes/context/NoteContext';
import { useNotes } from '@/plugins/notes/hooks/useNotes';
// Estimates
// Tasks
import { TaskForm } from '@/plugins/tasks/components/TaskForm';
import { TaskList } from '@/plugins/tasks/components/TaskList';
import { TaskView } from '@/plugins/tasks/components/TaskView';
import { TaskProvider } from '@/plugins/tasks/context/TaskContext';
import { useTasks } from '@/plugins/tasks/hooks/useTasks';

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
    },
    navigation: {
      category: 'Main',
      label: 'Contacts',
      icon: Users,
      order: 1,
    },
  },
  {
    name: 'notes',
    Provider: NoteProvider,
    hook: useNotes,
    panelKey: 'isNotePanelOpen',
    components: {
      List: NoteList,
      Form: NoteForm,
      View: NoteView,
    },
    navigation: {
      category: 'Main',
      label: 'Notes',
      icon: StickyNote,
      order: 2,
    },
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
    },
    navigation: {
      category: 'Main',
      label: 'Tasks',
      icon: CheckSquare,
      order: 3,
    },
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
    },
    navigation: {
      category: 'Business',
      label: 'Estimates',
      icon: Calculator,
      order: 0,
    },
  },
  {
    name: 'invoices',
    Provider: InvoicesProvider,
    hook: useInvoices,
    panelKey: 'isInvoicesPanelOpen',
    components: {
      List: InvoicesList,
      Form: InvoicesForm,
      View: InvoicesView,
    },
    navigation: invoicesNavigation,
  },
  {
    name: 'files',
    Provider: FilesProvider,
    hook: useFiles,
    panelKey: 'isFilePanelOpen',
    components: {
      List: FileList,
      Form: FileForm,
      View: FileView,
    },
    navigation: {
      category: 'Tools',
      label: 'Files',
      icon: FilesIcon,
      order: 0,
    },
  },
];
