document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggle-drawing');
  const clearBtn = document.getElementById('clear-all');
  const customizeBtn = document.getElementById('customize-shortcuts');
  const optionsBtn = document.getElementById('open-options');
  const aboutBtn = document.getElementById('about-btn');

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

  // Show About modal
  aboutBtn.addEventListener('click', () => {
    showAboutModal();
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

  function showAboutModal() {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'about-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>About Scratch</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="about-content">
            <p>hi my name is Henry!</p>
            <img src="assets/lovely.PNG" alt="Lovely" class="yep-image">
            <p>Thank you so much for using Scratch!</p>
            <p class="social-header">Follow my socials here:</p>
            <div class="social-links">
              <a href="https://www.henryfritz.com/" target="_blank" class="social-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M17,13H15L13.5,7H10.5L9,13H7L5.5,7H3.5L5.5,17H7L8.5,11H11.5L13,17H15L17,7H19L17,13Z"/>
                </svg>
                Website
              </a>
              <a href="https://github.com/hfritz34" target="_blank" class="social-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12,2A10,10 0 0,0 2,12C2,16.42 4.87,20.17 8.84,21.5C9.34,21.58 9.5,21.27 9.5,21C9.5,20.77 9.5,20.14 9.5,19.31C6.73,19.91 6.14,17.97 6.14,17.97C5.68,16.81 5.03,16.5 5.03,16.5C4.12,15.88 5.1,15.9 5.1,15.9C6.1,15.97 6.63,16.93 6.63,16.93C7.5,18.45 8.97,18 9.54,17.76C9.63,17.11 9.89,16.67 10.17,16.42C7.95,16.17 5.62,15.31 5.62,11.5C5.62,10.39 6,9.5 6.65,8.79C6.55,8.54 6.2,7.5 6.75,6.15C6.75,6.15 7.59,5.88 9.5,7.17C10.29,6.95 11.15,6.84 12,6.84C12.85,6.84 13.71,6.95 14.5,7.17C16.41,5.88 17.25,6.15 17.25,6.15C17.8,7.5 17.45,8.54 17.35,8.79C18,9.5 18.38,10.39 18.38,11.5C18.38,15.32 16.04,16.16 13.81,16.41C14.17,16.72 14.5,17.33 14.5,18.26C14.5,19.6 14.5,20.68 14.5,21C14.5,21.27 14.66,21.59 15.17,21.5C19.14,20.16 22,16.42 22,12A10,10 0 0,0 12,2Z"/>
                </svg>
                GitHub
              </a>
              <a href="https://www.instagram.com/hfritz00_/" target="_blank" class="social-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.8,2H16.2C19.4,2 22,4.6 22,7.8V16.2A5.8,5.8 0 0,1 16.2,22H7.8C4.6,22 2,19.4 2,16.2V7.8A5.8,5.8 0 0,1 7.8,2M7.6,4A3.6,3.6 0 0,0 4,7.6V16.4C4,18.39 5.61,20 7.6,20H16.4A3.6,3.6 0 0,0 20,16.4V7.6C20,5.61 18.39,4 16.4,4H7.6M17.25,5.5A1.25,1.25 0 0,1 18.5,6.75A1.25,1.25 0 0,1 17.25,8A1.25,1.25 0 0,1 16,6.75A1.25,1.25 0 0,1 17.25,5.5M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9Z"/>
                </svg>
                Instagram
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add modal styles
    const modalStyles = document.createElement('style');
    modalStyles.textContent = `
      .about-modal {
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
      .about-modal .modal-content {
        background: rgba(250, 250, 240, 0.95);
        backdrop-filter: blur(40px) saturate(1.8) brightness(1.1);
        -webkit-backdrop-filter: blur(40px) saturate(1.8) brightness(1.1);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 12px;
        width: 90%;
        max-width: 320px;
        color: #333;
      }
      .about-modal .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      }
      .about-modal .modal-close {
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
      .about-modal .modal-body {
        padding: 20px;
      }
      .about-content {
        text-align: center;
      }
      .about-content p {
        margin-bottom: 16px;
        line-height: 1.5;
        font-size: 14px;
      }
      .yep-image {
        width: 120px;
        height: 80px;
        margin: 16px 0;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
      .social-header {
        font-weight: 600;
        margin-bottom: 12px !important;
        margin-top: 8px;
      }
      .social-links {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .social-link {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 8px;
        color: #444;
        text-decoration: none;
        font-size: 13px;
        transition: all 0.2s ease;
      }
      .social-link:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: translateY(-1px);
      }
    `;

    document.head.appendChild(modalStyles);
    document.body.appendChild(modal);

    // Handle modal interactions
    modal.querySelector('.modal-close').addEventListener('click', () => {
      document.body.removeChild(modal);
      document.head.removeChild(modalStyles);
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