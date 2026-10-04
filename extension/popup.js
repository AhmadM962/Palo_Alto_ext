function setStatus(text) {
  document.getElementById('status').textContent = text;
}

function refreshStatus() {
  chrome.runtime.sendMessage({ type: 'scorm-status' }, (res) => {
    if (!res) return;
    setStatus(
      res.session
        ? `recording "${res.session.label}" — ${res.count} states captured`
        : `idle — ${res.count} states in buffer`
    );
  });
}

document.getElementById('start').addEventListener('click', async () => {
  const label = document.getElementById('label').value.trim() || 'untitled';

  const granted =
    (await chrome.permissions.contains({ origins: ['<all_urls>'] })) ||
    (await chrome.permissions.request({ origins: ['<all_urls>'] }));
  if (!granted) {
    setStatus('permission denied — cannot read iframe content without it');
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  chrome.runtime.sendMessage({ type: 'scorm-start', label }, async () => {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ['content.js']
    });
    refreshStatus();
  });
});

document.getElementById('stop').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'scorm-stop' }, refreshStatus);
});

document.getElementById('export').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'scorm-export' }, (res) => {
    setStatus(res && res.ok ? `exported ${res.count} states` : `export failed: ${res && res.error}`);
  });
});

document.getElementById('clear').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'scorm-clear' }, refreshStatus);
});

refreshStatus();
