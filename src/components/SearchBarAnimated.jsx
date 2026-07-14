import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useClickOutside } from "../hooks/useClickOutside.js";

function SearchIcon() {
  return (
    <svg
      className="search-bar-animated-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function assignRef(ref, node) {
  if (!ref) return;
  if (typeof ref === "function") ref(node);
  else ref.current = node;
}

export default function SearchBarAnimated({
  value = "",
  onChange,
  onSubmit,
  placeholder = "Search…",
  ariaLabel = "Search",
  id: idProp,
  name,
  className = "",
  disabled = false,
  inputRef: inputRefProp = null,
  defaultExpanded = false,
}) {
  const autoId = useId();
  const inputId = idProp || autoId;
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [expanded, setExpanded] = useState(() => defaultExpanded || Boolean(value));

  const setInputNode = useCallback((node) => {
    inputRef.current = node;
    assignRef(inputRefProp, node);
  }, [inputRefProp]);

  const collapse = useCallback(() => {
    setExpanded(false);
  }, []);

  useClickOutside(rootRef, collapse, expanded);

  useEffect(() => {
    if (!expanded) return undefined;
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [expanded]);

  function handleToggle() {
    if (disabled) return;
    setExpanded(prev => !prev);
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      onSubmit?.(value);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      collapse();
      inputRef.current?.blur();
    }
  }

  return (
    <div
      ref={rootRef}
      className={`search-bar-animated${expanded ? " is-expanded" : ""}${disabled ? " is-disabled" : ""}${className ? ` ${className}` : ""}`}
    >
      <button
        type="button"
        className="search-bar-animated-toggle"
        aria-label={expanded ? "Close search" : "Open search"}
        aria-expanded={expanded}
        aria-controls={inputId}
        disabled={disabled}
        onClick={handleToggle}
      >
        <SearchIcon />
      </button>
      <input
        ref={setInputNode}
        id={inputId}
        name={name}
        type="search"
        className="search-bar-animated-input"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        tabIndex={expanded ? 0 : -1}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
