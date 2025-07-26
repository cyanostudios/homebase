import React, { useEffect } from 'react';
import { PublicEstimateView } from './PublicEstimateView';

/**
 * Handles public estimate routes within the estimates plugin
 * Follows plugin isolation rules - no core app changes needed
 */
export function PublicRouteHandler({ children }: { children: React.ReactNode }) {
  // Check if current URL is a public estimate route
  const currentPath = window.location.pathname;
  const isPublicEstimateRoute = currentPath.startsWith('/public/estimate/');

  useEffect(() => {
    // If this is a public route, we handle it within the plugin
    if (isPublicEstimateRoute) {
      // Extract token from URL
      const pathParts = currentPath.split('/');
      const token = pathParts[pathParts.length - 1];
      
      if (token) {
        // Replace the entire body with our public view
        document.body.innerHTML = '';
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        
        // Create a container for our public view
        const container = document.createElement('div');
        container.id = 'public-estimate-root';
        document.body.appendChild(container);
        
        // Import and render the public view
        import('react-dom/client').then(({ createRoot }) => {
          const root = createRoot(container);
          root.render(React.createElement(PublicEstimateView, { token }));
        });
        
        return;
      }
    }
  }, [isPublicEstimateRoute, currentPath]);

  // For non-public routes, render normal plugin content
  if (isPublicEstimateRoute) {
    return null; // Public view will be rendered via useEffect
  }

  return <>{children}</>;
}