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
  if (!tab || !tab.url) {
    setStatus('could not read this tab — open the lesson page first', false);
    return;
  }

  let origin;
  try {
    origin = new URL(tab.url).origin + '/*';
  } catch {
    setStatus('this page cannot be captured', false);
    return;
  }

  const granted =
    (await chrome.permissions.contains({ origins: [origin] })) ||
    (await chrome.permissions.request({ origins: [origin] }));
  if (!granted) {
    setStatus('permission denied — cannot read page content without it', false);
    return;
  }

  // Register so the content script re-injects automatically on every future
  // navigation on this site (SCORM lessons often swap iframe pages, which
  // destroys a one-shot injected script), then inject into frames already
  // open right now.
  try {
    await chrome.scripting.registerContentScripts([
      { id: 'scorm-extractor', js: ['content.js'], matches: [origin], allFrames: true, runAt: 'document_idle' }
    ]);
  } catch {
    // already registered for this origin from a previous session — fine
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
