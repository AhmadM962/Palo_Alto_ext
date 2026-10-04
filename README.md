# SCORM Content Extractor

A browser extension that captures the text content of SCORM lessons —
including every state revealed by clicking buttons, tabs, or hotspots — as
AI-ready JSONL, plus matching screenshots for OCR on text-in-images.

## How it works

- `extension/` is an unpacked Chrome (MV3) extension. It does nothing until
  you click **Start Capture** on a tab — it then asks for one-time
  permission to read all frames on that tab (needed because SCORM content is
  often rendered inside a cross-origin iframe), injects a content script
  into every frame, and watches the DOM with a `MutationObserver`.
- As you click through a lesson normally, every DOM change is captured as a
  new "state": the extracted text, which element you clicked to get there
  (`trigger`), and a full-tab screenshot. Unchanged/duplicate states are
  skipped automatically.
- **Export JSONL** downloads one line-delimited JSON record per state plus
  all screenshots into `Downloads/scorm-capture/<session_id>/`.
- `tools/ocr_merge.py` is a separate offline step: it runs Tesseract OCR
  over the screenshots (by default only for states whose DOM text looks too
  short to be the real content) and writes `merged.jsonl` with an added
  `ocr_text` field. That merged file is what you feed to an LLM for
  summarization.

OCR is intentionally kept out of the extension itself (bundling
Tesseract/WASM into a Manifest V3 service worker is fragile) — it runs as a
plain Python script after the fact.

## Setup

1. Open `chrome://extensions`, enable **Developer mode**, click **Load
   unpacked**, and select the `extension/` folder.
2. `pip install -r tools/requirements.txt` and make sure the `tesseract`
   binary is installed (e.g. `apt install tesseract-ocr` / `brew install
   tesseract`).

## Usage

1. Open the SCORM lesson in a tab and bring it to the slide/state you want
   to start from.
2. Click the extension icon, type a lesson label (e.g.
   `module-3-lesson-2`), click **Start Capture**, and accept the permission
   prompt (first time only).
3. Click through the lesson as you normally would — every slide, every
   button/tab/hotspot. Each resulting DOM state is captured automatically.
4. Click **Export JSONL** when done (or at any checkpoint — captures keep
   accumulating until you hit **Clear Session**).
5. Run:
   ```
   python tools/ocr_merge.py ~/Downloads/scorm-capture/<session_id>/
   ```
   and use the resulting `merged.jsonl` as input to your summarizer.

## Record format

Each line of `export.jsonl` / `merged.jsonl`:

```json
{
  "id": "session_1700000000000_3",
  "lesson": "module-3-lesson-2",
  "frameUrl": "https://cdn.example.com/scorm/launch.html",
  "trigger": "button.btn-reveal:\"Show Risks\"",
  "text": "...\n[IMG:diagram of attack chain]\n[ARIA:Next slide]",
  "timestamp": 1700000000123,
  "screenshot": "session_1700000000000/session_1700000000000_3.png",
  "ocr_text": "text read from the screenshot, or null if skipped"
}
```

`trigger` is `null` for the first state captured on a slide (nothing was
clicked to reach it, e.g. initial load or an autoplay transition).

## Known limitations

- Coverage is only as complete as your clicking — the extension doesn't
  auto-discover or auto-click buttons, it just records whatever you trigger.
- The granted permission and injected content script are lost on a full
  page reload/navigation; click **Start Capture** again if that happens.
- Screenshots can only be taken of the tab that's currently active/focused
  in its window (a Chrome API limitation).
