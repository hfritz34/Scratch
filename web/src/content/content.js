class ScratchCanvas {
  constructor() {
    this.isDrawing = false;
    this.isActive = false;
    this.isDraggingToolbar = false;
    this.currentTool = 'pen';
    this.currentColor = '#000000';
    this.toolSizes = {
      pen: 2,
      highlighter: 15,
      eraser: 20
    };
    this.canvas = null;
    this.ctx = null;
    this.toolbar = null;
    this.sizeSlider = null;
    this.sliderTimeout = null;
    this.lastX = 0;
    this.lastY = 0;
    this.shortcuts = this.loadShortcuts();
    this.strokes = []; // Track all strokes for whole eraser functionality
    this.currentStroke = null;
    this.palettes = this.initializePalettes();
    this.currentPalette = 'simple';
    this.init();
  }

  init() {
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
    this.canvas.style.display = 'none';

    // Set canvas size to full document size
    this.updateCanvasSize();

    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
  }

  updateCanvasSize() {
    const body = document.body;
    const html = document.documentElement;

    // Get the full document dimensions including scrollable area
    const height = Math.max(
      body.scrollHeight, body.offsetHeight,
      html.clientHeight, html.scrollHeight, html.offsetHeight,
      window.innerHeight + window.pageYOffset
    );
    const width = Math.max(
      body.scrollWidth, body.offsetWidth,
      html.clientWidth, html.scrollWidth, html.offsetWidth,
      window.innerWidth + window.pageXOffset
    );

    // Set canvas size to cover entire document
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';

    console.log('Canvas size updated:', width, 'x', height);
  }

  createToolbar() {
    console.log('Creating toolbar...');
    this.toolbar = document.createElement('div');
    this.toolbar.id = 'scratch-toolbar';
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
      <button class="tool-btn" data-tool="highlighter" title="Highlighter (H)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11 9h5.5L11 3.5V9zM7.5 6.5C6.12 6.5 5 7.62 5 9v10.5c0 1.38 1.12 2.5 2.5 2.5h9c1.38 0 2.5-1.12 2.5-2.5V9H13V3.5h-3c-1.38 0-2.5 1.12-2.5 2.5V6.5z"/>
        </svg>
      </button>
      <button class="tool-btn" data-tool="eraser" title="Eraser (E)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 0 1-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l10.6-10.6c.79-.78 2.05-.78 2.83 0M4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53-6.36-6.36-3.54 3.54c-.78.78-.78 2.05 0 2.82z"/>
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
    `;

    // Position toolbar at top center initially
    this.toolbar.style.left = '50%';
    this.toolbar.style.top = '20px';
    this.toolbar.style.transform = 'translateX(-50%)';
    this.toolbarPosition = null; // Not snapped to edge initially

    document.body.appendChild(this.toolbar);
    console.log('Toolbar appended to body:', this.toolbar);
    this.createSizeSlider();
    this.setupToolbarEvents();
    this.setupToolbarDrag();
  }

  createSizeSlider() {
    this.sizeSlider = document.createElement('div');
    this.sizeSlider.id = 'size-slider';
    this.sizeSlider.innerHTML = `
      <div class="slider-container">
        <span class="slider-label">Size</span>
        <input type="range" class="size-range" min="1" max="50" value="2">
        <span class="slider-value">2px</span>
      </div>
    `;
    this.sizeSlider.style.display = 'none';
    document.body.appendChild(this.sizeSlider);

    const slider = this.sizeSlider.querySelector('.size-range');
    const valueDisplay = this.sizeSlider.querySelector('.slider-value');

    slider.addEventListener('input', (e) => {
      const size = parseInt(e.target.value);
      this.toolSizes[this.currentTool] = size;
      valueDisplay.textContent = size + 'px';
      this.resetSliderTimeout();
    });

    // Hide slider when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#size-slider') && !e.target.closest('.tool-btn')) {
        this.hideSizeSlider();
      }
    });
  }

  setupToolbarEvents() {
    // Tool selection with hover-based size slider
    this.toolbar.querySelectorAll('.tool-btn').forEach(btn => {
      // Click to select tool
      btn.addEventListener('click', (e) => {
        const tool = e.currentTarget.dataset.tool;
        this.setTool(tool);
      });

      // Hover to show size slider for current tool
      btn.addEventListener('mouseenter', (e) => {
        const tool = e.currentTarget.dataset.tool;
        if (tool === this.currentTool && ['pen', 'highlighter', 'eraser'].includes(tool)) {
          this.showSizeSlider(e.currentTarget);
        }
      });

      btn.addEventListener('mouseleave', (e) => {
        const tool = e.currentTarget.dataset.tool;
        if (tool === this.currentTool && ['pen', 'highlighter', 'eraser'].includes(tool)) {
          this.resetSliderTimeout();
        }
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
        if (!e.currentTarget.classList.contains('active')) {
          e.currentTarget.style.transform = '';
          e.currentTarget.style.boxShadow = '';
        }
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

      let newLeft = startLeft + deltaX;
      let newTop = startTop + deltaY;

      // Get toolbar dimensions
      const rect = this.toolbar.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const margin = 10;

      // Constrain to window bounds during drag
      newLeft = Math.max(margin, Math.min(newLeft, windowWidth - rect.width - margin));
      newTop = Math.max(margin, Math.min(newTop, windowHeight - rect.height - margin));

      this.toolbar.style.left = newLeft + 'px';
      this.toolbar.style.top = newTop + 'px';
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

  snapToEdge() {
    const rect = this.toolbar.getBoundingClientRect();
    const threshold = 50; // Distance from edge to trigger snap

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

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

    // Snap to edge and rotate if needed
    if (closestEdge) {
      this.toolbarPosition = closestEdge;
      this.positionToolbarAtEdge(closestEdge);

      // Add snapped class for visual feedback
      this.toolbar.classList.add('snapped');
      setTimeout(() => this.toolbar.classList.remove('snapped'), 300);
    }
  }

  positionToolbarAtEdge(edge) {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const rect = this.toolbar.getBoundingClientRect();

    switch (edge) {
      case 'top':
        this.toolbar.style.left = '50%';
        this.toolbar.style.top = '20px';
        this.toolbar.style.transform = 'translateX(-50%)';
        this.toolbar.style.writingMode = 'horizontal-tb';
        break;

      case 'bottom':
        this.toolbar.style.left = '50%';
        this.toolbar.style.top = (windowHeight - rect.height - 20) + 'px';
        this.toolbar.style.transform = 'translateX(-50%)';
        this.toolbar.style.writingMode = 'horizontal-tb';
        break;

      case 'left':
        this.toolbar.style.left = '20px';
        this.toolbar.style.top = '50%';
        this.toolbar.style.transform = 'translateY(-50%) rotate(-90deg)';
        this.toolbar.style.transformOrigin = 'center center';
        break;

      case 'right':
        this.toolbar.style.left = (windowWidth - rect.height - 20) + 'px';
        this.toolbar.style.top = '50%';
        this.toolbar.style.transform = 'translateY(-50%) rotate(90deg)';
        this.toolbar.style.transformOrigin = 'center center';
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

    // Update active tool button
    this.toolbar.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    this.toolbar.querySelector(`[data-tool="${tool}"]`).classList.add('active');

    // Update cursor
    this.updateCursor();
  }

  updateCursor() {
    if (!this.isActive) return;

    const color = this.currentColor || '#000000';
    let cursorSvg = '';

    if (this.currentTool === 'pen') {
      // Pen cursor with color dot
      cursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="8" fill="${color}" stroke="white" stroke-width="2"/>
        <circle cx="16" cy="16" r="2" fill="white"/>
      </svg>`;
    } else if (this.currentTool === 'highlighter') {
      // Highlighter cursor with transparent color
      const rgba = this.hexToRgba(color, 0.3);
      cursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <rect x="8" y="8" width="16" height="16" fill="${rgba}" stroke="white" stroke-width="2"/>
        <circle cx="16" cy="16" r="2" fill="black"/>
      </svg>`;
    } else if (this.currentTool === 'eraser') {
      // Eraser cursor
      cursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="10" fill="none" stroke="red" stroke-width="3"/>
        <line x1="10" y1="16" x2="22" y2="16" stroke="red" stroke-width="2"/>
        <line x1="16" y1="10" x2="16" y2="22" stroke="red" stroke-width="2"/>
      </svg>`;
    }

    const encodedSvg = encodeURIComponent(cursorSvg);
    this.canvas.style.cursor = `url('data:image/svg+xml;utf8,${encodedSvg}') 16 16, crosshair`;
  }

  setColor(color) {
    this.currentColor = color;

    // Update active color swatch
    this.toolbar.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.classList.remove('active');
    });

    const swatch = this.toolbar.querySelector(`[data-color="${color}"]`);
    if (swatch) {
      swatch.classList.add('active');
    }

    // Update custom color picker
    this.toolbar.querySelector('#custom-color').value = color;

    // Update cursor to match new color
    this.updateCursor();
  }

  showSizeSlider(toolButton) {
    const rect = toolButton.getBoundingClientRect();
    const toolbarRect = this.toolbar.getBoundingClientRect();

    // Update slider value for current tool
    const slider = this.sizeSlider.querySelector('.size-range');
    const valueDisplay = this.sizeSlider.querySelector('.slider-value');
    const currentSize = this.toolSizes[this.currentTool];

    slider.value = currentSize;
    valueDisplay.textContent = currentSize + 'px';

    // Set max value based on tool
    const maxValues = { pen: 20, highlighter: 40, eraser: 50 };
    slider.max = maxValues[this.currentTool] || 20;

    // Position slider near the tool button
    this.sizeSlider.style.position = 'fixed';
    this.sizeSlider.style.left = rect.left + 'px';
    this.sizeSlider.style.top = (rect.bottom + 8) + 'px';
    this.sizeSlider.style.display = 'block';
    this.sizeSlider.style.zIndex = '1000000';

    this.resetSliderTimeout();
  }

  hideSizeSlider() {
    this.sizeSlider.style.display = 'none';
    if (this.sliderTimeout) {
      clearTimeout(this.sliderTimeout);
      this.sliderTimeout = null;
    }
  }

  resetSliderTimeout() {
    if (this.sliderTimeout) {
      clearTimeout(this.sliderTimeout);
    }
    this.sliderTimeout = setTimeout(() => {
      this.hideSizeSlider();
    }, 2000); // Hide after 2 seconds of inactivity
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
        this.updateCanvasSize();
      }, 100);
    }, { passive: true });

    document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    document.addEventListener('contextmenu', (e) => this.handleRightClick(e));
    document.addEventListener('keydown', (e) => this.handleKeyPress(e));

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
    this.canvas.style.display = this.isActive ? 'block' : 'none';
    this.canvas.style.pointerEvents = this.isActive ? 'auto' : 'none';
    this.toolbar.style.display = this.isActive ? 'flex' : 'none';

    if (this.isActive) {
      this.setTool('pen'); // Set default tool
      this.updateCursor();
      // Ensure toolbar is in bounds when first shown
      this.keepToolbarInBounds();
    } else {
      this.canvas.style.cursor = 'default';
    }
  }

  handleMouseDown(e) {
    if (!this.isActive) return;

    // Prevent drawing if clicking on toolbar or dragging it
    if (e.target.closest('#scratch-toolbar') || this.isDraggingToolbar) return;

    if (this.currentTool === 'eraser') {
      // Whole eraser: detect and remove strokes at click point
      this.wholeErase(e.pageX, e.pageY);
      return;
    }

    this.isDrawing = true;
    this.lastX = e.pageX;
    this.lastY = e.pageY;

    // Start new stroke tracking
    this.currentStroke = {
      tool: this.currentTool,
      color: this.currentColor,
      size: this.toolSizes[this.currentTool],
      points: [{ x: e.pageX, y: e.pageY }],
      bounds: {
        minX: e.pageX,
        maxX: e.pageX,
        minY: e.pageY,
        maxY: e.pageY
      }
    };
  }

  handleMouseMove(e) {
    if (!this.isActive || !this.isDrawing) return;

    // Add point to current stroke
    if (this.currentStroke) {
      this.currentStroke.points.push({ x: e.pageX, y: e.pageY });

      // Update stroke bounds
      this.currentStroke.bounds.minX = Math.min(this.currentStroke.bounds.minX, e.pageX);
      this.currentStroke.bounds.maxX = Math.max(this.currentStroke.bounds.maxX, e.pageX);
      this.currentStroke.bounds.minY = Math.min(this.currentStroke.bounds.minY, e.pageY);
      this.currentStroke.bounds.maxY = Math.max(this.currentStroke.bounds.maxY, e.pageY);
    }

    if (this.currentTool === 'highlighter') {
      // Use multiply blending for proper highlighter effect
      this.ctx.globalCompositeOperation = 'multiply';
      this.ctx.strokeStyle = this.hexToRgba(this.currentColor, 0.4);
      this.ctx.lineWidth = this.toolSizes.highlighter;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
      this.ctx.lineTo(e.pageX, e.pageY);
      this.ctx.stroke();
    } else if (this.currentTool === 'pen') {
      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
      this.ctx.lineTo(e.pageX, e.pageY);

      this.ctx.strokeStyle = this.currentColor;
      this.ctx.lineWidth = this.toolSizes.pen;
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.lineCap = 'round';
      this.ctx.stroke();
    }

    this.lastX = e.pageX;
    this.lastY = e.pageY;
  }

  handleMouseUp(e) {
    if (this.isDrawing && this.currentStroke) {
      // Save completed stroke
      this.strokes.push(this.currentStroke);
      this.currentStroke = null;
    }
    this.isDrawing = false;
  }

  handleRightClick(e) {
    if (!this.isActive) return;
    e.preventDefault();

    const now = Date.now();
    if (this.lastRightClick && now - this.lastRightClick < 300) {
      this.clearCanvas();
    } else {
      const previousTool = this.currentTool;
      this.currentTool = 'eraser';

      const revertTool = () => {
        this.currentTool = previousTool;
        document.removeEventListener('mouseup', revertTool);
      };

      document.addEventListener('mouseup', revertTool);
    }

    this.lastRightClick = now;
  }

  handleKeyPress(e) {
    // Ignore if user is typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    // Handle 'D' key to toggle drawing mode
    if (e.key === 'd' || e.key === 'D') {
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        this.toggleDrawingMode();
        return;
      }
    }

    // Handle Escape key to exit drawing mode
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

  wholeErase(x, y) {
    // Find strokes that contain the click point
    const strokesToRemove = [];

    for (let i = 0; i < this.strokes.length; i++) {
      const stroke = this.strokes[i];

      // Quick bounds check first
      const padding = stroke.size / 2 + 5; // Add padding for easier selection
      if (x >= stroke.bounds.minX - padding && x <= stroke.bounds.maxX + padding &&
          y >= stroke.bounds.minY - padding && y <= stroke.bounds.maxY + padding) {

        // Check if point is near any line segment in the stroke
        if (this.isPointNearStroke(x, y, stroke)) {
          strokesToRemove.push(i);
        }
      }
    }

    // Remove strokes (in reverse order to maintain indices)
    for (let i = strokesToRemove.length - 1; i >= 0; i--) {
      this.strokes.splice(strokesToRemove[i], 1);
    }

    // Redraw canvas if strokes were removed
    if (strokesToRemove.length > 0) {
      this.redrawCanvas();
    }
  }

  isPointNearStroke(x, y, stroke) {
    const threshold = stroke.size / 2 + 8; // Tolerance for click detection

    for (let i = 0; i < stroke.points.length - 1; i++) {
      const p1 = stroke.points[i];
      const p2 = stroke.points[i + 1];

      const distance = this.distanceToLineSegment(x, y, p1.x, p1.y, p2.x, p2.y);
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

    // Redraw all remaining strokes
    for (const stroke of this.strokes) {
      this.drawStroke(stroke);
    }
  }

  drawStroke(stroke) {
    if (stroke.points.length < 2) return;

    if (stroke.tool === 'highlighter') {
      this.ctx.globalCompositeOperation = 'multiply';
      this.ctx.strokeStyle = this.hexToRgba(stroke.color, 0.4);
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = stroke.color;
    }

    this.ctx.lineWidth = stroke.size;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.beginPath();
    this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    for (let i = 1; i < stroke.points.length; i++) {
      this.ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }

    this.ctx.stroke();
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.strokes = []; // Clear stroke history
  }

  resizeCanvas() {
    // Store strokes and redraw instead of using imageData
    const currentStrokes = [...this.strokes];
    this.updateCanvasSize();
    this.strokes = currentStrokes;
    this.redrawCanvas();
  }

  initializePalettes() {
    return {
      simple: ['#000000', '#FF0000', '#0000FF', '#00FF00', '#FFFF00'],
      blu: ['#001F3F', '#0074D9', '#7FDBFF', '#39CCCC', '#2ECC40'],
      cambridge: ['#2E4057', '#048A81', '#54C6EB', '#F18F01', '#C73E1D'],
      dream: ['#F72585', '#B5179E', '#7209B7', '#480CA8', '#3A0CA3'],
      eclipse: ['#011627', '#FDFFFC', '#2EC4B6', '#E71D36', '#FF9F1C'],
      fairytale: ['#F72585', '#4CC9F0', '#7209B7', '#560BAD', '#480CA8'],
      go: ['#FF6B35', '#F7931E', '#FFD23F', '#06FFA5', '#118AB2'],
      incorrect: ['#EF476F', '#FFD166', '#06D6A0', '#118AB2', '#073B4C'],
      metropark: ['#264653', '#2A9D8F', '#E9C46A', '#F4A261', '#E76F51'],
      rebecca: ['#2F1B69', '#A288A6', '#FFFFFF', '#F0E68C', '#FF6B6B'],
      remember: ['#8D5524', '#C68642', '#E0AC69', '#F1C27D', '#FFDBAC'],
      stung: ['#F72585', '#B5179E', '#7209B7', '#480CA8', '#3A0CA3']
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
    const paletteNames = Object.keys(this.palettes);
    const currentIndex = paletteNames.indexOf(this.currentPalette);
    const nextIndex = (currentIndex + 1) % paletteNames.length;
    this.currentPalette = paletteNames[nextIndex];
    this.updateToolbarColors();
  }

  updateToolbarColors() {
    const colors = this.getCurrentPaletteColors();
    const swatches = this.toolbar.querySelectorAll('.color-swatch');

    swatches.forEach((swatch, index) => {
      if (index < colors.length) {
        swatch.style.backgroundColor = colors[index];
        swatch.setAttribute('data-color', colors[index]);
        swatch.setAttribute('title', `Color ${index + 1}`);
      }
    });

    // Update current color to first color of new palette
    this.currentColor = colors[0];
    swatches[0].classList.add('active');
    for (let i = 1; i < swatches.length; i++) {
      swatches[i].classList.remove('active');
    }
  }

  previewNextPalette() {
    const paletteNames = Object.keys(this.palettes);
    const currentIndex = paletteNames.indexOf(this.currentPalette);
    const nextIndex = (currentIndex + 1) % paletteNames.length;
    const nextPalette = paletteNames[nextIndex];

    // Store original colors for restoration
    this.originalColors = this.getCurrentPaletteColors();

    // Temporarily show next palette colors
    const colors = this.palettes[nextPalette];
    const swatches = this.toolbar.querySelectorAll('.color-swatch');

    swatches.forEach((swatch, index) => {
      if (index < colors.length) {
        swatch.style.backgroundColor = colors[index];
        swatch.style.opacity = '0.7'; // Make it look like a preview
      }
    });

    // Add visual indicator that this is a preview
    const paletteBtn = this.toolbar.querySelector('.palette-btn');
    if (paletteBtn) {
      paletteBtn.style.backgroundColor = 'rgba(0, 122, 255, 0.2)';
    }
  }

  clearPalettePreview() {
    if (this.originalColors) {
      const swatches = this.toolbar.querySelectorAll('.color-swatch');

      swatches.forEach((swatch, index) => {
        if (index < this.originalColors.length) {
          swatch.style.backgroundColor = this.originalColors[index];
          swatch.style.opacity = '1'; // Restore full opacity
        }
      });

      this.originalColors = null;
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

    // Listen for palette updates from options page
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'updatePalette') {
        this.currentPalette = request.palette;
        if (this.toolbar) {
          this.updateToolbarColors();
        }
      }
    });
  }
}

const scratch = new ScratchCanvas();