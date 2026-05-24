export default function Toast({ message, isGold }) {
  if (!message) return null;
  return <div className={`toast${isGold ? " toast-gold" : ""}`}>{message}</div>;
}
