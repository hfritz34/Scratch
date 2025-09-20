document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggle-drawing');
  const clearBtn = document.getElementById('clear-all');
  const customizeBtn = document.getElementById('customize-shortcuts');
  const optionsBtn = document.getElementById('open-options');

  // Check current drawing state
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getState' }, (response) => {
        if (response && response.isActive !== undefined) {
          updateToggleButton(response.isActive);
        } else {
          updateToggleButton(false); // Default to inactive if no response
        }
      });
    }
  });

  // Toggle drawing mode
  toggleBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleDrawing' }, (response) => {
        // Update button state based on response
        if (response && response.isActive !== undefined) {
          updateToggleButton(response.isActive);
        }
      });
    });
  });

  // Clear all drawings
  clearBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'clearCanvas' });
    });
    // Provide visual feedback
    clearBtn.style.background = 'rgba(255, 255, 255, 0.3)';
    setTimeout(() => {
      clearBtn.style.background = '';
    }, 200);
  });

  // Open shortcuts customization (we'll create this modal)
  customizeBtn.addEventListener('click', () => {
    showShortcutsModal();
  });

  // Open advanced options page
  optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  function updateToggleButton(isActive) {
    if (isActive) {
      toggleBtn.classList.add('active');
      toggleBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
        </svg>
        Stop Drawing
      `;
    } else {
      toggleBtn.classList.remove('active');
      toggleBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </svg>
        Start Drawing
      `;
    }
  }

  function showShortcutsModal() {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'shortcuts-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Customize Shortcuts</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <p class="modal-note">Click on any shortcut to change it</p>
          <div class="custom-shortcuts">
            <div class="custom-shortcut">
              <span class="shortcut-label">Toggle Drawing</span>
              <button class="shortcut-editor" data-action="toggle">D</button>
            </div>
            <div class="custom-shortcut">
              <span class="shortcut-label">Pen Tool</span>
              <button class="shortcut-editor" data-action="pen">P</button>
            </div>
            <div class="custom-shortcut">
              <span class="shortcut-label">Highlighter</span>
              <button class="shortcut-editor" data-action="highlighter">H</button>
            </div>
            <div class="custom-shortcut">
              <span class="shortcut-label">Eraser</span>
              <button class="shortcut-editor" data-action="eraser">E</button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-btn secondary" id="reset-shortcuts">Reset to Defaults</button>
          <button class="modal-btn primary" id="save-shortcuts">Save Changes</button>
        </div>
      </div>
    `;

    // Add modal styles
    const modalStyles = document.createElement('style');
    modalStyles.textContent = `
      .shortcuts-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
      .modal-content {
        background: rgba(250, 250, 240, 0.95);
        backdrop-filter: blur(40px) saturate(1.8) brightness(1.1);
        -webkit-backdrop-filter: blur(40px) saturate(1.8) brightness(1.1);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 12px;
        width: 90%;
        max-width: 400px;
        color: #333;
      }
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      }
      .modal-close {
        background: none;
        border: none;
        color: #333;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .modal-body {
        padding: 20px;
      }
      .modal-note {
        font-size: 12px;
        opacity: 0.7;
        margin-bottom: 16px;
      }
      .custom-shortcuts {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .custom-shortcut {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .shortcut-label {
        font-size: 14px;
      }
      .shortcut-editor {
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        color: #333;
        padding: 6px 12px;
        font-family: monospace;
        cursor: pointer;
        min-width: 60px;
      }
      .shortcut-editor:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      .shortcut-editor.editing {
        background: rgba(255, 255, 255, 0.9);
        color: #333;
        animation: pulse 1s infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      .modal-footer {
        display: flex;
        gap: 8px;
        padding: 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.2);
      }
      .modal-btn {
        flex: 1;
        padding: 10px 16px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .modal-btn.primary {
        background: rgba(255, 255, 255, 0.9);
        color: #444;
      }
      .modal-btn.secondary {
        background: rgba(255, 255, 255, 0.1);
        color: #555;
        border: 1px solid rgba(255, 255, 255, 0.3);
      }
    `;

    document.head.appendChild(modalStyles);
    document.body.appendChild(modal);

    // Handle modal interactions
    modal.querySelector('.modal-close').addEventListener('click', () => {
      document.body.removeChild(modal);
      document.head.removeChild(modalStyles);
    });

    // Handle shortcut editing
    modal.querySelectorAll('.shortcut-editor').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.textContent = 'Press key...';
        btn.classList.add('editing');

        const handleKeyPress = (e) => {
          e.preventDefault();
          const key = e.key.toUpperCase();
          btn.textContent = key;
          btn.classList.remove('editing');
          document.removeEventListener('keydown', handleKeyPress);
        };

        document.addEventListener('keydown', handleKeyPress);
      });
    });

    // Close modal on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
        document.head.removeChild(modalStyles);
      }
    });
  }
});