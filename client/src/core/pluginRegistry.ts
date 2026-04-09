import {
  Bell,
  Users,
  StickyNote,
  CheckSquare,
  Calculator,
  Files as FilesIcon,
  Mail,
  Store,
  Trophy,
  Download,
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

/**
 * Frontend plugin registration. Naming on the **hook return value** must follow
 * docs/PLUGIN_RUNTIME_CONVENTIONS.md (e.g. `is{Entity}PanelOpen`, `current{Entity}`, `save{Entity}`).
 *
 * - **panelKey**: boolean on context, e.g. `isContactPanelOpen`.
 * - **Provider**: wraps app; receives auth + `onCloseOtherPanels`.
 * - **components.List | Form | View**: main page, panel form, panel detail view.
 */
/** Accepts both eager and lazy (React.lazy) component types. */
type PluginComponent<P = Record<string, never>> =
  | React.ComponentType<P>
  | React.LazyExoticComponent<React.ComponentType<P>>;

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
    List?: PluginComponent;
    Form?: PluginComponent<any>;
    View?: PluginComponent<any>;
  };
  navigation?: PluginNavigationConfig;
  /** Valfri widget för Dashboard. Visas endast om plugin är aktiverad för användaren. */
  dashboardWidget?: PluginComponent<DashboardWidgetProps>;
  /** Prefix för visning av entitetsnummer (t.ex. CNT-1, EST-2025-001). */
  displayPrefix?: string;
}

// ─── Static imports: Providers and hooks must be eager (used at app init) ────

// Contacts
import { ContactProvider } from '@/plugins/contacts/context/ContactContext';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
// Cups
import { CupsProvider } from '@/plugins/cups/context/CupsContext';
import { useCups } from '@/plugins/cups/hooks/useCups';
// Estimates
import { EstimateProvider } from '@/plugins/estimates/context/EstimateContext';
import { useEstimates } from '@/plugins/estimates/hooks/useEstimates';
// Files
import { FilesProvider } from '@/plugins/files/context/FilesContext';
import { useFiles } from '@/plugins/files/hooks/useFiles';
// Ingest
import { IngestProvider } from '@/plugins/ingest/context/IngestContext';
import { useIngest } from '@/plugins/ingest/hooks/useIngest';
// Invoices
import { InvoicesProvider } from '@/plugins/invoices/context/InvoicesContext';
import { useInvoices } from '@/plugins/invoices/hooks/useInvoices';
import { invoicesNavigation } from '@/plugins/invoices/navigation';
// Mail
import { MailProvider } from '@/plugins/mail/context/MailContext';
import { useMail } from '@/plugins/mail/hooks/useMail';
// Matches
import { MatchProvider } from '@/plugins/matches/context/MatchContext';
import { useMatches } from '@/plugins/matches/hooks/useMatches';
// Notes
import { NoteProvider } from '@/plugins/notes/context/NoteContext';
import { useNotes } from '@/plugins/notes/hooks/useNotes';
// Pulses
import { PulseProvider } from '@/plugins/pulses/context/PulseContext';
import { usePulses } from '@/plugins/pulses/hooks/usePulses';
// Settings
import { SettingsProvider } from '@/plugins/settings/context/SettingsContext';
import { useSettings } from '@/plugins/settings/hooks/useSettings';
// Slots
import { SlotsProvider } from '@/plugins/slots/context/SlotsContext';
import { useSlotsContext as useSlots } from '@/plugins/slots/context/SlotsContext';
// Tasks
import { TaskProvider } from '@/plugins/tasks/context/TaskContext';
import { useTasks } from '@/plugins/tasks/hooks/useTasks';

// ─── Lazy UI components: List / Form / View / dashboardWidget ─────────────────
// These are loaded on-demand: List when navigating to a plugin page,
// Form/View when opening a panel, dashboardWidget when Dashboard is rendered.

// Contacts
const ContactList = React.lazy(() =>
  import('@/plugins/contacts/components/ContactList').then((m) => ({ default: m.ContactList })),
);
const ContactForm = React.lazy(() =>
  import('@/plugins/contacts/components/ContactForm').then((m) => ({ default: m.ContactForm })),
);
const ContactView = React.lazy(() =>
  import('@/plugins/contacts/components/ContactView').then((m) => ({ default: m.ContactView })),
);
const ContactsDashboardWidget = React.lazy(() =>
  import('@/plugins/contacts/components/ContactsDashboardWidget').then((m) => ({
    default: m.ContactsDashboardWidget,
  })),
);

