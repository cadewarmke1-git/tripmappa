export default function GroceryModal({ city, groceryInput, groceryItems, onInputChange, onAddItem, onClose, onPlaceOrder }) {
  return (
    <div className="modal">
      <div className="modal-title">Grocery delivery</div>
      <div className="modal-sub">Delivered to your hotel in {city}</div>
      <div className="grocery-input-row">
        <input
          className="grocery-input"
          placeholder="Add item…"
          value={groceryInput}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && groceryInput.trim() && onAddItem()}
        />
        <button type="button" className="modal-btn modal-btn-primary" style={{ flex: "none", padding: "0 14px", borderRadius: 7 }} onClick={onAddItem}>Add</button>
      </div>
      <ul className="grocery-list">
        {groceryItems.length === 0 && <li style={{ color: "var(--muted)", fontSize: 12, padding: "8px 0" }}>No items yet</li>}
        {groceryItems.map((item, i) => <li className="grocery-item" key={i}>{item}</li>)}
      </ul>
      <div className="modal-footer">
        <button type="button" className="modal-btn modal-btn-outline" onClick={onClose}>Cancel</button>
        <button type="button" className="modal-btn modal-btn-primary" onClick={onPlaceOrder}>Place order</button>
      </div>
    </div>
  );
}
