import { Download, File, Folder, RefreshCw, Image } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DropboxFile {
    id: string;
    name: string;
    path: string;
    type: string;
    size: number;
    modified: string;
    isFolder: boolean;
}

interface DropboxFileListProps {
    viewMode?: 'grid' | 'list';
    headerActions?: React.ReactNode;
}

function humanSize(bytes: number) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let n = bytes;
    let i = 0;
    while (n >= 1024 && i < units.length - 1) {
        n /= 1024;
        i++;
    }
    return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function getFileIcon(name: string, isFolder: boolean) {
    if (isFolder) return Folder;
    const ext = name.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext || '')) return Image;
    return File;
}

export const DropboxFileList: React.FC<DropboxFileListProps> = ({ viewMode = 'list', headerActions }) => {
    const [files, setFiles] = useState<DropboxFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadFiles = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/files/cloud/dropbox/files', {
                credentials: 'include',
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            setFiles(data.files || []);
        } catch (err: any) {
            console.error('Failed to load Dropbox files:', err);
            setError(err.message || 'Failed to load files');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFiles();
    }, []);

    if (loading && files.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                Loading Dropbox files...
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center">
                <p className="text-red-500 mb-4">{error}</p>
                <Button onClick={loadFiles} size="sm">
                    Try Again
                </Button>
            </div>
        );
    }

    if (files.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="mb-2">Your Dropbox is empty</p>
                <p className="text-xs">Upload files to your Dropbox to see them here</p>
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                    Dropbox root folder ({files.length} {files.length === 1 ? 'item' : 'items'})
                </h3>
                <div className="flex items-center gap-2">
                    {headerActions}
                    <Button onClick={loadFiles} size="sm" variant="outline" disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {files.map((file) => {
                        const Icon = getFileIcon(file.name, file.isFolder);
                        return (
                            <div
                                key={file.id}
                                className="relative border border-gray-200 rounded-lg p-3 hover:border-gray-300 hover:shadow-md transition-all cursor-default group"
                            >
                                <div className="flex flex-col items-center text-center">
                                    <div className="w-full h-24 flex items-center justify-center bg-gray-50 rounded mb-2 relative">
                                        <Icon className="w-8 h-8 text-gray-400" />
                                        {!file.isFolder && (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
                                                onClick={() => alert('Download coming soon!')}
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                    <div className="text-xs font-medium text-gray-900 truncate w-full" title={file.name}>
                                        {file.name}
                                    </div>
                                    <div className="text-[10px] text-gray-500 mt-1">
                                        {file.isFolder ? 'Folder' : humanSize(file.size)}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Modified</TableHead>
                            <TableHead className="w-12"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {files.map((file) => {
                            const Icon = getFileIcon(file.name, file.isFolder);
                            return (
                                <TableRow key={file.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Icon className="w-4 h-4 text-muted-foreground" />
                                            <span className="font-medium">{file.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {file.isFolder ? '—' : humanSize(file.size)}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {new Date(file.modified).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                        {!file.isFolder && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => {
                                                    // TODO: Implement download
                                                    alert('Download coming soon!');
                                                }}
                                                title="Download file"
                                            >
                                                <Download className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            )}
        </div>
    );
};
