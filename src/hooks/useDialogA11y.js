import { useEffect, useRef } from "react";

/** Focus first control, trap Tab, and close on Escape for modal dialogs. */
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

    function getFocusableElements() {
      if (!dialog) return [];
      return Array.from(dialog.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter(el => !el.hasAttribute("disabled"));
    }

    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
        return;
      }
      // Trap Tab focus inside the dialog so keyboard users cannot tab onto the map behind it.
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
