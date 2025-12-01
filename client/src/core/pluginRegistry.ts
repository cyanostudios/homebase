import {
  Users,
  StickyNote,
  CheckSquare,
  Calculator,
  FileText,
  Package,
  Train,
  ShoppingCart,
  Globe,
  Files as FilesIcon,
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import React from 'react';

export interface PluginNavigationConfig {
  category: string;
  label: string;
  icon: LucideIcon;
  order: number;
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
import { ContactProvider } from '@/plugins/contacts/context/ContactContext';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { ContactList } from '@/plugins/contacts/components/ContactList';
import { ContactForm } from '@/plugins/contacts/components/ContactForm';
import { ContactView } from '@/plugins/contacts/components/ContactView';

// Notes
import { NoteProvider } from '@/plugins/notes/context/NoteContext';
import { useNotes } from '@/plugins/notes/hooks/useNotes';
import { NoteList } from '@/plugins/notes/components/NoteList';
import { NoteForm } from '@/plugins/notes/components/NoteForm';
import { NoteView } from '@/plugins/notes/components/NoteView';

// Estimates
import { EstimateProvider } from '@/plugins/estimates/context/EstimateContext';
import { useEstimates } from '@/plugins/estimates/hooks/useEstimates';
import { EstimateList } from '@/plugins/estimates/components/EstimateList';
import { EstimateForm } from '@/plugins/estimates/components/EstimateForm';
import { EstimateView } from '@/plugins/estimates/components/EstimateView';

// Tasks
import { TaskProvider } from '@/plugins/tasks/context/TaskContext';
import { useTasks } from '@/plugins/tasks/hooks/useTasks';
import { TaskList } from '@/plugins/tasks/components/TaskList';
import { TaskForm } from '@/plugins/tasks/components/TaskForm';
import { TaskView } from '@/plugins/tasks/components/TaskView';

// Products
import { ProductProvider } from '@/plugins/products/context/ProductContext';
import { useProducts } from '@/plugins/products/hooks/useProducts';
import { ProductList } from '@/plugins/products/components/ProductList';
import { ProductForm } from '@/plugins/products/components/ProductForm';
import { ProductView } from '@/plugins/products/components/ProductView';

// Rail (custom structure)
import { RailProvider } from '@/plugins/rail/context/RailContext';
import { useRails } from '@/plugins/rail/hooks/useRails';
import { RailStationBoard } from '@/plugins/rail/components/RailStationBoard';

// Channels
import { ChannelsProvider } from '@/plugins/channels/context/ChannelsContext';
import { useChannels } from '@/plugins/channels/hooks/useChannels';
import { ChannelsList } from '@/plugins/channels/components/ChannelsList';
import { ChannelsView } from '@/plugins/channels/components/ChannelsView';

// Invoices
import { InvoicesProvider } from '@/plugins/invoices/context/InvoicesContext';
import { useInvoices } from '@/plugins/invoices/hooks/useInvoices';
import { InvoicesList } from '@/plugins/invoices/components/InvoicesList';
import { InvoicesForm } from '@/plugins/invoices/components/InvoicesForm';
import { InvoicesView } from '@/plugins/invoices/components/InvoicesView';

// Files
import { FilesProvider } from '@/plugins/files/context/FilesContext';
import { useFiles } from '@/plugins/files/hooks/useFiles';
import { FileList } from '@/plugins/files/components/FileList';
import { FileForm } from '@/plugins/files/components/FileForm';
import { FileView } from '@/plugins/files/components/FileView';

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
    panelKey: 'isInvoicePanelOpen',
    components: {
      List: InvoicesList,
      Form: InvoicesForm,
      View: InvoicesView,
    },
    navigation: {
      category: 'Business',
      label: 'Invoice',
      icon: FileText,
      order: 1,
    },
  },
  {
    name: 'products',
    Provider: ProductProvider,
    hook: useProducts,
    panelKey: 'isProductPanelOpen',
    components: {
      List: ProductList,
      Form: ProductForm,
      View: ProductView,
    },
    navigation: {
      category: 'E-commerce',
      label: 'Products',
      icon: Package,
      order: 0,
    },
  },
  {
    name: 'channels',
    Provider: ChannelsProvider,
    hook: useChannels,
    panelKey: 'isChannelPanelOpen',
    components: {
      List: ChannelsList,
      View: ChannelsView,
      // No Form component
    },
    navigation: {
      category: 'E-commerce',
      label: 'Channels',
      icon: Globe,
      order: 1,
    },
  },
  {
    name: 'rail',
    Provider: RailProvider,
    hook: useRails,
    panelKey: 'isRailPanelOpen',
    components: {
      View: RailStationBoard,
      // Custom component - no List/Form
    },
    navigation: {
      category: 'Tools',
      label: 'Rail',
      icon: Train,
      order: 0,
    },
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
      order: 1,
    },
  },
];