// Cups
const CupsList = React.lazy(() =>
  import('@/plugins/cups/components/CupsList').then((m) => ({ default: m.CupsList })),
);
const CupForm = React.lazy(() =>
  import('@/plugins/cups/components/CupForm').then((m) => ({ default: m.CupForm })),
);
const CupView = React.lazy(() =>
  import('@/plugins/cups/components/CupView').then((m) => ({ default: m.CupView })),
);
const CupsDashboardWidget = React.lazy(() =>
  import('@/plugins/cups/components/CupsDashboardWidget').then((m) => ({
    default: m.CupsDashboardWidget,
  })),
);

// Estimates
const EstimateList = React.lazy(() =>
  import('@/plugins/estimates/components/EstimateList').then((m) => ({
    default: m.EstimateList,
  })),
);
const EstimateForm = React.lazy(() =>
  import('@/plugins/estimates/components/EstimateForm').then((m) => ({
    default: m.EstimateForm,
  })),
);
const EstimateView = React.lazy(() =>
  import('@/plugins/estimates/components/EstimateView').then((m) => ({
    default: m.EstimateView,
  })),
);
const EstimatesDashboardWidget = React.lazy(() =>
  import('@/plugins/estimates/components/EstimatesDashboardWidget').then((m) => ({
    default: m.EstimatesDashboardWidget,
  })),
);

// Files
const FileList = React.lazy(() =>
  import('@/plugins/files/components/FileList').then((m) => ({ default: m.FileList })),
);
const FileForm = React.lazy(() =>
  import('@/plugins/files/components/FileForm').then((m) => ({ default: m.FileForm })),
);
const FileView = React.lazy(() =>
  import('@/plugins/files/components/FileView').then((m) => ({ default: m.FileView })),
);
const FilesDashboardWidget = React.lazy(() =>
  import('@/plugins/files/components/FilesDashboardWidget').then((m) => ({
    default: m.FilesDashboardWidget,
  })),
);

// Ingest
const IngestSourceList = React.lazy(() =>
  import('@/plugins/ingest/components/IngestSourceList').then((m) => ({
    default: m.IngestSourceList,
  })),
);
const IngestSourceForm = React.lazy(() =>
  import('@/plugins/ingest/components/IngestSourceForm').then((m) => ({
    default: m.IngestSourceForm,
  })),
);
const IngestSourceView = React.lazy(() =>
  import('@/plugins/ingest/components/IngestSourceView').then((m) => ({
    default: m.IngestSourceView,
  })),
);

// Invoices
const InvoicesList = React.lazy(() =>
  import('@/plugins/invoices/components/InvoicesList').then((m) => ({
    default: m.InvoicesList,
  })),
);
const InvoicesForm = React.lazy(() =>
  import('@/plugins/invoices/components/InvoicesForm').then((m) => ({
    default: m.InvoicesForm,
  })),
);
const InvoicesView = React.lazy(() =>
  import('@/plugins/invoices/components/InvoicesView').then((m) => ({
    default: m.InvoicesView,
  })),
);
const InvoicesDashboardWidget = React.lazy(() =>
  import('@/plugins/invoices/components/InvoicesDashboardWidget').then((m) => ({
    default: m.InvoicesDashboardWidget,
  })),
);

// Mail
const MailList = React.lazy(() =>
  import('@/plugins/mail/components/MailList').then((m) => ({ default: m.MailList })),
);
const MailSettingsForm = React.lazy(() =>
  import('@/plugins/mail/components/MailSettingsForm').then((m) => ({
    default: m.MailSettingsForm,
  })),
);
const MailDashboardWidget = React.lazy(() =>
  import('@/plugins/mail/components/MailDashboardWidget').then((m) => ({
    default: m.MailDashboardWidget,
  })),
);

// Matches
const MatchList = React.lazy(() =>
  import('@/plugins/matches/components/MatchList').then((m) => ({ default: m.MatchList })),
);
const MatchForm = React.lazy(() =>
  import('@/plugins/matches/components/MatchForm').then((m) => ({ default: m.MatchForm })),
);
const MatchView = React.lazy(() =>
  import('@/plugins/matches/components/MatchView').then((m) => ({ default: m.MatchView })),
);
const MatchesDashboardWidget = React.lazy(() =>
  import('@/plugins/matches/components/MatchesDashboardWidget').then((m) => ({
    default: m.MatchesDashboardWidget,
  })),
);

