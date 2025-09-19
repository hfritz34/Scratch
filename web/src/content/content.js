class ScratchCanvas {
  constructor() {
    this.isDrawing = false;
    this.isActive = false;
    this.isDraggingToolbar = false;
    this.currentTool = 'pen';
    this.currentColor = '#000000';
    this.canvas = null;
    this.ctx = null;
    this.toolbar = null;
    this.lastX = 0;
    this.lastY = 0;
    this.shortcuts = this.loadShortcuts();
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
    const height = Math.max(
      body.scrollHeight, body.offsetHeight,
      html.clientHeight, html.scrollHeight, html.offsetHeight
    );
    const width = Math.max(
      body.scrollWidth, body.offsetWidth,
      html.clientWidth, html.scrollWidth, html.offsetWidth
    );

    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.height = height + 'px';
  }

  createToolbar() {
    console.log('Creating toolbar...');
    this.toolbar = document.createElement('div');
    this.toolbar.id = 'scratch-toolbar';
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
      <div class="color-swatch active" data-color="#000000" style="background-color: #000000;" title="Black"></div>
      <div class="color-swatch" data-color="#FF0000" style="background-color: #FF0000;" title="Red"></div>
      <div class="color-swatch" data-color="#0000FF" style="background-color: #0000FF;" title="Blue"></div>
      <input type="color" id="custom-color" value="#000000" title="Custom color">
      <div class="toolbar-divider"></div>
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
    this.setupToolbarEvents();
    this.setupToolbarDrag();
  }

  setupToolbarEvents() {
    // Tool selection
    this.toolbar.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tool = e.currentTarget.dataset.tool;
        this.setTool(tool);
      });
    });

    // Color selection
    this.toolbar.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        const color = e.currentTarget.dataset.color;
        this.setColor(color);
      });
    });

    // Custom color picker
    const customColor = this.toolbar.querySelector('#custom-color');
    customColor.addEventListener('change', (e) => {
      this.setColor(e.target.value);
    });

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

  setupEventListeners() {
    let resizeTimeout;
    window.addEventListener('resize', () => {
      this.resizeCanvas();

      // Debounce toolbar repositioning
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.keepToolbarInBounds();
      }, 100);
    });
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

    this.isDrawing = true;
    this.lastX = e.pageX;
    this.lastY = e.pageY;
  }

  handleMouseMove(e) {
    if (!this.isActive || !this.isDrawing) return;

    if (this.currentTool === 'highlighter') {
      // Use multiply blending for proper highlighter effect
      this.ctx.globalCompositeOperation = 'multiply';
      this.ctx.strokeStyle = this.hexToRgba(this.currentColor, 0.4);
      this.ctx.lineWidth = 15;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
      this.ctx.lineTo(e.pageX, e.pageY);
      this.ctx.stroke();
    } else {
      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
      this.ctx.lineTo(e.pageX, e.pageY);

      if (this.currentTool === 'pen') {
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = 2;
        this.ctx.globalCompositeOperation = 'source-over';
      } else if (this.currentTool === 'eraser') {
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.lineWidth = 20;
      }

      this.ctx.lineCap = 'round';
      this.ctx.stroke();
    }

    this.lastX = e.pageX;
    this.lastY = e.pageY;
  }

  handleMouseUp(e) {
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

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  resizeCanvas() {
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this.updateCanvasSize();
    this.ctx.putImageData(imageData, 0, 0);
  }

  loadShortcuts() {
    return {
      'Ctrl+Shift+C': 'clear',
      'P': 'pen',
      'H': 'highlighter',
      'E': 'eraser'
    };
  }

  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  loadSettings() {
    chrome.storage.sync.get(['shortcuts'], (result) => {
      if (result.shortcuts) {
        this.shortcuts = result.shortcuts;
      }
    });
  }
}

const scratch = new ScratchCanvas();