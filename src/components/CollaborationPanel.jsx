import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createCollaboration,
  getOrCreateParticipantId,
  inviteToCollaboration,
  submitCollabPreferences,
  submitCollabSuggestion,
  submitCollabVote,
} from "../lib/collaborationApi.js";
import { subscribeCollaboration } from "../lib/collaborationRealtime.js";
import {
  listCollabResponders,
  summarizeCollabActivity,
  voteTotalsByStop,
} from "../lib/collaborationHints.js";
import { mapCollaborationFromDb } from "../lib/collaborationApi.js";
import { copyToClipboard } from "../lib/copyToClipboard.js";
import { useDialogA11y } from "../hooks/useDialogA11y.js";
import { roadStopKey } from "../lib/roadStopKeys.js";

function VoteButtons({ stopKey, votes, participantId, displayName, inviteToken, onUpdate }) {
  const myVote = votes?.find(v => v.participantId === participantId && v.stopKey === stopKey)?.vote;
  const summary = useMemo(() => {
    const rows = (votes || []).filter(v => v.stopKey === stopKey);
    return {
      up: rows.filter(v => v.vote === 1).length,
      down: rows.filter(v => v.vote === -1).length,
    };
  }, [votes, stopKey]);

  async function cast(vote) {
    const data = await submitCollabVote({
      inviteToken,
      participantId,
      stopKey,
      vote,
      displayName,
    });
    onUpdate?.(data.collaboration);
  }

  return (
    <div className="collab-vote-row">
      <button
        type="button"
        className={`collab-vote-btn${myVote === 1 ? " is-active" : ""}`}
        onClick={() => void cast(1)}
        aria-label="Thumbs up"
      >
        👍 {summary.up || ""}
      </button>
      <button
        type="button"
        className={`collab-vote-btn${myVote === -1 ? " is-active" : ""}`}
        onClick={() => void cast(-1)}
        aria-label="Thumbs down"
      >
        👎 {summary.down || ""}
      </button>
    </div>
  );
}

