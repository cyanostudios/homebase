import React from 'react';
import { cn } from '@/lib/utils';

interface DetailLayoutProps {
    children: React.ReactNode;
    sidebar?: React.ReactNode;
    className?: string;
}

export function DetailLayout({ children, sidebar, className }: DetailLayoutProps) {
    return (
        <div className={cn('grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8', className)}>
            {/* Main Content (70%) */}
            <div className="min-w-0 space-y-6">
                {children}
            </div>

            {/* Sidebar (30% / 320px) */}
            {sidebar && (
                <aside className="space-y-8">
                    {sidebar}
                </aside>
            )}
        </div>
    );
}
