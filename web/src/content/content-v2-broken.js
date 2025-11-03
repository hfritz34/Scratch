// content-v2.js
// Orchestrator for Scratch extension using modular architecture
// Version 2.0 - Per-container overlay system with proper multi-scroll support

class ScratchCanvas {
  constructor() {
    // Core modules
    this.overlayManager = new OverlayManager();
    this.storageManager = new StorageManager();
    this.drawingEngine = new DrawingEngine(this.overlayManager, this.storageManager);
    this.toolManager = new ToolManager(this.overlayManager, this.storageManager, this.drawingEngine);

    // UI state
    this.isActive = false;
    this.manuallyDisabled = true;
    this.toolbar = null;
    this.isDraggingToolbar = false;

    // Settings
    this.shortcuts = this.loadShortcuts();
    this.palettes = this.initializePalettes();
    this.currentPalette = 'simple';
    this.paletteSwitchCooldown = false;
    this.isPreviewingPalette = false;

    // Hover activation
    this.hoverTimeout = null;
    this.hideTimeout = null;
    this.isHoveringToolbar = false;

    // Performance mode
    this.performanceMode = false;
    this.heavyDomains = ['youtube.com', 'instagram.com', 'facebook.com', 'twitter.com', 'x.com'];

    // Undo/Redo
    this.undoHistory = [];
    this.maxUndoHistory = 50;

    this.init();
  }

