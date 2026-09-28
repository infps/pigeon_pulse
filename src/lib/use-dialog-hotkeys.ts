"use client";

import { useEffect } from "react";

interface DialogHotkeysOptions {
  /** Whether the dialog/form is open */
  open: boolean;
  /** Enter → save/submit */
  onSave?: () => void;
  /** Ctrl+S → save and new */
  onSaveAndNew?: () => void;
  /** Escape → close (only needed when not using Radix Dialog, which handles Esc natively) */
  onClose?: () => void;
  /** Set true when a mutation is pending to prevent double-submit */
  disabled?: boolean;
}

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "textarea" ||
    (tag === "input" && (el as HTMLInputElement).type !== "checkbox" && (el as HTMLInputElement).type !== "radio") ||
    el.isContentEditable
  );
}

export function useDialogHotkeys({
  open,
  onSave,
  onSaveAndNew,
  onClose,
  disabled = false,
}: DialogHotkeysOptions) {
  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (disabled) return;

      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        onSave?.();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (onSaveAndNew) {
          onSaveAndNew();
        } else {
          onSave?.();
        }
        return;
      }

      if (e.key === "Escape" && onClose) {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onSave, onSaveAndNew, onClose, disabled]);
}
