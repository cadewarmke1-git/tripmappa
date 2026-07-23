import { useEffect, useRef } from "react";

/** Focus first control, trap Tab, and open/close native `<dialog>` with a11y. */
export function useDialogA11y(open, onClose, titleId, { modal = true } = {}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const programmaticCloseRef = useRef(false);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const isNativeDialog = typeof dialog.show === "function" && dialog.tagName === "DIALOG";
    let ignoreCloseUntil = 0;

    function armProgrammaticClose() {
      programmaticCloseRef.current = true;
      // Stay armed past Strict Mode remount + async `close` delivery so an
      // effect-cleanup close never looks like a user dismiss.
      ignoreCloseUntil = Date.now() + 100;
      window.setTimeout(() => {
        if (Date.now() >= ignoreCloseUntil) programmaticCloseRef.current = false;
      }, 100);
    }

    if (isNativeDialog) {
      if (open) {
        if (!dialog.open) {
          armProgrammaticClose();
          if (modal) dialog.showModal();
          else dialog.show();
        }
      } else if (dialog.open) {
        armProgrammaticClose();
        dialog.close();
      }
    }

    function handleCancel(e) {
      e.preventDefault();
      if (programmaticCloseRef.current || Date.now() < ignoreCloseUntil) return;
      onCloseRef.current?.();
    }

    function handleClose() {
      if (programmaticCloseRef.current || Date.now() < ignoreCloseUntil) return;
      onCloseRef.current?.();
    }

    if (isNativeDialog) {
      dialog.addEventListener("cancel", handleCancel);
      dialog.addEventListener("close", handleClose);
    }
    return () => {
      if (isNativeDialog) {
        armProgrammaticClose();
        dialog.removeEventListener("cancel", handleCancel);
        dialog.removeEventListener("close", handleClose);
        if (dialog.open) dialog.close();
      }
    };
  }, [open, modal]);

  // Initial focus + Tab trap. Depend only on `open` so parent re-renders
  // (new onClose / titleId refs, controlled input keystrokes) do not steal focus.
  useEffect(() => {
    if (!open) return undefined;

    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    // Prefer a text field so we don't bounce focus onto the close button.
    const focusTarget = dialog?.querySelector(
      "input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href]",
    );
    focusTarget?.focus();

    function getFocusableElements() {
      if (!dialog) return [];
      return Array.from(dialog.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter(el => !el.hasAttribute("disabled"));
    }

    function onKeyDown(e) {
      if (e.key !== "Tab") return;
      const focusable = getFocusableElements();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      // Don't yank focus out of a still-open modal dialog (Strict Mode cleanup
      // used to restore outside focus while showModal was active).
      const stillOpen = dialogRef.current?.open;
      if (!stillOpen && previousFocus?.focus) previousFocus.focus();
    };
  }, [open]);

  return dialogRef;
}
