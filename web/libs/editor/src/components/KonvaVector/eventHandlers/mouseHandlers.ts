import type { KonvaEventObject } from "konva/lib/Node";
import {
  addPointFromGhostDrag,
  handleDrawingModeClick,
  handleShiftClickPointConversion,
  insertPointBetween,
  breakPathAtSegment,
  closePathBetweenFirstAndLast,
} from "./drawing";
import { deletePoint } from "../pointManagement";
import {
  handlePointDeselection,
  handlePointSelection,
  shouldClosePathOnPointClick,
  isActivePointEligibleForClosing,
} from "./pointSelection";
import type { EventHandlerProps } from "./types";
import {
  continueBezierDrag,
  findClosestPointOnPath,
  getDistance,
  handleBezierDragCreation,
  snapToPixel,
  stageToImageCoordinates,
} from "./utils";
import { constrainPointToBounds } from "../utils/boundsChecking";
import { VectorSelectionTracker } from "../VectorSelectionTracker";
import { PointType } from "../types";

export function createMouseDownHandler(props: EventHandlerProps, handledSelectionInMouseDown: { current: boolean }) {
  return (e: KonvaEventObject<MouseEvent>) => {
    let shiftClickHandled = false;

    // Only run Shift+click logic if Shift key is actually held
    if (e.evt.shiftKey === true && props.cursorPosition && props.initialPoints.length >= 2) {
      // Check if cursor is over an existing point
      const scale = props.transform.zoom * props.fitScale;
      const hitRadius = 10 / scale;
      let isOverPoint = false;

      for (let i = 0; i < props.initialPoints.length; i++) {
        const point = props.initialPoints[i];
        const distance = Math.sqrt((props.cursorPosition.x - point.x) ** 2 + (props.cursorPosition.y - point.y) ** 2);

        if (distance <= hitRadius) {
          isOverPoint = true;
          break;
        }
      }

      // Don't start ghost point drag if clicking on an existing point
      if (!isOverPoint) {
        const closestPathPoint = findClosestPointOnPath(
          props.cursorPosition,
          props.initialPoints,
          props.allowClose,
          props.isPathClosed,
        );

        if (closestPathPoint) {
          // Set up for potential drag detection - don't create any points yet
          props.lastPos.current = { x: e.evt.clientX, y: e.evt.clientY };

          // Handle closing segment (segmentIndex === points.length)
          let prevPointId: string;
          let nextPointId: string;

          if (closestPathPoint.segmentIndex === props.initialPoints.length) {
            // This is the closing segment between last and first points
            const lastPoint = props.initialPoints[props.initialPoints.length - 1];
            const firstPoint = props.initialPoints[0];
            prevPointId = lastPoint.id;
            nextPointId = firstPoint.id;
          } else {
            // Regular segment
            prevPointId = props.initialPoints[closestPathPoint.segmentIndex - 1]?.id || "";
            nextPointId = props.initialPoints[closestPathPoint.segmentIndex]?.id || "";
          }

          // Store ghost point info for potential drag
          props.setGhostPointDragInfo({
            ghostPoint: {
              x: closestPathPoint.point.x,
              y: closestPathPoint.point.y,
              prevPointId,
              nextPointId,
            },
            isDragging: false,
            dragDistance: 0,
          });
          shiftClickHandled = true; // Mark that Shift+click was handled
        }
      }
      // If we're over a point while holding Shift, allow normal point interactions to continue
    }

    // Skip the rest of mouse down logic if Shift+click was handled
    if (shiftClickHandled) {
      return;
    }

    // Handle drawing mode setup (only when path is not closed)
    if (props.isDrawingMode && !props.isPathClosed) {
      // Handle Shift+panning even in drawing mode
      if (e.evt.shiftKey) {
        props.isDragging.current = true;
        props.lastPos.current = { x: e.evt.clientX, y: e.evt.clientY };
        document.body.style.cursor = "grabbing";
        return;
      }

      // For drawing mode, we'll wait to see if this becomes a drag
      props.lastPos.current = { x: e.evt.clientX, y: e.evt.clientY };

      // Set up for potential Bezier curve creation (only if not in shift-click mode)
      if (!e.evt.shiftKey) {
        props.setIsDraggingNewBezier(false);
        props.setNewPointDragIndex(null);
      }

      // Don't return here - let the handler continue to set up drawing state
    }

    // Check if transformer is active first - this blocks most point interactions
    if (props.selectedPoints.size > 1) {
      const pos = e.target.getStage()?.getPointerPosition();
      if (pos) {
        const imagePos = stageToImageCoordinates(pos, props.transform, props.fitScale, props.x, props.y);
        const scale = props.transform.zoom * props.fitScale;
        const hitRadius = 10 / scale;

        // Check if we're clicking on a point
        for (let i = 0; i < props.initialPoints.length; i++) {
          const point = props.initialPoints[i];
          const distance = Math.sqrt((imagePos.x - point.x) ** 2 + (imagePos.y - point.y) ** 2);

          if (distance <= hitRadius) {
            // If cmd-click, handle multi-selection management
            if (e.evt.ctrlKey || e.evt.metaKey) {
              // Try deselection first
              if (handlePointDeselection(e, props)) {
                handledSelectionInMouseDown.current = true;
                return;
              }
              // If not deselection, try selection (adding to multi-selection)
              if (handlePointSelection(e, props)) {
                handledSelectionInMouseDown.current = true;
                return;
              }
            } else {
              // Regular click on point when transformer is active - do nothing
              // This prevents the click from falling through to deselection logic
              return;
            }
          }
        }
      }

      // If we get here, we're not clicking on a point
      // Allow deselection by clicking outside the shape
      return;
    }

    // Handle point interactions (selection, dragging) regardless of drawing mode
    // This allows point interaction even when drawing is disabled due to hovering
    const pos = e.target.getStage()?.getPointerPosition();
    if (pos) {
      const imagePos = stageToImageCoordinates(pos, props.transform, props.fitScale, props.x, props.y);

      const scale = props.transform.zoom * props.fitScale;
      const hitRadius = 10 / scale;

      // Check if we're clicking on a point to select or drag it (only when transformer is not active)
      for (let i = 0; i < props.initialPoints.length; i++) {
        const point = props.initialPoints[i];
        const distance = Math.sqrt((imagePos.x - point.x) ** 2 + (imagePos.y - point.y) ** 2);

        if (distance <= hitRadius) {
          // If cmd-click, handle selection immediately and don't set up dragging
          if (e.evt.ctrlKey || e.evt.metaKey) {
            // Try deselection first
            if (handlePointDeselection(e, props)) {
              handledSelectionInMouseDown.current = true;
              return;
            }
            // If not deselection, try selection (adding to multi-selection)
            if (handlePointSelection(e, props)) {
              handledSelectionInMouseDown.current = true;
              return;
            }
          } else {
            // Normal click - store the potential drag target but don't start dragging yet
            // We'll start dragging only if the mouse moves beyond a threshold
            props.setDraggedPointIndex(i);
            props.lastPos.current = {
              x: e.evt.clientX,
              y: e.evt.clientY,
              originalX: point.x,
              originalY: point.y,
              originalControlPoint1: point.isBezier ? point.controlPoint1 : undefined,
              originalControlPoint2: point.isBezier ? point.controlPoint2 : undefined,
            };
          }
          return;
        }
      }

      // Check if we're clicking on a control point (only when transformer is not active)
      for (let i = 0; i < props.initialPoints.length; i++) {
        const point = props.initialPoints[i];
        if (point.isBezier) {
          // Check control point 1
          if (point.controlPoint1) {
            const distance = Math.sqrt(
              (imagePos.x - point.controlPoint1.x) ** 2 + (imagePos.y - point.controlPoint1.y) ** 2,
            );
            if (distance <= hitRadius) {
              props.setDraggedControlPoint({
                pointIndex: i,
                controlIndex: 1,
              });
              props.isDragging.current = true;
              props.lastPos.current = {
                x: e.evt.clientX,
                y: e.evt.clientY,
                originalX: point.controlPoint1.x,
                originalY: point.controlPoint1.y,
              };
              return;
            }
          }

          // Check control point 2
          if (point.controlPoint2) {
            const distance = Math.sqrt(
              (imagePos.x - point.controlPoint2.x) ** 2 + (imagePos.y - point.controlPoint2.y) ** 2,
            );
            if (distance <= hitRadius) {
              props.setDraggedControlPoint({
                pointIndex: i,
                controlIndex: 2,
              });
              props.isDragging.current = true;
              props.lastPos.current = {
                x: e.evt.clientX,
                y: e.evt.clientY,
                originalX: point.controlPoint2.x,
                originalY: point.controlPoint2.y,
              };
              return;
            }
          }
        }
      }
    }

    // Handle point selection (for non-cmd clicks that weren't handled above)
    if (!e.evt.ctrlKey && !e.evt.metaKey && handlePointSelection(e, props)) {
      return;
    }

    // Handle panning with middle mouse button or Shift+drag
    if (e.evt.button === 1 || e.evt.shiftKey) {
      props.isDragging.current = true;
      props.lastPos.current = { x: e.evt.clientX, y: e.evt.clientY };
      document.body.style.cursor = "grabbing";
      return;
    }

    // If we get here, we're not clicking on anything specific
    // Handle deselection based on transformer state
    if (!e.evt.ctrlKey && !e.evt.metaKey) {
      // Use tracker for global selection management
      const tracker = VectorSelectionTracker.getInstance();
      tracker.selectPoints(props.instanceId || "unknown", new Set());

      // Reset active point to the last physically added point when deselecting
      if (props.skeletonEnabled && props.initialPoints.length > 0) {
        const lastPoint = props.initialPoints[props.initialPoints.length - 1];
        props.setLastAddedPointId?.(lastPoint.id);
      }
    }
  };
}

