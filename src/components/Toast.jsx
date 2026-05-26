export default function Toast({ message, isGold, actionLabel, onAction }) {
  if (!message) return null;
  return (
    <div className={`toast${isGold ? " toast-gold" : ""}${actionLabel ? " toast-with-action" : ""}`} role="status">
      <span className="toast-message">{message}</span>
      {actionLabel && onAction && (
        <button type="button" className="toast-action" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}
