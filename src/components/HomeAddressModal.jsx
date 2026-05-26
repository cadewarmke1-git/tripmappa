import { useRef } from "react";
import { Autocomplete } from "@react-google-maps/api";

export default function HomeAddressModal({ isLoaded, initialAddress = "", onSave, onClose }) {
  const inputRef = useRef(null);

  function handleSave() {
    const value = inputRef.current?.value?.trim() || "";
    if (!value) return;
    onSave(value);
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal home-address-modal" onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="home-address-title">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <h2 id="home-address-title" className="home-address-title">Set your home address</h2>
        <p className="home-address-lead">
          We&apos;ll use this as your destination when you tap Navigate Home. It&apos;s saved for next time.
        </p>
        <div className="home-address-field">
          {isLoaded ? (
            <Autocomplete options={{ types: ["geocode"] }}>
              <input
                ref={inputRef}
                className="home-address-input"
                placeholder="123 Main St, Dallas, TX"
                defaultValue={initialAddress}
                onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
              />
            </Autocomplete>
          ) : (
            <input
              ref={inputRef}
              className="home-address-input"
              placeholder="123 Main St, Dallas, TX"
              defaultValue={initialAddress}
              onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
            />
          )}
        </div>
        <button type="button" className="btn-generate home-address-save" onClick={handleSave}>
          Save home address
        </button>
      </div>
    </div>
  );
}