// Notes
const NoteList = React.lazy(() =>
  import('@/plugins/notes/components/NoteList').then((m) => ({ default: m.NoteList })),
);
const NoteForm = React.lazy(() =>
  import('@/plugins/notes/components/NoteForm').then((m) => ({ default: m.NoteForm })),
);
const NoteView = React.lazy(() =>
  import('@/plugins/notes/components/NoteView').then((m) => ({ default: m.NoteView })),
);
const NotesDashboardWidget = React.lazy(() =>
  import('@/plugins/notes/components/NotesDashboardWidget').then((m) => ({
    default: m.NotesDashboardWidget,
  })),
);

// Pulses
const PulseList = React.lazy(() =>
  import('@/plugins/pulses/components/PulseList').then((m) => ({ default: m.PulseList })),
);
const PulseSettingsForm = React.lazy(() =>
  import('@/plugins/pulses/components/PulseSettingsForm').then((m) => ({
    default: m.PulseSettingsForm,
  })),
);
const PulsesDashboardWidget = React.lazy(() =>
  import('@/plugins/pulses/components/PulsesDashboardWidget').then((m) => ({
    default: m.PulsesDashboardWidget,
  })),
);

// Settings
const SettingsList = React.lazy(() =>
  import('@/plugins/settings/components/SettingsList').then((m) => ({
    default: m.SettingsList,
  })),
);
const SettingsForm = React.lazy(() =>
  import('@/plugins/settings/components/SettingsForm').then((m) => ({
    default: m.SettingsForm,
  })),
);

// Slots
const SlotsList = React.lazy(() =>
  import('@/plugins/slots/components/SlotsList').then((m) => ({ default: m.SlotsList })),
);
const SlotForm = React.lazy(() =>
  import('@/plugins/slots/components/SlotForm').then((m) => ({ default: m.SlotForm })),
);
const SlotView = React.lazy(() =>
  import('@/plugins/slots/components/SlotView').then((m) => ({ default: m.SlotView })),
);
const SlotsDashboardWidget = React.lazy(() =>
  import('@/plugins/slots/components/SlotsDashboardWidget').then((m) => ({
    default: m.SlotsDashboardWidget,
  })),
);

// Tasks
const TaskList = React.lazy(() =>
  import('@/plugins/tasks/components/TaskList').then((m) => ({ default: m.TaskList })),
);
const TaskForm = React.lazy(() =>
  import('@/plugins/tasks/components/TaskForm').then((m) => ({ default: m.TaskForm })),
);
const TaskView = React.lazy(() =>
  import('@/plugins/tasks/components/TaskView').then((m) => ({ default: m.TaskView })),
);
const TasksDashboardWidget = React.lazy(() =>
  import('@/plugins/tasks/components/TasksDashboardWidget').then((m) => ({
    default: m.TasksDashboardWidget,
  })),
);

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
    dashboardWidget: MatchesDashboardWidget,
    displayPrefix: 'MAT',
  },
  {
    name: 'slots',
    Provider: SlotsProvider,
    hook: useSlots,
    panelKey: 'isSlotsPanelOpen',
    components: {
      List: SlotsList,
      Form: SlotForm,
      View: SlotView,
    },
    navigation: {
      category: 'Main',
      label: 'Slots',
      icon: Store,
      order: 5,
    },
    dashboardWidget: SlotsDashboardWidget,
    displayPrefix: 'SLT',
  },
  {
    name: 'cups',
    Provider: CupsProvider,
    hook: useCups,
    panelKey: 'isCupPanelOpen',
    components: {
      List: CupsList,
      Form: CupForm,
      View: CupView,
    },
    navigation: {
      category: 'Main',
      label: 'Cups',
      icon: Trophy,
      order: 6,
    },
    dashboardWidget: CupsDashboardWidget,
    displayPrefix: 'CUP',
  },
  {
    name: 'ingest',
    Provider: IngestProvider,
    hook: useIngest,
    panelKey: 'isIngestPanelOpen',
    components: {
      List: IngestSourceList,
      Form: IngestSourceForm,
      View: IngestSourceView,
    },
    navigation: {
      category: 'Tools',
      label: 'Ingest',
      icon: Download,
      order: 3,
    },
    displayPrefix: 'ING',
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
    dashboardWidget: MailDashboardWidget,
    displayPrefix: 'MAIL',
  },
  {
    name: 'pulses',
    Provider: PulseProvider,
    hook: usePulses,
    panelKey: 'isPulsesPanelOpen',
    components: {
      List: PulseList,
      Form: PulseSettingsForm,
    },
    navigation: {
      category: 'Tools',
      label: 'Pulse',
      icon: Bell,
      order: 2,
    },
    dashboardWidget: PulsesDashboardWidget,
    displayPrefix: 'PULSE',
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
