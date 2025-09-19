class ScratchCanvas {
  constructor() {
    this.isDrawing = false;
    this.isActive = false;
    this.currentTool = 'pen';
    this.canvas = null;
    this.ctx = null;
    this.lastX = 0;
    this.lastY = 0;
    this.shortcuts = this.loadShortcuts();
    this.init();
  }

  init() {
    this.createCanvas();
    this.setupEventListeners();
    this.loadSettings();
  }

  createCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'scratch-canvas';
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '999999';
    this.canvas.style.display = 'none';

    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.resizeCanvas());
    document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    document.addEventListener('contextmenu', (e) => this.handleRightClick(e));
    document.addEventListener('keydown', (e) => this.handleKeyPress(e));

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'toggleDrawing') {
        this.toggleDrawingMode();
      } else if (request.action === 'clearCanvas') {
        this.clearCanvas();
      }
    });
  }

  toggleDrawingMode() {
    this.isActive = !this.isActive;
    this.canvas.style.display = this.isActive ? 'block' : 'none';
    this.canvas.style.pointerEvents = this.isActive ? 'auto' : 'none';
  }

  handleMouseDown(e) {
    if (!this.isActive) return;

    this.isDrawing = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  handleMouseMove(e) {
    if (!this.isActive || !this.isDrawing) return;

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(e.clientX, e.clientY);

    if (this.currentTool === 'pen') {
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 2;
      this.ctx.globalCompositeOperation = 'source-over';
    } else if (this.currentTool === 'highlighter') {
      this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
      this.ctx.lineWidth = 15;
      this.ctx.globalCompositeOperation = 'source-over';
    } else if (this.currentTool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.lineWidth = 20;
    }

    this.ctx.lineCap = 'round';
    this.ctx.stroke();

    this.lastX = e.clientX;
    this.lastY = e.clientY;
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
    if (!this.shortcuts) return;

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
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.ctx.putImageData(imageData, 0, 0);
  }

  loadShortcuts() {
    return {
      'Ctrl+Shift+D': 'toggle',
      'Ctrl+Shift+C': 'clear',
      'P': 'pen',
      'H': 'highlighter',
      'E': 'eraser'
    };
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