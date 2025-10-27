// client/src/core/pluginRegistry.ts
import type { ComponentType, ReactNode } from 'react';

import { ChannelsList } from '@/plugins/channels/components/ChannelsList';
import { ChannelsView } from '@/plugins/channels/components/ChannelsView';
import { ChannelsProvider } from '@/plugins/channels/context/ChannelsContext';
import { useChannels } from '@/plugins/channels/hooks/useChannels';

import { ContactForm } from '@/plugins/contacts/components/ContactForm';
import { ContactList } from '@/plugins/contacts/components/ContactList';
import { ContactView } from '@/plugins/contacts/components/ContactView';
import { ContactProvider } from '@/plugins/contacts/context/ContactContext';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';

import { EstimateForm } from '@/plugins/estimates/components/EstimateForm';
import { EstimateList } from '@/plugins/estimates/components/EstimateList';
import { EstimateView } from '@/plugins/estimates/components/EstimateView';
import { EstimateProvider } from '@/plugins/estimates/context/EstimateContext';
import { useEstimates } from '@/plugins/estimates/hooks/useEstimates';

import { NoteForm } from '@/plugins/notes/components/NoteForm';
import { NotesList } from '@/plugins/notes/components/NotesList';
import { NoteView } from '@/plugins/notes/components/NoteView';
import { NoteProvider } from '@/plugins/notes/context/NoteContext';
import { useNotes } from '@/plugins/notes/hooks/useNotes';

// products
import { ProductForm } from '@/plugins/products/components/ProductForm';
import { ProductList } from '@/plugins/products/components/ProductList';
import { ProductView } from '@/plugins/products/components/ProductView';
import { ProductProvider } from '@/plugins/products/context/ProductContext';
import { useProducts } from '@/plugins/products/hooks/useProducts';

// files (PASSED & working)
import { FileList } from '@/plugins/files/components/FileList';
import { FileForm } from '@/plugins/files/components/FileForm';
import { FileView } from '@/plugins/files/components/FileView';
import { FilesProvider } from '@/plugins/files/context/FilesContext';
import { useFiles } from '@/plugins/files/hooks/useFiles';

// rail
import { RailStationBoard } from '@/plugins/rail/components/RailStationBoard';
import { RailProvider } from '@/plugins/rail/context/RailContext';
import { useRails } from '@/plugins/rail/hooks/useRails';

// tasks
import { TaskForm } from '@/plugins/tasks/components/TaskForm';
import { TaskList } from '@/plugins/tasks/components/TaskList';
import { TaskView } from '@/plugins/tasks/components/TaskView';
import { TaskProvider } from '@/plugins/tasks/context/TaskContext';
import { useTasks } from '@/plugins/tasks/hooks/useTasks';

// woocommerce-products
import { WooExportPanel } from '@/plugins/woocommerce-products/components/WooExportPanel';
import { WooSettingsForm } from '@/plugins/woocommerce-products/components/WooSettingsForm';
import { WooCommerceProvider } from '@/plugins/woocommerce-products/context/WooCommerceContext';
import { useWooCommerce } from '@/plugins/woocommerce-products/context/WooCommerceContext';

// 🔹 invoices (NEW)
import { InvoicesList } from '@/plugins/invoices/components/InvoicesList';
import { InvoicesForm } from '@/plugins/invoices/components/InvoicesForm';
import { InvoicesView } from '@/plugins/invoices/components/InvoicesView';
import { InvoicesProvider } from '@/plugins/invoices/context/InvoicesContext';
import { useInvoices } from '@/plugins/invoices/hooks/useInvoices';

export interface PluginRegistryEntry {
  name: string;
  Provider: ComponentType<{
    children: ReactNode;
    isAuthenticated: boolean;
    onCloseOtherPanels: (except?: string) => void;  }>;
  hook: () => any;
  panelKey: string;
  components: {
    List: ComponentType<any>;
    Form: ComponentType<any>;
    View: ComponentType<any>;
  };
}

export const PLUGIN_REGISTRY: PluginRegistryEntry[] = [
  {
    name: 'contacts',
    Provider: ContactProvider,
    hook: useContacts,
    panelKey: 'isContactPanelOpen',
    components: { List: ContactList, Form: ContactForm, View: ContactView },
  },
  {
    name: 'notes',
    Provider: NoteProvider,
    hook: useNotes,
    panelKey: 'isNotePanelOpen',
    components: { List: NotesList, Form: NoteForm, View: NoteView },
  },
  {
    name: 'estimates',
    Provider: EstimateProvider,
    hook: useEstimates,
    panelKey: 'isEstimatePanelOpen',
    components: { List: EstimateList, Form: EstimateForm, View: EstimateView },
  },
  {
    name: 'tasks',
    Provider: TaskProvider,
    hook: useTasks,
    panelKey: 'isTaskPanelOpen',
    components: { List: TaskList, Form: TaskForm, View: TaskView },
  },
  {
    name: 'products',
    Provider: ProductProvider,
    hook: useProducts,
    panelKey: 'isProductPanelOpen',
    components: { List: ProductList, Form: ProductForm, View: ProductView },
  },
  // files
  {
    name: 'files',
    Provider: FilesProvider,
    hook: useFiles,
    panelKey: 'isFilesPanelOpen',
    components: { List: FileList, Form: FileForm, View: FileView },
  },
  {
    name: 'woocommerce-products',
    Provider: WooCommerceProvider,
    hook: useWooCommerce,
    panelKey: 'isWooSettingsPanelOpen',
    components: {
      List: WooExportPanel,
      Form: WooSettingsForm as unknown as ComponentType<any>,
      View: (() => null) as ComponentType<any>,
    },
  },
  {
    name: 'rails',
    Provider: RailProvider,
    hook: useRails,
    panelKey: 'isRailPanelOpen',
    components: {
      List: RailStationBoard,
      Form: (() => null) as ComponentType<any>,
      View: (() => null) as ComponentType<any>,
    },
  },
  // 🔹 channels (ADDED)
  {
    name: 'channels',
    Provider: ChannelsProvider,
    hook: useChannels,
    panelKey: 'isChannelsPanelOpen',
    components: {
      List: ChannelsList,
      Form: (() => null) as ComponentType<any>,
      View: ChannelsView,
    },
  },
  // 🔹 invoices (NEW)
  {
    name: 'invoices',
    Provider: InvoicesProvider,
    hook: useInvoices,
    panelKey: 'isInvoicesPanelOpen',
    components: { List: InvoicesList, Form: InvoicesForm, View: InvoicesView },
  },
];