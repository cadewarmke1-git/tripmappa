import { OWNER_COLOR } from "../../lib/convoyConstants.js";

export default function ConvoyMemberList({ owner, convoyMembers = [], compact = false }) {
  const members = [];
  if (owner?.name) {
    members.push({
      id: "owner",
      name: owner.name,
      color: OWNER_COLOR,
      speedMph: owner.speedMph,
      distanceToDest: owner.distanceToDest,
      isOwner: true,
    });
  }
  members.push(...convoyMembers);

  if (!members.length) {
    return compact ? null : (
      <div className="convoy-member-empty">No convoy members yet.</div>
    );
  }

  return (
    <div className={`convoy-member-list${compact ? " convoy-member-list-compact" : ""}`}>
      {members.map(m => (
        <div key={m.id} className="convoy-member-row">
          <span className="convoy-member-dot" style={{ background: m.color }} aria-hidden="true" />
          <div className="convoy-member-info">
            <div className="convoy-member-name">
              {m.name}{m.isOwner ? " (Trip leader)" : ""}
            </div>
            <div className="convoy-member-meta">
              {m.speedMph != null ? `${m.speedMph} mph` : "— mph"}
              {" · "}
              {m.distanceToDest || "—"} to destination
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