export default function CollaborationPanel({
  open,
  onClose,
  collaboration,
  onCollaborationChange,
  accessToken,
  user,
  tripSnapshot,
  activeTripId,
  onRegenerateWithGroup,
  isOrganizer = true,
  embedded = false,
  onToast,
}) {
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [suggestPlace, setSuggestPlace] = useState("");
  const [suggestNote, setSuggestNote] = useState("");
  const [suggestStopIndex, setSuggestStopIndex] = useState("");
  const [dietary, setDietary] = useState("");
  const [travelPrefs, setTravelPrefs] = useState("");
  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Guest",
  );

  const inviteToken = collaboration?.inviteToken;
  const participantId = inviteToken ? getOrCreateParticipantId(inviteToken) : null;
  const stops = tripSnapshot?.stops || collaboration?.tripSnapshot?.stops || [];
  const stats = summarizeCollabActivity(collaboration);
  const responders = useMemo(() => listCollabResponders(collaboration), [collaboration]);
  const voteDashboard = useMemo(
    () => voteTotalsByStop(collaboration?.votes, stops),
    [collaboration?.votes, stops],
  );
  const dialogRef = useDialogA11y(open && !embedded, onClose, "collab-panel-title");

  useEffect(() => {
    if (!open || !inviteToken) return undefined;
    return subscribeCollaboration(inviteToken, row => {
      onCollaborationChange?.(mapCollaborationFromDb(row, collaboration?.collabUrl));
    });
  }, [open, inviteToken, collaboration?.collabUrl, onCollaborationChange]);

  const ensureSession = useCallback(async () => {
    if (collaboration || !accessToken) return collaboration;
    setLoading(true);
    try {
      const data = await createCollaboration(accessToken, {
        tripId: activeTripId,
        tripSnapshot,
      });
      onCollaborationChange?.(data.collaboration);
      return data.collaboration;
    } finally {
      setLoading(false);
    }
  }, [collaboration, accessToken, activeTripId, tripSnapshot, onCollaborationChange]);

  useEffect(() => {
    if (open && isOrganizer && !collaboration && accessToken) {
      void ensureSession();
    }
  }, [open, isOrganizer, collaboration, accessToken, ensureSession]);

  async function handleInvite(e) {
    e.preventDefault();
    const session = collaboration || await ensureSession();
    if (!session) return;
    setLoading(true);
    try {
      const data = await inviteToCollaboration(accessToken, {
        collaborationId: session.id,
        email: inviteEmail,
        phone: invitePhone,
        name: displayName,
      });
      onCollaborationChange?.(data.collaboration);
      setInviteEmail("");
      setInvitePhone("");
      onToast?.("Invite recorded — share the collaboration link");
    } catch (err) {
      onToast?.(err.message, { isError: true });
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyLink() {
    if (!collaboration?.collabUrl) return;
    const ok = await copyToClipboard(collaboration.collabUrl);
    onToast?.(ok ? "Collaboration link copied" : "Could not copy link", { isError: !ok });
  }

  async function handleSuggest(e) {
    e.preventDefault();
    if (!inviteToken || !suggestPlace.trim()) return;
    setLoading(true);
    try {
      const stopIndex = suggestStopIndex === "" ? null : Number(suggestStopIndex);
      const data = await submitCollabSuggestion({
        inviteToken,
        participantId,
        stopIndex: Number.isFinite(stopIndex) ? stopIndex : null,
        placeName: suggestPlace,
        note: suggestNote,
        displayName,
      });
      onCollaborationChange?.(data.collaboration);
      setSuggestPlace("");
      setSuggestNote("");
      onToast?.("Suggestion sent to the group");
    } catch (err) {
      onToast?.(err.message, { isError: true });
    } finally {
      setLoading(false);
    }
  }

  async function handlePrefs(e) {
    e.preventDefault();
    if (!inviteToken) return;
    setLoading(true);
    try {
      const data = await submitCollabPreferences({
        inviteToken,
        participantId,
        dietary,
        travelPreferences: travelPrefs,
        displayName,
      });
      onCollaborationChange?.(data.collaboration);
      onToast?.("Preferences saved for the group");
    } catch (err) {
      onToast?.(err.message, { isError: true });
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const panelBody = (
      <div
        className={`collab-panel${embedded ? " collab-panel--embedded" : ""}`}
        onClick={embedded ? undefined : e => e.stopPropagation()}
      >
        <header className="collab-panel-header">
          <h2 id="collab-panel-title">Trip collaboration</h2>
          <button type="button" className="collab-panel-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        {isOrganizer && (
          <section className="collab-panel-section">
            <p className="collab-panel-lead">
              Invite your group to vote on stops and share preferences. Updates appear live as people respond.
            </p>
            <div className="collab-panel-stats" aria-live="polite">
              <span>{stats.invitees} invited</span>
              <span>{stats.responded} responded</span>
              <span>{stats.votes} votes</span>
              <span>{stats.suggestions} suggestions</span>
            </div>
            {collaboration?.collabUrl && (
              <div className="collab-panel-link-row">
                <input
                  className="collab-panel-link-input"
                  readOnly
                  value={collaboration.collabUrl}
                  aria-label="Collaboration link"
                />
                <button type="button" className="collab-panel-btn collab-panel-btn--gold" onClick={() => void handleCopyLink()}>
                  Copy link
                </button>
              </div>
            )}
            <form className="collab-panel-form" onSubmit={handleInvite}>
              <label className="collab-panel-label">
                Email
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="friend@email.com" />
              </label>
              <label className="collab-panel-label">
                Phone
                <input type="tel" value={invitePhone} onChange={e => setInvitePhone(e.target.value)} placeholder="+1 555 000 0000" />
              </label>
              <button type="submit" className="collab-panel-btn collab-panel-btn--gold" disabled={loading || !accessToken}>
                Add invitee
              </button>
            </form>
            {(collaboration?.invitees?.length > 0) && (
              <ul className="collab-panel-invitees">
                {collaboration.invitees.map(inv => (
                  <li key={inv.id}>
                    {inv.name || inv.email || inv.phone || "Invitee"}
                    {inv.collabUrl && (
                      <span className="collab-panel-muted"> · link sent</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {responders.length > 0 && (
              <div className="collab-responders">
                <h4 className="collab-panel-subtitle">Who responded</h4>
                <ul className="collab-responders-list">
                  {responders.map(r => (
                    <li key={r.participantId}>{r.displayName}</li>
                  ))}
                </ul>
              </div>
            )}
            {voteDashboard.some(v => v.up || v.down) && (
              <div className="collab-vote-dashboard">
                <h4 className="collab-panel-subtitle">Stop votes</h4>
                <ul className="collab-vote-dashboard-list">
                  {voteDashboard.flatMap(v => (v.up || v.down ? [(
                    <li key={v.stopKey}>
                      {v.label}: 👍 {v.up} · 👎 {v.down}
                    </li>
                  )] : []))}
                </ul>
              </div>
            )}
            <button
              type="button"
              className="collab-panel-btn collab-panel-btn--gold collab-panel-regenerate"
              disabled={loading || (!stats.votes && !stats.suggestions && !stats.prefs)}
              onClick={() => onRegenerateWithGroup?.(collaboration)}
            >
              Regenerate with group input
            </button>
          </section>
        )}

        {!isOrganizer && (
          <p className="collab-panel-lead">
            Vote on stops, suggest alternatives, and add your travel preferences for the organizer.
          </p>
        )}

        <section className="collab-panel-section">
          <h3 className="collab-panel-subtitle">Vote on stops</h3>
          <ul className="collab-stop-list">
            {stops.map((stop, i) => (
              <li key={roadStopKey(stop) || `stop-${stop?.name || stop?.city || i}`} className="collab-stop-item">
                <span className="collab-stop-name">{stop?.name || stop?.city || `Stop ${i + 1}`}</span>
                {inviteToken && (
                  <VoteButtons
                    stopKey={`stop-${i}`}
                    votes={collaboration?.votes}
                    participantId={participantId}
                    displayName={displayName}
                    inviteToken={inviteToken}
                    onUpdate={onCollaborationChange}
                  />
                )}
              </li>
            ))}
            {!stops.length && <li className="collab-panel-muted">No stops to vote on yet.</li>}
          </ul>
        </section>

        <section className="collab-panel-section">
          <h3 className="collab-panel-subtitle">Suggest an alternative</h3>
          <form className="collab-panel-form" onSubmit={handleSuggest}>
            {stops.length > 0 && (
              <label className="collab-panel-label">
                Near which stop?
                <select
                  value={suggestStopIndex}
                  onChange={e => setSuggestStopIndex(e.target.value)}
                >
                  <option value="">Anywhere on the route</option>
                  {stops.map((stop, i) => (
                    <option key={roadStopKey(stop) || `stop-${stop?.name || stop?.city || i}`} value={String(i)}>
                      {stop?.name || stop?.city || `Stop ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="collab-panel-label">
              Place name
              <input value={suggestPlace} onChange={e => setSuggestPlace(e.target.value)} placeholder="e.g. Blue Ridge Parkway overlook" required />
            </label>
            <label className="collab-panel-label">
              Note (optional)
              <input value={suggestNote} onChange={e => setSuggestNote(e.target.value)} placeholder="Why this stop?" />
            </label>
            <button type="submit" className="collab-panel-btn" disabled={loading || !inviteToken}>Send suggestion</button>
          </form>
          {(collaboration?.suggestions?.length > 0) && (
            <ul className="collab-suggestion-list">
              {collaboration.suggestions.map(s => (
                <li key={s.id}>
                  <strong>{s.placeName}</strong>
                  {s.note && <> — {s.note}</>}
                  <span className="collab-panel-muted"> · {s.displayName}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="collab-panel-section">
          <h3 className="collab-panel-subtitle">Your preferences</h3>
          <form className="collab-panel-form" onSubmit={handlePrefs}>
            <label className="collab-panel-label">
              Display name
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </label>
            <label className="collab-panel-label">
              Dietary restrictions
              <input value={dietary} onChange={e => setDietary(e.target.value)} placeholder="Vegetarian, nut allergy…" />
            </label>
            <label className="collab-panel-label">
              Travel preferences
              <input value={travelPrefs} onChange={e => setTravelPrefs(e.target.value)} placeholder="Fewer long drives, more scenic routes…" />
            </label>
            <button type="submit" className="collab-panel-btn" disabled={loading || !inviteToken}>Save preferences</button>
          </form>
        </section>
      </div>
  );

  if (embedded) return panelBody;

  return (
    <dialog
      ref={dialogRef}
      className="collab-panel-overlay"
      aria-labelledby="collab-panel-title"
      onClick={onClose}
    >
      {panelBody}
    </dialog>
  );
}
