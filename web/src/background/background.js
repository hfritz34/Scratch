// Action click now handled by popup, but keep for fallback
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { action: 'toggleDrawing' });
});

chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      if (command === 'clear-canvas') {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'clearCanvas' });
      } else if (command === 'open-whiteboard') {
        openWhiteboard();
      }
    }
  });
});

// Open whiteboard in new tab
function openWhiteboard() {
  chrome.tabs.create({
    url: chrome.runtime.getURL('whiteboard.html'),
    active: true
  });
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openWhiteboard') {
    openWhiteboard();
    sendResponse({ success: true });
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  const defaultShortcuts = {
    'Ctrl+Shift+C': 'clear',
    'P': 'pen',
    'H': 'highlighter',
    'E': 'eraser'
  };

  chrome.storage.sync.get(['shortcuts'], (result) => {
    if (!result.shortcuts) {
      chrome.storage.sync.set({ shortcuts: defaultShortcuts });
    }
  });
});