export function createMouseMoveHandler(props: EventHandlerProps, handledSelectionInMouseDown: { current: boolean }) {
  return (e: KonvaEventObject<MouseEvent>) => {
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;

    // Update cursor position
    const imagePos = stageToImageCoordinates(pos, props.transform, props.fitScale, props.x, props.y);
    props.setCursorPosition(imagePos);

    // Set ghost point when Shift is held - snap to path (but not when dragging or creating bezier points)
    if (
      e.evt.shiftKey &&
      props.cursorPosition &&
      props.initialPoints.length >= 2 &&
      !props.isDragging.current &&
      !props.isDraggingNewBezier &&
      !props.ghostPointDragInfo?.isDragging
    ) {
      // Check if cursor is over an existing point
      const scale = props.transform.zoom * props.fitScale;
      const hitRadius = 10 / scale;
      let isOverPoint = false;

      for (let i = 0; i < props.initialPoints.length; i++) {
        const point = props.initialPoints[i];
        const distance = Math.sqrt((props.cursorPosition.x - point.x) ** 2 + (props.cursorPosition.y - point.y) ** 2);

        if (distance <= hitRadius) {
          isOverPoint = true;
          break;
        }
      }

      // Don't show ghost point if hovering over an existing point
      if (isOverPoint) {
        props.setGhostPoint(null);
      } else {
        const closestPathPoint = findClosestPointOnPath(
          props.cursorPosition,
          props.initialPoints,
          props.allowClose,
          props.isPathClosed,
        );

        if (closestPathPoint) {
          // Snap ghost point to pixel grid if enabled
          const snappedGhostPoint = snapToPixel(closestPathPoint.point, props.pixelSnapping);

          // Handle closing segment (segmentIndex === points.length)
          if (closestPathPoint.segmentIndex === props.initialPoints.length) {
            // This is the closing segment between last and first points
            const lastPoint = props.initialPoints[props.initialPoints.length - 1];
            const firstPoint = props.initialPoints[0];

            const ghostPoint = {
              x: snappedGhostPoint.x,
              y: snappedGhostPoint.y,
              prevPointId: lastPoint.id,
              nextPointId: firstPoint.id,
            };
            props.setGhostPoint(ghostPoint);
          } else {
            // Regular segment
            const currentPoint = props.initialPoints[closestPathPoint.segmentIndex];
            const prevPoint = currentPoint?.prevPointId
              ? props.initialPoints.find((p) => p.id === currentPoint.prevPointId)
              : null;

            if (currentPoint && prevPoint) {
              const ghostPoint = {
                x: snappedGhostPoint.x,
                y: snappedGhostPoint.y,
                prevPointId: prevPoint.id,
                nextPointId: currentPoint.id,
              };
              props.setGhostPoint(ghostPoint);
            }
          }
        } else {
          // If not close to path, don't show ghost point
          props.setGhostPoint(null);
        }
      }
    } else if (!e.evt.shiftKey) {
      // Clear ghost point when Shift is not held
      props.setGhostPoint(null);
    }

    // Handle panning (only when not dragging points or control points)
    if (
      props.isDragging.current &&
      props.lastPos.current &&
      props.draggedPointIndex === null &&
      props.draggedControlPoint === null
    ) {
      // Note: setTransform would need to be passed as a prop
      // For now, we'll skip panning in this refactored version
      // const dx = e.evt.clientX - props.lastPos.current.x;
      // const dy = e.evt.clientY - props.lastPos.current.y;
      // props.setTransform((prev) => ({
      // 	...prev,
      // 	offsetX: prev.offsetX - dx / (prev.zoom * props.fitScale),
      // 	offsetY: prev.offsetY - dy / (prev.zoom * props.fitScale),
      // }));

      props.lastPos.current = { x: e.evt.clientX, y: e.evt.clientY };
      return;
    }

    // Handle shift-click-drag bezier creation FIRST (before other dragging logic)
    if (props.ghostPointDragInfo?.isDragging && props.isDraggingNewBezier) {
      // Continue shift-click-drag bezier point creation - update control points to follow cursor
      const imagePos = stageToImageCoordinates(pos, props.transform, props.fitScale, props.x, props.y);

      if (props.newPointDragIndex !== null && props.cursorPosition) {
        const bezierPointIndex = props.newPointDragIndex;
        const newPoints = [...props.initialPoints];
        const bezierPoint = newPoints[bezierPointIndex];

        if (bezierPoint && bezierPoint.isBezier && props.cursorPosition) {
          // Keep the bezier point at its original position (where the ghost point was)
          // Create a new point object with updated control points
          newPoints[bezierPointIndex] = {
            ...bezierPoint,
            controlPoint1: {
              x: props.cursorPosition?.x,
              y: props.cursorPosition?.y,
            },
            controlPoint2: {
              x: bezierPoint.x - (props.cursorPosition?.x - bezierPoint.x),
              y: bezierPoint.y - (props.cursorPosition?.y - bezierPoint.y),
            },
          };

          // Update the points
          props.onPointsChange?.(newPoints);
          props.onPointEdited?.(newPoints[bezierPointIndex], bezierPointIndex);
        }
      }

      // Update ghost point drag info
      props.setGhostPointDragInfo({
        ...props.ghostPointDragInfo,
        dragDistance: Math.sqrt(
          (imagePos.x - props.ghostPointDragInfo?.ghostPoint.x) ** 2 +
            (imagePos.y - props.ghostPointDragInfo?.ghostPoint.y) ** 2,
        ),
      });
      return; // Exit early to prevent other dragging logic from interfering
    }

    // Handle point dragging
    if (props.draggedPointIndex !== null && props.lastPos.current) {
      // Completely disable point dragging when transformer is active
      if (props.selectedPoints.size > 1) {
        return;
      }

      // Check if we should start dragging (mouse moved beyond threshold)
      const dragThreshold = 5; // pixels
      const mouseDeltaX = Math.abs(e.evt.clientX - props.lastPos.current?.x);
      const mouseDeltaY = Math.abs(e.evt.clientY - props.lastPos.current?.y);

      // If we haven't started dragging yet, check if we should start
      if (!props.isDragging.current && (mouseDeltaX > dragThreshold || mouseDeltaY > dragThreshold)) {
        props.isDragging.current = true;
      }

      // Only proceed with dragging if we're actually dragging
      if (!props.isDragging.current) {
        return;
      }
      const imagePos = stageToImageCoordinates(pos, props.transform, props.fitScale, props.x, props.y);

      const newPoints = [...props.initialPoints];
      const draggedPoint = newPoints[props.draggedPointIndex];

      // Calculate the movement delta from the original position
      const originalX = props.lastPos.current?.originalX || draggedPoint.x;
      const originalY = props.lastPos.current?.originalY || draggedPoint.y;
      const deltaX = imagePos.x - originalX;
      const deltaY = imagePos.y - originalY;

      // Snap to pixel grid if enabled
      const snappedPos = snapToPixel(imagePos, props.pixelSnapping);

      // Apply bounds checking if enabled
      const finalPos = props.constrainToBounds
        ? constrainPointToBounds(snappedPos, { width: props.width, height: props.height })
        : snappedPos;

      // Update the point position
      newPoints[props.draggedPointIndex] = {
        ...draggedPoint,
        x: finalPos.x,
        y: finalPos.y,
      };

      // If it's a bezier point, move the control points with it
      if (draggedPoint.isBezier) {
        const updatedPoint = newPoints[props.draggedPointIndex];

        // Move control point 1 if it exists - use stored original position + delta
        if (props.lastPos.current?.originalControlPoint1) {
          const controlPoint1Pos = {
            x: props.lastPos.current.originalControlPoint1.x + deltaX,
            y: props.lastPos.current.originalControlPoint1.y + deltaY,
          };
          const snappedControlPoint1 = snapToPixel(controlPoint1Pos, props.pixelSnapping);
          updatedPoint.controlPoint1 = {
            x: snappedControlPoint1.x,
            y: snappedControlPoint1.y,
          };
        }

        // Move control point 2 if it exists - use stored original position + delta
        if (props.lastPos.current?.originalControlPoint2) {
          const controlPoint2Pos = {
            x: props.lastPos.current.originalControlPoint2.x + deltaX,
            y: props.lastPos.current.originalControlPoint2.y + deltaY,
          };
          const snappedControlPoint2 = snapToPixel(controlPoint2Pos, props.pixelSnapping);
          updatedPoint.controlPoint2 = {
            x: snappedControlPoint2.x,
            y: snappedControlPoint2.y,
          };
        }
      }

      props.onPointsChange?.(newPoints);
      props.onPointRepositioned?.(newPoints[props.draggedPointIndex], props.draggedPointIndex);
      return;
    }

    // Handle control point dragging (but not during new bezier creation)
    if (props.draggedControlPoint && !props.isDraggingNewBezier) {
      // Completely disable control point dragging when transformer is active
      if (props.selectedPoints.size > 1) {
        return;
      }

      const imagePos = stageToImageCoordinates(pos, props.transform, props.fitScale, props.x, props.y);

      const { pointIndex, controlIndex } = props.draggedControlPoint;
      const newPoints = [...props.initialPoints];
      const point = newPoints[pointIndex];

      if (point.isBezier) {
        // Snap to pixel grid if enabled
        const snappedPos = snapToPixel(imagePos, props.pixelSnapping);

        // Apply bounds checking if enabled
        const finalPos = props.constrainToBounds
          ? constrainPointToBounds(snappedPos, { width: props.width, height: props.height })
          : snappedPos;

        // If Alt key is held, disconnect the control points
        if (e.evt.altKey) {
          point.disconnected = true;
        }

        if (controlIndex === 1 && point.controlPoint1) {
          // Create a new point object with updated control points
          const updatedPoint = {
            ...point,
            controlPoint1: { x: finalPos.x, y: finalPos.y },
          };

          // If controls are synchronized (not disconnected), update the other control point symmetrically
          if (!point.disconnected && point.controlPoint2) {
            const deltaX = imagePos.x - point.x;
            const deltaY = imagePos.y - point.y;
            const symmetricControlPoint = {
              x: point.x - deltaX,
              y: point.y - deltaY,
            };
            const snappedSymmetricControlPoint = snapToPixel(symmetricControlPoint, props.pixelSnapping);
            updatedPoint.controlPoint2 = {
              x: snappedSymmetricControlPoint.x,
              y: snappedSymmetricControlPoint.y,
            };
          }

          newPoints[pointIndex] = updatedPoint;
        } else if (controlIndex === 2 && point.controlPoint2) {
          // Create a new point object with updated control points
          const updatedPoint = {
            ...point,
            controlPoint2: { x: finalPos.x, y: finalPos.y },
          };

          // If controls are synchronized (not disconnected), update the other control point symmetrically
          if (!point.disconnected && point.controlPoint1) {
            const deltaX = imagePos.x - point.x;
            const deltaY = imagePos.y - point.y;
            const symmetricControlPoint = {
              x: point.x - deltaX,
              y: point.y - deltaY,
            };
            const snappedSymmetricControlPoint = snapToPixel(symmetricControlPoint, props.pixelSnapping);
            updatedPoint.controlPoint1 = {
              x: snappedSymmetricControlPoint.x,
              y: snappedSymmetricControlPoint.y,
            };
          }

          newPoints[pointIndex] = updatedPoint;
        }

        props.onPointsChange?.(newPoints);
        props.onPointEdited?.(point, pointIndex);
      }
      return;
    }

    // Handle Bezier curve creation in drawing mode (click-drag without shift key) - only when path is not closed
    // Skip if PointCreationManager is currently creating a point
    if (
      props.isDrawingMode &&
      !props.isPathClosed &&
      props.lastPos.current &&
      !e.evt.shiftKey &&
      props.allowBezier &&
      !props.pointCreationManager?.isCreating()
    ) {
      const dragDistance = Math.sqrt(
        (e.evt.clientX - props.lastPos.current.x) ** 2 + (e.evt.clientY - props.lastPos.current.y) ** 2,
      );

      if (!props.isDraggingNewBezier) {
        // Start Bezier curve creation if we've moved enough
        if (dragDistance > 5) {
          // Convert client coordinates to stage coordinates
          const stage = e.target.getStage();
          const stagePos = stage?.getPointerPosition();
          if (stagePos) {
            handleBezierDragCreation(
              props,
              stagePos, // ✅ Use stage coordinates instead of client coordinates
              handledSelectionInMouseDown,
            );
          }
        }
      } else {
        // Continue Bezier curve creation - update control points to follow cursor
        continueBezierDrag(props);
      }
    }

    // Handle shift-click-drag bezier creation (start dragging detection) - only when shift key is held
    if (props.ghostPointDragInfo && !props.ghostPointDragInfo.isDragging && e.evt.shiftKey && props.allowBezier) {
      // Check if we should start dragging (mouse moved enough)
      const imagePos = stageToImageCoordinates(pos, props.transform, props.fitScale, props.x, props.y);

      const dragDistance = Math.sqrt(
        (imagePos.x - props.ghostPointDragInfo.ghostPoint.x) ** 2 +
          (imagePos.y - props.ghostPointDragInfo.ghostPoint.y) ** 2,
      );

      // Start dragging if we've moved more than 5 pixels
      if (dragDistance > 5) {
        // Create a bezier point at the ghost point location
        const ghostPoint = props.ghostPointDragInfo.ghostPoint;
        const prevPoint = props.initialPoints.find((p) => p.id === ghostPoint.prevPointId);
        const nextPoint = props.initialPoints.find((p) => p.id === ghostPoint.nextPointId);

        if (prevPoint && nextPoint) {
          // Snap to pixel grid if enabled
          const snappedPos = snapToPixel(imagePos, props.pixelSnapping);

          // Create initial control points - control point 1 will follow cursor, control point 2 will be opposite
          const controlPoint1 = { x: snappedPos.x, y: snappedPos.y };
          const controlPoint2 = {
            x: ghostPoint.x - (snappedPos.x - ghostPoint.x),
            y: ghostPoint.y - (snappedPos.y - ghostPoint.y),
          };

          // Insert the bezier point
          const result = props.pointCreationManager?.insertPointBetween(
            ghostPoint.x,
            ghostPoint.y,
            prevPoint.id,
            nextPoint.id,
            PointType.BEZIER,
            controlPoint1,
            controlPoint2,
          ) || { success: false };

          if (result.success && result.newPointIndex !== undefined) {
            // Store the index of the newly created bezier point
            props.setNewPointDragIndex(result.newPointIndex);
            // Set dragging state for bezier control point manipulation
            props.setIsDraggingNewBezier(true);
            // Mark that we've handled this interaction to prevent click handler from running
            handledSelectionInMouseDown.current = true;
          } else {
            // Failed to insert bezier point
          }
        }

        // Update ghost point drag info to indicate we're now dragging
        props.setGhostPointDragInfo({
          ...props.ghostPointDragInfo,
          isDragging: true,
          dragDistance,
        });

        // Clear the ghost point since we're now dragging
        props.setGhostPoint(null);
      }
    } else if (props.ghostPointDragInfo?.isDragging && props.isDraggingNewBezier) {
      // Continue shift-click-drag bezier point creation - update control points to follow cursor
      const imagePos = stageToImageCoordinates(pos, props.transform, props.fitScale, props.x, props.y);

      // Use the shared utility for continuing bezier drag
      continueBezierDrag(props);

      // Update ghost point drag info
      props.setGhostPointDragInfo({
        ...props.ghostPointDragInfo,
        dragDistance: Math.sqrt(
          (imagePos.x - props.ghostPointDragInfo.ghostPoint.x) ** 2 +
            (imagePos.y - props.ghostPointDragInfo.ghostPoint.y) ** 2,
        ),
      });
    } else if (props.ghostPointDragInfo?.isDragging && !props.isDraggingNewBezier) {
      // Continue regular ghost point dragging (non-bezier)
      const imagePos = stageToImageCoordinates(pos, props.transform, props.fitScale, props.x, props.y);

      const dragDistance = Math.sqrt(
        (imagePos.x - props.ghostPointDragInfo.ghostPoint.x) ** 2 +
          (imagePos.y - props.ghostPointDragInfo.ghostPoint.y) ** 2,
      );

      props.setGhostPointDragInfo({
        ...props.ghostPointDragInfo,
        dragDistance,
      });
    }
  };
}

