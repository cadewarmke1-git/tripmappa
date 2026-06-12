import { useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import PlacePhotoOrIcon from "./PlacePhotoOrIcon.jsx";
import { buildJourneyTimelineFromWaypoints } from "../../lib/buildJourneyTimeline.js";
import { getSortableStopIds } from "../../lib/itineraryWaypoints.js";

function formatMetaLine(stop, showTruckWarnings = false) {
  const parts = [stop.category || stop.type, null, stop.distance || stop.distanceFromRoute != null
    ? (typeof stop.distanceFromRoute === "number" ? `${stop.distanceFromRoute} mi` : stop.distanceFromRoute)
    : null];
  if (stop.rating != null) parts[1] = `${stop.rating}★`;
  if (showTruckWarnings && stop.truckParking === false && /food|rest|dining/i.test(String(stop.category || ""))) {
    parts.push("Limited truck parking");
  }
  return parts.filter(Boolean).join(" · ");
}

function StopActions({
  stop,
  isStopAdded,
  onAddRoadStop,
  onRemoveRoadStop,
  onLodgingSelect,
  onNavigateToStop,
  onToast,
}) {
  const added = isStopAdded?.(stop);
  const isOvernight = stop.type === "overnight";
  return (
    <div className="journey-timeline-actions">
      <button
        type="button"
        className="journey-timeline-action-btn journey-timeline-action-primary"
        onClick={(e) => {
          e.stopPropagation();
          onNavigateToStop?.(stop);
        }}
      >
        Navigate
      </button>
      {!isOvernight && stop.action === "add" && (
        <button
          type="button"
          className="journey-timeline-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            if (added) onRemoveRoadStop?.(stop);
            else onAddRoadStop?.(stop);
          }}
        >
          {added ? "Remove from trip" : "Add to trip"}
        </button>
      )}
      {isOvernight && (
        <button
          type="button"
          className="journey-timeline-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            onLodgingSelect?.(stop.stopData);
            onToast?.("Opening booking options…");
          }}
        >
          Book stay
        </button>
      )}
    </div>
  );
}

function SortableTimelineRow(props) {
  const { row, sortable } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id, disabled: !sortable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.88 : 1,
    zIndex: isDragging ? 2 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TimelineRowInner {...props} dragHandleProps={sortable ? { ...attributes, ...listeners } : null} />
    </div>
  );
}

function TimelineRowInner({
  row,
  rowIndex,
  expandedId,
  onToggle,
  stopRefs,
  highlightedStopId,
  onStopSelect,
  restaurantsByCity,
  isStopAdded,
  onAddRoadStop,
  onRemoveRoadStop,
  onLodgingSelect,
  onNavigateToStop,
  onToast,
  dragHandleProps = null,
  showTruckWarnings = false,
}) {
  if (row.kind === "drive") {
    const label = [row.duration, row.miles].filter(Boolean).join(" · ");
    if (!label) return null;
    return (
      <div className="journey-timeline-drive" aria-hidden="true">
        <span className="journey-timeline-drive-line" />
        <span className="journey-timeline-drive-text">{label}</span>
        <span className="journey-timeline-drive-line" />
      </div>
    );
  }

  if (row.kind === "destination") {
    const expanded = expandedId === row.id;
    return (
      <div
        className="journey-timeline-row journey-timeline-row-destination"
        data-testid="journey-timeline-destination"
      >
        <div className="journey-timeline-node journey-timeline-node-destination" aria-hidden="true" />
        <button
          type="button"
          className="journey-timeline-row-main"
          onClick={() => onToggle(row.id)}
          aria-expanded={expanded}
        >
          <div className="journey-timeline-row-text">
            <span className="journey-timeline-name journey-timeline-name-destination">{row.title}</span>
            <span className="journey-timeline-meta">
              Destination{row.arrivalTime ? ` · Arrive ${row.arrivalTime}` : ""}
            </span>
          </div>
          <span className="journey-timeline-chevron" aria-hidden="true">{expanded ? "▾" : "›"}</span>
        </button>
        {expanded && (
          <div className="journey-timeline-expanded">
            <p className="journey-timeline-desc">You made it — enjoy {row.title}.</p>
            <StopActions stop={{ id: row.id, type: "destination", title: row.title }} onNavigateToStop={onNavigateToStop} />
          </div>
        )}
      </div>
    );
  }

  const stop = row.stop;
  const expanded = expandedId === row.id;
  const highlighted = highlightedStopId === stop.id;

  return (
    <div
      ref={el => { if (stopRefs && stop.id) stopRefs.current[stop.id] = el; }}
      className={`journey-timeline-row journey-timeline-row-sortable${row.isOvernight ? " journey-timeline-row-overnight" : ""}${highlighted ? " journey-timeline-row-highlighted" : ""}`}
      data-stop-id={stop.id}
    >
      <div className={`journey-timeline-node${row.isOvernight ? " journey-timeline-node-overnight" : ""}`} aria-hidden="true" />
      <div className="journey-timeline-row-body">
      {dragHandleProps && (
        <button
          type="button"
          className="journey-timeline-drag-handle"
          aria-label="Drag to reorder stop"
          {...dragHandleProps}
        >
          ⠿
        </button>
      )}
      <button
        type="button"
        className="journey-timeline-row-main"
        onClick={() => {
          onToggle(row.id);
          onStopSelect?.(stop);
        }}
        aria-expanded={expanded}
      >
        <div className="journey-timeline-thumb">
          <PlacePhotoOrIcon
            photoUrl={stop.photoUrl}
            name={stop.title}
            category={stop.category}
            imgClassName="journey-timeline-photo"
            displayPx={64}
          />
        </div>
        <div className="journey-timeline-row-text">
          <span className={`journey-timeline-name${row.isOvernight ? " journey-timeline-name-overnight" : ""}`}>
            {stop.title}
          </span>
          <span className="journey-timeline-meta">{formatMetaLine(stop, showTruckWarnings)}</span>
        </div>
        <span className="journey-timeline-chevron" aria-hidden="true">{expanded ? "▾" : "›"}</span>
      </button>
      </div>
      {expanded && (
        <div className="journey-timeline-expanded">
          <p className="journey-timeline-desc">{stop.description}</p>
          <StopActions
            stop={stop}
            isStopAdded={isStopAdded}
            onAddRoadStop={onAddRoadStop}
            onRemoveRoadStop={onRemoveRoadStop}
            onLodgingSelect={onLodgingSelect}
            onNavigateToStop={onNavigateToStop}
            onToast={onToast}
          />
        </div>
      )}
    </div>
  );
}

