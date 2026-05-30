export default function ModalCloseButton({ onClose, label = "Close dialog" }) {
  return (
    <button type="button" className="modal-close-btn" onClick={onClose} aria-label={label}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    </button>
  );
}
