// whiteboard.js
// Simple script to handle ESC key to close whiteboard and return to previous tab

(function() {
  'use strict';

  // Listen for ESC key to close this tab and go back
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Close this tab - browser will automatically go to previous tab
      window.close();
    }
  });

  // Store that this is a whiteboard page for the extension to detect
  window.isWhiteboardPage = true;

  // Make logo erasable with transparency preview
  let logoElement = null;
  let logoErasePreview = false;

  // Wait for content.js to load and initialize
  window.addEventListener('load', () => {
    logoElement = document.getElementById('logo');

    // Listen for eraser/quick-delete hover events from content.js
    document.addEventListener('mousemove', (e) => {
      if (!logoElement || logoElement.style.display === 'none') return;

      // Check if mouse is over logo bounds
      const rect = logoElement.getBoundingClientRect();
      const mouseX = e.clientX;
      const mouseY = e.clientY;

      const isHovering = mouseX >= rect.left && mouseX <= rect.right &&
                        mouseY >= rect.top && mouseY <= rect.bottom;

      // Check if we're in eraser/quick-delete mode by checking if right mouse is down
      // or if the extension is in eraser mode
      if (isHovering && (e.buttons === 2 || isEraserActive())) {
        if (!logoErasePreview) {
          logoErasePreview = true;
          logoElement.classList.add('eraser-preview');
        }
      } else {
        if (logoErasePreview) {
          logoErasePreview = false;
          logoElement.classList.remove('eraser-preview');
        }
      }
    });

    // Listen for mouseup to check if we should delete the logo
    document.addEventListener('mouseup', (e) => {
      if (!logoElement || logoElement.style.display === 'none') return;

      if (logoErasePreview) {
        // Remove the logo
        logoElement.style.display = 'none';
        logoErasePreview = false;
      }
    });

    // Listen for left-click when eraser is active (whole mode)
    document.addEventListener('mousedown', (e) => {
      if (!logoElement || logoElement.style.display === 'none') return;
      if (e.button !== 0) return; // Only left click

      const rect = logoElement.getBoundingClientRect();
      const mouseX = e.clientX;
      const mouseY = e.clientY;

      const isHovering = mouseX >= rect.left && mouseX <= rect.right &&
                        mouseY >= rect.top && mouseY <= rect.bottom;

      if (isHovering && isEraserActive()) {
        logoElement.classList.add('eraser-preview');
        logoErasePreview = true;
      }
    });
  });

  // Helper to check if eraser tool is active in content.js
  function isEraserActive() {
    // Access the scratch instance from content.js
    if (window.scratch && window.scratch.isActive && window.scratch.currentTool === 'eraser') {
      return true;
    }
    return false;
  }

})();
