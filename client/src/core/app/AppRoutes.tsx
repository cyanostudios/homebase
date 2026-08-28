/**
 * Top-level routes: public share links and authenticated app shell.
 */

import React from 'react';
import { Route, Routes, useParams } from 'react-router-dom';

class PluginErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    console.error('[PluginErrorBoundary] Plugin crashed, showing fallback:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: '12px',
            fontFamily: 'sans-serif',
          }}
        >
          <p style={{ fontSize: '1rem', color: '#666' }}>
            Something went wrong loading the app. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 20px',
              borderRadius: '6px',
              border: 'none',
              background: '#0f172a',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import { ActionProvider } from '@/core/api/ActionContext';
import { AppProvider } from '@/core/api/AppContext';
import { AppContent } from '@/core/app/AppContent';
import { CompanionPanelProvider } from '@/core/app/CompanionPanelContext';
import { PluginProviders } from '@/core/app/PluginProviders';
import { TimeTrackingActivityProvider } from '@/core/widgets/time-tracking/TimeTrackingActivityContext';
import { GlobalNavigationGuardProvider } from '@/hooks/useGlobalNavigationGuard';
import { ResetPasswordPage } from '@/core/ui/ResetPasswordPage';

const PublicEstimateView = React.lazy(() =>
  import('@/plugins/estimates/components/PublicEstimateView').then((m) => ({
    default: m.PublicEstimateView,
  })),
);
const PublicInvoiceView = React.lazy(() =>
  import('@/plugins/invoices/components/PublicInvoiceView').then((m) => ({
    default: m.PublicInvoiceView,
  })),
);
const PublicNoteView = React.lazy(() =>
  import('@/plugins/notes/components/PublicNoteView').then((m) => ({
    default: m.PublicNoteView,
  })),
);
const PublicTaskView = React.lazy(() =>
  import('@/plugins/tasks/components/PublicTaskView').then((m) => ({
    default: m.PublicTaskView,
  })),
);
const PublicGarmentListView = React.lazy(() =>
  import('@/plugins/garments/components/PublicGarmentListView').then((m) => ({
    default: m.PublicGarmentListView,
  })),
);
const PublicRequestForm = React.lazy(() =>
  import('@/plugins/requests/components/PublicRequestForm').then((m) => ({
    default: m.PublicRequestForm,
  })),
);

function PublicTokenRoute({ Component }: { Component: React.ComponentType<{ token: string }> }) {
  const { token } = useParams<{ token: string }>();
  if (!token) {
    return <div>Invalid link</div>;
  }
  return (
    <React.Suspense fallback={null}>
      <Component token={token} />
    </React.Suspense>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Public routes – no auth / no providers needed */}
      <Route
        path="/public/estimate/:token"
        element={<PublicTokenRoute Component={PublicEstimateView} />}
      />
      <Route
        path="/public/invoice/:token"
        element={<PublicTokenRoute Component={PublicInvoiceView} />}
      />
      <Route path="/public/note/:token" element={<PublicTokenRoute Component={PublicNoteView} />} />
      <Route path="/public/task/:token" element={<PublicTokenRoute Component={PublicTaskView} />} />
      <Route
        path="/public/garment-list/:token"
        element={<PublicTokenRoute Component={PublicGarmentListView} />}
      />

      <Route
        path="/public/request"
        element={
          <React.Suspense fallback={null}>
            <PublicRequestForm lang="sv" />
          </React.Suspense>
        }
      />

      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

      {/* All private routes – wrapped in full provider stack */}
      <Route
        path="/*"
        element={
          <PluginErrorBoundary>
            <AppProvider>
              <TimeTrackingActivityProvider>
                <ActionProvider>
                  <GlobalNavigationGuardProvider>
                    <PluginProviders>
                      <CompanionPanelProvider>
                        <AppContent />
                      </CompanionPanelProvider>
                    </PluginProviders>
                  </GlobalNavigationGuardProvider>
                </ActionProvider>
              </TimeTrackingActivityProvider>
            </AppProvider>
          </PluginErrorBoundary>
        }
      />
    </Routes>
  );
}