export function createMouseUpHandler(props: EventHandlerProps) {
  return () => {
    // Store drag info before resetting state
    const wasGhostDrag = props.ghostPointDragInfo?.isDragging;
    const hadNewPointDragIndex = props.newPointDragIndex !== null;

    // Handle Shift+click-drag completion (BEFORE resetting state)
    if (wasGhostDrag && hadNewPointDragIndex) {
      // The bezier point was already created during the drag, just finalize it
      // Make the control points visible for the newly created bezier point
      if (props.newPointDragIndex !== null) {
        props.setVisibleControlPoints(new Set([props.newPointDragIndex]));
      }
    }

    // Handle point selection if we clicked but didn't drag
    // Note: cmd-clicks are handled in mousedown and return early, so draggedPointIndex is never set for them
    if (props.draggedPointIndex !== null && !props.isDragging.current) {
      // Check if this point click should trigger path closing instead of selection
      const pointIndex = props.draggedPointIndex;
      // Create a mock event for the helper function (since mouse up doesn't have the full event)
      const mockEvent = {
        evt: {
          shiftKey: false,
          ctrlKey: false,
          metaKey: false,
          altKey: false,
        },
      } as KonvaEventObject<MouseEvent>;
      const shouldClose =
        shouldClosePathOnPointClick(pointIndex, props, mockEvent) && isActivePointEligibleForClosing(props);

      if (shouldClose) {
        // Try to close the path instead of selecting the point
        const fromPointIndex = pointIndex;
        const toPointIndex = pointIndex === 0 ? props.initialPoints.length - 1 : 0;
        const closed = closePathBetweenFirstAndLast(props, fromPointIndex, toPointIndex);
        if (!closed) {
          // Path closing failed, fall back to point selection
          handlePointSelectionFromIndex(pointIndex, props);
        }
      } else {
        // Normal point selection
        handlePointSelectionFromIndex(pointIndex, props);
      }
    }

    // Reset dragging state
    props.isDragging.current = false;
    props.setDraggedPointIndex(null);
    props.setDraggedControlPoint(null);
    props.setNewPointDragIndex(null);
    props.setIsDraggingNewBezier(false);

    // Reset cursor
    document.body.style.cursor = "default";

    // Notify transformation complete if we were dragging
    if (props.lastPos.current) {
      props.notifyTransformationComplete?.();
      props.lastPos.current = null;
    }

    // Handle ghost point drag completion
    if (wasGhostDrag && props.ghostPointDragInfo?.ghostPoint) {
      const { ghostPoint, dragDistance } = props.ghostPointDragInfo;

      // If we were creating a bezier point, it was already created during the drag
      if (hadNewPointDragIndex) {
        // The bezier point was already created during the drag, just finalize it
        // Make the control points visible for the newly created bezier point
        if (props.newPointDragIndex !== null) {
          props.setVisibleControlPoints(new Set([props.newPointDragIndex]));
        }
      } else if (dragDistance > 5) {
        // Only add a regular point if we were dragging but NOT creating a bezier point
        // and the drag distance is sufficient
        // Convert ghost point format to match addPointFromGhostDrag expectations
        const ghostPointWithSegmentIndex = {
          x: ghostPoint.x,
          y: ghostPoint.y,
          segmentIndex: props.initialPoints.findIndex((p) => p.id === ghostPoint.nextPointId),
        };
        const success = addPointFromGhostDrag(props, ghostPointWithSegmentIndex, dragDistance);
        if (success) {
          // Update timing when point is successfully added
          if (props.lastCallbackTime?.current !== undefined) {
            props.lastCallbackTime.current = Date.now();
          }
        }
      }
    }

    // Always clear ghostPointDragInfo on mouseup (whether it was a drag or just a click)
    if (props.ghostPointDragInfo) {
      props.setGhostPointDragInfo(null);
    }
  };
}

