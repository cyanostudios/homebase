import {
    Clock,
    Eye,
    History,
    LayoutGrid,
    List,
    Zap,
} from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DetailSection } from '@/core/ui/DetailSection';
import { DetailCard } from '@/core/ui/DetailCard';

interface NoteSettingsFormProps {
    onCancel: () => void;
}

export const NoteSettingsForm: React.FC<NoteSettingsFormProps> = () => {
    return (
        <div className="space-y-6">
            {/* Display Preferences */}
            <DetailSection
                title={
                    <div className="flex items-center gap-2">
                        <Eye className="w-3.5 h-3.5" />
                        <span>Display Preferences</span>
                    </div>
                }
            >
                <DetailCard className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-sm font-semibold">Default View Mode</Label>
                            <p className="text-[11px] text-gray-500 italic">How your notes are displayed by default</p>
                        </div>
                        <div className="flex bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-100 dark:border-gray-700">
                            <Button
                                variant="default"
                                size="sm"
                                className="h-8 px-3 text-[10px] uppercase font-bold tracking-tight"
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                                Grid
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-3 text-[10px] uppercase font-bold tracking-tight text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                <List className="w-3.5 h-3.5" />
                                List
                            </Button>
                        </div>
                    </div>

                    <div className="h-px bg-gray-100 dark:bg-gray-800" />

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-sm font-semibold">Show Metadata</Label>
                            <p className="text-[11px] text-gray-500">Display creation date and last updated info</p>
                        </div>
                        <Switch defaultChecked />
                    </div>
                </DetailCard>
            </DetailSection>

            {/* Automation & Logic */}
            <DetailSection
                title={
                    <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5" />
                        <span>Automation & Logic</span>
                    </div>
                }
            >
                <DetailCard className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <Label className="text-sm font-semibold">Enable Auto-save</Label>
                                <Badge variant="outline" className="bg-green-50/50 text-green-700 dark:text-green-300 border-green-100/50 font-medium text-[9px] h-4">Recommended</Badge>
                            </div>
                            <p className="text-[11px] text-gray-500">Notes are saved as you type</p>
                        </div>
                        <Switch defaultChecked />
                    </div>

                    <div className="h-px bg-gray-100 dark:bg-gray-800" />

                    <div className="flex items-center justify-between opacity-60">
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <Label className="text-sm font-semibold">AI Title Generator</Label>
                                <Badge variant="outline" className="text-[9px] h-4 font-medium text-muted-foreground border-border/50 bg-secondary/30">Pro</Badge>
                            </div>
                            <p className="text-[11px] text-gray-500">Automatically suggest titles for your content</p>
                        </div>
                        <Switch disabled />
                    </div>
                </DetailCard>
            </DetailSection>

            {/* Data & History */}
            <DetailSection
                title={
                    <div className="flex items-center gap-2">
                        <History className="w-3.5 h-3.5" />
                        <span>Data & Retention</span>
                    </div>
                }
            >
                <DetailCard padding="none" className="overflow-hidden">
                    <Button
                        variant="ghost"
                        className="w-full justify-between h-auto py-3 px-3 hover:bg-white dark:hover:bg-gray-800 rounded-none group transition-all duration-200"
                        onClick={() => alert('Opening deletion logs...')}
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                <Clock className="w-4 h-4" />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-bold text-gray-900 dark:text-gray-100">Deletion History</div>
                                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Recover notes from activity log</div>
                            </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-secondary/50 text-secondary-foreground border-transparent font-medium">5 Items</Badge>
                    </Button>
                </DetailCard>
            </DetailSection>
        </div>
    );
};