export default function JourneyTimeline({
  waypoints = [],
  routeLegs = [],
  stopRefs,
  highlightedStopId,
  expandedStopId = null,
  onExpandedStopIdChange,
  onStopSelect,
  onReorder,
  restaurantsByCity,
  isStopAdded,
  onAddRoadStop,
  onRemoveRoadStop,
  onLodgingSelect,
  onNavigateToStop,
  onToast,
  showTruckWarnings = false,
}) {
  const expandedId = expandedStopId;
  const setExpandedId = onExpandedStopIdChange || (() => {});

  const rows = useMemo(
    () => buildJourneyTimelineFromWaypoints(waypoints, { routeLegs }),
    [waypoints, routeLegs],
  );

  const sortableIds = useMemo(() => getSortableStopIds(waypoints), [waypoints]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder?.(String(active.id), String(over.id));
  }

  let visualIndex = 0;
  const rowNodes = rows.map((row) => {
    const rowIndex = row.kind === "drive" ? null : visualIndex++;
    const content = row.kind === "stop" && row.sortable ? (
      <SortableTimelineRow
        key={row.id}
        row={row}
        sortable
        rowIndex={rowIndex ?? 0}
        expandedId={expandedId}
        onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
        stopRefs={stopRefs}
        highlightedStopId={highlightedStopId}
        onStopSelect={onStopSelect}
        restaurantsByCity={restaurantsByCity}
        isStopAdded={isStopAdded}
        onAddRoadStop={onAddRoadStop}
        onRemoveRoadStop={onRemoveRoadStop}
        onLodgingSelect={onLodgingSelect}
        onNavigateToStop={onNavigateToStop}
        onToast={onToast}
        showTruckWarnings={showTruckWarnings}
      />
    ) : (
      <TimelineRowInner
        key={row.id}
        row={row}
        rowIndex={rowIndex ?? 0}
        expandedId={expandedId}
        onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
        stopRefs={stopRefs}
        highlightedStopId={highlightedStopId}
        onStopSelect={onStopSelect}
        restaurantsByCity={restaurantsByCity}
        isStopAdded={isStopAdded}
        onAddRoadStop={onAddRoadStop}
        onRemoveRoadStop={onRemoveRoadStop}
        onLodgingSelect={onLodgingSelect}
        onNavigateToStop={onNavigateToStop}
        onToast={onToast}
        showTruckWarnings={showTruckWarnings}
      />
    );
    return content;
  });

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div className="journey-timeline" aria-label="Journey timeline">
          {rowNodes}
        </div>
      </SortableContext>
    </DndContext>
  );
}
