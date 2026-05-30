export default function Toast({ message, isGold, isError = false, actionLabel, onAction }) {
  if (!message) return null;
  return (
    <div
      className={`toast${isGold ? " toast-gold" : ""}${isError ? " toast-error" : ""}${actionLabel ? " toast-with-action" : ""}`}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
    >
      <span className="toast-message">{message}</span>
      {actionLabel && onAction && (
        <button type="button" className="toast-action" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}
