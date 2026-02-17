import {
  Users,
  StickyNote,
  CheckSquare,
  Calculator,
  Files as FilesIcon,
  Mail,
  Store,
  Trophy,
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

/** Props som dashboard-widgets får från core. onOpenPlugin anropas för att navigera till plugin-sidan. */
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
  /** Valfri widget för Dashboard. Visas endast om plugin är aktiverad för användaren. */
  dashboardWidget?: React.ComponentType<DashboardWidgetProps>;
  /** Prefix för visning av entitetsnummer (t.ex. CNT-1, EST-2025-001). */
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
import { InvoicesDashboardWidget } from '@/plugins/invoices/components/InvoicesDashboardWidget';
import { InvoicesForm } from '@/plugins/invoices/components/InvoicesForm';
import { InvoicesList } from '@/plugins/invoices/components/InvoicesList';
import { InvoicesView } from '@/plugins/invoices/components/InvoicesView';
import { InvoicesProvider } from '@/plugins/invoices/context/InvoicesContext';
import { useInvoices } from '@/plugins/invoices/hooks/useInvoices';
import { invoicesNavigation } from '@/plugins/invoices/navigation';
// Notes
import { KioskForm } from '@/plugins/kiosk/components/KioskForm';
import { KioskList } from '@/plugins/kiosk/components/KioskList';
import { KioskView } from '@/plugins/kiosk/components/KioskView';
import { KioskProvider } from '@/plugins/kiosk/context/KioskContext';
import { useKiosk } from '@/plugins/kiosk/hooks/useKiosk';
import { MailList } from '@/plugins/mail/components/MailList';
import { MailSettingsForm } from '@/plugins/mail/components/MailSettingsForm';
import { MailProvider } from '@/plugins/mail/context/MailContext';
import { useMail } from '@/plugins/mail/hooks/useMail';
import { MatchForm } from '@/plugins/matches/components/MatchForm';
import { MatchList } from '@/plugins/matches/components/MatchList';
import { MatchView } from '@/plugins/matches/components/MatchView';
import { MatchProvider } from '@/plugins/matches/context/MatchContext';
import { useMatches } from '@/plugins/matches/hooks/useMatches';
import { NoteForm } from '@/plugins/notes/components/NoteForm';
import { NoteList } from '@/plugins/notes/components/NoteList';
import { NotesDashboardWidget } from '@/plugins/notes/components/NotesDashboardWidget';
import { NoteView } from '@/plugins/notes/components/NoteView';
import { NoteProvider } from '@/plugins/notes/context/NoteContext';
import { useNotes } from '@/plugins/notes/hooks/useNotes';
// Tasks
import { SettingsForm } from '@/plugins/settings/components/SettingsForm';
import { SettingsList } from '@/plugins/settings/components/SettingsList';
import { SettingsProvider } from '@/plugins/settings/context/SettingsContext';
import { useSettings } from '@/plugins/settings/hooks/useSettings';
import { TaskForm } from '@/plugins/tasks/components/TaskForm';
import { TaskList } from '@/plugins/tasks/components/TaskList';
import { TasksDashboardWidget } from '@/plugins/tasks/components/TasksDashboardWidget';
import { TaskView } from '@/plugins/tasks/components/TaskView';
import { TaskProvider } from '@/plugins/tasks/context/TaskContext';
import { useTasks } from '@/plugins/tasks/hooks/useTasks';
// Matches
// Mail
// Settings (always-on)

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
    name: 'matches',
    Provider: MatchProvider,
    hook: useMatches,
    panelKey: 'isMatchPanelOpen',
    components: {
      List: MatchList,
      Form: MatchForm,
      View: MatchView,
    },
    navigation: {
      category: 'Main',
      label: 'Matches',
      icon: Trophy,
      order: 4,
    },
    displayPrefix: 'MAT',
  },
  {
    name: 'kiosk',
    Provider: KioskProvider,
    hook: useKiosk,
    panelKey: 'isKioskPanelOpen',
    components: {
      List: KioskList,
      Form: KioskForm,
      View: KioskView,
    },
    navigation: {
      category: 'Main',
      label: 'Kiosk',
      icon: Store,
      order: 5,
    },
    displayPrefix: 'KSK',
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
    displayPrefix: 'MAIL',
  },
  {
    name: 'settings',
    Provider: SettingsProvider,
    hook: useSettings,
    panelKey: 'isSettingsPanelOpen',
    components: {
      List: SettingsList,
      Form: SettingsForm,
    },
    // No navigation: settings is reached only via TopBar profile dropdown (Settings), not sidebar
  },
];
