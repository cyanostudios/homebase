import React from 'react';
import { Outlet, Link } from '@tanstack/react-router';

export const Layout: React.FC = () => {
  return (
    <div className="flex h-screen">
      <aside className="w-64 bg-gray-100 p-4">
        <nav className="space-y-2">
          <Link to="/dashboard" className="block">Dashboard</Link>
          <Link to="/invoice" className="block">Invoice</Link>
        </nav>
      </aside>
      <main className="flex-1">
        <header className="h-12 bg-white shadow px-4 flex items-center">Topbar</header>
        <div className="p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
export default Layout;
