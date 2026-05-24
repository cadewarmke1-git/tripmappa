export default function ThemeToggle({ theme, onToggle }) {
  return (
    <button
      type="button"
      className="theme-test-btn"
      onClick={onToggle}
      title="Override automatic day/night detection for this session"
      aria-label={theme === "day" ? "Switch to night mode" : "Switch to day mode"}
    >
      {theme === "day" ? "☀️" : "🌙"}
    </button>
  );
}
