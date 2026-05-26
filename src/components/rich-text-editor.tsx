"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@/components/ui/button";
import { Bold, Italic, List, ListOrdered, Heading2, Strikethrough, Quote, Undo, Redo } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
}

function ToolbarButton({
  active,
  onClick,
  disabled,
  children,
  label,
}: {
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "ghost"}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="h-8 w-8 p-0"
    >
      {children}
    </Button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-1 border-b p-1 bg-muted/30 flex-wrap">
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="Bold"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="Italic"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        label="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <div className="w-px h-6 bg-border mx-1" />
      <ToolbarButton
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        label="Heading"
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label="Bullet List"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        label="Ordered List"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        label="Blockquote"
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <div className="w-px h-6 bg-border mx-1" />
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        label="Undo"
      >
        <Undo className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        label="Redo"
      >
        <Redo className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = 160,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "rich-editor-content max-w-none focus:outline-none p-3",
          className,
        ),
        style: `min-height: ${minHeight}px;`,
        "data-placeholder": placeholder ?? "",
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      const isEmpty = !value || value === "<p></p>";
      const currentEmpty = editor.isEmpty;
      if (isEmpty && currentEmpty) return;
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="border rounded-md overflow-hidden bg-background">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
