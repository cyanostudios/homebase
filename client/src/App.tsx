/**
 * Root app entry — composes top-level routes (see core/app/AppRoutes).
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
