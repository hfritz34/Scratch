# Scratch

A Chrome extension for drawing on any webpage with customizable shortcuts.

## Features

- Draw on any webpage with pen, highlighter, and eraser tools
- Fully customizable keyboard and mouse shortcuts
- No data storage - purely for scratch work
- Clean, minimal interface

## Installation

1. Clone the repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable Developer Mode
4. Click "Load unpacked" and select the `web` folder

## Default Shortcuts

- `D` - Toggle drawing mode (when not in input field)
- `Escape` - Exit drawing mode
- `Ctrl+Shift+C` - Clear canvas
- `P` - Select pen tool (when in drawing mode)
- `H` - Select highlighter tool (when in drawing mode)
- `E` - Select eraser tool (when in drawing mode)
- Right-click (hold) - Temporary eraser
- Double right-click - Clear all drawings
- Click extension icon - Toggle drawing mode

## Development

The project is organized into:
- `/web` - Chrome extension code
- `/api` - Future API development (if needed)