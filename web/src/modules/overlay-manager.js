// overlay-manager.js
// Manages detection of scrollable containers and creation of per-container overlays

class OverlayManager {
  constructor() {
    this.overlays = new Map(); // container -> overlay object
    this.resizeObservers = new Map();
    this.mutationObserver = null;
  }

  // Utility: check if element is scrollable
  isScrollable(el) {
    if (!el || el.nodeType !== 1) return false;
    const cs = getComputedStyle(el);
    const overflowY = cs.overflowY;
    const overflowX = cs.overflowX;
    const vertically = (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
    const horizontally = (overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth;
    return vertically || horizontally;
  }

  // Find all scrollable containers on page
  findScrollableContainers() {
    const containers = new Set();

    // Always include document scrolling element
    const docScrolling = document.scrollingElement || document.documentElement;
    containers.add(docScrolling);

    // Search DOM for scrollable elements
    const all = document.querySelectorAll('body *');
    for (const el of all) {
      if (this.isScrollable(el)) {
        containers.add(el);
      }
    }

    return Array.from(containers);
  }

  // Find the scrollable container for a given point
  findContainerAtPoint(x, y) {
    // Temporarily hide all overlays to get element under point
    const overlayElements = [];
    for (const [container, overlay] of this.overlays) {
      if (overlay.wrapper && overlay.wrapper.style) {
        overlayElements.push({ elem: overlay.wrapper, display: overlay.wrapper.style.display });
        overlay.wrapper.style.display = 'none';
      }
    }

    const element = document.elementFromPoint(x, y);

    // Restore overlay visibility
    for (const { elem, display } of overlayElements) {
      elem.style.display = display;
    }

    if (!element) return document.scrollingElement || document.documentElement;

    // Walk up to find scrollable ancestor
    let el = element;
    while (el && el !== document.documentElement) {
      if (this.overlays.has(el)) return el;
      el = el.parentElement;
    }

    return document.scrollingElement || document.documentElement;
  }

  // Create overlay for a specific container
  createOverlay(container) {
    if (this.overlays.has(container)) {
      return this.overlays.get(container);
    }

    // Create wrapper element
    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.top = '0';
    wrapper.style.left = '0';
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.pointerEvents = 'none'; // Don't block interactions
    wrapper.style.zIndex = '999998';
    wrapper.className = 'scratch-overlay-wrapper';

    // Ensure container is a positioning context
    const cs = getComputedStyle(container);
    if (cs.position === 'static' && container !== document.scrollingElement && container !== document.documentElement) {
      container.style.position = 'relative';
    }

    // Create shadow root for CSS isolation
    const shadow = wrapper.attachShadow ? wrapper.attachShadow({ mode: 'open' }) : wrapper;

    // Create canvas element
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'auto'; // Canvas captures drawing events
    canvas.style.background = 'transparent';
    canvas.className = 'scratch-canvas';

    // Get 2D context
    const ctx = canvas.getContext('2d');

    // Function to update canvas size
    const updateCanvasSize = () => {
      const width = Math.max(container.scrollWidth, container.clientWidth);
      const height = Math.max(container.scrollHeight, container.clientHeight);

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        return true; // Size changed
      }
      return false;
    };

    updateCanvasSize();
    shadow.appendChild(canvas);

    // Insert wrapper into container
    if (container === document.scrollingElement || container === document.documentElement) {
      document.body.appendChild(wrapper);
    } else {
      container.insertBefore(wrapper, container.firstChild);
    }

    // Watch for size changes
    const ro = new ResizeObserver(() => {
      if (updateCanvasSize()) {
        // Size changed, trigger redraw
        this.emit('resize', container);
      }
    });
    ro.observe(container);
    this.resizeObservers.set(container, ro);

    // Create overlay object
    const overlay = {
      container,
      wrapper,
      shadow,
      canvas,
      ctx,
      updateCanvasSize
    };

    this.overlays.set(container, overlay);
    this.emit('overlayCreated', container, overlay);

    return overlay;
  }

  // Remove overlay for a container
  removeOverlay(container) {
    const overlay = this.overlays.get(container);
    if (!overlay) return;

    // Clean up resize observer
    const ro = this.resizeObservers.get(container);
    if (ro) {
      ro.disconnect();
      this.resizeObservers.delete(container);
    }

    // Remove wrapper from DOM
    if (overlay.wrapper && overlay.wrapper.parentNode) {
      overlay.wrapper.parentNode.removeChild(overlay.wrapper);
    }

    this.overlays.delete(container);
    this.emit('overlayRemoved', container);
  }

  // Initialize overlays for all scrollable containers
  initializeAll() {
    const containers = this.findScrollableContainers();
    for (const container of containers) {
      if (!container.__scratchOverlayInitialized) {
        this.createOverlay(container);
        container.__scratchOverlayInitialized = true;
      }
    }
  }

  // Watch for new scrollable containers (SPA support)
  startWatching() {
    this.mutationObserver = new MutationObserver(() => {
      // Debounce to avoid excessive checks
      if (this._watchDebounce) clearTimeout(this._watchDebounce);
      this._watchDebounce = setTimeout(() => {
        this.initializeAll();
      }, 200);
    });

    this.mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true
    });
  }

  // Stop watching for changes
  stopWatching() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }

  // Clean up all overlays
  cleanup() {
    this.stopWatching();

    for (const container of this.overlays.keys()) {
      this.removeOverlay(container);
    }

    this.overlays.clear();
    this.resizeObservers.clear();
    this.listeners.clear();
  }

  // Simple event system
  listeners = new Map();

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  emit(event, ...args) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    for (const callback of callbacks) {
      try {
        callback(...args);
      } catch (err) {
        console.error('Overlay manager event error:', err);
      }
    }
  }

  // Get overlay for container
  getOverlay(container) {
    return this.overlays.get(container);
  }

  // Get all overlays
  getAllOverlays() {
    return Array.from(this.overlays.values());
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OverlayManager;
}
