import { LucideIcon } from 'lucide-react';
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface EntityAction {
    id: string;
    label: string;
    icon: LucideIcon;
    onClick: (data: any) => void | Promise<void>;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
    className?: string;
}

interface ActionContextType {
    registerAction: (entityType: string, action: EntityAction) => () => void;
    getActionsForEntity: (entityType: string) => EntityAction[];
}

const ActionContext = createContext<ActionContextType | undefined>(undefined);

export function ActionProvider({ children }: { children: ReactNode }) {
    const [registry, setRegistry] = useState<Map<string, EntityAction[]>>(new Map());

    const registerAction = useCallback((entityType: string, action: EntityAction) => {
        setRegistry((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(entityType) || [];
            // Prevent duplicates
            if (existing.some((a) => a.id === action.id)) {
                return prev;
            }
            newMap.set(entityType, [...existing, action]);
            return newMap;
        });

        // Return unregister function
        return () => {
            setRegistry((prev) => {
                const newMap = new Map(prev);
                const existing = newMap.get(entityType) || [];
                newMap.set(
                    entityType,
                    existing.filter((a) => a.id !== action.id),
                );
                return newMap;
            });
        };
    }, []);

    const getActionsForEntity = useCallback(
        (entityType: string) => {
            return registry.get(entityType) || [];
        },
        [registry],
    );

    return (
        <ActionContext.Provider value={{ registerAction, getActionsForEntity }}>
            {children}
        </ActionContext.Provider>
    );
}

export function useActionRegistry() {
    const context = useContext(ActionContext);
    if (!context) {
        throw new Error('useActionRegistry must be used within an ActionProvider');
    }
    return context;
}

export function usePluginActions(entityType: string) {
    const { getActionsForEntity } = useActionRegistry();
    return getActionsForEntity(entityType);
}
