document.addEventListener('DOMContentLoaded', () => {
  loadSettings();

  document.getElementById('save').addEventListener('click', saveSettings);
  document.getElementById('reset').addEventListener('click', resetSettings);

  document.getElementById('pen-size').addEventListener('input', (e) => {
    document.getElementById('pen-size-value').textContent = e.target.value;
  });

  document.getElementById('highlighter-opacity').addEventListener('input', (e) => {
    document.getElementById('highlighter-opacity-value').textContent = e.target.value;
  });

  document.getElementById('eraser-size').addEventListener('input', (e) => {
    document.getElementById('eraser-size-value').textContent = e.target.value;
  });
});

function loadSettings() {
  chrome.storage.sync.get(['settings', 'shortcuts'], (result) => {
    if (result.settings) {
      document.getElementById('pen-color').value = result.settings.penColor || '#000000';
      document.getElementById('pen-size').value = result.settings.penSize || 2;
      document.getElementById('pen-size-value').textContent = result.settings.penSize || 2;
      document.getElementById('highlighter-color').value = result.settings.highlighterColor || '#ffff00';
      document.getElementById('highlighter-opacity').value = result.settings.highlighterOpacity || 30;
      document.getElementById('highlighter-opacity-value').textContent = result.settings.highlighterOpacity || 30;
      document.getElementById('eraser-size').value = result.settings.eraserSize || 20;
      document.getElementById('eraser-size-value').textContent = result.settings.eraserSize || 20;
      document.getElementById('right-click-eraser').checked = result.settings.rightClickEraser !== false;
      document.getElementById('double-right-clear').checked = result.settings.doubleRightClear !== false;
      document.getElementById('middle-click-toggle').checked = result.settings.middleClickToggle !== false;
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