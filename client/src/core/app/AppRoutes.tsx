/**
 * Top-level routes: public share links and authenticated app shell.
 */

import React from 'react';
import { Route, Routes, useParams } from 'react-router-dom';

import { ActionProvider } from '@/core/api/ActionContext';
import { AppProvider } from '@/core/api/AppContext';
import { AppContent } from '@/core/app/AppContent';
import { PluginProviders } from '@/core/app/PluginProviders';
import { GlobalNavigationGuardProvider } from '@/hooks/useGlobalNavigationGuard';

const PublicEstimateView = React.lazy(() =>
  import('@/plugins/estimates/components/PublicEstimateView').then((m) => ({
    default: m.PublicEstimateView,
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
      <Route path="/public/note/:token" element={<PublicTokenRoute Component={PublicNoteView} />} />
      <Route path="/public/task/:token" element={<PublicTokenRoute Component={PublicTaskView} />} />

      {/* All private routes – wrapped in full provider stack */}
      <Route
        path="/*"
        element={
          <AppProvider>
            <ActionProvider>
              <GlobalNavigationGuardProvider>
                <PluginProviders>
                  <AppContent />
                </PluginProviders>
              </GlobalNavigationGuardProvider>
            </ActionProvider>
          </AppProvider>
        }
      />
    </Routes>
  );
}
