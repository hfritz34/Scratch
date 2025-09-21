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
    this.manuallyDisabled = true; // Start disabled to avoid being intrusive, user must manually enable
    // Partial eraser properties
    this.isErasing = false;
    this.erasePoints = [];
    // Quick delete mode properties
    this.isQuickDeleteMode = false;
    this.quickDeleteStrokes = new Set(); // Track strokes to delete
    this.isQuickDeleting = false;
    this.previousTool = null;
    // Eraser delete mode properties (for whole eraser left-click)
    this.isEraserDeleteMode = false;
    this.eraserDeleteStrokes = new Set();
    this.isEraserDeleting = false;

    // Select tool properties
    this.isSelecting = false;
    this.selectionPath = [];
    this.selectedStrokes = new Set();
    this.selectionBounds = null;
    this.isDraggingSelection = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.originalStrokePositions = new Map();

    // Undo/Redo functionality
    this.undoHistory = [];
    this.maxUndoHistory = 50; // Limit history to prevent memory issues

    // Performance optimizations
    this.performanceMode = false;
    this.maxStrokes = 500; // Limit stroke history
    this.heavyDomains = ['youtube.com', 'instagram.com', 'facebook.com', 'twitter.com', 'x.com'];

    // Viewport rendering properties
    this.viewportPadding = 500; // Extra padding around viewport for stroke rendering
    this.renderRequestId = null;
    this.lastScrollX = 0;
    this.lastScrollY = 0;

    this.init();
  }

  init() {
    // Check if we're on a heavy page for performance mode
    const hostname = window.location.hostname;
    this.performanceMode = this.heavyDomains.some(domain =>
      hostname.includes(domain)
    );

    if (this.performanceMode) {
      console.log('Scratch: Performance mode enabled for', hostname);
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.initializeExtension();
      });
    } else {
      this.initializeExtension();
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
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '999998';
    this.canvas.style.display = 'none'; // Start hidden, show on hover

    // Set canvas size to full document size
    this.updateCanvasSize();

    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
  }

  updateCanvasSize() {
    const body = document.body;
    const html = document.documentElement;

    // Get document dimensions but with performance limits
    let height = Math.max(
      body.scrollHeight, body.offsetHeight,
      html.clientHeight, html.scrollHeight, html.offsetHeight,
      window.innerHeight + window.pageYOffset
    );
    let width = Math.max(
      body.scrollWidth, body.offsetWidth,
      html.clientWidth, html.scrollWidth, html.offsetWidth,
      window.innerWidth + window.pageXOffset
    );

    // Performance optimization: limit canvas size on heavy pages
    if (this.performanceMode) {
      const maxWidth = window.innerWidth * 3;
      const maxHeight = window.innerHeight * 5;
      width = Math.min(width, maxWidth);
      height = Math.min(height, maxHeight);
    }

    // Avoid unnecessary resizes
    if (this.canvas.width === width && this.canvas.height === height) {
      return;
    }

    // Set canvas size
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';

    console.log('Canvas size updated:', width, 'x', height, this.performanceMode ? '(performance limited)' : '');
  }

  createToolbar() {
    console.log('Creating toolbar...');
    this.toolbar = document.createElement('div');
    this.toolbar.id = 'scratch-toolbar';

    // Add performance mode class if needed
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
        <button class="mode-pill active" data-mode="whole" title="Whole eraser - removes entire strokes">Whole</button>
        <button class="mode-pill" data-mode="partial" title="Partial eraser - removes parts of strokes">Partial</button>
      </div>
      <button class="tool-btn" data-tool="select" title="Select (S)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.5,5.6L5,7L6.4,4.5L5,2L7.5,3.4L10,2L8.6,4.5L10,7L7.5,5.6M19.5,15.4L22,14L20.6,16.5L22,19L19.5,17.6L17,19L18.4,16.5L17,14L19.5,15.4M22,2L20.6,4.5L22,7L19.5,5.6L17,7L18.4,4.5L17,2L19.5,3.4L22,2M13.34,12.78L15.78,10.34L13.66,8.22L11.22,10.66L13.34,12.78M14.37,7.29L16.71,9.63C17.1,10 17.1,10.65 16.71,11.04L5.04,22.71C4.65,23.1 4,23.1 3.63,22.71L1.29,20.37C0.9,20 0.9,19.35 1.29,18.96L12.96,7.29C13.35,6.9 14,6.9 14.37,7.29Z"/>
        </svg>
      </button>
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

    // Position toolbar at top center initially but start hidden
    this.toolbar.style.left = '50%';
    this.toolbar.style.top = '20px';
    this.toolbar.style.transform = 'translateX(-50%)';
    this.toolbar.style.display = 'none'; // Start hidden, show on hover
    this.toolbarPosition = null; // Not snapped to edge initially

    document.body.appendChild(this.toolbar);
    console.log('Toolbar appended to body:', this.toolbar);
    this.setupToolbarEvents();
    this.setupToolbarDrag();
    this.setupHoverActivation();
  }


  setupToolbarEvents() {
    // Tool selection and size button management
    this.toolbar.querySelectorAll('.tool-btn').forEach(btn => {
      // Click to select tool
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

        // Update tool size
        this.toolSizes[tool] = size;

        // Update active state
        sizeGroup.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');

        // Update cursor if this is the current tool
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

        // Update active state
        this.toolbar.querySelectorAll('.mode-pill').forEach(p => p.classList.remove('active'));
        e.currentTarget.classList.add('active');

        console.log(`Eraser mode set to: ${mode}`);
      });
    });

    // Color selection with hover preview
    this.toolbar.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        const color = e.currentTarget.dataset.color;
        this.setColor(color);
      });

      // Hover effects for color swatches
      swatch.addEventListener('mouseenter', (e) => {
        const color = e.currentTarget.dataset.color;
        if (color !== this.currentColor) {
          e.currentTarget.style.transform = 'scale(1.2)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
        }
      });

      swatch.addEventListener('mouseleave', (e) => {
        // Always clear hover effects on mouse leave, active state will be handled by CSS
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '';
      });
    });

    // Palette button with hover preview
    const paletteBtn = this.toolbar.querySelector('.palette-btn');
    if (paletteBtn) {
      let hoverTimeout = null;

      paletteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.switchPalette();
      });

      // Hover to preview next palette
      paletteBtn.addEventListener('mouseenter', (e) => {
        hoverTimeout = setTimeout(() => {
          this.previewNextPalette();
        }, 500); // Show preview after 500ms hover
      });

      paletteBtn.addEventListener('mouseleave', (e) => {
        if (hoverTimeout) {
          clearTimeout(hoverTimeout);
          hoverTimeout = null;
        }
        this.clearPalettePreview();
      });
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
    this.toolbarPosition = null; // Track toolbar position for rotation
    let orientationPreviewRAF = null;
    let lastPreviewEdge = null;
    let lastPreviewTime = 0;

    const handleMouseDown = (e) => {
      isDragging = true;
      this.isDraggingToolbar = true; // Prevent drawing while dragging
      startX = e.clientX;
      startY = e.clientY;

      const rect = this.toolbar.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;

      // Clear any edge positioning since we're manually dragging
      this.toolbarPosition = null;

      // Reset any rotation first
      this.toolbar.style.transform = 'none';
      this.toolbar.style.left = startLeft + 'px';
      this.toolbar.style.top = startTop + 'px';

      // Add dragging class for visual feedback
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

      // Use left/top for precise positioning during drag
      this.toolbar.style.left = newLeft + 'px';
      this.toolbar.style.top = newTop + 'px';

      // Debounced orientation preview as user nears edges
      const now = performance.now();
      const preview = () => {
        const edge = this.getClosestEdgeByPoint(e.clientX, e.clientY, 120);
        if (edge && edge !== lastPreviewEdge) {
          lastPreviewEdge = edge;
          if (edge === 'left' || edge === 'right') {
            this.toolbar.classList.add('vertical');
            this.toolbar.classList.remove('horizontal');
          } else {
            this.toolbar.classList.add('horizontal');
            this.toolbar.classList.remove('vertical');
          }
        }
        orientationPreviewRAF = null;
        lastPreviewTime = now;
      };
      if (!orientationPreviewRAF && now - lastPreviewTime > 60) {
        orientationPreviewRAF = requestAnimationFrame(preview);
      }
    };

    const handleMouseUp = (e) => {
      if (!isDragging) return;

      isDragging = false;
      this.isDraggingToolbar = false;

      // Snap to edge if close
      this.snapToEdge();

      this.toolbar.classList.remove('dragging');

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    handle.addEventListener('mousedown', handleMouseDown);
  }

  getClosestEdgeByPoint(clientX, clientY, threshold = 120) {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const distances = {
      top: clientY,
      bottom: windowHeight - clientY,
      left: clientX,
      right: windowWidth - clientX
    };
    let closest = null;
    let minDist = threshold;
    for (const [edge, dist] of Object.entries(distances)) {
      if (dist < minDist) {
        minDist = dist;
        closest = edge;
      }
    }
    return closest;
  }

  previewOrientationDuringDrag(clientX, clientY) {
    if (!this.toolbar) return;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const distances = {
      top: clientY,
      bottom: windowHeight - clientY,
      left: clientX,
      right: windowWidth - clientX
    };

    const previewThreshold = 120;
    let targetEdge = null;
    let minDistance = previewThreshold;

    for (const [edge, distance] of Object.entries(distances)) {
      if (distance < minDistance) {
        minDistance = distance;
        targetEdge = edge;
      }
    }

    if (!targetEdge) return;

    if (targetEdge === 'left' || targetEdge === 'right') {
      this.toolbar.classList.add('vertical');
      this.toolbar.classList.remove('horizontal');
    } else if (targetEdge === 'top' || targetEdge === 'bottom') {
      this.toolbar.classList.add('horizontal');
      this.toolbar.classList.remove('vertical');
    }
  }

  snapToEdge() {
    const rect = this.toolbar.getBoundingClientRect();
    const threshold = 80; // Increased threshold for easier snapping

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Calculate distances to edges
    const distances = {
      top: rect.top,
      bottom: windowHeight - rect.bottom,
      left: rect.left,
      right: windowWidth - rect.right
    };

    // Find closest edge
    let closestEdge = null;
    let minDistance = threshold;

    for (const [edge, distance] of Object.entries(distances)) {
      if (distance < minDistance) {
        minDistance = distance;
        closestEdge = edge;
      }
    }

    // Snap to edge with smooth animation (no class thrashing)
    if (closestEdge) {
      this.toolbarPosition = closestEdge;
      this.toolbar.classList.remove('dragging');
      // Use RAF to ensure layout is stable before applying the final position
      requestAnimationFrame(() => {
        this.positionToolbarAtEdge(closestEdge);
      });
    }
  }

  positionToolbarAtEdge(edge) {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const currentRect = this.toolbar.getBoundingClientRect();

    // Remove any existing orientation classes
    this.toolbar.classList.remove('horizontal', 'vertical', 'edge-top', 'edge-bottom', 'edge-left', 'edge-right');

    switch (edge) {
      case 'top':
        this.toolbar.classList.add('horizontal');
        // Anchor near left/right if close, else center
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
        // Anchor near left/right if close, else center
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
        // Add classes first so width is accurate, then position with 10px right padding
        this.toolbar.classList.add('vertical', 'edge-right');
        this.toolbar.style.left = (windowWidth - this.toolbar.offsetWidth - 10) + 'px';
        this.toolbar.style.top = '50%';
        this.toolbar.style.transform = 'translateY(-50%)';
        break;
    }
  }

  keepToolbarInBounds() {
    if (!this.toolbar || !this.isActive) return;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const margin = 20;

    // If toolbar was snapped to an edge, reposition it
    if (this.toolbarPosition) {
      this.positionToolbarAtEdge(this.toolbarPosition);
      return;
    }

    // Get current position
    let currentLeft = parseInt(this.toolbar.style.left) || 0;
    let currentTop = parseInt(this.toolbar.style.top) || 0;

    // Reset transform to get accurate measurements
    const originalTransform = this.toolbar.style.transform;
    this.toolbar.style.transform = 'none';
    const rect = this.toolbar.getBoundingClientRect();

    let needsUpdate = false;
    let newLeft = currentLeft;
    let newTop = currentTop;

    // Check if centered (has translateX)
    if (originalTransform.includes('translateX(-50%)')) {
      // Handle centered toolbar
      const toolbarWidth = rect.width;
      const maxLeft = windowWidth - toolbarWidth / 2 - margin;
      const minLeft = toolbarWidth / 2 + margin;

      // Convert percentage to pixels if needed
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
      // Handle non-centered toolbar
      const toolbarWidth = rect.width;
      const toolbarHeight = rect.height;

      // Check horizontal bounds
      if (currentLeft + toolbarWidth > windowWidth - margin) {
        newLeft = windowWidth - toolbarWidth - margin;
        needsUpdate = true;
      } else if (currentLeft < margin) {
        newLeft = margin;
        needsUpdate = true;
      }

      // Check vertical bounds
      if (currentTop + toolbarHeight > windowHeight - margin) {
        newTop = windowHeight - toolbarHeight - margin;
        needsUpdate = true;
      } else if (currentTop < margin) {
        newTop = margin;
        needsUpdate = true;
      }
    }

    // Restore transform and update position if needed
    if (needsUpdate) {
      this.toolbar.style.left = newLeft + 'px';
      this.toolbar.style.top = newTop + 'px';
      this.toolbar.style.transform = originalTransform;
    } else {
      this.toolbar.style.transform = originalTransform;
    }
  }

  setTool(tool) {
    this.currentTool = tool;

    // Clear selection when switching tools
    if (tool !== 'select' && this.selectedStrokes.size > 0) {
      this.clearSelection();
    }

    // Update active tool button
    this.toolbar.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    this.toolbar.querySelector(`[data-tool="${tool}"]`).classList.add('active');

    // Show/hide appropriate size buttons
    this.toolbar.querySelectorAll('.size-buttons').forEach(sizeGroup => {
      if (sizeGroup.dataset.tool === tool) {
        sizeGroup.style.display = 'flex';
        // Update active size button for this tool
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

    // Show/hide color swatches and palette button based on tool
    const colorSwatches = this.toolbar.querySelectorAll('.color-swatch');
    const paletteBtn = this.toolbar.querySelector('.palette-btn');
    const dividers = this.toolbar.querySelectorAll('.toolbar-divider');
    const eraserModePills = this.toolbar.querySelector('.eraser-mode-pills');

    if (tool === 'eraser') {
      // Hide colors and palette button, show eraser mode pills
      colorSwatches.forEach(swatch => swatch.style.display = 'none');
      if (paletteBtn) paletteBtn.style.display = 'none';
      // Hide the dividers around colors when eraser is selected
      if (dividers[0]) dividers[0].style.display = 'none';
      if (dividers[1]) dividers[1].style.display = 'none';
      // Show eraser mode pills
      if (eraserModePills) {
        eraserModePills.classList.add('visible');
      }
    } else if (tool === 'select') {
      // Hide colors, palette button, and eraser mode pills for select tool
      colorSwatches.forEach(swatch => swatch.style.display = 'none');
      if (paletteBtn) paletteBtn.style.display = 'none';
      if (dividers[0]) dividers[0].style.display = 'none';
      if (dividers[1]) dividers[1].style.display = 'none';
      if (eraserModePills) {
        eraserModePills.classList.remove('visible');
      }
    } else {
      // Show colors and palette button, hide eraser mode pills
      colorSwatches.forEach(swatch => swatch.style.display = '');
      if (paletteBtn) paletteBtn.style.display = '';
      // Show the dividers
      if (dividers[0]) dividers[0].style.display = '';
      if (dividers[1]) dividers[1].style.display = '';
      // Hide eraser mode pills
      if (eraserModePills) {
        eraserModePills.classList.remove('visible');
      }
    }

    // Update cursor
    this.updateCursor();
  }

  setupHoverActivation() {
    // Setup hover detection for content areas
    document.addEventListener('mousemove', (e) => this.handleContentHover(e));

    // Setup hover detection for toolbar
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
    // Don't activate on toolbar or other UI elements
    if (e.target.closest('#scratch-toolbar') || e.target.closest('#scratch-canvas')) {
      return;
    }

    // Check if hovering over content areas (not UI elements)
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
    // Clear any existing hide timeout
    this.clearHideTimeout();

    // Don't activate if manually disabled
    if (this.manuallyDisabled) {
      return;
    }

    // Start hover timeout for activation
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }

    this.hoverTimeout = setTimeout(() => {
      if (this.isHoveringContent && !this.isActive && !this.manuallyDisabled) {
        this.activateDrawingMode();
      }
    }, 500); // 500ms delay as requested
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
    }, 1000); // Hide after 1 second of no hover
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
      // Redraw any existing strokes
      this.redrawCanvas();
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

  startPartialErase(x, y) {
    // Initialize partial eraser mode
    this.isErasing = true;
    this.erasePoints = [{x, y}];
    console.log('Started partial erase mode');
  }

  partialErase(x, y) {
    if (!this.isErasing) return;

    // Add point to erase path
    this.erasePoints.push({x, y});

    // Find strokes that intersect with the erase path
    const eraserSize = this.toolSizes.eraser;
    const strokesToModify = [];

    for (let i = 0; i < this.strokes.length; i++) {
      const stroke = this.strokes[i];
      if (!stroke || !stroke.points || stroke.points.length === 0) continue;

      // Check if any part of this stroke intersects with the erase path
      const intersectedPointIndices = [];

      for (let j = 0; j < stroke.points.length; j++) {
        const strokePoint = stroke.points[j];

        // Check if this stroke point is within eraser range of any erase point
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

    // Split strokes at intersected points
    this.splitStrokesAtPoints(strokesToModify);

    // Redraw canvas
    this.redrawCanvas();
  }

  splitStrokesAtPoints(strokesToModify) {
    // Save original strokes for undo before modifying
    if (strokesToModify.length > 0) {
      this.saveToUndoHistory({
        type: 'partialErase',
        originalStrokes: [...this.strokes]
      });
    }

    // Process strokes in reverse order to maintain indices
    for (let i = strokesToModify.length - 1; i >= 0; i--) {
      const {strokeIndex, pointIndices} = strokesToModify[i];
      const originalStroke = this.strokes[strokeIndex];

      if (!originalStroke || pointIndices.length === 0) continue;

      // Sort point indices
      pointIndices.sort((a, b) => a - b);

      // Create new stroke segments
      const newStrokes = [];
      let lastEnd = 0;

      for (const pointIndex of pointIndices) {
        // Create stroke from lastEnd to pointIndex (excluding the erased point)
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

      // Add final segment if there are remaining points
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

      // Replace the original stroke with new segments
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

  updateCursor() {
    if (!this.isActive) return;

    const color = this.currentColor || '#000000';
    // Add timestamp to force cursor refresh and prevent caching
    const timestamp = Date.now();
    let cursorSvg = '';

    if (this.currentTool === 'pen') {
      // Pen cursor with color dot - ensure perfect center alignment
      cursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="8" fill="${color}" stroke="white" stroke-width="2"/>
        <circle cx="16" cy="16" r="2" fill="white"/>
        <circle cx="16" cy="16" r="0.5" fill="rgba(0,0,0,0.3)"/>
        <text x="1" y="1" fill="transparent">${timestamp}</text>
      </svg>`;
    } else if (this.currentTool === 'highlighter') {
      // Highlighter cursor with transparent color - ensure perfect center alignment
      const rgba = this.hexToRgba(color, 0.3);
      cursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <rect x="8" y="8" width="16" height="16" fill="${rgba}" stroke="white" stroke-width="2"/>
        <circle cx="16" cy="16" r="2" fill="black"/>
        <circle cx="16" cy="16" r="0.5" fill="white"/>
        <text x="1" y="1" fill="transparent">${timestamp}</text>
      </svg>`;
    } else if (this.currentTool === 'eraser') {
      // Eraser cursor - ensure perfect center alignment
      cursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="10" fill="none" stroke="red" stroke-width="3"/>
        <line x1="10" y1="16" x2="22" y2="16" stroke="red" stroke-width="2"/>
        <line x1="16" y1="10" x2="16" y2="22" stroke="red" stroke-width="2"/>
        <circle cx="16" cy="16" r="1" fill="red"/>
        <text x="1" y="1" fill="transparent">${timestamp}</text>
      </svg>`;
    } else if (this.currentTool === 'select') {
      // Select/lasso cursor
      cursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="2" fill="#007AFF" stroke="white" stroke-width="1"/>
        <circle cx="16" cy="16" r="8" fill="none" stroke="#007AFF" stroke-width="2" stroke-dasharray="2,2" opacity="0.5"/>
        <text x="1" y="1" fill="transparent">${timestamp}</text>
      </svg>`;
    }

    const encodedSvg = encodeURIComponent(cursorSvg);
    const cursorUrl = `url('data:image/svg+xml;utf8,${encodedSvg}') 16 16, crosshair`;


    // Force cursor update by temporarily setting to different values
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

    // Update active color swatch
    this.toolbar.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.classList.remove('active');
      // Clear any hover effects when switching colors
      swatch.style.transform = '';
      swatch.style.boxShadow = '';
    });

    const swatch = this.toolbar.querySelector(`[data-color="${color}"]`);
    if (swatch) {
      swatch.classList.add('active');
    }

    // Update custom color picker if it exists
    const customColorPicker = this.toolbar.querySelector('#custom-color');
    if (customColorPicker) {
      customColorPicker.value = color;
    }

    // Update cursor to match new color
    this.updateCursor();
  }


  setupEventListeners() {
    let resizeTimeout;
    let scrollTimeout;

    window.addEventListener('resize', () => {
      this.resizeCanvas();

      // Debounce toolbar repositioning
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.keepToolbarInBounds();
      }, 100);
    });

    // Listen for scroll events to update canvas size for long pages
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.resizeCanvas(); // Use resizeCanvas which preserves strokes

        // Cleanup distant strokes periodically when scrolling (performance mode only)
        if (this.performanceMode) {
          this.cleanupDistantStrokes();
        }
      }, 100);
    }, { passive: true });

    document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    document.addEventListener('contextmenu', (e) => this.handleRightClick(e));
    document.addEventListener('keydown', (e) => this.handleKeyPress(e), true); // Use capture phase

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'toggleDrawing') {
        this.toggleDrawingMode();
        // Send response with current state for popup
        sendResponse({ isActive: this.isActive });
      } else if (request.action === 'clearCanvas') {
        this.clearCanvas();
        sendResponse({ success: true });
      } else if (request.action === 'getState') {
        // Allow popup to query current state
        sendResponse({ isActive: this.isActive });
      }
      return true; // Keep message channel open for async response
    });
  }

  toggleDrawingMode() {
    this.isActive = !this.isActive;
    console.log('Toggle drawing mode:', this.isActive);

    // Track manual disable/enable state for hover activation
    if (!this.isActive) {
      this.manuallyDisabled = true;
    } else {
      this.manuallyDisabled = false;
    }

    this.canvas.style.display = this.isActive ? 'block' : 'none';
    this.canvas.style.pointerEvents = this.isActive ? 'auto' : 'none';
    this.toolbar.style.display = this.isActive ? 'flex' : 'none';

    if (this.isActive) {
      this.setTool('pen'); // Set default tool
      this.updateCursor();
      // Ensure toolbar is in bounds when first shown
      this.keepToolbarInBounds();
      // Redraw any existing strokes
      this.redrawCanvas();
    } else {
      this.canvas.style.cursor = 'default';
    }
  }

  handleMouseDown(e) {
    if (!this.isActive) return;

    // Prevent drawing if clicking on toolbar or dragging it
    if (e.target.closest('#scratch-toolbar') || this.isDraggingToolbar) return;

    // Prevent ALL drawing-related actions if in quick delete mode or eraser delete mode
    if (this.isQuickDeleteMode || this.isEraserDeleteMode) return;

    // Only allow drawing with left mouse button (button 0)
    if (e.button !== 0) return;

    if (this.currentTool === 'select') {
      const x = e.pageX;
      const y = e.pageY;

      // Check if clicking on a selected stroke to start dragging
      if (this.selectedStrokes.size > 0 && this.isPointInSelection(x, y)) {
        this.startDraggingSelection(x, y);
      } else {
        // Start new lasso selection
        this.clearSelection();
        this.startSelection(x, y);
      }
      return;
    }

    if (this.currentTool === 'eraser') {
      if (this.eraserMode === 'whole') {
        // Whole eraser: start delete preview mode (like quick delete but with left click)
        this.startEraserDeleteMode(e);
        return;
      } else {
        // Partial eraser: start erasing mode
        this.startPartialErase(e.pageX, e.pageY);
        // Don't return, let it continue to drawing logic for continuous erasing
      }
    }

    this.isDrawing = true;
    // Ensure precise positioning at cursor center
    this.lastX = Math.round(e.pageX);
    this.lastY = Math.round(e.pageY);

    // Start new stroke tracking with precise coordinates
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

    // Immediately draw a dot for quick taps
    if (this.currentTool === 'pen' || this.currentTool === 'highlighter') {
      this.drawDot(this.lastX, this.lastY, this.currentColor, this.toolSizes[this.currentTool], this.currentTool);
    }
  }

  handleMouseMove(e) {
    if (!this.isActive) return;

    const x = e.pageX;
    const y = e.pageY;

    // Handle selection tool
    if (this.currentTool === 'select') {
      if (this.isSelecting) {
        this.updateSelection(x, y);
      } else if (this.isDraggingSelection) {
        this.dragSelection(x, y);
      }
      return;
    }

    if (!this.isDrawing) return;

    // Don't draw if in quick delete mode
    if (this.isQuickDeleteMode) return;

    // Handle partial erasing
    if (this.currentTool === 'eraser' && this.eraserMode === 'partial' && this.isErasing) {
      this.partialErase(e.pageX, e.pageY);
      return;
    }

    // Use precise rounded coordinates for consistent positioning
    const currentX = Math.round(e.pageX);
    const currentY = Math.round(e.pageY);

    // Add point to current stroke
    if (this.currentStroke) {
      this.currentStroke.points.push({ x: currentX, y: currentY });

      // Update stroke bounds
      this.currentStroke.bounds.minX = Math.min(this.currentStroke.bounds.minX, currentX);
      this.currentStroke.bounds.maxX = Math.max(this.currentStroke.bounds.maxX, currentX);
      this.currentStroke.bounds.minY = Math.min(this.currentStroke.bounds.minY, currentY);
      this.currentStroke.bounds.maxY = Math.max(this.currentStroke.bounds.maxY, currentY);
    }

    // Draw directly on canvas using document coordinates (no viewport offset needed)
    if (this.currentTool === 'highlighter') {
      // Use multiply blending for proper highlighter effect (unless in performance mode)
      this.ctx.globalCompositeOperation = this.performanceMode ? 'source-over' : 'multiply';
      this.ctx.strokeStyle = this.hexToRgba(this.currentColor, this.performanceMode ? 0.2 : 0.4);
      this.ctx.lineWidth = this.toolSizes.highlighter;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
      this.ctx.lineTo(currentX, currentY);
      this.ctx.stroke();
    } else if (this.currentTool === 'pen') {
      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
      this.ctx.lineTo(currentX, currentY);

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
    // Handle selection tool
    if (this.currentTool === 'select') {
      if (this.isSelecting) {
        this.completeSelection();
      } else if (this.isDraggingSelection) {
        this.stopDraggingSelection();
      }
      return;
    }

    // Don't process if in quick delete mode (handled by quick delete listeners)
    if (this.isQuickDeleteMode) return;

    // End partial erasing
    if (this.isErasing) {
      this.isErasing = false;
      this.erasePoints = [];
      console.log('Ended partial erase mode');
    }

    if (this.isDrawing) {
      // Always save the stroke if we were drawing, even for quick taps
      if (this.currentStroke && this.currentStroke.points.length > 0) {
        // Ensure stroke has valid properties
        if (!this.currentStroke.tool) this.currentStroke.tool = this.currentTool;
        if (!this.currentStroke.color) this.currentStroke.color = this.currentColor;
        if (!this.currentStroke.size) this.currentStroke.size = this.toolSizes[this.currentTool];

        this.strokes.push(this.currentStroke);

        // Save to undo history
        this.saveToUndoHistory({
          type: 'draw'
        });

        // Performance optimization: Enforce stroke limit
        if (this.strokes.length > this.maxStrokes) {
          this.strokes.splice(0, this.strokes.length - this.maxStrokes);
        }

        console.log(`Saved stroke with ${this.currentStroke.points.length} points`);
      }
      this.currentStroke = null;
      this.isDrawing = false;
    }
  }

  handleRightClick(e) {
    if (!this.isActive) return;
    e.preventDefault();

    // If eraser tool is selected, right-click toggles between whole/partial modes
    if (this.currentTool === 'eraser') {
      this.toggleEraserMode();
      return;
    }

    const now = Date.now();

    // Double right-click to clear canvas
    if (this.lastRightClick && now - this.lastRightClick < 300) {
      this.clearCanvas();
      this.lastRightClick = null; // Reset to prevent triple-click issues
      return;
    }

    // Start quick delete mode on right-click down
    this.startQuickDeleteMode(e);
    this.lastRightClick = now;
  }

  toggleEraserMode() {
    if (this.currentTool !== 'eraser') return;

    // Toggle between whole and partial modes
    this.eraserMode = this.eraserMode === 'whole' ? 'partial' : 'whole';

    // Update the mode pills visual state
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
    // Similar to quick delete but for left click when eraser tool is in whole mode
    if (this.isEraserDeleteMode) return;

    console.log('Starting eraser delete mode');
    this.isEraserDeleteMode = true;
    this.eraserDeleteStrokes = new Set(); // Track stroke indices to delete
    this.isEraserDeleting = true;

    // Set up event listeners for eraser delete mode
    const handleMouseMove = (moveEvent) => {
      if (this.isEraserDeleteMode && this.isEraserDeleting) {
        this.highlightStrokesForEraserDeletion(moveEvent.pageX, moveEvent.pageY);
      }
    };

    const handleMouseUp = (upEvent) => {
      if (upEvent.button === 0 && this.isEraserDeleteMode) { // Left mouse button
        this.endEraserDeleteMode();
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Initial highlight at click position
    this.highlightStrokesForEraserDeletion(e.pageX, e.pageY);
  }

  highlightStrokesForEraserDeletion(x, y) {
    // Find strokes near the cursor (similar to quick delete)
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

    // Redraw with highlights (using eraser delete strokes)
    this.redrawCanvasWithEraserHighlights();
  }

  redrawCanvasWithEraserHighlights() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = 0; i < this.strokes.length; i++) {
      const stroke = this.strokes[i];
      if (!stroke || !stroke.points || stroke.points.length === 0) continue;

      // Check if this stroke is marked for deletion
      if (this.eraserDeleteStrokes.has(i)) {
        // Draw with translucent effect for strokes to be deleted
        this.ctx.globalAlpha = 0.3;
      } else {
        this.ctx.globalAlpha = 1.0;
      }

      this.drawStroke(stroke);
    }

    this.ctx.globalAlpha = 1.0;
  }

  endEraserDeleteMode() {
    if (!this.isEraserDeleteMode) return;

    const strokesToDelete = this.eraserDeleteStrokes.size;
    console.log(`Ending eraser delete mode, deleting ${strokesToDelete} strokes`);

    // Save deleted strokes to undo history
    if (strokesToDelete > 0) {
      const deletedStrokes = [];
      for (const index of this.eraserDeleteStrokes) {
        deletedStrokes.push({
          index: index,
          stroke: this.strokes[index]
        });
      }

      this.saveToUndoHistory({
        type: 'delete',
        deletedStrokes: deletedStrokes
      });
    }

    // Delete all highlighted strokes (in reverse order to maintain indices)
    if (strokesToDelete > 0) {
      const strokeIndices = Array.from(this.eraserDeleteStrokes).sort((a, b) => b - a);
      for (const index of strokeIndices) {
        this.strokes.splice(index, 1);
      }
    }

    // Reset mode
    this.isEraserDeleteMode = false;
    this.isEraserDeleting = false;
    this.eraserDeleteStrokes.clear();

    // Redraw canvas normally
    this.redrawCanvas();
  }

  startQuickDeleteMode(e) {
    if (this.isQuickDeleteMode) return;

    console.log('Starting quick delete mode');
    this.isQuickDeleteMode = true;
    this.quickDeleteStrokes.clear();
    this.previousTool = this.currentTool;
    this.isQuickDeleting = true; // Track if we're actively deleting

    // Set up event listeners for quick delete
    const handleMouseMove = (moveEvent) => {
      if (this.isQuickDeleteMode && this.isQuickDeleting) {
        this.highlightStrokesForDeletion(moveEvent.pageX, moveEvent.pageY);
      }
    };

    const handleMouseUp = (upEvent) => {
      if (upEvent.button === 2) { // Right mouse button
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

    // Initial erase at click position
    this.highlightStrokesForDeletion(e.pageX, e.pageY);
  }

  highlightStrokesForDeletion(x, y) {
    // Find strokes near the cursor
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

    // Redraw with highlights
    this.redrawCanvasWithHighlights();
  }

  endQuickDeleteMode() {
    console.log(`Ending quick delete mode, deleting ${this.quickDeleteStrokes.size} strokes`);

    // Save deleted strokes to undo history
    if (this.quickDeleteStrokes.size > 0) {
      const deletedStrokes = [];
      for (const index of this.quickDeleteStrokes) {
        deletedStrokes.push({
          index: index,
          stroke: this.strokes[index]
        });
      }

      this.saveToUndoHistory({
        type: 'delete',
        deletedStrokes: deletedStrokes
      });
    }

    // Delete all highlighted strokes (in reverse order to maintain indices)
    const strokeIndices = Array.from(this.quickDeleteStrokes).sort((a, b) => b - a);
    for (const index of strokeIndices) {
      this.strokes.splice(index, 1);
    }

    // Clear quick delete state
    this.isQuickDeleteMode = false;
    this.quickDeleteStrokes.clear();
    this.isQuickDeleting = false;

    // Reset any drawing state that might be stuck
    this.isDrawing = false;
    this.currentStroke = null;

    // Return to previous tool
    if (this.previousTool) {
      this.setTool(this.previousTool);
      this.previousTool = null;
    }

    // Redraw canvas normally
    this.redrawCanvas();
  }

  redrawCanvasWithHighlights() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Redraw all strokes
    for (let i = 0; i < this.strokes.length; i++) {
      const stroke = this.strokes[i];
      if (!stroke || !stroke.points || stroke.points.length === 0) continue;

      const isHighlighted = this.quickDeleteStrokes.has(i);

      if (isHighlighted) {
        // Draw highlighted stroke with translucency
        this.ctx.save();
        this.ctx.globalAlpha = 0.3; // Make translucent
        this.drawStroke(stroke);
        this.ctx.restore();
      } else {
        // Draw normal stroke
        this.drawStroke(stroke);
      }
    }
  }

  handleKeyPress(e) {
    // Ignore if user is typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    // Always handle Cmd+Z / Ctrl+Z when extension is active to prevent browser undo
    if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey) && this.isActive) {
      e.preventDefault();
      e.stopPropagation();
      this.undo();
      return;
    }

    // Handle 'D' key
    if (e.key === 'd' || e.key === 'D') {
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (!this.isActive) {
          // Open the extension if not active
          this.toggleDrawingMode();
        } else {
          // Always switch to pen tool if extension is already open
          this.setTool('pen');
        }
        return;
      }
    }

    // Handle Escape key
    if (e.key === 'Escape' && this.isActive) {
      // If there's a selection, clear it
      if (this.selectedStrokes.size > 0 || this.isSelecting) {
        e.preventDefault();
        this.clearSelection();
        return;
      }
      // Otherwise exit drawing mode
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
      case 'undo':
        this.undo();
        break;
      case 'pen':
        this.setTool('pen');
        break;
      case 'highlighter':
        this.setTool('highlighter');
        break;
      case 'eraser':
        this.setTool('eraser');
        break;
      case 'select':
        this.setTool('select');
        break;
    }
  }

  wholeErase(x, y) {
    // Validate input coordinates
    if (typeof x !== 'number' || typeof y !== 'number' || !isFinite(x) || !isFinite(y)) {
      console.warn('Invalid coordinates for eraser:', x, y);
      return;
    }

    // Find strokes that contain the click point
    const strokesToRemove = [];

    for (let i = 0; i < this.strokes.length; i++) {
      const stroke = this.strokes[i];

      // Validate stroke data
      if (!stroke || !stroke.bounds || !stroke.points || stroke.points.length === 0) {
        continue;
      }

      // Improved padding calculation based on stroke size
      const padding = Math.max(stroke.size || 15, 15); // Minimum 15px padding for easier selection

      // Quick bounds check first
      if (x >= stroke.bounds.minX - padding && x <= stroke.bounds.maxX + padding &&
          y >= stroke.bounds.minY - padding && y <= stroke.bounds.maxY + padding) {

        // Check if point is near any part of the stroke
        if (this.isPointNearStroke(x, y, stroke)) {
          strokesToRemove.push(i);
        }
      }
    }

    // Remove strokes (in reverse order to maintain indices)
    for (let i = strokesToRemove.length - 1; i >= 0; i--) {
      this.strokes.splice(strokesToRemove[i], 1);
    }

    // Always redraw canvas to ensure proper state
    this.redrawCanvas();

    // Log for debugging
    if (strokesToRemove.length > 0) {
      console.log(`Erased ${strokesToRemove.length} stroke(s) at (${x}, ${y})`);
    } else {
      console.log(`No strokes found to erase at (${x}, ${y})`);
    }
  }

  isPointNearStroke(x, y, stroke) {
    // Improved threshold calculation for better detection
    const threshold = Math.max(stroke.size / 2 + 10, 12); // Minimum 12px threshold

    // Handle single point strokes (dots)
    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      const distance = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
      return distance <= threshold;
    }

    // Check line segments for multi-point strokes
    for (let i = 0; i < stroke.points.length - 1; i++) {
      const p1 = stroke.points[i];
      const p2 = stroke.points[i + 1];

      const distance = this.distanceToLineSegment(x, y, p1.x, p1.y, p2.x, p2.y);
      if (distance <= threshold) {
        return true;
      }
    }

    // Additional check for stroke endpoints (helps with very short strokes)
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
      // Point case
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

  redrawCanvas() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Redraw all strokes
    for (let i = 0; i < this.strokes.length; i++) {
      const stroke = this.strokes[i];
      const isSelected = this.selectedStrokes.has(i);
      this.drawStroke(stroke, isSelected);
    }

    // Draw selection box if there are selected strokes
    if (this.selectedStrokes.size > 0 && this.selectionBounds) {
      this.drawSelectionBox();
    }

    // Draw lasso if currently selecting
    if (this.isSelecting && this.selectionPath.length > 1) {
      this.drawLasso();
    }
  }

  drawSelectionBox() {
    if (!this.selectionBounds) return;

    this.ctx.save();
    this.ctx.strokeStyle = '#007AFF';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);

    this.ctx.strokeRect(
      this.selectionBounds.x,
      this.selectionBounds.y,
      this.selectionBounds.width,
      this.selectionBounds.height
    );

    // Draw corner handles
    this.ctx.fillStyle = '#007AFF';
    const handleSize = 8;
    const handles = [
      {x: this.selectionBounds.x, y: this.selectionBounds.y}, // Top-left
      {x: this.selectionBounds.x + this.selectionBounds.width, y: this.selectionBounds.y}, // Top-right
      {x: this.selectionBounds.x, y: this.selectionBounds.y + this.selectionBounds.height}, // Bottom-left
      {x: this.selectionBounds.x + this.selectionBounds.width, y: this.selectionBounds.y + this.selectionBounds.height} // Bottom-right
    ];

    for (const handle of handles) {
      this.ctx.fillRect(
        handle.x - handleSize / 2,
        handle.y - handleSize / 2,
        handleSize,
        handleSize
      );
    }

    this.ctx.restore();
  }

  drawStroke(stroke, isSelected = false) {
    // Validate stroke data
    if (!stroke || !stroke.points || stroke.points.length === 0) return;

    // Ensure stroke has valid properties (fix for black dot bug)
    const tool = stroke.tool || 'pen';
    const color = stroke.color || this.currentColor || '#000000';
    const size = stroke.size || this.toolSizes[tool] || 5;

    this.ctx.save();

    // Apply selection highlighting
    if (isSelected) {
      this.ctx.globalAlpha = 0.8;
      // Add subtle glow effect for selected strokes
      this.ctx.shadowColor = '#007AFF';
      this.ctx.shadowBlur = 5;
    }

    if (tool === 'highlighter') {
      this.ctx.globalCompositeOperation = this.performanceMode ? 'source-over' : 'multiply';
      this.ctx.strokeStyle = this.hexToRgba(color, this.performanceMode ? 0.2 : 0.4);
      this.ctx.fillStyle = this.hexToRgba(color, this.performanceMode ? 0.2 : 0.4);
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = color;
      this.ctx.fillStyle = color;
    }

    this.ctx.lineWidth = size;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.beginPath();

    if (stroke.points.length === 1) {
      // Handle single point as a dot
      const point = stroke.points[0];
      this.ctx.arc(point.x, point.y, size / 2, 0, 2 * Math.PI);
      this.ctx.fill();
    } else {
      // Handle multiple points as a line
      this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        this.ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  clearCanvas() {
    // Save current state before clearing
    if (this.strokes.length > 0) {
      this.saveToUndoHistory({
        type: 'clear',
        strokes: [...this.strokes]
      });
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.strokes = []; // Clear stroke history
  }

  saveToUndoHistory(action) {
    this.undoHistory.push(action);

    // Limit history size
    if (this.undoHistory.length > this.maxUndoHistory) {
      this.undoHistory.shift();
    }
  }

  undo() {
    if (this.undoHistory.length === 0) return;

    const lastAction = this.undoHistory.pop();

    switch (lastAction.type) {
      case 'clear':
        // Restore all strokes that were cleared
        this.strokes = lastAction.strokes;
        break;

      case 'draw':
        // Remove the last drawn stroke
        this.strokes.pop();
        break;

      case 'delete':
        // Restore deleted strokes
        for (const deletedStroke of lastAction.deletedStrokes) {
          this.strokes.splice(deletedStroke.index, 0, deletedStroke.stroke);
        }
        break;

      case 'move':
        // Restore strokes to their original positions
        for (const movedStroke of lastAction.movedStrokes) {
          const stroke = this.strokes[movedStroke.index];
          if (stroke) {
            stroke.points = movedStroke.originalPoints;
            stroke.bounds = movedStroke.originalBounds;
          }
        }
        break;

      case 'partialErase':
        // Restore the original strokes before partial erasing
        this.strokes = lastAction.originalStrokes;
        break;
    }

    // Clear any selection after undo
    this.clearSelection();

    // Redraw canvas
    this.redrawCanvas();
  }

  resizeCanvas() {
    // Store strokes and redraw instead of using imageData
    const currentStrokes = [...this.strokes];
    this.updateCanvasSize();
    this.strokes = currentStrokes;
    this.redrawCanvas();
  }

  // Render only strokes visible in current viewport
  renderVisibleStrokes() {
    // Cancel any pending render
    if (this.renderRequestId) {
      cancelAnimationFrame(this.renderRequestId);
    }

    this.renderRequestId = requestAnimationFrame(() => {
      // Clear canvas
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Get current scroll position
      const scrollX = window.pageXOffset;
      const scrollY = window.pageYOffset;

      // Calculate viewport bounds in document coordinates
      const viewportBounds = {
        left: scrollX - this.viewportPadding,
        right: scrollX + window.innerWidth + this.viewportPadding,
        top: scrollY - this.viewportPadding,
        bottom: scrollY + window.innerHeight + this.viewportPadding
      };

      // Only render strokes that intersect with viewport
      for (const stroke of this.strokes) {
        if (!stroke || !stroke.bounds) continue;

        // Check if stroke bounds intersect with viewport bounds
        if (stroke.bounds.maxX < viewportBounds.left ||
            stroke.bounds.minX > viewportBounds.right ||
            stroke.bounds.maxY < viewportBounds.top ||
            stroke.bounds.minY > viewportBounds.bottom) {
          continue; // Skip strokes outside viewport
        }

        // Render stroke with viewport offset
        this.drawStrokeWithOffset(stroke, scrollX, scrollY);
      }

      this.renderRequestId = null;
    });
  }

  // Draw stroke on viewport canvas with scroll offset
  drawStrokeWithOffset(stroke, scrollX, scrollY) {
    if (!stroke || !stroke.points || stroke.points.length === 0) return;

    if (stroke.tool === 'highlighter') {
      this.ctx.globalCompositeOperation = this.performanceMode ? 'source-over' : 'multiply';
      this.ctx.strokeStyle = this.hexToRgba(stroke.color, this.performanceMode ? 0.2 : 0.4);
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = stroke.color;
    }

    this.ctx.lineWidth = stroke.size || 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.beginPath();

    if (stroke.points.length === 1) {
      // Handle single point as a dot
      const point = stroke.points[0];
      const canvasX = point.x - scrollX;
      const canvasY = point.y - scrollY;
      this.ctx.arc(canvasX, canvasY, (stroke.size || 2) / 2, 0, 2 * Math.PI);
      this.ctx.fill();
    } else {
      // Handle multiple points as a line
      const firstPoint = stroke.points[0];
      this.ctx.moveTo(firstPoint.x - scrollX, firstPoint.y - scrollY);

      for (let i = 1; i < stroke.points.length; i++) {
        const point = stroke.points[i];
        this.ctx.lineTo(point.x - scrollX, point.y - scrollY);
      }
      this.ctx.stroke();
    }
  }

  // Clean up strokes that are very far from current viewport
  cleanupDistantStrokes() {
    if (!this.performanceMode) return; // Only cleanup in performance mode

    const scrollX = window.pageXOffset;
    const scrollY = window.pageYOffset;
    const cleanupDistance = this.viewportPadding * 4; // 4x viewport padding

    const viewportBounds = {
      left: scrollX - cleanupDistance,
      right: scrollX + window.innerWidth + cleanupDistance,
      top: scrollY - cleanupDistance,
      bottom: scrollY + window.innerHeight + cleanupDistance
    };

    // Remove strokes that are completely outside the cleanup bounds
    const originalLength = this.strokes.length;
    this.strokes = this.strokes.filter(stroke => {
      if (!stroke || !stroke.bounds) return true;

      // Keep stroke if it intersects with cleanup bounds
      return !(stroke.bounds.maxX < viewportBounds.left ||
               stroke.bounds.minX > viewportBounds.right ||
               stroke.bounds.maxY < viewportBounds.top ||
               stroke.bounds.minY > viewportBounds.bottom);
    });

    if (this.strokes.length < originalLength) {
      console.log(`Cleaned up ${originalLength - this.strokes.length} distant strokes`);
    }
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
    // Default shortcuts - will be overridden by stored shortcuts in loadSettings
    return {
      'Ctrl+Shift+C': 'clear',
      'Ctrl+Z': 'undo',
      'Meta+Z': 'undo',  // Cmd+Z on Mac
      'P': 'pen',
      'H': 'highlighter',
      'E': 'eraser',
      'S': 'select'
    };
  }

  getCurrentPaletteColors() {
    return this.palettes[this.currentPalette] || this.palettes.simple;
  }

  switchPalette() {
    // Prevent rapid palette switching
    if (this.paletteSwitchCooldown) {
      return;
    }

    this.paletteSwitchCooldown = true;
    setTimeout(() => {
      this.paletteSwitchCooldown = false;
    }, 200); // 200ms cooldown

    const paletteNames = Object.keys(this.palettes);
    const currentIndex = paletteNames.indexOf(this.currentPalette);
    const nextIndex = (currentIndex + 1) % paletteNames.length;
    this.currentPalette = paletteNames[nextIndex];
    this.updateToolbarColors();

    // Save current palette preference
    chrome.storage.sync.set({ selectedPalette: this.currentPalette });
  }

  updateToolbarColors() {
    const colors = this.getCurrentPaletteColors();
    const swatches = this.toolbar.querySelectorAll('.color-swatch');

    // Clear all active states first
    swatches.forEach(swatch => swatch.classList.remove('active'));

    swatches.forEach((swatch, index) => {
      if (index < colors.length) {
        swatch.style.backgroundColor = colors[index];
        swatch.setAttribute('data-color', colors[index]);
        swatch.setAttribute('title', `Color ${index + 1}`);
      }
    });

    // Check if current color exists in new palette
    const currentColorInNewPalette = colors.includes(this.currentColor);

    if (currentColorInNewPalette) {
      // Keep current color if it exists in new palette
      const activeIndex = colors.indexOf(this.currentColor);
      swatches[activeIndex].classList.add('active');
    } else {
      // Switch to first color of new palette if current color doesn't exist
      this.currentColor = colors[0];
      swatches[0].classList.add('active');
    }

    // Update cursor to reflect color change
    this.updateCursor();
  }

  previewNextPalette() {
    // Don't preview if switching is on cooldown or already previewing
    if (this.paletteSwitchCooldown || this.isPreviewingPalette) {
      return;
    }

    this.isPreviewingPalette = true;

    const paletteNames = Object.keys(this.palettes);
    const currentIndex = paletteNames.indexOf(this.currentPalette);
    const nextIndex = (currentIndex + 1) % paletteNames.length;
    const nextPalette = paletteNames[nextIndex];

    // Store original colors for restoration
    this.originalColors = this.getCurrentPaletteColors();
    this.originalActiveColor = this.currentColor;

    // Temporarily show next palette colors
    const colors = this.palettes[nextPalette];
    const swatches = this.toolbar.querySelectorAll('.color-swatch');

    swatches.forEach((swatch, index) => {
      if (index < colors.length) {
        swatch.style.backgroundColor = colors[index];
        swatch.style.opacity = '0.7'; // Make it look like a preview
        swatch.setAttribute('data-color', colors[index]);
      }
    });

    // Add visual indicator that this is a preview
    const paletteBtn = this.toolbar.querySelector('.palette-btn');
    if (paletteBtn) {
      paletteBtn.style.backgroundColor = 'rgba(0, 122, 255, 0.2)';
    }
  }

  clearPalettePreview() {
    if (this.originalColors && this.isPreviewingPalette) {
      const swatches = this.toolbar.querySelectorAll('.color-swatch');

      // Clear all active states first
      swatches.forEach(swatch => swatch.classList.remove('active'));

      swatches.forEach((swatch, index) => {
        if (index < this.originalColors.length) {
          swatch.style.backgroundColor = this.originalColors[index];
          swatch.style.opacity = '1'; // Restore full opacity
          swatch.setAttribute('data-color', this.originalColors[index]);
        }
      });

      // Restore active color state
      if (this.originalActiveColor) {
        const activeSwatch = this.toolbar.querySelector(`[data-color="${this.originalActiveColor}"]`);
        if (activeSwatch) {
          activeSwatch.classList.add('active');
        }
      }

      // Clear the stored original data
      this.originalColors = null;
      this.originalActiveColor = null;
      this.isPreviewingPalette = false;
    }

    // Clear palette button highlight
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

  drawDot(x, y, color, size, tool) {
    this.ctx.save();

    if (tool === 'highlighter') {
      this.ctx.globalCompositeOperation = this.performanceMode ? 'source-over' : 'multiply';
      this.ctx.fillStyle = this.hexToRgba(color, this.performanceMode ? 0.2 : 0.4);
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.fillStyle = color;
    }

    this.ctx.beginPath();
    this.ctx.arc(x, y, size / 2, 0, 2 * Math.PI);
    this.ctx.fill();

    this.ctx.restore();
  }

  // Selection tool methods
  startSelection(x, y) {
    this.isSelecting = true;
    this.selectionPath = [{x, y}];
    this.selectedStrokes.clear();
  }

  updateSelection(x, y) {
    if (!this.isSelecting) return;

    // Add point to selection lasso path
    this.selectionPath.push({x, y});

    // Draw the lasso
    this.redrawCanvas();
    this.drawLasso();
  }

  completeSelection() {
    if (!this.isSelecting) return;

    this.isSelecting = false;

    // Need at least 3 points to make a selection area
    if (this.selectionPath.length < 3) {
      this.selectionPath = [];
      this.redrawCanvas();
      return;
    }

    // Auto-close the lasso path by connecting last point to first
    const closedPath = [...this.selectionPath];
    if (this.selectionPath.length > 0) {
      const firstPoint = this.selectionPath[0];
      const lastPoint = this.selectionPath[this.selectionPath.length - 1];
      // Only add closing point if last point isn't already close to first
      const distance = Math.sqrt(
        Math.pow(lastPoint.x - firstPoint.x, 2) +
        Math.pow(lastPoint.y - firstPoint.y, 2)
      );
      if (distance > 10) {
        // Auto-close the path
        closedPath.push(firstPoint);
      }
    }

    // Find strokes inside the lasso
    this.selectedStrokes.clear();
    for (let i = 0; i < this.strokes.length; i++) {
      const stroke = this.strokes[i];
      if (!stroke || !stroke.points) continue;

      // Check if any point of the stroke is inside the lasso
      // Use a sampling approach for long strokes
      const checkPoints = [];
      if (stroke.points.length <= 10) {
        checkPoints.push(...stroke.points);
      } else {
        // Sample points along the stroke
        const step = Math.max(1, Math.floor(stroke.points.length / 10));
        for (let j = 0; j < stroke.points.length; j += step) {
          checkPoints.push(stroke.points[j]);
        }
        // Always include last point
        checkPoints.push(stroke.points[stroke.points.length - 1]);
      }

      for (const point of checkPoints) {
        if (this.isPointInPolygon(point.x, point.y, closedPath)) {
          this.selectedStrokes.add(i);
          break;
        }
      }
    }

    // Calculate selection bounds
    if (this.selectedStrokes.size > 0) {
      this.calculateSelectionBounds();
    }

    // Clear lasso path and redraw with selection highlights
    this.selectionPath = [];
    this.redrawCanvas();
  }

  drawLasso() {
    if (!this.isSelecting || this.selectionPath.length < 2) return;

    this.ctx.save();
    this.ctx.strokeStyle = '#007AFF';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.beginPath();
    this.ctx.moveTo(this.selectionPath[0].x, this.selectionPath[0].y);

    for (let i = 1; i < this.selectionPath.length; i++) {
      this.ctx.lineTo(this.selectionPath[i].x, this.selectionPath[i].y);
    }

    // Don't close the path while drawing - let user draw freeform
    this.ctx.stroke();
    this.ctx.restore();
  }

  isPointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;

      const intersect = ((yi > y) !== (yj > y))
          && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  calculateSelectionBounds() {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const strokeIndex of this.selectedStrokes) {
      const stroke = this.strokes[strokeIndex];
      if (!stroke || !stroke.bounds) continue;

      minX = Math.min(minX, stroke.bounds.minX);
      minY = Math.min(minY, stroke.bounds.minY);
      maxX = Math.max(maxX, stroke.bounds.maxX);
      maxY = Math.max(maxY, stroke.bounds.maxY);
    }

    this.selectionBounds = {
      x: minX - 10,
      y: minY - 10,
      width: maxX - minX + 20,
      height: maxY - minY + 20
    };
  }

  isPointInSelection(x, y) {
    if (!this.selectionBounds) return false;

    return x >= this.selectionBounds.x &&
           x <= this.selectionBounds.x + this.selectionBounds.width &&
           y >= this.selectionBounds.y &&
           y <= this.selectionBounds.y + this.selectionBounds.height;
  }

  startDraggingSelection(x, y) {
    this.isDraggingSelection = true;
    this.dragStartX = x;
    this.dragStartY = y;

    // Store original positions
    this.originalStrokePositions.clear();
    for (const strokeIndex of this.selectedStrokes) {
      const stroke = this.strokes[strokeIndex];
      if (!stroke || !stroke.points) continue;

      this.originalStrokePositions.set(strokeIndex, {
        points: stroke.points.map(p => ({x: p.x, y: p.y})),
        bounds: {...stroke.bounds}
      });
    }
  }

  dragSelection(x, y) {
    if (!this.isDraggingSelection) return;

    const dx = x - this.dragStartX;
    const dy = y - this.dragStartY;

    // Update positions of selected strokes
    for (const strokeIndex of this.selectedStrokes) {
      const stroke = this.strokes[strokeIndex];
      const original = this.originalStrokePositions.get(strokeIndex);
      if (!stroke || !original) continue;

      // Update points
      stroke.points = original.points.map(p => ({
        x: p.x + dx,
        y: p.y + dy
      }));

      // Update bounds
      stroke.bounds = {
        minX: original.bounds.minX + dx,
        maxX: original.bounds.maxX + dx,
        minY: original.bounds.minY + dy,
        maxY: original.bounds.maxY + dy
      };
    }

    // Recalculate selection bounds based on moved strokes
    this.calculateSelectionBounds();

    this.redrawCanvas();
  }

  stopDraggingSelection() {
    // Save move action to undo history
    if (this.originalStrokePositions.size > 0) {
      const movedStrokes = [];
      for (const [index, original] of this.originalStrokePositions) {
        movedStrokes.push({
          index: index,
          originalPoints: original.points,
          originalBounds: original.bounds
        });
      }

      this.saveToUndoHistory({
        type: 'move',
        movedStrokes: movedStrokes
      });
    }

    this.isDraggingSelection = false;
    this.originalStrokePositions.clear();
    this.calculateSelectionBounds();
    this.redrawCanvas();
  }

  clearSelection() {
    this.selectedStrokes.clear();
    this.selectionBounds = null;
    this.selectionPath = [];
    this.isSelecting = false;
    this.isDraggingSelection = false;
    this.redrawCanvas();
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

    // Listen for palette and shortcut updates from options page
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