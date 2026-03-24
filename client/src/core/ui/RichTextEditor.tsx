import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import DOMPurify from 'dompurify';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Link as LinkIcon,
} from 'lucide-react';
import React, { useEffect, useCallback, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3'];

function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }
  return DOMPurify.sanitize(html, { ALLOWED_TAGS });
}

export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Min height in pixels for editor area */
  minHeight?: number;
  /** Show code/source toggle (for Product description). Omit for Notes, Tasks, Inspections. */
  showSourceToggle?: boolean;
  className?: string;
  disabled?: boolean;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = '',
  minHeight = 160,
  showSourceToggle = false,
  className = '',
  disabled = false,
}) => {
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceValue, setSourceValue] = useState(value || '');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      Underline,
      Placeholder.configure({ placeholder }),
    ],
    content: sanitizeHtml(value || ''),
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[80px] px-3 py-2 focus:outline-none',
      },
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    const current = editor.getHTML();
    const incoming = sanitizeHtml(value || '');
    if (current !== incoming && !sourceMode) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [value, editor, sourceMode]);

  const handleEditorUpdate = useCallback(() => {
    if (!editor || sourceMode) {
      return;
    }
    const html = editor.getHTML();
    if (html !== value) {
      onChange(html);
    }
  }, [editor, sourceMode, value, onChange]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.on('update', handleEditorUpdate);
    return () => {
      editor.off('update', handleEditorUpdate);
    };
  }, [editor, handleEditorUpdate]);

  const applyLink = useCallback(() => {
    if (!editor) {
      return;
    }
    const url = linkUrl.trim();
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setLinkUrl('');
    setLinkPopoverOpen(false);
  }, [editor, linkUrl]);

  const handleSourceToVisual = useCallback(() => {
    const clean = sanitizeHtml(sourceValue);
    onChange(clean);
    editor?.commands.setContent(clean, { emitUpdate: false });
    setSourceMode(false);
  }, [sourceValue, editor, onChange]);

  const handleVisualToSource = useCallback(() => {
    setSourceValue(editor?.getHTML() ?? '');
    setSourceMode(true);
  }, [editor]);

  if (!editor) {
    return null;
  }

  const toolbar = (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-input bg-muted/30 px-1 py-1 rounded-t-md">
      <Toggle
        size="sm"
        pressed={editor.isActive('bold')}
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
        aria-label="Fet"
        className="h-8 w-8 p-0 data-[state=on]:bg-muted"
      >
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('italic')}
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        aria-label="Kursiv"
        className="h-8 w-8 p-0 data-[state=on]:bg-muted"
      >
        <Italic className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('underline')}
        onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
        aria-label="Understruken"
        className="h-8 w-8 p-0 data-[state=on]:bg-muted"
      >
        <UnderlineIcon className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('strike')}
        onPressedChange={() => editor.chain().focus().toggleStrike().run()}
        aria-label="Genomstrucken"
        className="h-8 w-8 p-0 data-[state=on]:bg-muted"
      >
        <Strikethrough className="h-4 w-4" />
      </Toggle>
      <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
        <PopoverTrigger asChild>
          <Toggle
            size="sm"
            pressed={editor.isActive('link')}
            aria-label="Länk"
            className="h-8 w-8 p-0 data-[state=on]:bg-muted"
          >
            <LinkIcon className="h-4 w-4" />
          </Toggle>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <div className="flex gap-2">
            <Input
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyLink()}
            />
            <button
              type="button"
              onClick={applyLink}
              className="text-sm px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Sätt
            </button>
          </div>
        </PopoverContent>
      </Popover>
      {showSourceToggle && (
        <>
          <div className="w-px h-5 bg-border mx-1" />
          <button
            type="button"
            onClick={sourceMode ? handleSourceToVisual : handleVisualToSource}
            className={cn(
              'text-xs px-2 py-1 rounded hover:bg-muted',
              sourceMode && 'bg-muted font-medium',
            )}
          >
            {sourceMode ? 'Visual' : 'Kod'}
          </button>
        </>
      )}
    </div>
  );

  if (sourceMode && showSourceToggle) {
    return (
      <div className={cn('rounded-md border border-input overflow-hidden', className)}>
        {toolbar}
        <Textarea
          value={sourceValue}
          onChange={(e) => setSourceValue(e.target.value)}
          onBlur={() => {
            const clean = sanitizeHtml(sourceValue);
            if (clean !== value) {
              onChange(clean);
            }
          }}
          placeholder={placeholder}
          rows={Math.max(6, Math.floor(minHeight / 24))}
          className="rounded-t-none border-0 focus-visible:ring-0 font-mono text-sm resize-y min-h-[80px]"
        />
      </div>
    );
  }

  return (
    <div className={cn('rounded-md border border-input overflow-hidden bg-background', className)}>
      {toolbar}
      <div style={{ minHeight }} className="overflow-auto">
        <EditorContent editor={editor} />
      </div>
      <BubbleMenu
        editor={editor}
        className="flex gap-0.5 bg-background border rounded-md shadow-md p-1"
      >
        <Toggle
          size="sm"
          pressed={editor.isActive('bold')}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          className="h-8 w-8 p-0"
        >
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('italic')}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          className="h-8 w-8 p-0"
        >
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('underline')}
          onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
          className="h-8 w-8 p-0"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('strike')}
          onPressedChange={() => editor.chain().focus().toggleStrike().run()}
          className="h-8 w-8 p-0"
        >
          <Strikethrough className="h-4 w-4" />
        </Toggle>
      </BubbleMenu>
    </div>
  );
};
