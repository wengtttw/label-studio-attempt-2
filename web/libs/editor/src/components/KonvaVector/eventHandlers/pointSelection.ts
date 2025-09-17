import type { KonvaEventObject } from "konva/lib/Node";
import type { EventHandlerProps } from "./types";
import { isPointInHitRadius, stageToImageCoordinates } from "./utils";
import { closePathBetweenFirstAndLast } from "./drawing";
import { VectorSelectionTracker } from "../VectorSelectionTracker";

// Helper function to check if a point click should trigger path closing
export function shouldClosePathOnPointClick(
  pointIndex: number,
  props: EventHandlerProps,
  event: KonvaEventObject<MouseEvent>,
): boolean {
  return (
    (pointIndex === 0 || pointIndex === props.initialPoints.length - 1) &&
    props.allowClose &&
    !props.isPathClosed &&
    !event.evt.shiftKey
  );
}

// Helper function to check if the active point is eligible for path closing
export function isActivePointEligibleForClosing(props: EventHandlerProps): boolean {
  const activePoint =
    props.skeletonEnabled && props.activePointId
      ? props.initialPoints.find((p) => p.id === props.activePointId)
      : props.initialPoints[props.initialPoints.length - 1]; // Fallback to last point

  if (!activePoint) return false;

  const firstPoint = props.initialPoints[0];
  const lastPoint = props.initialPoints[props.initialPoints.length - 1];

  // Only allow closing if the active point is the first or last point
  const isActivePointFirst = activePoint.id === firstPoint.id;
  const isActivePointLast = activePoint.id === lastPoint.id;

  return isActivePointFirst || isActivePointLast;
}

// Helper function to check if cursor is near a closing target
function isNearClosingTarget(cursorPos: { x: number; y: number }, props: EventHandlerProps): boolean {
  if (!props.allowClose || props.isPathClosed) {
    return false;
  }

  // Check if we can close the path based on point count or bezier points
  const canClosePath = () => {
    if (props.initialPoints.length > 2) return true;
    return props.initialPoints.some((point) => point.isBezier);
  };

  if (!canClosePath()) return false;

  // Additional validation: ensure we meet the minimum points requirement
  if (props.minPoints && props.initialPoints.length < props.minPoints) {
    return false;
  }

  const firstPoint = props.initialPoints[0];
  const lastPoint = props.initialPoints[props.initialPoints.length - 1];
  const closeRadius = 15 / (props.transform.zoom * props.fitScale);

  // Get the active point
  const activePoint =
    props.skeletonEnabled && props.activePointId
      ? props.initialPoints.find((p) => p.id === props.activePointId)
      : props.initialPoints[props.initialPoints.length - 1];

  if (!activePoint) return false;

  // Only check if the active point is the first or last point
  const isActivePointFirst = activePoint.id === firstPoint.id;
  const isActivePointLast = activePoint.id === lastPoint.id;

  if (!isActivePointFirst && !isActivePointLast) return false;

  const distanceToFirst = Math.sqrt((cursorPos.x - firstPoint.x) ** 2 + (cursorPos.y - firstPoint.y) ** 2);
  const distanceToLast = Math.sqrt((cursorPos.x - lastPoint.x) ** 2 + (cursorPos.y - lastPoint.y) ** 2);

  // If active point is first, check if near last point
  if (isActivePointFirst && distanceToLast <= closeRadius) {
    return true;
  }

  // If active point is last, check if near first point
  if (isActivePointLast && distanceToFirst <= closeRadius) {
    return true;
  }

  return false;
}

