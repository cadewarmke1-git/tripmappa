import { useEffect, useRef } from "react";

/** Focus first control and close on Escape for modal dialogs. */
export function useDialogA11y(open, onClose, titleId) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const focusTarget = dialog?.querySelector(
      "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href]",
    );
    focusTarget?.focus();

    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose?.();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.focus) previousFocus.focus();
    };
  }, [open, onClose, titleId]);

  return dialogRef;
}
