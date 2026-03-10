import React from 'react';

/**
 * PublicRouteHandler – previously handled /public/estimate/:token via DOM hijack.
 * Since the app now uses react-router-dom, the public route is handled at the
 * router level in App.tsx (<Route path="/public/estimate/:token" ...>).
 * This component is kept as a transparent passthrough for backward compatibility.
 */
export function PublicRouteHandler({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
