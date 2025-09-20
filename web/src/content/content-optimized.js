class ScratchCanvas {
  constructor() {
    this.isDrawing = false;
    this.isActive = false;
    this.isDraggingToolbar = false;
    this.currentTool = 'pen';
    this.currentColor = '#000000';
    this.eraserMode = 'whole'; // 'whole' or 'partial'
    this.toolSizes = {
      pen: 5,
      highlighter: 15,
      eraser: 20
    };
    this.sizeOptions = {
      pen: [2, 5, 8],
      highlighter: [10, 15, 20],
      eraser: [15, 20, 30]
    };
    this.canvas = null;
    this.ctx = null;
    this.toolbar = null;
    this.lastX = 0;
    this.lastY = 0;
    this.shortcuts = this.loadShortcuts();
    this.strokes = []; // Track all strokes for whole eraser functionality
    this.currentStroke = null;
    this.palettes = this.initializePalettes();
    this.currentPalette = 'simple';
    this.paletteSwitchCooldown = false;
    this.isPreviewingPalette = false;
    // Hover-based activation properties
    this.hoverTimeout = null;
    this.hideTimeout = null;
    this.isHoveringContent = false;
    this.isHoveringToolbar = false;
    this.manuallyDisabled = true; // Start disabled to avoid being intrusive
    // Partial eraser properties
    this.isErasing = false;
    this.erasePoints = [];
    // Quick delete mode properties
    this.isQuickDeleteMode = false;
    this.quickDeleteStrokes = new Set();
    this.isQuickDeleting = false;
    this.previousTool = null;
    // Eraser delete mode properties
    this.isEraserDeleteMode = false;
    this.eraserDeleteStrokes = new Set();
    this.isEraserDeleting = false;

    // Performance optimizations
    this.performanceMode = false;
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
    this.viewportPadding = 100; // Extra padding around viewport
    this.dirtyRegions = [];
    this.frameRequestId = null;
    this.lastDrawTime = 0;
    this.drawThrottle = 16; // ~60fps
    this.scrollThrottle = null;
    this.resizeThrottle = null;
    this.maxStrokes = 500; // Limit stroke history
    this.strokeSimplificationThreshold = 100; // Simplify strokes with more than 100 points
    this.heavyDomains = ['youtube.com', 'instagram.com', 'facebook.com', 'twitter.com', 'x.com', 'tiktok.com'];

    this.init();
  }

  init() {
    // Check if we're on a heavy page
    this.detectHeavyPage();

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.initializeExtension();
      });
    } else {
      this.initializeExtension();
    }
  }

  detectHeavyPage() {
    const hostname = window.location.hostname;
    this.performanceMode = this.heavyDomains.some(domain =>
      hostname.includes(domain)
    );

    if (this.performanceMode) {
      console.log('Scratch: Performance mode enabled for', hostname);
    }
  }

  initializeExtension() {
    this.createCanvas();
    this.createToolbar();
    this.setupEventListeners();
    this.loadSettings();
  }

  createCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'scratch-canvas';
    this.canvas.style.position = 'fixed'; // Changed from absolute to fixed
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '999998';
    this.canvas.style.display = 'none';

    // Only size canvas to viewport
    this.updateCanvasSize();

    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d', {
      alpha: true,
      desynchronized: true, // Better performance
      willReadFrequently: false
    });

    // Create offscreen canvas for double buffering
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', {
      alpha: true,
      desynchronized: true
    });
  }

  updateCanvasSize() {
    // Only size to viewport, not entire document
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Avoid unnecessary resizes
    if (this.canvas.width === width && this.canvas.height === height) {
      return;
    }

    // Store current drawing if exists
    const imageData = this.ctx ? this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height) : null;

    // Update both canvases
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';

    this.offscreenCanvas.width = width;
    this.offscreenCanvas.height = height;

    // Restore drawing if existed
    if (imageData && this.ctx) {
      this.ctx.putImageData(imageData, 0, 0);
    }

    console.log('Canvas sized to viewport:', width, 'x', height);
  }

  createToolbar() {
    console.log('Creating toolbar...');
    this.toolbar = document.createElement('div');
    this.toolbar.id = 'scratch-toolbar';

    // Simplified toolbar class for performance mode
    if (this.performanceMode) {
      this.toolbar.classList.add('performance-mode');
    }

    const colors = this.getCurrentPaletteColors();
    const colorSwatches = colors.map((color, index) =>
      `<div class="color-swatch ${index === 0 ? 'active' : ''}" data-color="${color}" style="background-color: ${color};" title="Color ${index + 1}"></div>`
    ).join('');

    this.toolbar.innerHTML = `
      <div class="toolbar-drag-handle" title="Drag to move"></div>
      <button class="tool-btn active" data-tool="pen" title="Pen (P)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </svg>
      </button>
      <div class="size-buttons" data-tool="pen">
        <button class="size-btn small" data-size="2" title="Small (2px)"></button>
        <button class="size-btn medium active" data-size="5" title="Medium (5px)"></button>
        <button class="size-btn large" data-size="8" title="Large (8px)"></button>
      </div>
      <button class="tool-btn" data-tool="highlighter" title="Highlighter (H)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11 9h5.5L11 3.5V9zM7.5 6.5C6.12 6.5 5 7.62 5 9v10.5c0 1.38 1.12 2.5 2.5 2.5h9c1.38 0 2.5-1.12 2.5-2.5V9H13V3.5h-3c-1.38 0-2.5 1.12-2.5 2.5V6.5z"/>
        </svg>
      </button>
      <div class="size-buttons" data-tool="highlighter" style="display: none;">
        <button class="size-btn small" data-size="10" title="Small (10px)"></button>
        <button class="size-btn medium active" data-size="15" title="Medium (15px)"></button>
        <button class="size-btn large" data-size="20" title="Large (20px)"></button>
      </div>
      <button class="tool-btn" data-tool="eraser" title="Eraser (E)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 0 1-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l10.6-10.6c.79-.78 2.05-.78 2.83 0M4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53-6.36-6.36-3.54 3.54c-.78.78-.78 2.05 0 2.82z"/>
        </svg>
      </button>
      <div class="size-buttons" data-tool="eraser" style="display: none;">
        <button class="size-btn small" data-size="15" title="Small (15px)"></button>
        <button class="size-btn medium active" data-size="20" title="Medium (20px)"></button>
        <button class="size-btn large" data-size="30" title="Large (30px)"></button>
      </div>
      <div class="eraser-mode-pills">
        <button class="mode-pill active" data-mode="whole" title="Whole eraser">Whole</button>
        <button class="mode-pill" data-mode="partial" title="Partial eraser">Partial</button>
      </div>
      <div class="toolbar-divider"></div>
      ${colorSwatches}
      <div class="toolbar-divider"></div>
      <button class="palette-btn" title="Change palette">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22C13.11,22 14,21.11 14,20V19.6C14,19.27 14.27,19 14.6,19H16A3,3 0 0,0 19,16V13A10,10 0 0,0 12,2M6.5,9A1.5,1.5 0 0,1 8,10.5A1.5,1.5 0 0,1 6.5,12A1.5,1.5 0 0,1 5,10.5A1.5,1.5 0 0,1 6.5,9M9.5,5.5A1.5,1.5 0 0,1 11,7A1.5,1.5 0 0,1 9.5,8.5A1.5,1.5 0 0,1 8,7A1.5,1.5 0 0,1 9.5,5.5M14.5,5.5A1.5,1.5 0 0,1 16,7A1.5,1.5 0 0,1 14.5,8.5A1.5,1.5 0 0,1 13,7A1.5,1.5 0 0,1 14.5,5.5M17.5,9A1.5,1.5 0 0,1 19,10.5A1.5,1.5 0 0,1 17.5,12A1.5,1.5 0 0,1 16,10.5A1.5,1.5 0 0,1 17.5,9Z"/>
        </svg>
      </button>
      <button class="clear-btn" title="Clear all (Ctrl+Shift+C)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
        </svg>
      </button>
      ${this.performanceMode ? '<span class="perf-indicator" title="Performance mode active">⚡</span>' : ''}
    `;

    // Position toolbar at top center initially
    this.toolbar.style.left = '50%';
    this.toolbar.style.top = '20px';
    this.toolbar.style.transform = 'translateX(-50%)';
    this.toolbar.style.display = 'none';
    this.toolbarPosition = null;

    document.body.appendChild(this.toolbar);
    console.log('Toolbar appended to body:', this.toolbar);
    this.setupToolbarEvents();
    this.setupToolbarDrag();
    this.setupHoverActivation();
  }

  // Throttled event handler helper
  throttle(func, delay) {
    let lastCall = 0;
    let timeoutId = null;

    return function(...args) {
      const now = Date.now();
      const timeSinceLastCall = now - lastCall;

      if (timeSinceLastCall >= delay) {
        lastCall = now;
        func.apply(this, args);
      } else if (!timeoutId) {
        timeoutId = setTimeout(() => {
          lastCall = Date.now();
          timeoutId = null;
          func.apply(this, args);
        }, delay - timeSinceLastCall);
      }
    };
  }

  // Debounced event handler helper
  debounce(func, delay) {
    let timeoutId = null;

    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  }

  setupEventListeners() {
    // Throttled/debounced handlers
    const throttledMouseMove = this.throttle(this.handleMouseMove.bind(this), this.drawThrottle);
    const debouncedResize = this.debounce(() => {
      this.resizeCanvas();
    }, 200);
    const debouncedScroll = this.debounce(() => {
      this.handleScroll();
    }, 100);

    window.addEventListener('resize', debouncedResize, { passive: true });
    window.addEventListener('scroll', debouncedScroll, { passive: true });

    document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    document.addEventListener('mousemove', throttledMouseMove);
    document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    document.addEventListener('contextmenu', (e) => this.handleRightClick(e));
    document.addEventListener('keydown', (e) => this.handleKeyPress(e));

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'toggleDrawing') {
        this.toggleDrawingMode();
        sendResponse({ isActive: this.isActive });
      } else if (request.action === 'clearCanvas') {
        this.clearCanvas();
        sendResponse({ success: true });
      } else if (request.action === 'getState') {
        sendResponse({ isActive: this.isActive });
      }
      return true;
    });
  }

  handleScroll() {
    // Only redraw visible strokes when scrolling
    if (this.isActive && this.strokes.length > 0) {
      this.renderVisibleStrokes();
    }
  }

  renderVisibleStrokes() {
    // Cancel any pending render
    if (this.frameRequestId) {
      cancelAnimationFrame(this.frameRequestId);
    }

    this.frameRequestId = requestAnimationFrame(() => {
      // Clear canvas
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Get viewport bounds with padding
      const scrollX = window.pageXOffset;
      const scrollY = window.pageYOffset;
      const viewportLeft = scrollX - this.viewportPadding;
      const viewportRight = scrollX + window.innerWidth + this.viewportPadding;
      const viewportTop = scrollY - this.viewportPadding;
      const viewportBottom = scrollY + window.innerHeight + this.viewportPadding;

      // Only render strokes that are visible
      for (const stroke of this.strokes) {
        if (!stroke || !stroke.bounds) continue;

        // Check if stroke is in viewport
        if (stroke.bounds.maxX < viewportLeft ||
            stroke.bounds.minX > viewportRight ||
            stroke.bounds.maxY < viewportTop ||
            stroke.bounds.minY > viewportBottom) {
          continue; // Skip strokes outside viewport
        }

        // Render stroke with adjusted coordinates
        this.drawStrokeOptimized(stroke, -scrollX, -scrollY);
      }

      this.frameRequestId = null;
    });
  }

  drawStrokeOptimized(stroke, offsetX = 0, offsetY = 0) {
    if (!stroke || !stroke.points || stroke.points.length === 0) return;

    const ctx = this.ctx;

    // Simplify stroke if it has too many points
    const points = stroke.points.length > this.strokeSimplificationThreshold
      ? this.simplifyStroke(stroke.points)
      : stroke.points;

    if (stroke.tool === 'highlighter') {
      ctx.globalCompositeOperation = this.performanceMode ? 'source-over' : 'multiply';
      ctx.strokeStyle = this.hexToRgba(stroke.color, this.performanceMode ? 0.2 : 0.4);
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
    }

    ctx.lineWidth = stroke.size || 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();

    if (points.length === 1) {
      const point = points[0];
      ctx.arc(point.x + offsetX, point.y + offsetY, (stroke.size || 2) / 2, 0, 2 * Math.PI);
      ctx.fill();
    } else {
      ctx.moveTo(points[0].x + offsetX, points[0].y + offsetY);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x + offsetX, points[i].y + offsetY);
      }
      ctx.stroke();
    }
  }

  simplifyStroke(points) {
    // Douglas-Peucker algorithm for line simplification
    if (points.length <= 2) return points;

    const tolerance = 2; // Adjust for more/less simplification

    // Find the point with maximum distance from line between start and end
    let maxDist = 0;
    let maxIndex = 0;
    const start = points[0];
    const end = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const dist = this.perpendicularDistance(points[i], start, end);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }

    // If max distance is greater than tolerance, recursively simplify
    if (maxDist > tolerance) {
      const left = this.simplifyStroke(points.slice(0, maxIndex + 1));
      const right = this.simplifyStroke(points.slice(maxIndex));
      return [...left.slice(0, -1), ...right];
    }

    // Otherwise return just the endpoints
    return [start, end];
  }

  perpendicularDistance(point, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;

    if (dx === 0 && dy === 0) {
      return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
    }

    const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
    const t_clamped = Math.max(0, Math.min(1, t));

    const nearestX = lineStart.x + t_clamped * dx;
    const nearestY = lineStart.y + t_clamped * dy;

    return Math.sqrt((point.x - nearestX) ** 2 + (point.y - nearestY) ** 2);
  }

  handleMouseDown(e) {
    if (!this.isActive) return;
    if (e.target.closest('#scratch-toolbar') || this.isDraggingToolbar) return;
    if (this.isQuickDeleteMode || this.isEraserDeleteMode) return;
    if (e.button !== 0) return;

    if (this.currentTool === 'eraser') {
      if (this.eraserMode === 'whole') {
        this.startEraserDeleteMode(e);
        return;
      } else {
        const scrollX = window.pageXOffset;
        const scrollY = window.pageYOffset;
        this.startPartialErase(e.pageX + scrollX, e.pageY + scrollY);
      }
    }

    this.isDrawing = true;
    const scrollX = window.pageXOffset;
    const scrollY = window.pageYOffset;
    this.lastX = e.pageX + scrollX;
    this.lastY = e.pageY + scrollY;

    // Start new stroke tracking
    this.currentStroke = {
      tool: this.currentTool,
      color: this.currentColor,
      size: this.toolSizes[this.currentTool],
      points: [{ x: this.lastX, y: this.lastY }],
      bounds: {
        minX: this.lastX,
        maxX: this.lastX,
        minY: this.lastY,
        maxY: this.lastY
      }
    };
  }

  handleMouseMove(e) {
    if (!this.isActive || !this.isDrawing) return;
    if (this.isQuickDeleteMode) return;

    const scrollX = window.pageXOffset;
    const scrollY = window.pageYOffset;
    const currentX = e.pageX + scrollX;
    const currentY = e.pageY + scrollY;

    // Handle partial erasing
    if (this.currentTool === 'eraser' && this.eraserMode === 'partial' && this.isErasing) {
      this.partialErase(currentX, currentY);
      return;
    }

    // Add point to current stroke
    if (this.currentStroke) {
      this.currentStroke.points.push({ x: currentX, y: currentY });

      // Update stroke bounds
      this.currentStroke.bounds.minX = Math.min(this.currentStroke.bounds.minX, currentX);
      this.currentStroke.bounds.maxX = Math.max(this.currentStroke.bounds.maxX, currentX);
      this.currentStroke.bounds.minY = Math.min(this.currentStroke.bounds.minY, currentY);
      this.currentStroke.bounds.maxY = Math.max(this.currentStroke.bounds.maxY, currentY);
    }

    // Draw on canvas with viewport offset
    const viewportX = currentX - scrollX;
    const viewportY = currentY - scrollY;
    const lastViewportX = this.lastX - scrollX;
    const lastViewportY = this.lastY - scrollY;

    if (this.currentTool === 'highlighter') {
      this.ctx.globalCompositeOperation = this.performanceMode ? 'source-over' : 'multiply';
      this.ctx.strokeStyle = this.hexToRgba(this.currentColor, this.performanceMode ? 0.2 : 0.4);
      this.ctx.lineWidth = this.toolSizes.highlighter;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      this.ctx.beginPath();
      this.ctx.moveTo(lastViewportX, lastViewportY);
      this.ctx.lineTo(viewportX, viewportY);
      this.ctx.stroke();
    } else if (this.currentTool === 'pen') {
      this.ctx.beginPath();
      this.ctx.moveTo(lastViewportX, lastViewportY);
      this.ctx.lineTo(viewportX, viewportY);

      this.ctx.strokeStyle = this.currentColor;
      this.ctx.lineWidth = this.toolSizes.pen;
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.lineCap = 'round';
      this.ctx.stroke();
    }

    this.lastX = currentX;
    this.lastY = currentY;
  }

  handleMouseUp(e) {
    if (this.isQuickDeleteMode) return;

    if (this.isErasing) {
      this.isErasing = false;
      this.erasePoints = [];
    }

    if (this.isDrawing && this.currentStroke) {
      if (this.currentStroke.points.length > 0) {
        this.strokes.push(this.currentStroke);

        // Enforce stroke limit
        if (this.strokes.length > this.maxStrokes) {
          this.strokes.splice(0, this.strokes.length - this.maxStrokes);
        }

        console.log(`Saved stroke with ${this.currentStroke.points.length} points`);
      }
      this.currentStroke = null;
    }
    this.isDrawing = false;
  }

  resizeCanvas() {
    this.updateCanvasSize();
    this.renderVisibleStrokes();
  }

  redrawCanvas() {
    this.renderVisibleStrokes();
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.strokes = [];
  }

  // Copy remaining methods from original with viewport adjustments...
  // (setupToolbarEvents, setupToolbarDrag, setTool, setupHoverActivation, etc.)
  // These remain largely the same but with scroll offset adjustments where needed

  setupToolbarEvents() {
    // Tool selection and size button management
    this.toolbar.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tool = e.currentTarget.dataset.tool;
        this.setTool(tool);
      });
    });

    // Size button events
    this.toolbar.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const size = parseInt(e.currentTarget.dataset.size);
        const sizeGroup = e.currentTarget.closest('.size-buttons');
        const tool = sizeGroup.dataset.tool;

        this.toolSizes[tool] = size;

        sizeGroup.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');

        if (tool === this.currentTool) {
          this.updateCursor();
        }

        console.log(`Updated ${tool} size to ${size}px`);
      });
    });

    // Mode pill events (for eraser modes)
    this.toolbar.querySelectorAll('.mode-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        this.eraserMode = mode;

        this.toolbar.querySelectorAll('.mode-pill').forEach(p => p.classList.remove('active'));
        e.currentTarget.classList.add('active');

        console.log(`Eraser mode set to: ${mode}`);
      });
    });

    // Color selection
    this.toolbar.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        const color = e.currentTarget.dataset.color;
        this.setColor(color);
      });

      if (!this.performanceMode) {
        swatch.addEventListener('mouseenter', (e) => {
          const color = e.currentTarget.dataset.color;
          if (color !== this.currentColor) {
            e.currentTarget.style.transform = 'scale(1.2)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
          }
        });

        swatch.addEventListener('mouseleave', (e) => {
          e.currentTarget.style.transform = '';
          e.currentTarget.style.boxShadow = '';
        });
      }
    });

    // Palette button
    const paletteBtn = this.toolbar.querySelector('.palette-btn');
    if (paletteBtn) {
      paletteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.switchPalette();
      });

      if (!this.performanceMode) {
        let hoverTimeout = null;

        paletteBtn.addEventListener('mouseenter', (e) => {
          hoverTimeout = setTimeout(() => {
            this.previewNextPalette();
          }, 500);
        });

        paletteBtn.addEventListener('mouseleave', (e) => {
          if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
          }
          this.clearPalettePreview();
        });
      }
    }

    // Clear button
    this.toolbar.querySelector('.clear-btn').addEventListener('click', () => {
      this.clearCanvas();
    });
  }

  setupToolbarDrag() {
    const handle = this.toolbar.querySelector('.toolbar-drag-handle');
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    this.toolbarPosition = null;

    const handleMouseDown = (e) => {
      isDragging = true;
      this.isDraggingToolbar = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = this.toolbar.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;

      this.toolbarPosition = null;

      this.toolbar.style.transform = 'none';
      this.toolbar.style.left = startLeft + 'px';
      this.toolbar.style.top = startTop + 'px';

      this.toolbar.classList.add('dragging');

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      e.preventDefault();
      e.stopPropagation();
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      const newLeft = startLeft + deltaX;
      const newTop = startTop + deltaY;

      this.toolbar.style.left = newLeft + 'px';
      this.toolbar.style.top = newTop + 'px';
    };

    const handleMouseUp = (e) => {
      if (!isDragging) return;

      isDragging = false;
      this.isDraggingToolbar = false;

      this.snapToEdge();

      this.toolbar.classList.remove('dragging');

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    handle.addEventListener('mousedown', handleMouseDown);
  }

  snapToEdge() {
    const rect = this.toolbar.getBoundingClientRect();
    const threshold = 80;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const distances = {
      top: rect.top,
      bottom: windowHeight - rect.bottom,
      left: rect.left,
      right: windowWidth - rect.right
    };

    let closestEdge = null;
    let minDistance = threshold;

    for (const [edge, distance] of Object.entries(distances)) {
      if (distance < minDistance) {
        minDistance = distance;
        closestEdge = edge;
      }
    }

    if (closestEdge) {
      this.toolbarPosition = closestEdge;
      this.toolbar.classList.remove('dragging');
      requestAnimationFrame(() => {
        this.positionToolbarAtEdge(closestEdge);
      });
    }
  }

  positionToolbarAtEdge(edge) {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const currentRect = this.toolbar.getBoundingClientRect();

    this.toolbar.classList.remove('horizontal', 'vertical', 'edge-top', 'edge-bottom', 'edge-left', 'edge-right');

    switch (edge) {
      case 'top':
        this.toolbar.classList.add('horizontal');
        if (currentRect.left <= 120) {
          this.toolbar.style.left = '10px';
          this.toolbar.style.transform = 'none';
        } else if ((windowWidth - currentRect.right) <= 120) {
          this.toolbar.style.left = (windowWidth - this.toolbar.offsetWidth - 10) + 'px';
          this.toolbar.style.transform = 'none';
        } else {
          this.toolbar.style.left = '50%';
          this.toolbar.style.transform = 'translateX(-50%)';
        }
        this.toolbar.style.top = '20px';
        this.toolbar.classList.add('edge-top');
        break;

      case 'bottom':
        this.toolbar.classList.add('horizontal');
        if (currentRect.left <= 120) {
          this.toolbar.style.left = '10px';
          this.toolbar.style.transform = 'none';
        } else if ((windowWidth - currentRect.right) <= 120) {
          this.toolbar.style.left = (windowWidth - this.toolbar.offsetWidth - 10) + 'px';
          this.toolbar.style.transform = 'none';
        } else {
          this.toolbar.style.left = '50%';
          this.toolbar.style.transform = 'translateX(-50%)';
        }
        this.toolbar.style.top = (windowHeight - this.toolbar.offsetHeight - 20) + 'px';
        this.toolbar.classList.add('edge-bottom');
        break;

      case 'left':
        this.toolbar.style.left = '10px';
        this.toolbar.style.top = '50%';
        this.toolbar.style.transform = 'translateY(-50%)';
        this.toolbar.classList.add('vertical', 'edge-left');
        break;

      case 'right':
        this.toolbar.classList.add('vertical', 'edge-right');
        this.toolbar.style.left = (windowWidth - this.toolbar.offsetWidth - 10) + 'px';
        this.toolbar.style.top = '50%';
        this.toolbar.style.transform = 'translateY(-50%)';
        break;
    }
  }

  setTool(tool) {
    this.currentTool = tool;

    this.toolbar.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    this.toolbar.querySelector(`[data-tool="${tool}"]`).classList.add('active');

    this.toolbar.querySelectorAll('.size-buttons').forEach(sizeGroup => {
      if (sizeGroup.dataset.tool === tool) {
        sizeGroup.style.display = 'flex';
        const currentSize = this.toolSizes[tool];
        sizeGroup.querySelectorAll('.size-btn').forEach(btn => {
          btn.classList.remove('active');
          if (parseInt(btn.dataset.size) === currentSize) {
            btn.classList.add('active');
          }
        });
      } else {
        sizeGroup.style.display = 'none';
      }
    });

    const colorSwatches = this.toolbar.querySelectorAll('.color-swatch');
    const paletteBtn = this.toolbar.querySelector('.palette-btn');
    const dividers = this.toolbar.querySelectorAll('.toolbar-divider');
    const eraserModePills = this.toolbar.querySelector('.eraser-mode-pills');

    if (tool === 'eraser') {
      colorSwatches.forEach(swatch => swatch.style.display = 'none');
      if (paletteBtn) paletteBtn.style.display = 'none';
      if (dividers[0]) dividers[0].style.display = 'none';
      if (dividers[1]) dividers[1].style.display = 'none';
      if (eraserModePills) {
        eraserModePills.classList.add('visible');
      }
    } else {
      colorSwatches.forEach(swatch => swatch.style.display = '');
      if (paletteBtn) paletteBtn.style.display = '';
      if (dividers[0]) dividers[0].style.display = '';
      if (dividers[1]) dividers[1].style.display = '';
      if (eraserModePills) {
        eraserModePills.classList.remove('visible');
      }
    }

    this.updateCursor();
  }

  setupHoverActivation() {
    document.addEventListener('mousemove', (e) => this.handleContentHover(e));

    this.toolbar.addEventListener('mouseenter', () => {
      this.isHoveringToolbar = true;
      this.clearHideTimeout();
    });

    this.toolbar.addEventListener('mouseleave', () => {
      this.isHoveringToolbar = false;
      this.checkShouldHide();
    });
  }

  handleContentHover(e) {
    if (e.target.closest('#scratch-toolbar') || e.target.closest('#scratch-canvas')) {
      return;
    }

    const isContentArea = !e.target.closest('button') &&
                         !e.target.closest('input') &&
                         !e.target.closest('select') &&
                         !e.target.closest('textarea') &&
                         !e.target.closest('nav') &&
                         !e.target.closest('header') &&
                         !e.target.closest('.menu') &&
                         !e.target.closest('[role="button"]') &&
                         !e.target.closest('[role="menu"]');

    if (isContentArea && !this.isHoveringContent) {
      this.isHoveringContent = true;
      this.startHoverActivation();
    } else if (!isContentArea && this.isHoveringContent) {
      this.isHoveringContent = false;
      this.checkShouldHide();
    }
  }

  startHoverActivation() {
    this.clearHideTimeout();

    if (this.manuallyDisabled) {
      return;
    }

    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }

    this.hoverTimeout = setTimeout(() => {
      if (this.isHoveringContent && !this.isActive && !this.manuallyDisabled) {
        this.activateDrawingMode();
      }
    }, 500);
  }

  checkShouldHide() {
    if (!this.isHoveringContent && !this.isHoveringToolbar && this.isActive) {
      this.startHideTimeout();
    }
  }

  startHideTimeout() {
    this.clearHideTimeout();
    this.hideTimeout = setTimeout(() => {
      if (!this.isHoveringContent && !this.isHoveringToolbar && this.isActive) {
        this.deactivateDrawingMode();
      }
    }, 1000);
  }

  clearHideTimeout() {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  activateDrawingMode() {
    if (!this.isActive && !this.manuallyDisabled) {
      this.isActive = true;
      console.log('Hover-activated drawing mode');
      this.canvas.style.display = 'block';
      this.canvas.style.pointerEvents = 'auto';
      this.toolbar.style.display = 'flex';
      this.setTool('pen');
      this.updateCursor();
      this.keepToolbarInBounds();
    }
  }

  deactivateDrawingMode() {
    if (this.isActive) {
      this.isActive = false;
      console.log('Hover-deactivated drawing mode');
      this.canvas.style.display = 'none';
      this.canvas.style.pointerEvents = 'none';
      this.toolbar.style.display = 'none';
      this.canvas.style.cursor = 'default';
    }
  }

  toggleDrawingMode() {
    this.isActive = !this.isActive;
    console.log('Toggle drawing mode:', this.isActive);

    if (!this.isActive) {
      this.manuallyDisabled = true;
    } else {
      this.manuallyDisabled = false;
    }

    this.canvas.style.display = this.isActive ? 'block' : 'none';
    this.canvas.style.pointerEvents = this.isActive ? 'auto' : 'none';
    this.toolbar.style.display = this.isActive ? 'flex' : 'none';

    if (this.isActive) {
      this.setTool('pen');
      this.updateCursor();
      this.keepToolbarInBounds();
      this.renderVisibleStrokes();
    } else {
      this.canvas.style.cursor = 'default';
    }
  }

  keepToolbarInBounds() {
    if (!this.toolbar || !this.isActive) return;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const margin = 20;

    if (this.toolbarPosition) {
      this.positionToolbarAtEdge(this.toolbarPosition);
      return;
    }

    let currentLeft = parseInt(this.toolbar.style.left) || 0;
    let currentTop = parseInt(this.toolbar.style.top) || 0;

    const originalTransform = this.toolbar.style.transform;
    this.toolbar.style.transform = 'none';
    const rect = this.toolbar.getBoundingClientRect();

    let needsUpdate = false;
    let newLeft = currentLeft;
    let newTop = currentTop;

    if (originalTransform.includes('translateX(-50%)')) {
      const toolbarWidth = rect.width;
      const maxLeft = windowWidth - toolbarWidth / 2 - margin;
      const minLeft = toolbarWidth / 2 + margin;

      if (this.toolbar.style.left === '50%') {
        newLeft = windowWidth / 2;
      }

      if (newLeft > maxLeft) {
        newLeft = maxLeft;
        needsUpdate = true;
      } else if (newLeft < minLeft) {
        newLeft = minLeft;
        needsUpdate = true;
      }
    } else {
      const toolbarWidth = rect.width;
      const toolbarHeight = rect.height;

      if (currentLeft + toolbarWidth > windowWidth - margin) {
        newLeft = windowWidth - toolbarWidth - margin;
        needsUpdate = true;
      } else if (currentLeft < margin) {
        newLeft = margin;
        needsUpdate = true;
      }

      if (currentTop + toolbarHeight > windowHeight - margin) {
        newTop = windowHeight - toolbarHeight - margin;
        needsUpdate = true;
      } else if (currentTop < margin) {
        newTop = margin;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      this.toolbar.style.left = newLeft + 'px';
      this.toolbar.style.top = newTop + 'px';
      this.toolbar.style.transform = originalTransform;
    } else {
      this.toolbar.style.transform = originalTransform;
    }
  }

  updateCursor() {
    if (!this.isActive) return;

    const color = this.currentColor || '#000000';
    const timestamp = Date.now();
    let cursorSvg = '';

    if (this.currentTool === 'pen') {
      cursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="8" fill="${color}" stroke="white" stroke-width="2"/>
        <circle cx="16" cy="16" r="2" fill="white"/>
        <text x="1" y="1" fill="transparent">${timestamp}</text>
      </svg>`;
    } else if (this.currentTool === 'highlighter') {
      const rgba = this.hexToRgba(color, 0.3);
      cursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <rect x="8" y="8" width="16" height="16" fill="${rgba}" stroke="white" stroke-width="2"/>
        <circle cx="16" cy="16" r="2" fill="black"/>
        <text x="1" y="1" fill="transparent">${timestamp}</text>
      </svg>`;
    } else if (this.currentTool === 'eraser') {
      cursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="10" fill="none" stroke="red" stroke-width="3"/>
        <line x1="10" y1="16" x2="22" y2="16" stroke="red" stroke-width="2"/>
        <line x1="16" y1="10" x2="16" y2="22" stroke="red" stroke-width="2"/>
        <text x="1" y="1" fill="transparent">${timestamp}</text>
      </svg>`;
    }

    const encodedSvg = encodeURIComponent(cursorSvg);
    const cursorUrl = `url('data:image/svg+xml;utf8,${encodedSvg}') 16 16, crosshair`;

    this.canvas.style.cursor = 'auto';
    setTimeout(() => {
      this.canvas.style.cursor = 'crosshair';
      setTimeout(() => {
        this.canvas.style.cursor = cursorUrl;
      }, 10);
    }, 10);
  }

  setColor(color) {
    this.currentColor = color;

    this.toolbar.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.classList.remove('active');
      swatch.style.transform = '';
      swatch.style.boxShadow = '';
    });

    const swatch = this.toolbar.querySelector(`[data-color="${color}"]`);
    if (swatch) {
      swatch.classList.add('active');
    }

    const customColorPicker = this.toolbar.querySelector('#custom-color');
    if (customColorPicker) {
      customColorPicker.value = color;
    }

    this.updateCursor();
  }

  handleRightClick(e) {
    if (!this.isActive) return;
    e.preventDefault();

    if (this.currentTool === 'eraser') {
      this.toggleEraserMode();
      return;
    }

    const now = Date.now();

    if (this.lastRightClick && now - this.lastRightClick < 300) {
      this.clearCanvas();
      this.lastRightClick = null;
      return;
    }

    this.startQuickDeleteMode(e);
    this.lastRightClick = now;
  }

  toggleEraserMode() {
    if (this.currentTool !== 'eraser') return;

    this.eraserMode = this.eraserMode === 'whole' ? 'partial' : 'whole';

    const modePills = this.toolbar.querySelectorAll('.mode-pill');
    modePills.forEach(pill => {
      pill.classList.remove('active');
      if (pill.dataset.mode === this.eraserMode) {
        pill.classList.add('active');
      }
    });

    console.log('Eraser mode toggled to:', this.eraserMode);
  }

  startEraserDeleteMode(e) {
    if (this.isEraserDeleteMode) return;

    console.log('Starting eraser delete mode');
    this.isEraserDeleteMode = true;
    this.eraserDeleteStrokes = new Set();
    this.isEraserDeleting = true;

    const scrollX = window.pageXOffset;
    const scrollY = window.pageYOffset;

    const handleMouseMove = (moveEvent) => {
      if (this.isEraserDeleteMode && this.isEraserDeleting) {
        this.highlightStrokesForEraserDeletion(moveEvent.pageX + scrollX, moveEvent.pageY + scrollY);
      }
    };

    const handleMouseUp = (upEvent) => {
      if (upEvent.button === 0 && this.isEraserDeleteMode) {
        this.endEraserDeleteMode();
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    this.highlightStrokesForEraserDeletion(e.pageX + scrollX, e.pageY + scrollY);
  }

  highlightStrokesForEraserDeletion(x, y) {
    const eraserSize = this.toolSizes.eraser;

    for (let i = 0; i < this.strokes.length; i++) {
      const stroke = this.strokes[i];
      if (!stroke || !stroke.bounds || !stroke.points || stroke.points.length === 0) continue;

      const padding = Math.max(stroke.size || 15, 15);

      if (x >= stroke.bounds.minX - padding && x <= stroke.bounds.maxX + padding &&
          y >= stroke.bounds.minY - padding && y <= stroke.bounds.maxY + padding) {

        if (this.isPointNearStroke(x, y, stroke)) {
          this.eraserDeleteStrokes.add(i);
        }
      }
    }

    this.redrawCanvasWithEraserHighlights();
  }

  redrawCanvasWithEraserHighlights() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const scrollX = window.pageXOffset;
    const scrollY = window.pageYOffset;

    for (let i = 0; i < this.strokes.length; i++) {
      const stroke = this.strokes[i];
      if (!stroke || !stroke.points || stroke.points.length === 0) continue;

      if (this.eraserDeleteStrokes.has(i)) {
        this.ctx.globalAlpha = 0.3;
      } else {
        this.ctx.globalAlpha = 1.0;
      }

      this.drawStrokeOptimized(stroke, -scrollX, -scrollY);
    }

    this.ctx.globalAlpha = 1.0;
  }

  endEraserDeleteMode() {
    if (!this.isEraserDeleteMode) return;

    const strokesToDelete = this.eraserDeleteStrokes.size;
    console.log(`Ending eraser delete mode, deleting ${strokesToDelete} strokes`);

    if (strokesToDelete > 0) {
      const strokeIndices = Array.from(this.eraserDeleteStrokes).sort((a, b) => b - a);
      for (const index of strokeIndices) {
        this.strokes.splice(index, 1);
      }
    }

    this.isEraserDeleteMode = false;
    this.isEraserDeleting = false;
    this.eraserDeleteStrokes.clear();

    this.redrawCanvas();
  }

  startQuickDeleteMode(e) {
    if (this.isQuickDeleteMode) return;

    console.log('Starting quick delete mode');
    this.isQuickDeleteMode = true;
    this.quickDeleteStrokes.clear();
    this.previousTool = this.currentTool;
    this.isQuickDeleting = true;

    const scrollX = window.pageXOffset;
    const scrollY = window.pageYOffset;

    const handleMouseMove = (moveEvent) => {
      if (this.isQuickDeleteMode && this.isQuickDeleting) {
        this.highlightStrokesForDeletion(moveEvent.pageX + scrollX, moveEvent.pageY + scrollY);
      }
    };

    const handleMouseUp = (upEvent) => {
      if (upEvent.button === 2) {
        this.endQuickDeleteMode();
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('contextmenu', preventContext);
      }
    };

    const preventContext = (contextEvent) => {
      contextEvent.preventDefault();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('contextmenu', preventContext);

    this.highlightStrokesForDeletion(e.pageX + scrollX, e.pageY + scrollY);
  }

  highlightStrokesForDeletion(x, y) {
    const eraserSize = this.toolSizes.eraser;

    for (let i = 0; i < this.strokes.length; i++) {
      const stroke = this.strokes[i];
      if (!stroke || !stroke.bounds || !stroke.points || stroke.points.length === 0) continue;

      const padding = Math.max(stroke.size || 15, 15);

      if (x >= stroke.bounds.minX - padding && x <= stroke.bounds.maxX + padding &&
          y >= stroke.bounds.minY - padding && y <= stroke.bounds.maxY + padding) {

        if (this.isPointNearStroke(x, y, stroke)) {
          this.quickDeleteStrokes.add(i);
        }
      }
    }

    this.redrawCanvasWithHighlights();
  }

  endQuickDeleteMode() {
    console.log(`Ending quick delete mode, deleting ${this.quickDeleteStrokes.size} strokes`);

    const strokeIndices = Array.from(this.quickDeleteStrokes).sort((a, b) => b - a);
    for (const index of strokeIndices) {
      this.strokes.splice(index, 1);
    }

    this.isQuickDeleteMode = false;
    this.quickDeleteStrokes.clear();
    this.isQuickDeleting = false;

    this.isDrawing = false;
    this.currentStroke = null;

    if (this.previousTool) {
      this.setTool(this.previousTool);
      this.previousTool = null;
    }

    this.redrawCanvas();
  }

  redrawCanvasWithHighlights() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const scrollX = window.pageXOffset;
    const scrollY = window.pageYOffset;

    for (let i = 0; i < this.strokes.length; i++) {
      const stroke = this.strokes[i];
      const isHighlighted = this.quickDeleteStrokes.has(i);

      if (isHighlighted) {
        this.ctx.save();
        this.ctx.globalAlpha = 0.3;
        this.drawStrokeOptimized(stroke, -scrollX, -scrollY);
        this.ctx.restore();
      } else {
        this.drawStrokeOptimized(stroke, -scrollX, -scrollY);
      }
    }
  }

  handleKeyPress(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    if (e.key === 'd' || e.key === 'D') {
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        this.toggleDrawingMode();
        return;
      }
    }

    if (e.key === 'Escape' && this.isActive) {
      e.preventDefault();
      this.toggleDrawingMode();
      return;
    }

    if (!this.shortcuts || !this.isActive) return;

    const key = this.getKeyString(e);
    const action = this.shortcuts[key];

    if (action) {
      e.preventDefault();
      this.executeAction(action);
    }
  }

  getKeyString(e) {
    const keys = [];
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');
    if (e.metaKey) keys.push('Meta');
    keys.push(e.key.toUpperCase());
    return keys.join('+');
  }

  executeAction(action) {
    switch(action) {
      case 'toggle':
        this.toggleDrawingMode();
        break;
      case 'clear':
        this.clearCanvas();
        break;
      case 'pen':
        this.currentTool = 'pen';
        break;
      case 'highlighter':
        this.currentTool = 'highlighter';
        break;
      case 'eraser':
        this.currentTool = 'eraser';
        break;
    }
  }

  startPartialErase(x, y) {
    this.isErasing = true;
    this.erasePoints = [{x, y}];
    console.log('Started partial erase mode');
  }

  partialErase(x, y) {
    if (!this.isErasing) return;

    this.erasePoints.push({x, y});

    const eraserSize = this.toolSizes.eraser;
    const strokesToModify = [];

    for (let i = 0; i < this.strokes.length; i++) {
      const stroke = this.strokes[i];
      if (!stroke || !stroke.points || stroke.points.length === 0) continue;

      const intersectedPointIndices = [];

      for (let j = 0; j < stroke.points.length; j++) {
        const strokePoint = stroke.points[j];

        for (const erasePoint of this.erasePoints) {
          const distance = Math.sqrt(
            (strokePoint.x - erasePoint.x) ** 2 +
            (strokePoint.y - erasePoint.y) ** 2
          );

          if (distance <= eraserSize / 2) {
            intersectedPointIndices.push(j);
            break;
          }
        }
      }

      if (intersectedPointIndices.length > 0) {
        strokesToModify.push({strokeIndex: i, pointIndices: intersectedPointIndices});
      }
    }

    this.splitStrokesAtPoints(strokesToModify);
    this.redrawCanvas();
  }

  splitStrokesAtPoints(strokesToModify) {
    for (let i = strokesToModify.length - 1; i >= 0; i--) {
      const {strokeIndex, pointIndices} = strokesToModify[i];
      const originalStroke = this.strokes[strokeIndex];

      if (!originalStroke || pointIndices.length === 0) continue;

      pointIndices.sort((a, b) => a - b);

      const newStrokes = [];
      let lastEnd = 0;

      for (const pointIndex of pointIndices) {
        if (pointIndex > lastEnd) {
          const segmentPoints = originalStroke.points.slice(lastEnd, pointIndex);
          if (segmentPoints.length > 1) {
            newStrokes.push({
              ...originalStroke,
              points: segmentPoints,
              bounds: this.calculateStrokeBounds(segmentPoints)
            });
          }
        }
        lastEnd = pointIndex + 1;
      }

      if (lastEnd < originalStroke.points.length) {
        const segmentPoints = originalStroke.points.slice(lastEnd);
        if (segmentPoints.length > 1) {
          newStrokes.push({
            ...originalStroke,
            points: segmentPoints,
            bounds: this.calculateStrokeBounds(segmentPoints)
          });
        }
      }

      this.strokes.splice(strokeIndex, 1, ...newStrokes);
    }
  }

  calculateStrokeBounds(points) {
    if (points.length === 0) return {minX: 0, maxX: 0, minY: 0, maxY: 0};

    let minX = points[0].x, maxX = points[0].x;
    let minY = points[0].y, maxY = points[0].y;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }

    return {minX, maxX, minY, maxY};
  }

  isPointNearStroke(x, y, stroke) {
    const threshold = Math.max(stroke.size / 2 + 10, 12);

    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      const distance = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
      return distance <= threshold;
    }

    for (let i = 0; i < stroke.points.length - 1; i++) {
      const p1 = stroke.points[i];
      const p2 = stroke.points[i + 1];

      const distance = this.distanceToLineSegment(x, y, p1.x, p1.y, p2.x, p2.y);
      if (distance <= threshold) {
        return true;
      }
    }

    for (const point of stroke.points) {
      const distance = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
      if (distance <= threshold) {
        return true;
      }
    }

    return false;
  }

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

  initializePalettes() {
    return {
      simple: ['#474448', '#2D232E', '#E0DDCF', '#534B52', '#F1F0EA'],
      blu: ['#03256C', '#2541B2', '#1768AC', '#06BEE1', '#FFFFFF'],
      cambridge: ['#555B6E', '#89B0AE', '#BEE3DB', '#FAF9F9', '#FFD6BA'],
      dream: ['#8895B3', '#8E94F2', '#9FA0FF', '#BBADFF', '#DAB6FC'],
      eclipse: ['#485696', '#E7E7E7', '#F9C784', '#FC7A1E', '#F24C00'],
      fairytale: ['#392F5A', '#F092DD', '#FFAFF0', '#EEC8E0', '#A8C7BB'],
      go: ['#395E66', '#387D7A', '#32936F', '#26A96C', '#2BC016'],
      incorrect: ['#273043', '#9197AE', '#EFF6EE', '#F02D3A', '#DD0426'],
      metropark: ['#2589BD', '#187795', '#38686A', '#A3B4A2', '#CDC6AE'],
      rebecca: ['#E5D4ED', '#6D72C3', '#5941A9', '#514F59', '#1D1128'],
      remember: ['#1B264F', '#274690', '#576CA8', '#302B27', '#F5F3F5'],
      stung: ['#2D2A32', '#DDD92A', '#EAE151', '#EEEFA8', '#FAFDF6'],
      wish: ['#EF476F', '#FFD166', '#06D6A0', '#118AB2', '#073B4C'],
      untitled: ['#100007', '#200116', '#2D0605', '#4C0827', '#80D39B'],
      lonely: ['#223127', '#9C0D38', '#CE5374', '#DBBBF5', '#DDF0FF'],
      window: ['#FE5F55', '#F0B67F', '#D6D1B1', '#C7EFCF', '#EEF5DB']
    };
  }

  loadShortcuts() {
    return {
      'Ctrl+Shift+C': 'clear',
      'P': 'pen',
      'H': 'highlighter',
      'E': 'eraser'
    };
  }

  getCurrentPaletteColors() {
    return this.palettes[this.currentPalette] || this.palettes.simple;
  }

  switchPalette() {
    if (this.paletteSwitchCooldown) {
      return;
    }

    this.paletteSwitchCooldown = true;
    setTimeout(() => {
      this.paletteSwitchCooldown = false;
    }, 200);

    const paletteNames = Object.keys(this.palettes);
    const currentIndex = paletteNames.indexOf(this.currentPalette);
    const nextIndex = (currentIndex + 1) % paletteNames.length;
    this.currentPalette = paletteNames[nextIndex];
    this.updateToolbarColors();

    chrome.storage.sync.set({ selectedPalette: this.currentPalette });
  }

  updateToolbarColors() {
    const colors = this.getCurrentPaletteColors();
    const swatches = this.toolbar.querySelectorAll('.color-swatch');

    swatches.forEach(swatch => swatch.classList.remove('active'));

    swatches.forEach((swatch, index) => {
      if (index < colors.length) {
        swatch.style.backgroundColor = colors[index];
        swatch.setAttribute('data-color', colors[index]);
        swatch.setAttribute('title', `Color ${index + 1}`);
      }
    });

    const currentColorInNewPalette = colors.includes(this.currentColor);

    if (currentColorInNewPalette) {
      const activeIndex = colors.indexOf(this.currentColor);
      swatches[activeIndex].classList.add('active');
    } else {
      this.currentColor = colors[0];
      swatches[0].classList.add('active');
    }

    this.updateCursor();
  }

  previewNextPalette() {
    if (this.paletteSwitchCooldown || this.isPreviewingPalette) {
      return;
    }

    this.isPreviewingPalette = true;

    const paletteNames = Object.keys(this.palettes);
    const currentIndex = paletteNames.indexOf(this.currentPalette);
    const nextIndex = (currentIndex + 1) % paletteNames.length;
    const nextPalette = paletteNames[nextIndex];

    this.originalColors = this.getCurrentPaletteColors();
    this.originalActiveColor = this.currentColor;

    const colors = this.palettes[nextPalette];
    const swatches = this.toolbar.querySelectorAll('.color-swatch');

    swatches.forEach((swatch, index) => {
      if (index < colors.length) {
        swatch.style.backgroundColor = colors[index];
        swatch.style.opacity = '0.7';
        swatch.setAttribute('data-color', colors[index]);
      }
    });

    const paletteBtn = this.toolbar.querySelector('.palette-btn');
    if (paletteBtn) {
      paletteBtn.style.backgroundColor = 'rgba(0, 122, 255, 0.2)';
    }
  }

  clearPalettePreview() {
    if (this.originalColors && this.isPreviewingPalette) {
      const swatches = this.toolbar.querySelectorAll('.color-swatch');

      swatches.forEach(swatch => swatch.classList.remove('active'));

      swatches.forEach((swatch, index) => {
        if (index < this.originalColors.length) {
          swatch.style.backgroundColor = this.originalColors[index];
          swatch.style.opacity = '1';
          swatch.setAttribute('data-color', this.originalColors[index]);
        }
      });

      if (this.originalActiveColor) {
        const activeSwatch = this.toolbar.querySelector(`[data-color="${this.originalActiveColor}"]`);
        if (activeSwatch) {
          activeSwatch.classList.add('active');
        }
      }

      this.originalColors = null;
      this.originalActiveColor = null;
      this.isPreviewingPalette = false;
    }

    const paletteBtn = this.toolbar.querySelector('.palette-btn');
    if (paletteBtn) {
      paletteBtn.style.backgroundColor = '';
    }
  }

  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  loadSettings() {
    chrome.storage.sync.get(['shortcuts', 'selectedPalette'], (result) => {
      if (result.shortcuts) {
        this.shortcuts = result.shortcuts;
      }
      if (result.selectedPalette) {
        this.currentPalette = result.selectedPalette;
        if (this.toolbar) {
          this.updateToolbarColors();
        }
      }
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'updatePalette') {
        this.currentPalette = request.palette;
        if (this.toolbar) {
          this.updateToolbarColors();
        }
      } else if (request.action === 'updateShortcuts') {
        this.shortcuts = request.shortcuts;
      }
    });
  }
}

const scratch = new ScratchCanvas();