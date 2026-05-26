"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RichTextEditor } from "@/components/rich-text-editor";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ImageIcon, MessageSquare, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import {
  useListAdminEventMessages,
  useCreateEventMessage,
  useUpdateEventMessage,
  useDeleteEventMessage,
} from "@/lib/api/event-messages";

interface Author {
  id: string;
  name: string | null;
  lastName: string | null;
  image: string | null;
}

interface EventMessage {
  id: number;
  eventId: number;
  authorId: string;
  title: string | null;
  body: string;
  mediaUrls: string[];
  createdAt: string;
  updatedAt: string;
  author: Author;
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function authorName(a: Author): string {
  return [a.name, a.lastName].filter(Boolean).join(" ") || "Unknown";
}

function authorInitial(a: Author): string {
  return (a.name?.[0] || a.lastName?.[0] || "?").toUpperCase();
}

export function MessagesTab({ eventId }: { eventId: string }) {
  const { data, isPending, isError, error } = useListAdminEventMessages({ eventId });

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EventMessage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EventMessage | null>(null);
  const [search, setSearch] = useState("");

  const messages: EventMessage[] = data?.messages ?? [];

  const filtered = search.trim()
    ? messages.filter((m) => {
        const q = search.trim().toLowerCase();
        return (
          m.title?.toLowerCase().includes(q) ||
          m.body.toLowerCase().includes(q)
        );
      })
    : messages;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Messages</h2>
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Message
        </Button>
      </div>

      {isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : isError ? (
        <p className="text-red-500 text-center py-8">
          {(error as Error)?.message ?? "Failed to load messages."}
        </p>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mb-3" />
          <p>No messages yet. Post your first announcement.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Search className="h-12 w-12 mb-3" />
          <p>No messages match &ldquo;{search}&rdquo;</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((m) => (
            <Card key={m.id} className="overflow-hidden p-0 gap-0">
              <div className="bg-muted/60 border-b py-3 px-4 flex items-center gap-3">
                <Avatar className="size-10">
                  {m.author.image && (
                    <AvatarImage src={m.author.image} alt={authorName(m.author)} />
                  )}
                  <AvatarFallback>{authorInitial(m.author)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  {m.title && <p className="font-bold truncate">{m.title}</p>}
                  <p className="text-xs text-muted-foreground">
                    {authorName(m.author)} · {formatFullDate(m.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditTarget(m)}
                    aria-label="Edit message"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget(m)}
                    aria-label="Delete message"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-4 space-y-3">
                <div className="rich-editor-content" dangerouslySetInnerHTML={{ __html: m.body }} />
                {m.mediaUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {m.mediaUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`attachment-${i + 1}`}
                          className="h-32 w-auto rounded-md border object-cover hover:opacity-90 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateDialog
        eventId={eventId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <EditDialog
        eventId={eventId}
        message={editTarget}
        onClose={() => setEditTarget(null)}
      />

      <DeleteDialog
        eventId={eventId}
        message={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

async function uploadMessageImage(eventId: string, file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`/api/admin/event/${eventId}/messages/upload`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.url as string;
}

function ImageAttachments({
  eventId,
  urls,
  onChange,
}: {
  eventId: string;
  urls: string[];
  onChange: (urls: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        Array.from(files).map((f) => uploadMessageImage(eventId, f))
      );
      onChange([...urls, ...uploaded]);
    } catch {
      toast.error("Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Images (optional)</Label>
      <div className="flex flex-wrap gap-2">
        {urls.map((url, i) => (
          <div key={i} className="relative group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-20 w-auto rounded-md border object-cover" />
            <button
              type="button"
              onClick={() => onChange(urls.filter((_, j) => j !== i))}
              className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <label className={`flex items-center gap-1.5 px-3 py-2 border rounded-md text-sm cursor-pointer hover:bg-muted transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
          <ImageIcon className="h-4 w-4" />
          {uploading ? "Uploading..." : "Add Image"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={uploading}
          />
        </label>
      </div>
    </div>
  );
}

function CreateDialog({
  eventId,
  open,
  onOpenChange,
}: {
  eventId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [sendPublic, setSendPublic] = useState(true);
  const [sendBreeders, setSendBreeders] = useState(false);
  const create = useCreateEventMessage({ eventId });

  const reset = () => {
    setTitle("");
    setBody("");
    setMediaUrls([]);
    setSendPublic(true);
    setSendBreeders(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    create.mutate(
      { title: title.trim() || undefined, body, mediaUrls },
      {
        onSuccess: () => {
          toast.success("Message posted");
          reset();
          onOpenChange(false);
        },
        onError: () => toast.error("Post failed"),
      } as never,
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="msg-title">Title (optional)</Label>
            <Input
              id="msg-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="msg-body">Message</Label>
            <RichTextEditor
              value={body}
              onChange={setBody}
              placeholder="Write your message..."
            />
          </div>
          <ImageAttachments eventId={eventId} urls={mediaUrls} onChange={setMediaUrls} />
          <div className="space-y-2">
            <Label>Send To</Label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={sendPublic}
                  onCheckedChange={(v) => setSendPublic(!!v)}
                />
                Public
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={sendBreeders}
                  onCheckedChange={(v) => setSendBreeders(!!v)}
                />
                Active Breeders
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!body.trim() || (!sendPublic && !sendBreeders)}>
              Post
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  eventId,
  message,
  onClose,
}: {
  eventId: string;
  message: EventMessage | null;
  onClose: () => void;
}) {
  return message ? (
    <EditDialogInner eventId={eventId} message={message} onClose={onClose} />
  ) : null;
}

function EditDialogInner({
  eventId,
  message,
  onClose,
}: {
  eventId: string;
  message: EventMessage;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(message.title ?? "");
  const [body, setBody] = useState(message.body);
  const [mediaUrls, setMediaUrls] = useState<string[]>(message.mediaUrls);
  const [sendPublic, setSendPublic] = useState(true);
  const [sendBreeders, setSendBreeders] = useState(false);
  const update = useUpdateEventMessage({ eventId, messageId: message.id });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    update.mutate(
      { title: title.trim() || null, body, mediaUrls },
      {
        onSuccess: () => {
          toast.success("Message updated");
          onClose();
        },
        onError: () => toast.error("Update failed"),
      } as never,
    );
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Message</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-msg-title">Title (optional)</Label>
            <Input
              id="edit-msg-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-msg-body">Message</Label>
            <RichTextEditor
              value={body}
              onChange={setBody}
              placeholder="Write your message..."
            />
          </div>
          <ImageAttachments eventId={eventId} urls={mediaUrls} onChange={setMediaUrls} />
          <div className="space-y-2">
            <Label>Send To</Label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={sendPublic}
                  onCheckedChange={(v) => setSendPublic(!!v)}
                />
                Public
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={sendBreeders}
                  onCheckedChange={(v) => setSendBreeders(!!v)}
                />
                Active Breeders
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!body.trim() || (!sendPublic && !sendBreeders)}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  eventId,
  message,
  onClose,
}: {
  eventId: string;
  message: EventMessage | null;
  onClose: () => void;
}) {
  return message ? (
    <DeleteDialogInner eventId={eventId} message={message} onClose={onClose} />
  ) : null;
}

function DeleteDialogInner({
  eventId,
  message,
  onClose,
}: {
  eventId: string;
  message: EventMessage;
  onClose: () => void;
}) {
  const del = useDeleteEventMessage({ eventId, messageId: message.id });

  const handleDelete = () => {
    del.mutate(undefined as never, {
      onSuccess: () => {
        toast.success("Message deleted");
        onClose();
      },
      onError: () => toast.error("Delete failed"),
    } as never);
  };

  return (
    <AlertDialog open onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete message?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
