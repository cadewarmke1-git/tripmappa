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

    if (isNativeDialog) {
      if (open) {
        if (!dialog.open) {
          if (modal) dialog.showModal();
          else dialog.show();
        }
      } else if (dialog.open) {
        programmaticCloseRef.current = true;
        dialog.close();
        programmaticCloseRef.current = false;
      }
    }

    function handleCancel(e) {
      e.preventDefault();
      onCloseRef.current?.();
    }

    function handleClose() {
      if (programmaticCloseRef.current) return;
      onCloseRef.current?.();
    }

    if (isNativeDialog) {
      dialog.addEventListener("cancel", handleCancel);
      dialog.addEventListener("close", handleClose);
    }
    return () => {
      if (isNativeDialog) {
        dialog.removeEventListener("cancel", handleCancel);
        dialog.removeEventListener("close", handleClose);
        if (dialog.open) {
          programmaticCloseRef.current = true;
          dialog.close();
          programmaticCloseRef.current = false;
        }
      }
    };
  }, [open, modal]);

  useEffect(() => {
    if (!open) return undefined;

    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const focusTarget = dialog?.querySelector(
      "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href]",
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
      if (previousFocus?.focus) previousFocus.focus();
    };
  }, [open, onClose, titleId]);

  return dialogRef;
}
