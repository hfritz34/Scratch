// drawing-engine.js
// Core drawing and rendering logic

class DrawingEngine {
  constructor(overlayManager, storageManager) {
    this.overlayManager = overlayManager;
    this.storageManager = storageManager;
    this.renderLoopId = null;
  }

  // Convert client coordinates to container content coordinates
  clientToContentCoords(container, clientX, clientY) {
    const rect = container.getBoundingClientRect();
    const x = container.scrollLeft + (clientX - rect.left);
    const y = container.scrollTop + (clientY - rect.top);
    return { x: Math.round(x), y: Math.round(y) };
  }

  // Convert content coordinates back to canvas coordinates (for rendering)
  contentToCanvasCoords(container, contentX, contentY) {
    // Canvas is positioned at 0,0 of container's scroll area
    // So content coordinates ARE canvas coordinates
    return { x: contentX, y: contentY };
  }

  // Draw a single stroke on a canvas context
  drawStroke(ctx, stroke, options = {}) {
    const {
      isSelected = false,
      isHighlighted = false,
      globalAlpha = 1.0
    } = options;

    if (!stroke || !stroke.points || stroke.points.length === 0) return;

    const tool = stroke.tool || 'pen';
    const color = stroke.color || '#000000';
    const size = stroke.size || 5;

    ctx.save();

    // Apply alpha
    ctx.globalAlpha = globalAlpha;

    // Apply selection effects
    if (isSelected) {
      ctx.shadowColor = '#007AFF';
      ctx.shadowBlur = 5;
    }

    // Apply highlight effects (for delete preview)
    if (isHighlighted) {
      ctx.globalAlpha = 0.3;
    }

    // Set tool-specific properties
    if (tool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = this.hexToRgba(color, 0.3);
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
    }

    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw the stroke
    if (stroke.points.length === 1) {
      // Single point (dot)
      const point = stroke.points[0];
      const canvasCoords = this.contentToCanvasCoords(stroke.container, point.x, point.y);

      if (tool === 'highlighter') {
        ctx.beginPath();
        ctx.moveTo(canvasCoords.x, canvasCoords.y);
        ctx.lineTo(canvasCoords.x + 0.1, canvasCoords.y + 0.1);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(canvasCoords.x, canvasCoords.y, size / 2, 0, 2 * Math.PI);
        ctx.fill();
      }
    } else {
      // Multi-point stroke
      ctx.beginPath();
      const firstPoint = stroke.points[0];
      const firstCanvas = this.contentToCanvasCoords(stroke.container, firstPoint.x, firstPoint.y);
      ctx.moveTo(firstCanvas.x, firstCanvas.y);

      for (let i = 1; i < stroke.points.length; i++) {
        const point = stroke.points[i];
        const canvasCoords = this.contentToCanvasCoords(stroke.container, point.x, point.y);
        ctx.lineTo(canvasCoords.x, canvasCoords.y);
      }

      ctx.stroke();
    }

    ctx.restore();
  }

  // Render all strokes for a container
  renderContainer(container, options = {}) {
    const overlay = this.overlayManager.getOverlay(container);
    if (!overlay) return;

    const { canvas, ctx } = overlay;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get strokes (only visible ones for performance)
    const strokes = this.storageManager.getVisibleStrokes(container);

    // Render each stroke
    for (const stroke of strokes) {
      this.drawStroke(ctx, stroke, options);
    }
  }

  // Render all containers
  renderAll(options = {}) {
    const overlays = this.overlayManager.getAllOverlays();
    for (const overlay of overlays) {
      this.renderContainer(overlay.container, options);
    }
  }

  // Start continuous render loop (for smooth updates during drawing/scrolling)
  startRenderLoop() {
    if (this.renderLoopId) return; // Already running

    const render = () => {
      this.renderAll();
      this.renderLoopId = requestAnimationFrame(render);
    };

    this.renderLoopId = requestAnimationFrame(render);
  }

  // Stop render loop
  stopRenderLoop() {
    if (this.renderLoopId) {
      cancelAnimationFrame(this.renderLoopId);
      this.renderLoopId = null;
    }
  }

  // Utility: convert hex color to rgba
  hexToRgba(hex, alpha = 1) {
    // Handle both #RGB and #RRGGBB formats
    let r, g, b;

    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
      r = parseInt(hex.substring(1, 3), 16);
      g = parseInt(hex.substring(3, 5), 16);
      b = parseInt(hex.substring(5, 7), 16);
    } else {
      return hex; // Invalid format, return as-is
    }

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Draw selection box around selected strokes
  drawSelectionBox(container, bounds, ctx) {
    if (!bounds) return;

    ctx.save();
    ctx.strokeStyle = '#007AFF';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    ctx.strokeRect(
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height
    );

    // Draw corner handles
    ctx.fillStyle = '#007AFF';
    const handleSize = 8;
    const handles = [
      { x: bounds.x, y: bounds.y }, // Top-left
      { x: bounds.x + bounds.width, y: bounds.y }, // Top-right
      { x: bounds.x, y: bounds.y + bounds.height }, // Bottom-left
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height } // Bottom-right
    ];

    for (const handle of handles) {
      ctx.fillRect(
        handle.x - handleSize / 2,
        handle.y - handleSize / 2,
        handleSize,
        handleSize
      );
    }

    ctx.restore();
  }

  // Draw lasso selection path
  drawLasso(container, path, ctx) {
    if (!path || path.length < 2) return;

    ctx.save();
    ctx.strokeStyle = '#007AFF';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    const firstCanvas = this.contentToCanvasCoords(container, path[0].x, path[0].y);
    ctx.moveTo(firstCanvas.x, firstCanvas.y);

    for (let i = 1; i < path.length; i++) {
      const canvasCoords = this.contentToCanvasCoords(container, path[i].x, path[i].y);
      ctx.lineTo(canvasCoords.x, canvasCoords.y);
    }

    ctx.stroke();
    ctx.restore();
  }

  // Cleanup
  cleanup() {
    this.stopRenderLoop();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DrawingEngine;
}
