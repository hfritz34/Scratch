// tools.js
// Tool implementations (pen, highlighter, eraser, select)

class ToolManager {
  constructor(overlayManager, storageManager, drawingEngine) {
    this.overlayManager = overlayManager;
    this.storageManager = storageManager;
    this.drawingEngine = drawingEngine;

    // Current tool state
    this.currentTool = 'pen';
    this.currentColor = '#000000';
    this.toolSizes = {
      pen: 5,
      highlighter: 15,
      eraser: 20
    };
    this.eraserMode = 'whole'; // 'whole' or 'partial'

    // Drawing state
    this.isDrawing = false;
    this.currentStroke = null;
    this.currentContainer = null;

    // Selection state
    this.isSelecting = false;
    this.selectionPath = [];
    this.selectedStrokes = new Map(); // container -> Set of indices
    this.isDraggingSelection = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    // Eraser state
    this.isErasing = false;
    this.erasePoints = [];
    this.deletePreviewStrokes = new Map(); // container -> Set of indices
  }

  // Set current tool
  setTool(tool) {
    this.currentTool = tool;
    this.clearSelection();
  }

  // Set current color
  setColor(color) {
    this.currentColor = color;
  }

  // Set tool size
  setSize(size) {
    this.toolSizes[this.currentTool] = size;
  }

  // Toggle eraser mode
  toggleEraserMode() {
    this.eraserMode = this.eraserMode === 'whole' ? 'partial' : 'whole';
  }

  // Start drawing
  startDrawing(clientX, clientY) {
    const container = this.overlayManager.findContainerAtPoint(clientX, clientY);
    if (!container) return;

    const overlay = this.overlayManager.getOverlay(container);
    if (!overlay) return;

    // Convert to content coordinates
    const pos = this.drawingEngine.clientToContentCoords(container, clientX, clientY);

    this.isDrawing = true;
    this.currentContainer = container;

    // Create new stroke
    this.currentStroke = {
      container,
      tool: this.currentTool,
      color: this.currentColor,
      size: this.toolSizes[this.currentTool],
      points: [pos]
    };
  }

  // Continue drawing
  continueDrawing(clientX, clientY) {
    if (!this.isDrawing || !this.currentStroke || !this.currentContainer) return;

    const pos = this.drawingEngine.clientToContentCoords(this.currentContainer, clientX, clientY);
    this.currentStroke.points.push(pos);

    // Render current stroke immediately for responsiveness
    const overlay = this.overlayManager.getOverlay(this.currentContainer);
    if (overlay) {
      this.drawingEngine.renderContainer(this.currentContainer);
      // Draw current stroke on top
      this.drawingEngine.drawStroke(overlay.ctx, this.currentStroke);
    }
  }

  // End drawing
  endDrawing() {
    if (!this.isDrawing || !this.currentStroke) return;

    // Save stroke to storage
    if (this.currentStroke.points.length > 0) {
      this.storageManager.addStroke(this.currentContainer, this.currentStroke);
      this.drawingEngine.renderContainer(this.currentContainer);
    }

    this.isDrawing = false;
    this.currentStroke = null;
    this.currentContainer = null;
  }

  // Selection tool: start lasso
  startSelection(clientX, clientY) {
    const container = this.overlayManager.findContainerAtPoint(clientX, clientY);
    if (!container) return;

    const pos = this.drawingEngine.clientToContentCoords(container, clientX, clientY);

    this.isSelecting = true;
    this.currentContainer = container;
    this.selectionPath = [pos];
    this.clearSelection();
  }

  // Selection tool: update lasso
  updateSelection(clientX, clientY) {
    if (!this.isSelecting || !this.currentContainer) return;

    const pos = this.drawingEngine.clientToContentCoords(this.currentContainer, clientX, clientY);
    this.selectionPath.push(pos);

    // Render with lasso
    const overlay = this.overlayManager.getOverlay(this.currentContainer);
    if (overlay) {
      this.drawingEngine.renderContainer(this.currentContainer);
      this.drawingEngine.drawLasso(this.currentContainer, this.selectionPath, overlay.ctx);
    }
  }

