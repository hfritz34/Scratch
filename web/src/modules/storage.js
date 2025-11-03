// storage.js
// Manages in-memory stroke storage with automatic cleanup for performance

class StorageManager {
  constructor() {
    this.strokesByContainer = new Map(); // container -> array of strokes
    this.maxDistance = 3000; // px - how far outside viewport before cleanup
    this.cleanupThrottleMs = 500;
    this.lastCleanup = new Map(); // container -> timestamp
  }

  // Add stroke to container
  addStroke(container, stroke) {
    if (!this.strokesByContainer.has(container)) {
      this.strokesByContainer.set(container, []);
    }

    // Calculate bounding box for stroke
    stroke.bbox = this.calculateBoundingBox(stroke.points);

    this.strokesByContainer.get(container).push(stroke);
  }

  // Get all strokes for container
  getStrokes(container) {
    return this.strokesByContainer.get(container) || [];
  }

  // Get visible strokes for container (within buffer distance)
  getVisibleStrokes(container, bufferDistance = this.maxDistance) {
    const strokes = this.getStrokes(container);
    if (strokes.length === 0) return [];

    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;
    const viewLeft = container.scrollLeft;
    const viewRight = viewLeft + container.clientWidth;

    const minY = viewTop - bufferDistance;
    const maxY = viewBottom + bufferDistance;
    const minX = viewLeft - bufferDistance;
    const maxX = viewRight + bufferDistance;

    return strokes.filter(stroke => {
      const bbox = stroke.bbox;
      return bbox.maxY >= minY &&
             bbox.minY <= maxY &&
             bbox.maxX >= minX &&
             bbox.minX <= maxX;
    });
  }

  // Clean up strokes far outside viewport
  cleanupContainer(container, force = false) {
    // Throttle cleanup
    const now = Date.now();
    const lastTime = this.lastCleanup.get(container) || 0;
    if (!force && (now - lastTime) < this.cleanupThrottleMs) {
      return;
    }
    this.lastCleanup.set(container, now);

    const strokes = this.strokesByContainer.get(container);
    if (!strokes || strokes.length === 0) return;

    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;
    const viewLeft = container.scrollLeft;
    const viewRight = viewLeft + container.clientWidth;

    const minY = viewTop - this.maxDistance;
    const maxY = viewBottom + this.maxDistance;
    const minX = viewLeft - this.maxDistance;
    const maxX = viewRight + this.maxDistance;

    const before = strokes.length;
    const filtered = strokes.filter(stroke => {
      const bbox = stroke.bbox;
      return bbox.maxY >= minY &&
             bbox.minY <= maxY &&
             bbox.maxX >= minX &&
             bbox.minX <= maxX;
    });

    if (filtered.length !== before) {
      this.strokesByContainer.set(container, filtered);
      console.log(`Cleaned up ${before - filtered.length} strokes from container`);
      return before - filtered.length; // Return number cleaned
    }

    return 0;
  }

  // Clean up all containers
  cleanupAll(force = false) {
    let totalCleaned = 0;
    for (const container of this.strokesByContainer.keys()) {
      totalCleaned += this.cleanupContainer(container, force) || 0;
    }
    return totalCleaned;
  }

  // Calculate bounding box for array of points
  calculateBoundingBox(points) {
    if (!points || points.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }

    return { minX, maxX, minY, maxY };
  }

  // Remove all strokes from container
  clearContainer(container) {
    this.strokesByContainer.delete(container);
  }

  // Remove all strokes
  clearAll() {
    this.strokesByContainer.clear();
    this.lastCleanup.clear();
  }

  // Get stroke count for container
  getStrokeCount(container) {
    const strokes = this.strokesByContainer.get(container);
    return strokes ? strokes.length : 0;
  }

  // Get total stroke count
  getTotalStrokeCount() {
    let count = 0;
    for (const strokes of this.strokesByContainer.values()) {
      count += strokes.length;
    }
    return count;
  }

  // Remove specific strokes from container
  removeStrokes(container, indicesToRemove) {
    const strokes = this.strokesByContainer.get(container);
    if (!strokes) return;

    // Sort indices in descending order to remove from end first
    const sorted = Array.from(indicesToRemove).sort((a, b) => b - a);

    for (const index of sorted) {
      if (index >= 0 && index < strokes.length) {
        strokes.splice(index, 1);
      }
    }
  }

  // Update stroke in container
  updateStroke(container, index, newStroke) {
    const strokes = this.strokesByContainer.get(container);
    if (!strokes || index < 0 || index >= strokes.length) return;

    // Recalculate bounding box
    newStroke.bbox = this.calculateBoundingBox(newStroke.points);
    strokes[index] = newStroke;
  }

  // Undo support - save state before operations
  createSnapshot(container) {
    const strokes = this.getStrokes(container);
    return strokes.map(s => ({ ...s, points: [...s.points] }));
  }

  // Restore from snapshot
  restoreSnapshot(container, snapshot) {
    this.strokesByContainer.set(container, snapshot);
  }

  // Get memory stats
  getStats() {
    const containerCount = this.strokesByContainer.size;
    const totalStrokes = this.getTotalStrokeCount();
    let totalPoints = 0;

    for (const strokes of this.strokesByContainer.values()) {
      for (const stroke of strokes) {
        totalPoints += stroke.points.length;
      }
    }

    return {
      containers: containerCount,
      strokes: totalStrokes,
      points: totalPoints,
      memoryEstimateMB: ((totalPoints * 16) / 1024 / 1024).toFixed(2) // rough estimate
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}
