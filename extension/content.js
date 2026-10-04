(function () {
  if (window.__scormExtractorActive) return;
  window.__scormExtractorActive = true;

  const DEBOUNCE_MS = 500;
  let debounceTimer = null;
  let lastTrigger = null;
  let lastTextHash = null;

  function describeElement(el) {
    if (!el || !el.tagName) return null;
    const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 80);
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls =
      el.className && typeof el.className === 'string' && el.className.trim()
        ? `.${el.className.trim().split(/\s+/).join('.')}`
        : '';
    return `${tag}${id}${cls}${label ? `:"${label}"` : ''}`.slice(0, 160);
  }

  function extractText() {
    const parts = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while ((node = walker.nextNode())) {
      parts.push(node.nodeValue.trim());
    }
    document.querySelectorAll('img[alt]').forEach((img) => {
      const alt = img.alt.trim();
      if (alt) parts.push(`[IMG:${alt}]`);
    });
    document.querySelectorAll('[aria-label]').forEach((el) => {
      const label = el.getAttribute('aria-label').trim();
      if (label && !parts.includes(label)) parts.push(`[ARIA:${label}]`);
    });
    return parts.join('\n');
  }

  function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h;
  }

  function capture() {
    const text = extractText();
    const h = hash(text);
    if (h === lastTextHash) return;
    lastTextHash = h;
    chrome.runtime.sendMessage({
      type: 'scorm-capture',
      frameUrl: location.href,
      trigger: lastTrigger,
      text,
      timestamp: Date.now()
    });
    lastTrigger = null;
  }

  document.addEventListener(
    'click',
    (e) => {
      lastTrigger = describeElement(e.target);
    },
    { capture: true }
  );

  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(capture, DEBOUNCE_MS);
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true
  });

  setTimeout(capture, DEBOUNCE_MS);
})();
