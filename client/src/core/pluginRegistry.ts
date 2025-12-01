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
  navigation?: PluginNavigationConfig; // Optional navigation
}

// Import all plugin providers, hooks, and components
import { ContactProvider } from '@/plugins/contacts/context/ContactContext';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { ContactList } from '@/plugins/contacts/components/ContactList';
import { ContactForm } from '@/plugins/contacts/components/ContactForm';
import { ContactView } from '@/plugins/contacts/components/ContactView';

import { NoteProvider } from '@/plugins/notes/context/NoteContext';
import { useNotes } from '@/plugins/notes/hooks/useNotes';
import { NoteList } from '@/plugins/notes/components/NoteList';
import { NoteForm } from '@/plugins/notes/components/NoteForm';
import { NoteView } from '@/plugins/notes/components/NoteView';

import { EstimateProvider } from '@/plugins/estimates/context/EstimateContext';
import { useEstimates } from '@/plugins/estimates/hooks/useEstimates';
import { EstimateList } from '@/plugins/estimates/components/EstimateList';
import { EstimateForm } from '@/plugins/estimates/components/EstimateForm';
import { EstimateView } from '@/plugins/estimates/components/EstimateView';

import { TaskProvider } from '@/plugins/tasks/context/TaskContext';
import { useTasks } from '@/plugins/tasks/hooks/useTasks';
import { TaskList } from '@/plugins/tasks/components/TaskList';
import { TaskForm } from '@/plugins/tasks/components/TaskForm';
import { TaskView } from '@/plugins/tasks/components/TaskView';

import { ProductProvider } from '@/plugins/products/context/ProductContext';
import { useProducts } from '@/plugins/products/hooks/useProducts';
import { ProductList } from '@/plugins/products/components/ProductList';
import { ProductForm } from '@/plugins/products/components/ProductForm';
import { ProductView } from '@/plugins/products/components/ProductView';

import { RailProvider } from '@/plugins/rail/context/RailContext';
import { useRails } from '@/plugins/rail/hooks/useRails';
import { RailStationBoard } from '@/plugins/rail/components/RailStationBoard';

import { WooCommerceProductProvider } from '@/plugins/woocommerce-products/context/WooCommerceProductContext';
import { useWooCommerceProducts } from '@/plugins/woocommerce-products/hooks/useWooCommerceProducts';
import { WooCommerceProductList } from '@/plugins/woocommerce-products/components/WooCommerceProductList';
import { WooCommerceProductForm } from '@/plugins/woocommerce-products/components/WooCommerceProductForm';
import { WooCommerceProductView } from '@/plugins/woocommerce-products/components/WooCommerceProductView';

import { ChannelProvider } from '@/plugins/channels/context/ChannelContext';
import { useChannels } from '@/plugins/channels/hooks/useChannels';
import { ChannelList } from '@/plugins/channels/components/ChannelList';
import { ChannelForm } from '@/plugins/channels/components/ChannelForm';
import { ChannelView } from '@/plugins/channels/components/ChannelView';

import { InvoiceProvider } from '@/plugins/invoices/context/InvoiceContext';
import { useInvoices } from '@/plugins/invoices/hooks/useInvoices';
import { InvoiceList } from '@/plugins/invoices/components/InvoiceList';
import { InvoiceForm } from '@/plugins/invoices/components/InvoiceForm';
import { InvoiceView } from '@/plugins/invoices/components/InvoiceView';

import { FileProvider } from '@/plugins/files/context/FileContext';
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
    Provider: InvoiceProvider,
    hook: useInvoices,
    panelKey: 'isInvoicePanelOpen',
    components: {
      List: InvoiceList,
      Form: InvoiceForm,
      View: InvoiceView,
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
    Provider: ChannelProvider,
    hook: useChannels,
    panelKey: 'isChannelPanelOpen',
    components: {
      List: ChannelList,
      Form: ChannelForm,
      View: ChannelView,
    },
    navigation: {
      category: 'E-commerce',
      label: 'Channels',
      icon: Globe,
      order: 1,
    },
  },
  {
    name: 'woocommerce-products',
    Provider: WooCommerceProductProvider,
    hook: useWooCommerceProducts,
    panelKey: 'isWooCommerceProductPanelOpen',
    components: {
      List: WooCommerceProductList,
      Form: WooCommerceProductForm,
      View: WooCommerceProductView,
    },
    navigation: {
      category: 'E-commerce',
      label: 'WooCommerce',
      icon: ShoppingCart,
      order: 2,
    },
  },
  {
    name: 'rail',
    Provider: RailProvider,
    hook: useRails,
    panelKey: 'isRailPanelOpen',
    components: {
      View: RailStationBoard, // Custom component - no List/Form
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
    Provider: FileProvider,
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