export function handlePointSelection(e: KonvaEventObject<MouseEvent>, props: EventHandlerProps): boolean {
  const pos = e.target.getStage()?.getPointerPosition();
  if (!pos) return false;

  const imagePos = stageToImageCoordinates(pos, props.transform, props.fitScale, props.x, props.y);

  const scale = props.transform.zoom * props.fitScale;
  const hitRadius = 10 / scale;

  // Get the tracker instance
  const tracker = VectorSelectionTracker.getInstance();

  // Check if this instance can have selection
  if (!tracker.canInstanceHaveSelection(props.instanceId || "unknown")) {
    return false; // Block selection in this instance
  }

  // Check if we clicked on any point
  for (let i = 0; i < props.initialPoints.length; i++) {
    const point = props.initialPoints[i];

    if (isPointInHitRadius(imagePos, point, hitRadius)) {
      // Check if we're clicking on the first or last point to close the path
      // But only if the active point is also the first or last point
      // But don't close if Shift is held (to allow Shift+click functionality)
      // This should take priority over normal point selection
      if (shouldClosePathOnPointClick(i, props, e) && isActivePointEligibleForClosing(props)) {
        // Determine which point to close to
        const fromPointIndex = i;
        const toPointIndex = i === 0 ? props.initialPoints.length - 1 : 0;

        // Use the bidirectional closePath function
        return closePathBetweenFirstAndLast(props, fromPointIndex, toPointIndex);
      }

      // Disable point selection when near a closing target to prevent interference with path closure
      // This applies to both drawing mode and edit mode
      // This ensures that when a user is about to close a path, clicking on the closing target
      // will trigger path closure instead of point selection
      if (!props.isPathClosed && isNearClosingTarget(imagePos, props)) {
        // Only allow selection if Cmd/Ctrl is held (for multi-selection)
        if (!e.evt.ctrlKey && !e.evt.metaKey) {
          return false; // Don't select the point, let path closure handle it
        }
      }

      // If Cmd/Ctrl is held, add to selection (multi-selection) - this takes priority
      if (e.evt.ctrlKey || e.evt.metaKey) {
        // Check if this is the last added point and trigger onFinish
        if (props.lastAddedPointId && point.id === props.lastAddedPointId) {
          props.onFinish?.();
        }

        const currentSelection = props.selectedPoints;
        const newSelection = new Set(currentSelection);
        newSelection.add(i);

        // Use tracker for global selection management
        tracker.selectPoints(props.instanceId || "unknown", newSelection);
        return true;
      }

      // Handle skeleton mode point selection (when not multi-selecting)
      if (props.skeletonEnabled) {
        // Check if this is the last added point and trigger onFinish
        if (props.lastAddedPointId && point.id === props.lastAddedPointId) {
          props.onFinish?.();
        }

        // Use tracker for global selection management
        tracker.selectPoints(props.instanceId || "unknown", new Set([i]));
        // Don't set lastAddedPointId when selecting a point - it should remain the last physically added point
        // Set the selected point as the active point for drawing
        props.setActivePointId?.(point.id);
        return true;
      }

      // Check if this is the last added point and trigger onFinish
      if (props.lastAddedPointId && point.id === props.lastAddedPointId) {
        props.onFinish?.();
      }

      // If no Cmd/Ctrl and not skeleton mode, clear multi-selection and select only this point
      // Use tracker for global selection management
      tracker.selectPoints(props.instanceId || "unknown", new Set([i]));
      // Return true to indicate we handled the selection
      return true;
    }
  }

  return false;
}

export function handlePointDeselection(e: KonvaEventObject<MouseEvent>, props: EventHandlerProps): boolean {
  const pos = e.target.getStage()?.getPointerPosition();
  if (!pos) return false;

  const imagePos = stageToImageCoordinates(pos, props.transform, props.fitScale, props.x, props.y);

  const scale = props.transform.zoom * props.fitScale;
  const hitRadius = 10 / scale;

  // Get the tracker instance
  const tracker = VectorSelectionTracker.getInstance();

  // Check if this instance can have selection (deselection is allowed for the active instance)
  if (!tracker.canInstanceHaveSelection(props.instanceId || "unknown")) {
    return false; // Block deselection in this instance
  }

  // Check if we clicked on a selected point to unselect it
  for (let i = 0; i < props.initialPoints.length; i++) {
    if (props.selectedPoints.has(i)) {
      const point = props.initialPoints[i];

      if (isPointInHitRadius(imagePos, point, hitRadius)) {
        const newSet = new Set<number>(props.selectedPoints);
        newSet.delete(i);

        // Use tracker for global selection management
        tracker.selectPoints(props.instanceId || "unknown", newSet);

        // Handle skeleton mode reset
        if (newSet.size <= 1 && props.skeletonEnabled && props.initialPoints.length > 0) {
          const lastPoint = props.initialPoints[props.initialPoints.length - 1];
          props.setLastAddedPointId?.(lastPoint.id);
          props.setActivePointId?.(lastPoint.id);
        }

        return true;
      }
    }
  }

  return false;
}
