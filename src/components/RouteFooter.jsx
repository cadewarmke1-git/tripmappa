import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Autocomplete } from "@react-google-maps/api";
import { isWaterVehicle } from "../lib/vehicles.js";

export default function RouteFooter({
  isLoaded,
  origin,
  dest,
  answers,
  timingMode,
  arriveByDate,
  originRef,
  destRef,
  onSwap,
  onFetchDirections,
  onSetOrigin,
  onSetDest,
  onSetTimingMode,
  onSetArriveByDate,
}) {
  const [showTimingMenu, setShowTimingMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const timingBtnRef = useRef(null);
  const menuRef = useRef(null);

  const updateMenuPos = useCallback(() => {
    if (!timingBtnRef.current) return;
    const rect = timingBtnRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 6, left: rect.left });
  }, []);

  useEffect(() => {
    if (!showTimingMenu) return;
    updateMenuPos();
    const onReposition = () => updateMenuPos();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [showTimingMenu, updateMenuPos]);

  useEffect(() => {
    if (!showTimingMenu) return;
    const onPointerDown = (e) => {
      if (timingBtnRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setShowTimingMenu(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [showTimingMenu]);

  const selectLeaveNow = () => {
    onSetTimingMode("leave_now");
    setShowTimingMenu(false);
    if (originRef.current?.value && destRef.current?.value && answers.vehicle) {
      onFetchDirections(answers.vehicle);
    }
  };

  const selectArriveBy = () => {
    onSetTimingMode("arrive_by");
    setShowTimingMenu(false);
  };

  return (
    <div className="route-footer">
      <div className="route-fields">
        <div className="route-input-wrap">
          <div className="route-dot"/>
          {isLoaded ? (
            <Autocomplete onPlaceChanged={() => answers.vehicle && onFetchDirections(answers.vehicle)} options={{ types: ["geocode", "establishment"] }}>
              <input ref={originRef} className="route-input" placeholder="Starting from…" defaultValue={origin}/>
            </Autocomplete>
          ) : (
            <input className="route-input" placeholder="Starting from…" value={origin} onChange={e => onSetOrigin(e.target.value)}/>
          )}
        </div>
        <div className="route-divider-wrap">
          <div className="route-divider"/>
          <button type="button" className="route-swap-btn" onClick={onSwap} aria-label="Swap origin and destination">↕</button>
        </div>
        <div className="route-input-wrap">
          <div className="route-dot dest"/>
          {isLoaded ? (
            <Autocomplete onPlaceChanged={() => answers.vehicle && onFetchDirections(answers.vehicle)} options={{ types: ["geocode", "establishment"] }}>
              <input ref={destRef} className="route-input" placeholder="Going to…" defaultValue={dest}/>
            </Autocomplete>
          ) : (
            <input className="route-input" placeholder="Going to…" value={dest} onChange={e => onSetDest(e.target.value)}/>
          )}
        </div>
      </div>
      <div className="route-timing-wrap">
        <button
          ref={timingBtnRef}
          type="button"
          className="route-timing-btn"
          aria-expanded={showTimingMenu}
          aria-haspopup="menu"
          onClick={() => {
            setShowTimingMenu(open => {
              if (!open) updateMenuPos();
              return !open;
            });
          }}
        >
          {timingMode === "leave_now" ? "Leave now" : arriveByDate ? `Arrive by ${new Date(arriveByDate).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "Arrive by"} ▾
        </button>
        {showTimingMenu && createPortal(
          <div
            ref={menuRef}
            className="timing-menu-fixed"
            role="menu"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <button type="button" role="menuitem" className={`timing-menu-fixed-item${timingMode === "leave_now" ? " active" : ""}`} onClick={selectLeaveNow}>Leave now</button>
            <button type="button" role="menuitem" className={`timing-menu-fixed-item${timingMode === "arrive_by" ? " active" : ""}`} onClick={selectArriveBy}>Arrive by</button>
          </div>,
          document.body,
        )}
        {timingMode === "arrive_by" && (
          <input
            type="datetime-local"
            className="route-arrive-picker"
            value={arriveByDate}
            min={new Date().toISOString().slice(0, 16)}
            onChange={e => { onSetArriveByDate(e.target.value); if (e.target.value && originRef.current?.value && destRef.current?.value && answers.vehicle) onFetchDirections(answers.vehicle); }}
            aria-label="Arrive by date and time"
          />
        )}
      </div>
      {isWaterVehicle(answers.vehicle) && (
        <div className="water-route-note">Routing is approximate — Google Maps does not support marine routes.</div>
      )}
    </div>
  );
}
