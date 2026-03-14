import {
  Users,
  StickyNote,
  CheckSquare,
  Calculator,
  ClipboardList,
  Files as FilesIcon,
  Mail,
  ShoppingCart,
  Package,
  Truck,
  Store,
  BarChart3,
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
  /** When true, plugin is not shown as a top-level sidebar item (e.g. reached via Channels submenu). */
  hideFromSidebar?: boolean;
}

/** Props passed to dashboard widgets from core. onOpenPlugin navigates to the plugin page. */
export interface DashboardWidgetProps {
  onOpenPlugin: () => void;
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
  /** Optional widget for Dashboard. Shown only when plugin is enabled for the user. */
  dashboardWidget?: React.ComponentType<DashboardWidgetProps>;
  /** Prefix for entity numbers (e.g. CNT-1, EST-2025-001). */
  displayPrefix?: string;
}

// Contacts
import { ContactForm } from '@/plugins/contacts/components/ContactForm';
import { ContactList } from '@/plugins/contacts/components/ContactList';
import { ContactsDashboardWidget } from '@/plugins/contacts/components/ContactsDashboardWidget';
import { ContactView } from '@/plugins/contacts/components/ContactView';
import { ContactProvider } from '@/plugins/contacts/context/ContactContext';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
// Estimates
import { EstimateForm } from '@/plugins/estimates/components/EstimateForm';
import { EstimateList } from '@/plugins/estimates/components/EstimateList';
import { EstimatesDashboardWidget } from '@/plugins/estimates/components/EstimatesDashboardWidget';
import { EstimateView } from '@/plugins/estimates/components/EstimateView';
import { EstimateProvider } from '@/plugins/estimates/context/EstimateContext';
import { useEstimates } from '@/plugins/estimates/hooks/useEstimates';
// Files
import { FileForm } from '@/plugins/files/components/FileForm';
import { FileList } from '@/plugins/files/components/FileList';
import { FilesDashboardWidget } from '@/plugins/files/components/FilesDashboardWidget';
import { FileView } from '@/plugins/files/components/FileView';
import { FilesProvider } from '@/plugins/files/context/FilesContext';
import { useFiles } from '@/plugins/files/hooks/useFiles';
// Invoices
import { InvoicesForm } from '@/plugins/invoices/components/InvoicesForm';
import { InvoicesList } from '@/plugins/invoices/components/InvoicesList';
import { InvoicesDashboardWidget } from '@/plugins/invoices/components/InvoicesDashboardWidget';
import { InvoicesView } from '@/plugins/invoices/components/InvoicesView';
import { InvoicesProvider } from '@/plugins/invoices/context/InvoicesContext';
import { useInvoices } from '@/plugins/invoices/hooks/useInvoices';
import { invoicesNavigation } from '@/plugins/invoices/navigation';
// Notes
import { NoteForm } from '@/plugins/notes/components/NoteForm';
import { NoteList } from '@/plugins/notes/components/NoteList';
import { NotesDashboardWidget } from '@/plugins/notes/components/NotesDashboardWidget';
import { NoteView } from '@/plugins/notes/components/NoteView';
import { NoteProvider } from '@/plugins/notes/context/NoteContext';
import { useNotes } from '@/plugins/notes/hooks/useNotes';
// Estimates
// Tasks
import { TaskForm } from '@/plugins/tasks/components/TaskForm';
import { TaskList } from '@/plugins/tasks/components/TaskList';
import { TasksDashboardWidget } from '@/plugins/tasks/components/TasksDashboardWidget';
import { TaskView } from '@/plugins/tasks/components/TaskView';
import { TaskProvider } from '@/plugins/tasks/context/TaskContext';
import { useTasks } from '@/plugins/tasks/hooks/useTasks';
// Channels
import { ChannelsList } from '@/plugins/channels/components/ChannelsList';
import { ChannelsView } from '@/plugins/channels/components/ChannelsView';
import { ChannelsProvider } from '@/plugins/channels/context/ChannelsContext';
import { useChannels } from '@/plugins/channels/hooks/useChannels';
import { channelsNavigation } from '@/plugins/channels/navigation';
// Products
import { ProductForm } from '@/plugins/products/components/ProductForm';
import { ProductList } from '@/plugins/products/components/ProductList';
import { ProductProvider } from '@/plugins/products/context/ProductContext';
import { useProducts } from '@/plugins/products/hooks/useProducts';
// WooCommerce
import { WooExportPanel } from '@/plugins/woocommerce-products/components/WooExportPanel';
import { WooSettingsForm } from '@/plugins/woocommerce-products/components/WooSettingsForm';
import { WooCommerceProvider } from '@/plugins/woocommerce-products/context/WooCommerceContext';
import { useWooCommerce } from '@/plugins/woocommerce-products/hooks/useWooCommerce';
// CDON
import { CdonExportPanel } from '@/plugins/cdon-products/components/CdonExportPanel';
import { CdonSettingsForm } from '@/plugins/cdon-products/components/CdonSettingsForm';
import { CdonProductsProvider } from '@/plugins/cdon-products/context/CdonProductsContext';
import { useCdonProducts } from '@/plugins/cdon-products/hooks/useCdonProducts';
// Fyndiq
import { FyndiqExportPanel } from '@/plugins/fyndiq-products/components/FyndiqExportPanel';
import { FyndiqSettingsForm } from '@/plugins/fyndiq-products/components/FyndiqSettingsForm';
import { FyndiqProductsProvider } from '@/plugins/fyndiq-products/context/FyndiqProductsContext';
import { useFyndiqProducts } from '@/plugins/fyndiq-products/hooks/useFyndiqProducts';
// Orders
import { OrdersList } from '@/plugins/orders/components/OrdersList';
import { OrdersView } from '@/plugins/orders/components/OrdersView';
import { OrdersProvider } from '@/plugins/orders/context/OrdersContext';
import { useOrders } from '@/plugins/orders/hooks/useOrders';
// Analytics
import { AnalyticsDashboardWidget } from '@/plugins/analytics/components/AnalyticsDashboardWidget';
import { AnalyticsList } from '@/plugins/analytics/components/AnalyticsList';
import { AnalyticsView } from '@/plugins/analytics/components/AnalyticsView';
import { AnalyticsProvider } from '@/plugins/analytics/context/AnalyticsContext';
import { useAnalytics } from '@/plugins/analytics/hooks/useAnalytics';
// Shipping
import { ShippingList } from '@/plugins/shipping/components/ShippingList';
import { ShippingSettingsForm } from '@/plugins/shipping/components/ShippingSettingsForm';
import { ShippingProvider } from '@/plugins/shipping/context/ShippingContext';
import { useShipping } from '@/plugins/shipping/hooks/useShipping';
// Mail
import { MailList } from '@/plugins/mail/components/MailList';
import { MailSettingsForm } from '@/plugins/mail/components/MailSettingsForm';
import { MailProvider } from '@/plugins/mail/context/MailContext';
import { useMail } from '@/plugins/mail/hooks/useMail';
// Inspection
import { InspectionList } from '@/plugins/inspection/components/InspectionList';
import { InspectionView } from '@/plugins/inspection/components/InspectionView';
import { InspectionProvider } from '@/plugins/inspection/context/InspectionContext';
import { useInspections } from '@/plugins/inspection/hooks/useInspections';

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
    dashboardWidget: ContactsDashboardWidget,
    displayPrefix: 'CNT',
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
    dashboardWidget: NotesDashboardWidget,
    displayPrefix: 'NTS',
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
    dashboardWidget: TasksDashboardWidget,
    displayPrefix: 'TSK',
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
    dashboardWidget: EstimatesDashboardWidget,
    displayPrefix: 'EST',
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
    dashboardWidget: InvoicesDashboardWidget,
    displayPrefix: 'INV',
  },
  {
    name: 'files',
    Provider: FilesProvider,
    hook: useFiles,
    panelKey: 'isFilesPanelOpen',
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
    dashboardWidget: FilesDashboardWidget,
    displayPrefix: 'FLS',
  },
  {
    name: 'mail',
    Provider: MailProvider,
    hook: useMail,
    panelKey: 'isMailPanelOpen',
    components: {
      List: MailList,
      Form: MailSettingsForm,
    },
    navigation: {
      category: 'Tools',
      label: 'Mail',
      icon: Mail,
      order: 1,
    },
  },
  {
    name: 'inspection',
    Provider: InspectionProvider,
    hook: useInspections,
    panelKey: 'isInspectionPanelOpen',
    components: {
      List: InspectionList,
      Form: InspectionView,
      View: InspectionView,
    },
    navigation: {
      category: 'Tools',
      label: 'Besiktningar',
      icon: ClipboardList,
      order: 2,
    },
  },
  {
    name: 'channels',
    Provider: ChannelsProvider,
    hook: useChannels,
    panelKey: 'isChannelsPanelOpen',
    components: {
      List: ChannelsList,
      View: ChannelsView,
    },
    navigation: channelsNavigation,
  },
  {
    name: 'products',
    Provider: ProductProvider,
    hook: useProducts,
    panelKey: 'isProductPanelOpen',
    components: {
      List: ProductList,
      Form: ProductForm,
      View: undefined, // Products: always editable form, no separate view mode
    },
    navigation: {
      category: 'E-Commerce',
      label: 'Products',
      icon: Package,
      order: 1,
    },
  },
  {
    name: 'woocommerce-products',
    Provider: WooCommerceProvider,
    hook: useWooCommerce,
    panelKey: 'isWoocommerceProductsPanelOpen',
    components: {
      List: WooExportPanel,
      Form: WooSettingsForm,
    },
    navigation: {
      category: 'E-Commerce',
      label: 'WooCommerce',
      icon: Store,
      order: 0,
      hideFromSidebar: true,
    },
  },
  {
    name: 'cdon-products',
    Provider: CdonProductsProvider,
    hook: useCdonProducts,
    panelKey: 'isCdonProductsPanelOpen',
    components: {
      List: CdonExportPanel,
      Form: CdonSettingsForm,
    },
    navigation: {
      category: 'E-Commerce',
      label: 'CDON',
      icon: Store,
      order: 0,
      hideFromSidebar: true,
    },
  },
  {
    name: 'fyndiq-products',
    Provider: FyndiqProductsProvider,
    hook: useFyndiqProducts,
    panelKey: 'isFyndiqProductsPanelOpen',
    components: {
      List: FyndiqExportPanel,
      Form: FyndiqSettingsForm,
    },
    navigation: {
      category: 'E-Commerce',
      label: 'Fyndiq',
      icon: Store,
      order: 0,
      hideFromSidebar: true,
    },
  },
  {
    name: 'orders',
    Provider: OrdersProvider,
    hook: useOrders,
    panelKey: 'isOrdersPanelOpen',
    components: {
      List: OrdersList,
      View: OrdersView,
    },
    navigation: {
      category: 'E-Commerce',
      label: 'Orders',
      icon: ShoppingCart,
      order: 0,
    },
  },
  {
    name: 'shipping',
    Provider: ShippingProvider,
    hook: useShipping,
    panelKey: 'isShippingPanelOpen',
    components: {
      List: ShippingList,
      Form: ShippingSettingsForm,
    },
    navigation: {
      category: 'E-Commerce',
      label: 'Frakt',
      icon: Truck,
      order: 3,
    },
  },
  {
    name: 'analytics',
    Provider: AnalyticsProvider,
    hook: useAnalytics,
    panelKey: 'isAnalyticsPanelOpen',
    components: {
      List: AnalyticsList,
      View: AnalyticsView,
    },
    navigation: {
      category: 'E-Commerce',
      label: 'Analytics',
      icon: BarChart3,
      order: 4,
    },
    dashboardWidget: AnalyticsDashboardWidget,
  },
];