  init() {
    // Check performance mode
    const hostname = window.location.hostname;
    this.performanceMode = this.heavyDomains.some(domain => hostname.includes(domain));

    if (this.performanceMode) {
      console.log('Scratch: Performance mode enabled for', hostname);
    }

    // Wait for DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initializeExtension());
    } else {
      this.initializeExtension();
    }
  }

  initializeExtension() {
    // Safety check
    if (!document.body) {
      setTimeout(() => this.initializeExtension(), 100);
      return;
    }

    // Initialize overlay system
    this.overlayManager.initializeAll();
    this.overlayManager.startWatching();

    // Create toolbar
    this.createToolbar();
    this.setupEventListeners();
    this.loadSettings();

    // Setup resize handler for overlays
    this.overlayManager.on('resize', (container) => {
      this.drawingEngine.renderContainer(container);
    });

    // Setup scroll cleanup
    window.addEventListener('scroll', () => {
      this.storageManager.cleanupAll();
    }, { passive: true });

    console.log('Scratch v2.0 initialized');
  }

  createToolbar() {
    console.log('Creating toolbar...');
    this.toolbar = document.createElement('div');
    this.toolbar.id = 'scratch-toolbar';

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
      <button class="tool-btn" data-tool="select" title="Select (V)">
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
      ${this.performanceMode ? '<span class="perf-indicator" title="Performance mode">⚡</span>' : ''}
    `;

    // Position toolbar
    this.toolbar.style.left = '50%';
    this.toolbar.style.top = '20px';
    this.toolbar.style.transform = 'translateX(-50%)';
    this.toolbar.style.display = 'none';
    this.toolbarPosition = null;

    document.body.appendChild(this.toolbar);
    console.log('Toolbar appended');

    this.setupToolbarEvents();
    this.setupToolbarDrag();
    this.setupHoverActivation();
  }

  setupToolbarEvents() {
    // Tool buttons
    this.toolbar.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tool = e.currentTarget.dataset.tool;
        this.setTool(tool);
      });
    });

    // Size buttons
    this.toolbar.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const size = parseInt(e.currentTarget.dataset.size);
        const sizeGroup = e.currentTarget.closest('.size-buttons');
        const tool = sizeGroup.dataset.tool;

        this.toolManager.toolSizes[tool] = size;

        sizeGroup.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');

        console.log(`Updated ${tool} size to ${size}px`);
      });
    });

    // Mode pills (eraser modes)
    this.toolbar.querySelectorAll('.mode-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        this.toolManager.eraserMode = mode;

        this.toolbar.querySelectorAll('.mode-pill').forEach(p => p.classList.remove('active'));
        e.currentTarget.classList.add('active');

        console.log(`Eraser mode: ${mode}`);
      });
    });

    // Color swatches
    this.toolbar.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        const color = e.currentTarget.dataset.color;
        this.setColor(color);
      });

      swatch.addEventListener('mouseenter', (e) => {
        if (e.currentTarget.dataset.color !== this.toolManager.currentColor) {
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

    // Palette button
    const paletteBtn = this.toolbar.querySelector('.palette-btn');
    if (paletteBtn) {
      paletteBtn.addEventListener('click', () => this.cyclePalette());
    }

    // Clear button
    const clearBtn = this.toolbar.querySelector('.clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearAll());
    }
  }

  setupToolbarDrag() {
    const handle = this.toolbar.querySelector('.toolbar-drag-handle');
    let offsetX = 0;
    let offsetY = 0;

    handle.addEventListener('mousedown', (e) => {
      this.isDraggingToolbar = true;
      const rect = this.toolbar.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      this.toolbar.style.transform = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isDraggingToolbar) return;

      this.toolbar.style.left = (e.clientX - offsetX) + 'px';
      this.toolbar.style.top = (e.clientY - offsetY) + 'px';
    });

    document.addEventListener('mouseup', () => {
      this.isDraggingToolbar = false;
    });
  }

  setupHoverActivation() {
    document.addEventListener('mousemove', (e) => {
      if (this.manuallyDisabled) return;

      const nearEdge = e.clientX < 100 || e.clientX > window.innerWidth - 100 ||
                       e.clientY < 100 || e.clientY > window.innerHeight - 100;

      if (nearEdge && !this.isHoveringToolbar) {
        if (!this.hoverTimeout) {
          this.hoverTimeout = setTimeout(() => {
            this.showToolbar();
          }, 300);
        }
      } else {
        if (this.hoverTimeout) {
          clearTimeout(this.hoverTimeout);
          this.hoverTimeout = null;
        }
      }
    });

    this.toolbar.addEventListener('mouseenter', () => {
      this.isHoveringToolbar = true;
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
        this.hideTimeout = null;
      }
    });

    this.toolbar.addEventListener('mouseleave', () => {
      this.isHoveringToolbar = false;
      this.hideTimeout = setTimeout(() => {
        if (!this.isHoveringToolbar) {
          this.hideToolbar();
        }
      }, 2000);
    });
  }

  setupEventListeners() {
    // Mouse events for drawing
    document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    document.addEventListener('mouseup', (e) => this.handleMouseUp(e));

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));

    // Background messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'toggleDrawing') {
        this.toggleExtension();
      } else if (message.action === 'clearCanvas') {
        this.clearAll();
      }
      sendResponse({ success: true });
    });
  }

  handleMouseDown(e) {
    if (!this.isActive || this.isDraggingToolbar) return;
    if (e.target.closest('#scratch-toolbar')) return;

    const tool = this.toolManager.currentTool;

    if (tool === 'pen' || tool === 'highlighter') {
      this.toolManager.startDrawing(e.clientX, e.clientY);
    } else if (tool === 'eraser') {
      if (this.toolManager.eraserMode === 'whole') {
        this.toolManager.startDeletePreview(e.clientX, e.clientY);
      } else {
        this.toolManager.startPartialErase(e.clientX, e.clientY);
      }
    } else if (tool === 'select') {
      this.toolManager.startSelection(e.clientX, e.clientY);
    }
  }

  handleMouseMove(e) {
    if (!this.isActive || this.isDraggingToolbar) return;

    const tool = this.toolManager.currentTool;

    if (tool === 'pen' || tool === 'highlighter') {
      this.toolManager.continueDrawing(e.clientX, e.clientY);
    } else if (tool === 'eraser') {
      if (this.toolManager.eraserMode === 'whole') {
        this.toolManager.updateDeletePreview(e.clientX, e.clientY);
      } else {
        this.toolManager.continuePartialErase(e.clientX, e.clientY);
      }
    } else if (tool === 'select') {
      this.toolManager.updateSelection(e.clientX, e.clientY);
    }
  }

  handleMouseUp(e) {
    if (!this.isActive) return;

    const tool = this.toolManager.currentTool;

    if (tool === 'pen' || tool === 'highlighter') {
      this.toolManager.endDrawing();
    } else if (tool === 'eraser') {
      if (this.toolManager.eraserMode === 'whole') {
        this.toolManager.completeDelete();
      } else {
        this.toolManager.endPartialErase();
      }
    } else if (tool === 'select') {
      this.toolManager.completeSelection();
    }
  }

  handleKeyDown(e) {
    // Whiteboard shortcut (W key)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'w') {
      e.preventDefault();
      chrome.runtime.sendMessage({ action: 'openWhiteboard' });
      return;
    }

    // Tool shortcuts
    const key = e.key.toLowerCase();
    if (key === 'p') this.setTool('pen');
    else if (key === 'h') this.setTool('highlighter');
    else if (key === 'e') this.setTool('eraser');
    else if (key === 'v') this.setTool('select');

    // Toggle extension (D key)
    if (key === 'd') {
      this.toggleExtension();
    }

    // Clear all (Ctrl/Cmd+Shift+C)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'c') {
      e.preventDefault();
      this.clearAll();
    }

    // Undo (Ctrl/Cmd+Z)
    if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.undo();
    }
  }

  setTool(tool) {
    this.toolManager.setTool(tool);

    // Update UI
    this.toolbar.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    this.toolbar.querySelectorAll('.size-buttons').forEach(group => {
      group.style.display = group.dataset.tool === tool ? 'flex' : 'none';
    });

    this.toolbar.querySelector('.eraser-mode-pills').style.display =
      tool === 'eraser' ? 'flex' : 'none';

    console.log(`Tool set to: ${tool}`);
  }

  setColor(color) {
    this.toolManager.setColor(color);

    // Update UI
    this.toolbar.querySelectorAll('.color-swatch').forEach(swatch => {
      const isActive = swatch.dataset.color === color;
      swatch.classList.toggle('active', isActive);
      swatch.style.transform = isActive ? 'scale(1.2)' : '';
      swatch.style.boxShadow = isActive ? '0 4px 12px rgba(0, 0, 0, 0.3)' : '';
    });

    console.log(`Color set to: ${color}`);
  }

  toggleExtension() {
    this.manuallyDisabled = !this.manuallyDisabled;
    this.isActive = !this.manuallyDisabled;

    if (this.isActive) {
      this.showToolbar();
      console.log('Scratch activated');
    } else {
      this.hideToolbar();
      this.toolManager.clearSelection();
      console.log('Scratch deactivated');
    }
  }

  showToolbar() {
    if (this.toolbar) {
      this.toolbar.style.display = 'flex';
    }
  }

  hideToolbar() {
    if (this.toolbar) {
      this.toolbar.style.display = 'none';
    }
  }

  clearAll() {
    if (!confirm('Clear all drawings?')) return;

    this.storageManager.clearAll();
    this.drawingEngine.renderAll();
    this.undoHistory = [];

    console.log('All drawings cleared');
  }

  undo() {
    // Placeholder for undo functionality
    console.log('Undo called (not yet implemented in v2.0)');
  }

  cyclePalette() {
    const paletteNames = Object.keys(this.palettes);
    const currentIndex = paletteNames.indexOf(this.currentPalette);
    const nextIndex = (currentIndex + 1) % paletteNames.length;
    this.currentPalette = paletteNames[nextIndex];

    // Update color swatches
    const colors = this.getCurrentPaletteColors();
    const swatches = this.toolbar.querySelectorAll('.color-swatch');

    swatches.forEach((swatch, index) => {
      if (colors[index]) {
        swatch.dataset.color = colors[index];
        swatch.style.backgroundColor = colors[index];
      }
    });

    console.log(`Palette changed to: ${this.currentPalette}`);
  }

  getCurrentPaletteColors() {
    return this.palettes[this.currentPalette] || this.palettes.simple;
  }

  initializePalettes() {
    return {
      simple: ['#000000', '#FF0000', '#0000FF', '#00FF00', '#FFFF00', '#FF00FF'],
      pastel: ['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', '#E0BBE4'],
      neon: ['#FF006E', '#FB5607', '#FFBE0B', '#8338EC', '#3A86FF', '#06FFA5'],
      earth: ['#8B4513', '#228B22', '#4682B4', '#D2691E', '#556B2F', '#8B7355']
    };
  }

  loadShortcuts() {
    return {
      'P': 'pen',
      'H': 'highlighter',
      'E': 'eraser',
      'V': 'select',
      'D': 'toggle'
    };
  }

  loadSettings() {
    // Load settings from chrome.storage
    chrome.storage.sync.get(['shortcuts', 'palette'], (result) => {
      if (result.shortcuts) {
        this.shortcuts = result.shortcuts;
      }
      if (result.palette) {
        this.currentPalette = result.palette;
      }
    });
  }

  cleanup() {
    this.overlayManager.cleanup();
    this.drawingEngine.cleanup();
    if (this.toolbar && this.toolbar.parentNode) {
      this.toolbar.parentNode.removeChild(this.toolbar);
    }
  }
}

// Initialize extension
const scratchCanvas = new ScratchCanvas();

// Export for debugging
window.scratchCanvas = scratchCanvas;
