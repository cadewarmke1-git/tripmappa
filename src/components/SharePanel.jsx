export default function SharePanel({ onCopyLink, onShareItinerary, hasItinerary = false }) {
  return (
    <div className="share-wrap">
      {hasItinerary && (
        <div className="share-safety-block">
          <div className="share-safety-title">Share My Itinerary for Safety</div>
          <div className="share-safety-sub">
            Generate a read-only link with all stops, hotels, and timing to send a trusted contact before you depart.
          </div>
          <button type="button" className="btn-generate share-safety-btn" onClick={onShareItinerary}>
            Copy safety itinerary link
          </button>
        </div>
      )}
      <div className="share-title">Live sharing</div>
      <div className="share-sub">Share your location in real time. Friends and family get a live map link — no app needed.</div>
      {[{ init: "S", name: "Sarah", status: "live" }, { init: "M", name: "Mom", status: "pending" }].map((p, i) => (
        <div className="person-row" key={i}>
          <div className="avatar">{p.init}</div>
          <div style={{ flex: 1 }}>
            <div className="person-name">{p.name}</div>
            <div className="person-status">
              <span className={`dot dot-${p.status === "live" ? "live" : "pending"}`} />
              {p.status === "live" ? "Watching live" : "Invite pending"}
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="btn-generate" style={{ marginTop: 16 }} onClick={onCopyLink}>Copy share link</button>
    </div>
  );
}