  // Selection tool: complete lasso and select strokes
  completeSelection() {
    if (!this.isSelecting || !this.currentContainer) return;

    this.isSelecting = false;

    if (this.selectionPath.length < 3) {
      this.selectionPath = [];
      this.drawingEngine.renderContainer(this.currentContainer);
      return;
    }

    // Close the path
    const closedPath = [...this.selectionPath, this.selectionPath[0]];

    // Find strokes inside the lasso
    const strokes = this.storageManager.getStrokes(this.currentContainer);
    const selected = new Set();

    for (let i = 0; i < strokes.length; i++) {
      const stroke = strokes[i];
      if (!stroke || !stroke.points) continue;

      // Check if any point is inside the lasso
      for (const point of stroke.points) {
        if (this.isPointInPolygon(point.x, point.y, closedPath)) {
          selected.add(i);
          break;
        }
      }
    }

    if (selected.size > 0) {
      this.selectedStrokes.set(this.currentContainer, selected);
    }

    this.selectionPath = [];
    this.drawingEngine.renderContainer(this.currentContainer);
  }

  // Clear selection
  clearSelection() {
    this.selectedStrokes.clear();
    this.selectionPath = [];
    this.isSelecting = false;
    this.isDraggingSelection = false;
  }

  // Point-in-polygon test (ray casting algorithm)
  isPointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;

      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