export function createClickHandler(props: EventHandlerProps, handledSelectionInMouseDown: { current: boolean }) {
  return (e: KonvaEventObject<MouseEvent>) => {
    // Handle Shift+click functionality FIRST (before other checks)
    if (e.evt.shiftKey && !e.evt.altKey) {
      // First, try to convert a point to bezier if clicking on a point
      if (handleShiftClickPointConversion(e, props)) {
        return;
      }
    }

    // Handle Shift+click functionality (before other checks)
    if (e.evt.shiftKey && !e.evt.altKey) {
      // First, check if we're near a ghost point to add a point
      if (
        props.cursorPosition &&
        !props.isDraggingNewBezier &&
        !props.ghostPointDragInfo?.isDragging &&
        !props.isDragging.current
      ) {
        // Check if we have a ghost point (this should be the persistent one from mouse move)
        const ghostPoint = props.ghostPoint;

        if (ghostPoint) {
          // Check if we're clicking near the ghost point
          const distance = Math.sqrt(
            (props.cursorPosition.x - ghostPoint.x) ** 2 + (props.cursorPosition.y - ghostPoint.y) ** 2,
          );
          const clickRadius = 15 / (props.transform.zoom * props.fitScale);

          if (distance <= clickRadius) {
            // Insert a regular point between the two points that form the segment
            const insertResult = insertPointBetween(
              props,
              ghostPoint.x,
              ghostPoint.y,
              ghostPoint.prevPointId,
              ghostPoint.nextPointId,
            );
            if (insertResult.success) {
              return; // Successfully added point
            }
          }
        }
      }
    }

    // Handle Alt+click functionality (point deletion and path breaking)
    if (e.evt.altKey && !e.evt.shiftKey) {
      const pos = e.target.getStage()?.getPointerPosition();
      if (pos) {
        const imagePos = stageToImageCoordinates(pos, props.transform, props.fitScale, props.x, props.y);

        const scale = props.transform.zoom * props.fitScale;
        const hitRadius = 10 / scale;

        // Check if we clicked on any point to delete it
        for (let i = 0; i < props.initialPoints.length; i++) {
          const point = props.initialPoints[i];
          const distance = Math.sqrt((imagePos.x - point.x) ** 2 + (imagePos.y - point.y) ** 2);

          if (distance <= hitRadius) {
            deletePoint(
              i,
              props.initialPoints,
              props.selectedPointIndex,
              props.setSelectedPointIndex,
              props.setVisibleControlPoints,
              props.onPointSelected,
              props.onPointRemoved,
              props.onPointsChange,
              props.setLastAddedPointId,
              props.lastAddedPointId,
            );
            return;
          }
        }

        // If we didn't click on a point, check if we clicked on a segment to break the path
        if (props.isPathClosed && props.allowClose) {
          const segmentHitRadius = 15 / scale; // Slightly larger than point hit radius

          // Find the closest point on the path
          const closestPathPoint = findClosestPointOnPath(
            imagePos,
            props.initialPoints,
            props.allowClose,
            props.isPathClosed,
          );

          if (closestPathPoint && getDistance(imagePos, closestPathPoint.point) <= segmentHitRadius) {
            // We clicked on a segment, break the closed path
            if (breakPathAtSegment(props, closestPathPoint.segmentIndex)) {
              return;
            }
          }
        }
      }
    }

    // Skip if we already handled selection in mousedown (for cmd-click and other interactions)
    if (handledSelectionInMouseDown.current) {
      handledSelectionInMouseDown.current = false;
      return;
    }

    // Handle point selection (including path closing) when clicking on existing points
    if (handlePointSelection(e, props)) {
      return;
    }

    // Check if we clicked on an existing point - if so, don't create new points
    const pos = e.target.getStage()?.getPointerPosition();
    if (pos) {
      const imagePos = stageToImageCoordinates(pos, props.transform, props.fitScale, props.x, props.y);

      const scale = props.transform.zoom * props.fitScale;
      const hitRadius = 10 / scale;

      // Check if we clicked on any existing point
      for (let i = 0; i < props.initialPoints.length; i++) {
        const point = props.initialPoints[i];
        const distance = Math.sqrt((imagePos.x - point.x) ** 2 + (imagePos.y - point.y) ** 2);

        if (distance <= hitRadius) {
          // Check if this is the last added point and trigger onFinish
          if (props.lastAddedPointId && point.id === props.lastAddedPointId) {
            props.onFinish?.();
          }

          // We clicked on an existing point, don't create new points
          return;
        }
      }
    }

    // Handle drawing mode clicks (only when path is not closed)
    // Skip if PointCreationManager is currently creating a point
    if (props.isDrawingMode && !props.isPathClosed && !props.pointCreationManager?.isCreating()) {
      // Check if we just created a Bezier point - if so, skip regular point creation
      if (handledSelectionInMouseDown.current) {
        handledSelectionInMouseDown.current = false;
        return;
      }

      // Handle regular click (add regular point)
      if (handleDrawingModeClick(e, props)) {
        return;
      }
    }

    // Skip if we already handled selection in mousedown (for non-drawing mode)
    if (handledSelectionInMouseDown.current) {
      handledSelectionInMouseDown.current = false;
      return;
    }
  };
}

// Helper function to select a point by index
function handlePointSelectionFromIndex(pointIndex: number, props: EventHandlerProps) {
  // For now, just do single selection since we don't have access to modifier keys in mouse up
  // Multi-selection will be handled by the existing point selection logic in mouse down

  // Use tracker for global selection management
  const tracker = VectorSelectionTracker.getInstance();
  tracker.selectPoints(props.instanceId || "unknown", new Set([pointIndex]));

  // Update activePointId for skeleton mode - set the selected point as the active point
  if (pointIndex >= 0 && pointIndex < props.initialPoints.length) {
    const selectedPoint = props.initialPoints[pointIndex];
    props.setActivePointId?.(selectedPoint.id);
  }
}
