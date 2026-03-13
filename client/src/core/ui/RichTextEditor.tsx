import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { ReactRenderer, useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
  Underline as UnderlineIcon,
} from 'lucide-react';
import React, { forwardRef, useImperativeHandle, useEffect, useRef, useState } from 'react';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import 'tippy.js/dist/tippy.css';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { Mention as MentionRecord } from '../types/mention';

// ─── Mention suggestion popup ────────────────────────────────────────────────

interface SuggestionListProps {
  items: any[];
  command: (item: { id: string; label: string }) => void;
}

const SuggestionList = forwardRef<
  { onKeyDown: (p: { event: KeyboardEvent }) => boolean },
  SuggestionListProps
>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0);

  useEffect(() => setSelected(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown({ event }) {
      if (event.key === 'ArrowUp') {
        setSelected((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelected((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        const item = items[selected];
        if (item) {
          command({ id: String(item.id), label: item.companyName });
        }
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="bg-popover border border-border rounded-md shadow-lg px-3 py-2 text-sm text-muted-foreground">
        No contacts found
      </div>
    );
  }

  return (
    <div className="bg-popover border border-border rounded-md shadow-lg overflow-hidden min-w-[200px] max-w-[280px] max-h-48 overflow-y-auto">
      {items.map((item, i) => (
        <button
          key={item.id}
          onMouseDown={(e) => {
            e.preventDefault();
            command({ id: String(item.id), label: item.companyName });
          }}
          className={cn(
            'w-full text-left px-3 py-2 text-sm border-b border-border/50 last:border-0',
            i === selected
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-accent/50 text-foreground',
          )}
        >
          <div className="font-medium">{item.companyName}</div>
          {item.organizationNumber && (
            <div className="text-xs text-muted-foreground">{item.organizationNumber}</div>
          )}
        </button>
      ))}
    </div>
  );
});
SuggestionList.displayName = 'SuggestionList';

// ─── Toolbar button ───────────────────────────────────────────────────────────

function ToolbarButton({
  onClick,
  active,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn(
        'h-7 w-7 p-0 rounded',
        active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </Button>
  );
}

// ─── RichTextEditor ───────────────────────────────────────────────────────────

interface RichTextEditorProps {
  value: string;
  onChange: (html: string, mentions: MentionRecord[]) => void;
  placeholder?: string;
  className?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write something…',
  className,
}) => {
  // Load contacts once for the mention suggestions
  const [, setContacts] = useState<any[]>([]);
  const contactsRef = useRef<any[]>([]);

  useEffect(() => {
    fetch('/api/contacts', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setContacts(data);
        contactsRef.current = data;
      })
      .catch(() => {});
  }, []);

  // Derive mentions from the editor document
  const extractMentions = (editor: ReturnType<typeof useEditor>): MentionRecord[] => {
    if (!editor) {
      return [];
    }
    const mentions: MentionRecord[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'mention') {
        const contactId = String(node.attrs.id);
        const contact = contactsRef.current.find((c) => String(c.id) === contactId);
        mentions.push({
          contactId,
          contactName: node.attrs.label ?? '',
          companyName: contact?.companyName,
          position: 0,
          length: 0,
        });
      }
    });
    return mentions;
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder }),
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        suggestion: {
          items: ({ query }: { query: string }) => {
            if (!query) {
              return contactsRef.current.slice(0, 6);
            }
            return contactsRef.current
              .filter((c) => c.companyName?.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 6);
          },
          render() {
            let component: ReactRenderer;
            let popup: TippyInstance[];

            return {
              onStart(props) {
                component = new ReactRenderer(SuggestionList, { props, editor: props.editor });
                if (!props.clientRect) {
                  return;
                }
                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                  theme: 'none',
                  arrow: false,
                  offset: [0, 4],
                });
              },
              onUpdate(props) {
                component.updateProps(props);
                if (!props.clientRect) {
                  return;
                }
                popup[0]?.setProps({ getReferenceClientRect: props.clientRect as () => DOMRect });
              },
              onKeyDown(props) {
                if (props.event.key === 'Escape') {
                  popup[0]?.hide();
                  return true;
                }
                return (component.ref as any)?.onKeyDown(props) ?? false;
              },
              onExit() {
                popup[0]?.destroy();
                component.destroy();
              },
            };
          },
        },
      }),
    ],
    content: value || '',
    onUpdate({ editor: e }) {
      onChange(e.getHTML(), extractMentions(e));
    },
  });

  // Sync external value changes (e.g. when editing an existing note)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (!editor) {
      return;
    }
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Only sync if value differs from current HTML (avoid cursor reset on every keystroke)
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  const groups = [
    [
      {
        icon: <Heading1 size={14} />,
        title: 'Heading 1',
        action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        active: editor.isActive('heading', { level: 1 }),
      },
      {
        icon: <Heading2 size={14} />,
        title: 'Heading 2',
        action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        active: editor.isActive('heading', { level: 2 }),
      },
      {
        icon: <Heading3 size={14} />,
        title: 'Heading 3',
        action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        active: editor.isActive('heading', { level: 3 }),
      },
    ],
    [
      {
        icon: <Bold size={14} />,
        title: 'Bold',
        action: () => editor.chain().focus().toggleBold().run(),
        active: editor.isActive('bold'),
      },
      {
        icon: <Italic size={14} />,
        title: 'Italic',
        action: () => editor.chain().focus().toggleItalic().run(),
        active: editor.isActive('italic'),
      },
      {
        icon: <UnderlineIcon size={14} />,
        title: 'Underline',
        action: () => editor.chain().focus().toggleUnderline().run(),
        active: editor.isActive('underline'),
      },
      {
        icon: <Strikethrough size={14} />,
        title: 'Strikethrough',
        action: () => editor.chain().focus().toggleStrike().run(),
        active: editor.isActive('strike'),
      },
      {
        icon: <Code size={14} />,
        title: 'Inline code',
        action: () => editor.chain().focus().toggleCode().run(),
        active: editor.isActive('code'),
      },
    ],
    [
      {
        icon: <List size={14} />,
        title: 'Bullet list',
        action: () => editor.chain().focus().toggleBulletList().run(),
        active: editor.isActive('bulletList'),
      },
      {
        icon: <ListOrdered size={14} />,
        title: 'Ordered list',
        action: () => editor.chain().focus().toggleOrderedList().run(),
        active: editor.isActive('orderedList'),
      },
      {
        icon: <Quote size={14} />,
        title: 'Blockquote',
        action: () => editor.chain().focus().toggleBlockquote().run(),
        active: editor.isActive('blockquote'),
      },
      {
        icon: <Minus size={14} />,
        title: 'Divider',
        action: () => editor.chain().focus().setHorizontalRule().run(),
        active: false,
      },
    ],
  ];

  return (
    <div
      className={cn(
        'border border-input rounded-md bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        className,
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-input bg-muted/30 rounded-t-md">
        {groups.map((group, gi) => (
          <React.Fragment key={group[0]?.title ?? `group-${gi}`}>
            {gi > 0 && <div className="w-px h-4 bg-border mx-1" />}
            {group.map((btn) => (
              <ToolbarButton
                key={btn.title}
                onClick={btn.action}
                active={btn.active}
                title={btn.title}
              >
                {btn.icon}
              </ToolbarButton>
            ))}
          </React.Fragment>
        ))}
        <div className="ml-auto text-[10px] text-muted-foreground hidden sm:block">
          @ to mention
        </div>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} className="rich-text-editor px-3 py-3 min-h-[200px] text-sm" />
    </div>
  );
};
