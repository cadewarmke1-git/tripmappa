import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { submitGroceryOrder } from "../../lib/groceryApi.js";
import {
  buildTripReferenceId,
  computeDestinationArrival,
  defaultScheduledDeliveryTime,
  formatDatetimeLocalValue,
  formatDisplayDateTime,
  normalizeGroceryItemName,
  parseDatetimeLocalValue,
  resolveGroceryDestination,
  splitSpokenGroceryItems,
} from "../../lib/groceryDelivery.js";
import { TIERS, TIER_PRICING, TRAVELER_BENEFITS, getTierPriceLabel } from "../../lib/tiers.js";

function MicIcon({ active }) {
  return (
    <svg
      className={`grocery-mic-icon${active ? " grocery-mic-icon-active" : ""}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"
        fill="currentColor"
      />
      <path
        d="M17 11a5 5 0 0 1-10 0M12 17v3M8 20h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatWindow(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  const sameDay = start.toDateString() === end.toDateString();
  const startStr = start.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const endStr = end.toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    ...(sameDay ? {} : { month: "short", day: "numeric" }),
  });
  return `${startStr} – ${endStr}`;
}

function GroceryCardLocked({ destination, onUpgrade, isGuest = false, onSignIn }) {
  return (
    <div className="grocery-card grocery-card-locked">
      <div className="grocery-card-header">
        <h3 className="grocery-card-title">Grocery delivery</h3>
        <p className="grocery-card-subtitle">
          {isGuest
            ? "Sign in to order groceries to your hotel before you arrive."
            : `Stock your hotel before you arrive. Available on the ${TIER_PRICING[TIERS.TRAVELER].label} plan.`}
        </p>
      </div>
      <ul className="grocery-locked-benefits">
        {TRAVELER_BENEFITS.slice(1).map(item => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className="grocery-meta-field">
        <span className="grocery-meta-label">Delivery address</span>
        <p className="grocery-meta-value">{destination.displayAddress}</p>
      </div>
      {isGuest ? (
        <button type="button" className="grocery-btn grocery-btn-primary" onClick={onSignIn}>
          Sign in to continue
        </button>
      ) : (
        <button type="button" className="grocery-btn grocery-btn-primary" onClick={onUpgrade}>
          Upgrade to Traveler — {getTierPriceLabel(TIERS.TRAVELER)}
        </button>
      )}
    </div>
  );
}

export default function GroceryCard({
  origin,
  dest,
  selectedLodging = [],
  stops = [],
  routeInfo,
  departureTime,
  onToast,
  groceryAllowed = false,
  accessToken = null,
  onUpgrade,
  isGuest = false,
  onSignIn,
}) {
  const destination = useMemo(
    () => resolveGroceryDestination({ dest, selectedLodging, stops }),
    [dest, selectedLodging, stops],
  );

  if (!groceryAllowed) {
    return (
      <GroceryCardLocked
        destination={destination}
        onUpgrade={onUpgrade}
        isGuest={isGuest}
        onSignIn={onSignIn}
      />
    );
  }

  return (
    <GroceryCardActive
      origin={origin}
      dest={dest}
      selectedLodging={selectedLodging}
      stops={stops}
      routeInfo={routeInfo}
      departureTime={departureTime}
      onToast={onToast}
      accessToken={accessToken}
      destination={destination}
    />
  );
}

function GroceryCardActive({
  origin,
  dest,
  selectedLodging = [],
  stops = [],
  routeInfo,
  departureTime,
  onToast,
  accessToken,
  destination,
}) {

  const tripId = useMemo(
    () => buildTripReferenceId({ origin, dest, departureTime }),
    [origin, dest, departureTime],
  );

  const defaultScheduled = useMemo(() => {
    const arrival = computeDestinationArrival({ departureTime, routeInfo });
    return defaultScheduledDeliveryTime(arrival);
  }, [departureTime, routeInfo]);

  const [items, setItems] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [scheduledTime, setScheduledTime] = useState(() => formatDatetimeLocalValue(defaultScheduled));
  const [confirmation, setConfirmation] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);

  const recognitionRef = useRef(null);
  const lastOrderRef = useRef(null);
  const addedTranscriptRef = useRef("");

  useEffect(() => {
    setScheduledTime(formatDatetimeLocalValue(defaultScheduled));
  }, [defaultScheduled]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(Boolean(SpeechRecognition));
    if (!SpeechRecognition) return undefined;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript || "";
        if (result.isFinal) finalChunk += text;
        else interim += text;
      }
      setInterimText(interim.trim());

      if (finalChunk.trim()) {
        const combined = `${addedTranscriptRef.current} ${finalChunk}`.trim();
        addedTranscriptRef.current = combined;
        const spokenItems = splitSpokenGroceryItems(finalChunk);
        if (spokenItems.length) {
          setItems(prev => {
            const seen = new Set(prev.map(i => i.toLowerCase()));
            const next = [...prev];
            spokenItems.forEach(raw => {
              const name = normalizeGroceryItemName(raw);
              if (name && !seen.has(name.toLowerCase())) {
                seen.add(name.toLowerCase());
                next.push(name);
              }
            });
            return next;
          });
        }
      }
    };

    recognition.onerror = () => {
      setListening(false);
      setInterimText("");
    };

    recognition.onend = () => {
      setListening(false);
      setInterimText("");
      addedTranscriptRef.current = "";
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, []);

  const addItem = useCallback((raw) => {
    const name = normalizeGroceryItemName(raw);
    if (!name) return;
    setItems(prev => {
      if (prev.some(i => i.toLowerCase() === name.toLowerCase())) return prev;
      return [...prev, name];
    });
  }, []);

  function handleManualAdd() {
    if (!inputValue.trim()) return;
    addItem(inputValue);
    setInputValue("");
  }

  function handleRemoveItem(index) {
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  function handleClearAll() {
    setItems([]);
    setInputValue("");
    setInterimText("");
  }

  function startListening() {
    if (!speechSupported || !recognitionRef.current || listening) return;
    addedTranscriptRef.current = "";
    setInterimText("");
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch {
      onToast?.("Microphone is already active.");
    }
  }

  function stopListening() {
    if (!recognitionRef.current || !listening) return;
    recognitionRef.current.stop();
    setListening(false);
    setInterimText("");
    addedTranscriptRef.current = "";
  }

  async function placeOrder(fulfillmentMode = "delivery") {
    if (!items.length) {
      onToast?.("Add at least one item to your list.");
      return;
    }
    const scheduled = parseDatetimeLocalValue(scheduledTime) || defaultScheduled;
    const payload = {
      items,
      address: destination.instacartAddress,
      scheduledTime: scheduled.toISOString(),
      tripId,
      fulfillmentMode,
      hotelName: destination.hotelName,
      accessToken,
    };

    setSubmitting(true);
    try {
      const result = await submitGroceryOrder(payload);
      lastOrderRef.current = payload;
      setConfirmation(result);
      onToast?.(fulfillmentMode === "pickup" ? "Pickup order confirmed." : "Grocery order confirmed.");
    } catch (err) {
      onToast?.(err.message || "Could not place order.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePickupFallback() {
    if (!lastOrderRef.current) return;
    setSubmitting(true);
    try {
      const result = await submitGroceryOrder({
        ...lastOrderRef.current,
        fulfillmentMode: "pickup",
      });
      setConfirmation(result);
      onToast?.("Switched to store pickup.");
    } catch (err) {
      onToast?.(err.message || "Could not switch to pickup.");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmation) {
    const isPickup = confirmation.fulfillmentMode === "pickup";
    return (
      <div className="grocery-card grocery-card-confirmation">
        <div className="grocery-card-header">
          <h3 className="grocery-card-title">
            {isPickup ? "Pickup confirmed" : "Delivery confirmed"}
          </h3>
          <p className="grocery-card-subtitle">{confirmation.storeName}</p>
        </div>
        <dl className="grocery-confirm-details">
          <div className="grocery-confirm-row">
            <dt>Order ID</dt>
            <dd>{confirmation.orderId}</dd>
          </div>
          <div className="grocery-confirm-row">
            <dt>{isPickup ? "Pickup location" : "Delivery address"}</dt>
            <dd>{confirmation.deliveryAddress}</dd>
          </div>
          <div className="grocery-confirm-row">
            <dt>Scheduled time</dt>
            <dd>{formatDisplayDateTime(new Date(confirmation.scheduledTime))}</dd>
          </div>
          <div className="grocery-confirm-row">
            <dt>{isPickup ? "Estimated pickup window" : "Estimated delivery window"}</dt>
            <dd>
              {formatWindow(
                confirmation.estimatedDeliveryWindow?.start,
                confirmation.estimatedDeliveryWindow?.end,
              )}
            </dd>
          </div>
        </dl>
        {!isPickup && (
          <button
            type="button"
            className="grocery-btn grocery-btn-secondary"
            onClick={handlePickupFallback}
            disabled={submitting}
          >
            Switch to store pickup
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grocery-card">
      <div className="grocery-card-header">
        <h3 className="grocery-card-title">Grocery delivery</h3>
        <p className="grocery-card-subtitle">
          Build your list by voice or type items below. Groceries go to your hotel at the destination.
        </p>
      </div>

      <div className="grocery-voice-block">
        <button
          type="button"
          className={`grocery-mic-btn${listening ? " grocery-mic-btn-active" : ""}`}
          onPointerDown={startListening}
          onPointerUp={stopListening}
          onPointerLeave={stopListening}
          onPointerCancel={stopListening}
          disabled={!speechSupported}
          aria-pressed={listening}
          aria-label={listening ? "Release to stop listening" : "Hold to speak your grocery list"}
        >
          <MicIcon active={listening} />
          <span className="grocery-mic-label">
            {listening ? "Listening… release to stop" : "Hold to speak"}
          </span>
        </button>
        {!speechSupported && (
          <p className="grocery-voice-hint">Voice input is not supported in this browser. Type items below.</p>
        )}
        {interimText && (
          <p className="grocery-interim-text" aria-live="polite">{interimText}</p>
        )}
      </div>

      <ul className="grocery-list grocery-card-list">
        {items.length === 0 && (
          <li className="grocery-item grocery-item-empty">No items yet — hold the mic or type below.</li>
        )}
        {items.map((item, index) => (
          <li className="grocery-item grocery-item-row" key={`${item}-${index}`}>
            <span className="grocery-item-name">{item}</span>
            <button
              type="button"
              className="grocery-item-remove"
              onClick={() => handleRemoveItem(index)}
              aria-label={`Remove ${item}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      {items.length > 0 && (
        <button type="button" className="grocery-clear-btn" onClick={handleClearAll}>
          Clear all
        </button>
      )}

      <div className="grocery-input-row">
        <input
          className="grocery-input"
          placeholder="Type an item and press Enter"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleManualAdd();
            }
          }}
        />
        <button type="button" className="grocery-btn grocery-btn-add" onClick={handleManualAdd}>
          Add
        </button>
      </div>

      <div className="grocery-delivery-meta">
        <div className="grocery-meta-field">
          <label className="grocery-meta-label" htmlFor="grocery-delivery-address">Delivery address</label>
          <p id="grocery-delivery-address" className="grocery-meta-value">{destination.displayAddress}</p>
        </div>
        <div className="grocery-meta-field">
          <label className="grocery-meta-label" htmlFor="grocery-scheduled-time">Scheduled delivery</label>
          <input
            id="grocery-scheduled-time"
            type="datetime-local"
            className="grocery-datetime-input"
            value={scheduledTime}
            onChange={e => setScheduledTime(e.target.value)}
          />
          <p className="grocery-meta-hint">
            Defaults to one hour before your estimated arrival at the destination.
          </p>
        </div>
      </div>

      <button
        type="button"
        className="grocery-btn grocery-btn-primary"
        onClick={() => placeOrder("delivery")}
        disabled={submitting || !items.length}
      >
        {submitting ? "Placing order…" : "Place grocery order"}
      </button>
    </div>
  );
}
