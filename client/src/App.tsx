/**
 * ⚠️  CRITICAL SYSTEM FILE - HANDLE WITH EXTREME CARE ⚠️
 *
 * Root app entry: composes top-level routes (see core/app/AppRoutes).
 *
 * Last Modified: August 2025 - Global Navigation Guard Integration
 */

import { AppRoutes } from '@/core/app/AppRoutes';

function App() {
  return <AppRoutes />;
}

export default App;

// Root component: accept HMR but force full reload to avoid "Failed to reload App.tsx"
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate();
  });
}