      if (intersect) inside = !inside;
    }
    return inside;
  }

  // Eraser: start delete preview
  startDeletePreview(clientX, clientY) {
    const container = this.overlayManager.findContainerAtPoint(clientX, clientY);
    if (!container) return;

    const pos = this.drawingEngine.clientToContentCoords(container, clientX, clientY);
    this.currentContainer = container;
    this.deletePreviewStrokes.set(container, new Set());

    this.highlightStrokesNearPoint(container, pos.x, pos.y);
  }

  // Eraser: update delete preview
  updateDeletePreview(clientX, clientY) {
    if (!this.currentContainer) return;

    const pos = this.drawingEngine.clientToContentCoords(this.currentContainer, clientX, clientY);
    this.highlightStrokesNearPoint(this.currentContainer, pos.x, pos.y);
  }

  // Eraser: complete delete
  completeDelete() {
    if (!this.currentContainer) return;

    const strokeIndices = this.deletePreviewStrokes.get(this.currentContainer);
    if (strokeIndices && strokeIndices.size > 0) {
      this.storageManager.removeStrokes(this.currentContainer, strokeIndices);
      this.drawingEngine.renderContainer(this.currentContainer);
    }

    this.deletePreviewStrokes.clear();
    this.currentContainer = null;
  }

  // Find and highlight strokes near a point
  highlightStrokesNearPoint(container, x, y) {
    const strokes = this.storageManager.getStrokes(container);
    const previewSet = this.deletePreviewStrokes.get(container) || new Set();
    const eraserSize = this.toolSizes.eraser;
    const padding = Math.max(eraserSize, 15);

    for (let i = 0; i < strokes.length; i++) {
      const stroke = strokes[i];
      if (!stroke || !stroke.bbox) continue;

      // Quick bounds check
      if (x >= stroke.bbox.minX - padding && x <= stroke.bbox.maxX + padding &&
          y >= stroke.bbox.minY - padding && y <= stroke.bbox.maxY + padding) {

        // Check if point is near any part of stroke
        if (this.isPointNearStroke(x, y, stroke, eraserSize)) {
          previewSet.add(i);
        }
      }
    }

    // Render with highlights
    const overlay = this.overlayManager.getOverlay(container);
    if (!overlay) return;

    const { ctx } = overlay;
    ctx.clearRect(0, 0, overlay.canvas.width, overlay.canvas.height);

    // Draw all strokes with preview highlights
    for (let i = 0; i < strokes.length; i++) {
      const isHighlighted = previewSet.has(i);
      this.drawingEngine.drawStroke(ctx, strokes[i], { isHighlighted });
    }
  }

  // Check if point is near a stroke
  isPointNearStroke(x, y, stroke, threshold) {
    if (!stroke || !stroke.points || stroke.points.length === 0) return false;

    threshold = threshold || (stroke.size / 2 + 10);

    // Check single point strokes
    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      const distance = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
      return distance <= threshold;
    }

    // Check line segments
    for (let i = 0; i < stroke.points.length - 1; i++) {
      const p1 = stroke.points[i];
      const p2 = stroke.points[i + 1];
      const distance = this.distanceToLineSegment(x, y, p1.x, p1.y, p2.x, p2.y);
      if (distance <= threshold) return true;
    }

    return false;
  }

  // Distance from point to line segment
  distanceToLineSegment(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) {
      return Math.sqrt(A * A + B * B);
    }

    let param = dot / lenSq;
    param = Math.max(0, Math.min(1, param));

    const xx = x1 + param * C;
    const yy = y1 + param * D;
    const dx = px - xx;
    const dy = py - yy;

    return Math.sqrt(dx * dx + dy * dy);
  }

  // Partial eraser: start
  startPartialErase(clientX, clientY) {
    const container = this.overlayManager.findContainerAtPoint(clientX, clientY);
    if (!container) return;

    const pos = this.drawingEngine.clientToContentCoords(container, clientX, clientY);
    this.currentContainer = container;
    this.isErasing = true;
    this.erasePoints = [pos];
  }

  // Partial eraser: continue
  continuePartialErase(clientX, clientY) {
    if (!this.isErasing || !this.currentContainer) return;

    const pos = this.drawingEngine.clientToContentCoords(this.currentContainer, clientX, clientY);
    this.erasePoints.push(pos);

    // Find and split strokes
    this.splitStrokesAtPoints(this.currentContainer);
    this.drawingEngine.renderContainer(this.currentContainer);
  }

  // Partial eraser: end
  endPartialErase() {
    this.isErasing = false;
    this.erasePoints = [];
    this.currentContainer = null;
  }

  // Split strokes intersected by erase path
  splitStrokesAtPoints(container) {
    const strokes = this.storageManager.getStrokes(container);
    const eraserSize = this.toolSizes.eraser;
    const strokesToSplit = [];

    // Find intersected points
    for (let i = 0; i < strokes.length; i++) {
      const stroke = strokes[i];
      if (!stroke || !stroke.points) continue;

      const intersectedIndices = [];

      for (let j = 0; j < stroke.points.length; j++) {
        const strokePoint = stroke.points[j];

        for (const erasePoint of this.erasePoints) {
          const distance = Math.sqrt(
            (strokePoint.x - erasePoint.x) ** 2 +
            (strokePoint.y - erasePoint.y) ** 2
          );

          if (distance <= eraserSize / 2) {
            intersectedIndices.push(j);
            break;
          }
        }
      }

      if (intersectedIndices.length > 0) {
        strokesToSplit.push({ index: i, intersectedIndices });
      }
    }

    // Split strokes (process in reverse to maintain indices)
    for (let i = strokesToSplit.length - 1; i >= 0; i--) {
      const { index, intersectedIndices } = strokesToSplit[i];
      const originalStroke = strokes[index];

      intersectedIndices.sort((a, b) => a - b);

      const newStrokes = [];
      let lastEnd = 0;

      for (const pointIndex of intersectedIndices) {
        if (pointIndex > lastEnd) {
          const segmentPoints = originalStroke.points.slice(lastEnd, pointIndex);
          if (segmentPoints.length > 1) {
            newStrokes.push({
              ...originalStroke,
              points: segmentPoints
            });
          }
        }
        lastEnd = pointIndex + 1;
      }

      // Add final segment
      if (lastEnd < originalStroke.points.length) {
        const segmentPoints = originalStroke.points.slice(lastEnd);
        if (segmentPoints.length > 1) {
          newStrokes.push({
            ...originalStroke,
            points: segmentPoints
          });
        }
      }

      // Remove original and add new strokes
      strokes.splice(index, 1, ...newStrokes);
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ToolManager;
}
