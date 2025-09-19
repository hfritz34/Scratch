document.addEventListener('DOMContentLoaded', () => {
  loadSettings();

  // Palette selection
  document.querySelectorAll('.palette-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.palette-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      const palette = card.dataset.palette;
      savePaletteSetting(palette);
    });
  });

  document.getElementById('save').addEventListener('click', saveSettings);
  document.getElementById('reset').addEventListener('click', resetSettings);

  const penSizeEl = document.getElementById('pen-size');
  if (penSizeEl) {
    penSizeEl.addEventListener('input', (e) => {
      document.getElementById('pen-size-value').textContent = e.target.value;
    });
  }

  const highlighterOpacityEl = document.getElementById('highlighter-opacity');
  if (highlighterOpacityEl) {
    highlighterOpacityEl.addEventListener('input', (e) => {
      document.getElementById('highlighter-opacity-value').textContent = e.target.value;
    });
  }

  const eraserSizeEl = document.getElementById('eraser-size');
  if (eraserSizeEl) {
    eraserSizeEl.addEventListener('input', (e) => {
      document.getElementById('eraser-size-value').textContent = e.target.value;
    });
  }
});

function loadSettings() {
  chrome.storage.sync.get(['settings', 'shortcuts', 'selectedPalette'], (result) => {
    // Load palette selection
    const selectedPalette = result.selectedPalette || 'simple';
    const paletteCard = document.querySelector(`[data-palette="${selectedPalette}"]`);
    if (paletteCard) {
      paletteCard.classList.add('selected');
    }

    if (result.settings) {
      const penColorEl = document.getElementById('pen-color');
      if (penColorEl) penColorEl.value = result.settings.penColor || '#000000';

      const penSizeEl = document.getElementById('pen-size');
      if (penSizeEl) {
        penSizeEl.value = result.settings.penSize || 2;
        const penSizeValueEl = document.getElementById('pen-size-value');
        if (penSizeValueEl) penSizeValueEl.textContent = result.settings.penSize || 2;
      }

      const highlighterColorEl = document.getElementById('highlighter-color');
      if (highlighterColorEl) highlighterColorEl.value = result.settings.highlighterColor || '#ffff00';

      const highlighterOpacityEl = document.getElementById('highlighter-opacity');
      if (highlighterOpacityEl) {
        highlighterOpacityEl.value = result.settings.highlighterOpacity || 30;
        const highlighterOpacityValueEl = document.getElementById('highlighter-opacity-value');
        if (highlighterOpacityValueEl) highlighterOpacityValueEl.textContent = result.settings.highlighterOpacity || 30;
      }

      const eraserSizeEl = document.getElementById('eraser-size');
      if (eraserSizeEl) {
        eraserSizeEl.value = result.settings.eraserSize || 20;
        const eraserSizeValueEl = document.getElementById('eraser-size-value');
        if (eraserSizeValueEl) eraserSizeValueEl.textContent = result.settings.eraserSize || 20;
      }

      const rightClickEraserEl = document.getElementById('right-click-eraser');
      if (rightClickEraserEl) rightClickEraserEl.checked = result.settings.rightClickEraser !== false;

      const doubleRightClearEl = document.getElementById('double-right-clear');
      if (doubleRightClearEl) doubleRightClearEl.checked = result.settings.doubleRightClear !== false;

      const middleClickToggleEl = document.getElementById('middle-click-toggle');
      if (middleClickToggleEl) middleClickToggleEl.checked = result.settings.middleClickToggle !== false;
    }

    if (result.shortcuts) {
      displayShortcuts(result.shortcuts);
    }
  });
}

function displayShortcuts(shortcuts) {
  const container = document.getElementById('shortcuts-list');
  container.innerHTML = '';

  Object.entries(shortcuts).forEach(([key, action]) => {
    const item = document.createElement('div');
    item.className = 'shortcut-item';
    item.innerHTML = `
      <span class="shortcut-key">${key}</span>
      <span class="shortcut-action">${action}</span>
      <button class="shortcut-delete" data-key="${key}">Delete</button>
    `;
    container.appendChild(item);
  });
}

function saveSettings() {
  const settings = {
    penColor: document.getElementById('pen-color').value,
    penSize: parseInt(document.getElementById('pen-size').value),
    highlighterColor: document.getElementById('highlighter-color').value,
    highlighterOpacity: parseInt(document.getElementById('highlighter-opacity').value),
    eraserSize: parseInt(document.getElementById('eraser-size').value),
    rightClickEraser: document.getElementById('right-click-eraser').checked,
    doubleRightClear: document.getElementById('double-right-clear').checked,
    middleClickToggle: document.getElementById('middle-click-toggle').checked
  };

  chrome.storage.sync.set({ settings }, () => {
    showNotification('Settings saved!');
  });
}

function resetSettings() {
  if (confirm('Reset all settings to defaults?')) {
    chrome.storage.sync.clear(() => {
      loadSettings();
      showNotification('Settings reset to defaults');
    });
  }
}

function savePaletteSetting(palette) {
  chrome.storage.sync.set({ selectedPalette: palette }, () => {
    showNotification(`Palette changed to ${palette}`);

    // Notify all active tabs to update their palette
    chrome.tabs.query({ active: true }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'updatePalette',
          palette: palette
        }).catch(() => {
          // Ignore errors for tabs that don't have the content script
        });
      });
    });
  });
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #28a745;
    color: white;
    padding: 15px 20px;
    border-radius: 4px;
    z-index: 1000;
  `;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}