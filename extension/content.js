(function () {
  if (window.__scormExtractorActive) return;
  window.__scormExtractorActive = true;

  const DEBOUNCE_MS = 500;
  let debounceTimer = null;
  let lastTrigger = null;
  let lastTextHash = null;
  const observedRoots = new WeakSet();

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

  // Modern course players (e.g. Docebo's component library) render into
  // Shadow DOM, which a plain document.body walk/observer cannot see into.
  // Collect document.body plus every open shadow root reachable from it.
  function allRoots() {
    const roots = [document.body];
    const seen = new Set();
    for (let i = 0; i < roots.length; i++) {
      roots[i].querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot && !seen.has(el.shadowRoot)) {
          seen.add(el.shadowRoot);
          roots.push(el.shadowRoot);
        }
      });
    }
    return roots;
  }

  function extractTextFromRoot(root, parts) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
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
    root.querySelectorAll('img[alt]').forEach((img) => {
      const alt = img.alt.trim();
      if (alt) parts.push(`[IMG:${alt}]`);
    });
    root.querySelectorAll('[aria-label]').forEach((el) => {
      const label = el.getAttribute('aria-label').trim();
      if (label) parts.push(`[ARIA:${label}]`);
    });
  }

  function extractText() {
    const parts = [];
    allRoots().forEach((root) => extractTextFromRoot(root, parts));
    const seen = new Set();
    return parts.filter((p) => (seen.has(p) ? false : (seen.add(p), true))).join('\n');
  }

  function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h;
  }

  function observe(root) {
    if (observedRoots.has(root)) return;
    observedRoots.add(root);
    const observer = new MutationObserver(scheduleCapture);
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true });
  }

  function capture() {
    allRoots().forEach(observe); // pick up any shadow roots that appeared since the last pass
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

  function scheduleCapture() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(capture, DEBOUNCE_MS);
  }

  document.addEventListener(
    'click',
    (e) => {
      // composedPath()[0] is the true innermost element even when the click
      // originated inside a shadow root (e.target gets retargeted otherwise).
      const target = e.composedPath ? e.composedPath()[0] : e.target;
      lastTrigger = describeElement(target);
    },
    { capture: true }
  );

  allRoots().forEach(observe);
  setTimeout(capture, DEBOUNCE_MS);
})();
