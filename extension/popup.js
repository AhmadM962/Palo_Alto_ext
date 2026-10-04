function setStatus(text, recording) {
  const el = document.getElementById('status');
  el.textContent = text;
  el.className = recording ? 'recording' : 'idle';
}

function refreshStatus() {
  chrome.runtime.sendMessage({ type: 'scorm-status' }, (res) => {
    if (!res) return;
    setStatus(
      res.session
        ? `● recording "${res.session.label}" — ${res.count} states captured`
        : `idle — ${res.count} states in buffer`,
      !!res.session
    );
  });
}

document.getElementById('start').addEventListener('click', async () => {
  const label = document.getElementById('label').value.trim() || 'untitled';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    setStatus('could not find the active tab', false);
    return;
  }

  // SCORM content is frequently served from a different subdomain/origin
  // than the LMS shell (sandboxing), so the permission and the registered
  // content script both need to cover every origin, not just the tab's own.
  const granted =
    (await chrome.permissions.contains({ origins: ['<all_urls>'] })) ||
    (await chrome.permissions.request({ origins: ['<all_urls>'] }));
  if (!granted) {
    setStatus('permission denied — cannot read page content without it', false);
    return;
  }

  // Register so the content script re-injects automatically on every future
  // navigation anywhere (SCORM lessons often swap iframe pages, or load the
  // actual lesson content from a different origin than the shell, either of
  // which destroys a one-shot injected script), then inject into frames
  // already open right now.
  const scriptConfig = {
    id: 'scorm-extractor',
    js: ['content.js'],
    matches: ['<all_urls>'],
    allFrames: true,
    runAt: 'document_idle'
  };
  try {
    await chrome.scripting.registerContentScripts([scriptConfig]);
  } catch {
    await chrome.scripting.updateContentScripts([scriptConfig]).catch(() => {});
  }
  await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    files: ['content.js']
  });

  chrome.runtime.sendMessage({ type: 'scorm-start', label }, refreshStatus);
});

document.getElementById('stop').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'scorm-stop' }, refreshStatus);
});

document.getElementById('export').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'scorm-export' }, (res) => {
    const recording = document.getElementById('status').className === 'recording';
    setStatus(res && res.ok ? `exported ${res.count} states` : `export failed: ${res && res.error}`, recording);
  });
});

document.getElementById('clear').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'scorm-clear' }, refreshStatus);
});

refreshStatus();
