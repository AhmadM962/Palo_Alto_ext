function getState() {
  return chrome.storage.local.get(['scormSession', 'scormCaptures']).then((r) => ({
    session: r.scormSession || null,
    captures: r.scormCaptures || []
  }));
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
      captures.push({
        lesson: session.label,
        index: captures.length,
        frameUrl: msg.frameUrl,
        trigger: msg.trigger,
        text: msg.text,
        timestamp: msg.timestamp
      });
      await chrome.storage.local.set({ scormCaptures: captures });
      sendResponse({ ok: true, count: captures.length });
      return;
    }

    if (msg.type === 'scorm-export') {
      const { session, captures } = await getState();
      if (!captures.length) {
        sendResponse({ ok: false, error: 'No captures yet' });
        return;
      }
      const body = captures
        .map((c) => {
          const when = new Date(c.timestamp).toISOString();
          const trigger = c.trigger || '(initial load)';
          return `### ${c.lesson} | state ${c.index} | trigger: ${trigger} | ${when}\n${c.text}\n`;
        })
        .join('\n');
      const blob = new Blob([body], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const sid = session ? session.id : `session_${Date.now()}`;
      chrome.downloads.download(
        { url, filename: `scorm-capture/${sid}.txt`, saveAs: false },
        (downloadId) => {
          URL.revokeObjectURL(url);
          if (chrome.runtime.lastError || downloadId == null) {
            sendResponse({
              ok: false,
              error: chrome.runtime.lastError ? chrome.runtime.lastError.message : 'download did not start'
            });
            return;
          }
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
