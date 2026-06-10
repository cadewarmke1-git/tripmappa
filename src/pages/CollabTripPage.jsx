import { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext.jsx";
import BrandWordmark from "../components/BrandWordmark.jsx";
import CollaborationPanel from "../components/CollaborationPanel.jsx";
import { fetchCollaboration, parseCollabToken } from "../lib/collaborationApi.js";

export default function CollabTripPage({ toast }) {
  const { theme } = useTheme();
  const token = parseCollabToken();
  const [collaboration, setCollaboration] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("Invalid collaboration link");
      setLoading(false);
      return;
    }
    fetchCollaboration(token)
      .then(data => setCollaboration(data.collaboration))
      .catch(err => setError(err.message || "Could not load collaboration"))
      .finally(() => setLoading(false));
  }, [token]);

  const snapshot = collaboration?.tripSnapshot || {};

  return (
    <div className={`app-wrap collab-page ${theme}`}>
      <header className="collab-page-header">
        <a href="/" className="collab-page-home" aria-label="TripMappa home">
          <BrandWordmark />
        </a>
      </header>
      <main className="collab-page-main">
        {loading && <p className="collab-page-status">Loading group trip…</p>}
        {error && <p className="collab-page-error" role="alert">{error}</p>}
        {!loading && !error && collaboration && (
          <>
            <h1 className="collab-page-title">Group trip review</h1>
            <p className="collab-page-route">
              {(snapshot.origin || "Origin")} → {(snapshot.dest || snapshot.destination || "Destination")}
            </p>
            <CollaborationPanel
              open
              embedded
              onClose={() => { window.location.href = "/"; }}
              collaboration={collaboration}
              onCollaborationChange={setCollaboration}
              tripSnapshot={snapshot}
              isOrganizer={false}
              onToast={toast}
            />
          </>
        )}
      </main>
    </div>
  );
}
