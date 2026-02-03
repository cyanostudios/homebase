import React from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    History,
    LayoutGrid,
    List,
    Zap,
    Eye,
    Clock
} from 'lucide-react';

interface NoteSettingsFormProps {
    onCancel: () => void; // Still keep prop for potential internal use, but we'll use panel footer
}

export const NoteSettingsForm: React.FC<NoteSettingsFormProps> = () => {
    return (
        <div className="space-y-6 pb-8">
            {/* Section: Display */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-slate-500 font-medium text-xs uppercase tracking-wider px-1">
                    <Eye className="w-4 h-4" />
                    Display Preferences
                </div>

                <Card className="p-4 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden border-l-4 border-l-blue-500">
                    <div className="space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-medium">Default View Mode</Label>
                                <p className="text-xs text-muted-foreground italic">How your notes are displayed by default</p>
                            </div>
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-md self-start sm:self-center">
                                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-600 transition-all">
                                    <LayoutGrid className="w-3.5 h-3.5" />
                                    Grid
                                </button>
                                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-all">
                                    <List className="w-3.5 h-3.5" />
                                    List
                                </button>
                            </div>
                        </div>

                        <Separator className="bg-slate-100 dark:bg-slate-800" />

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-medium">Show Metadata</Label>
                                <p className="text-xs text-muted-foreground">Display creation date and last updated info</p>
                            </div>
                            <Switch defaultChecked />
                        </div>
                    </div>
                </Card>
            </section>

            {/* Section: Automation */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-slate-500 font-medium text-xs uppercase tracking-wider px-1">
                    <Zap className="w-4 h-4" />
                    Automation & Logic
                </div>

                <Card className="p-4 border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-yellow-500">
                    <div className="space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <Label className="text-sm font-medium">Enable Auto-save</Label>
                                    <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 hover:bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400 border-none text-[10px] h-4">Recommended</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">Notes are saved as you type</p>
                            </div>
                            <Switch defaultChecked />
                        </div>

                        <Separator className="bg-slate-100 dark:bg-slate-800" />

                        <div className="flex items-center justify-between opacity-50 cursor-not-allowed">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <Label className="text-sm font-medium text-slate-400">AI Title Generator</Label>
                                    <Badge variant="outline" className="text-[10px] h-4 text-slate-400 font-normal">Pro</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">Automatically suggest titles for your content</p>
                            </div>
                            <Switch disabled />
                        </div>
                    </div>
                </Card>
            </section>

            {/* Section: Core Integration */}
            <section className="space-y-4 pt-2 px-1">
                <div className="flex items-center gap-2 text-slate-500 font-medium text-xs uppercase tracking-wider">
                    <History className="w-4 h-4" />
                    Data & Retention
                </div>

                <div className="grid grid-cols-1 gap-3">
                    <Button
                        variant="outline"
                        className="w-full justify-between h-auto py-3 px-4 border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 group transition-all duration-200 shadow-sm"
                        onClick={() => alert('Opening deletion logs...')}
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                <Clock className="w-4 h-4" />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Deletion History</div>
                                <div className="text-[10px] text-muted-foreground font-normal">Recover notes from activity log</div>
                            </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-slate-200 dark:border-slate-700 font-normal">5 recent</Badge>
                    </Button>
                </div>
            </section>
        </div>
    );
};
