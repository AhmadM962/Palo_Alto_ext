const SHOT_MIN_INTERVAL_MS = 700;
let lastShotAt = 0;

function getState() {
  return chrome.storage.local.get(['scormSession', 'scormCaptures']).then((r) => ({
    session: r.scormSession || null,
    captures: r.scormCaptures || []
  }));
}

function takeScreenshot(tabId, filename) {
  if (tabId == null) return;
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab) return;
    chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) return;
      chrome.downloads.download({ url: dataUrl, filename, saveAs: false });
    });
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === 'scorm-start') {
      const session = { id: `session_${Date.now()}`, label: msg.label || 'untitled', startedAt: Date.now() };
      await chrome.storage.local.set({ scormSession: session, scormCaptures: [] });
      sendResponse({ ok: true, session });
      return;
    }

    if (msg.type === 'scorm-stop') {
      await chrome.storage.local.set({ scormSession: null });
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === 'scorm-status') {
      const { session, captures } = await getState();
      sendResponse({ session, count: captures.length });
      return;
    }

    if (msg.type === 'scorm-capture') {
      const { session, captures } = await getState();
      if (!session) {
        sendResponse({ ok: false, reason: 'not recording' });
        return;
      }
      const tabId = sender.tab ? sender.tab.id : null;
      const captureId = `${session.id}_${captures.length}`;
      const record = {
        id: captureId,
        lesson: session.label,
        frameUrl: msg.frameUrl,
        trigger: msg.trigger,
        text: msg.text,
        timestamp: msg.timestamp,
        screenshot: `${session.id}/${captureId}.png`
      };
      captures.push(record);
      await chrome.storage.local.set({ scormCaptures: captures });

      const now = Date.now();
      const wait = Math.max(0, SHOT_MIN_INTERVAL_MS - (now - lastShotAt));
      lastShotAt = now + wait;
      setTimeout(() => takeScreenshot(tabId, `scorm-capture/${record.screenshot}`), wait);

      sendResponse({ ok: true, count: captures.length });
      return;
    }

    if (msg.type === 'scorm-export') {
      const { session, captures } = await getState();
      if (!captures.length) {
        sendResponse({ ok: false, error: 'No captures yet' });
        return;
      }
      const jsonl = captures.map((c) => JSON.stringify(c)).join('\n');
      const blob = new Blob([jsonl], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const sid = session ? session.id : captures[0].screenshot.split('/')[0];
      chrome.downloads.download(
        { url, filename: `scorm-capture/${sid}/export.jsonl`, saveAs: false },
        () => {
          URL.revokeObjectURL(url);
          sendResponse({ ok: true, count: captures.length });
        }
      );
      return;
    }

    if (msg.type === 'scorm-clear') {
      await chrome.storage.local.set({ scormCaptures: [] });
      sendResponse({ ok: true });
      return;
    }
  })();

  return true;
});
