# SCORM Content Extractor

A browser extension that captures the text content of SCORM lessons —
including every state revealed by clicking buttons, tabs, or hotspots — into
a single plain-text file ready to feed to an AI summarizer.

## How it works

- `extension/` is an unpacked Chrome (MV3) extension. It does nothing until
  you click **Start Capture** on a tab — it then asks for one-time
  permission to read that site (needed because SCORM content is often
  rendered inside a cross-origin iframe and/or Shadow DOM), registers the
  content script to auto-inject into every frame of that site from then on
  (so it survives the lesson navigating to a new page/iframe, not just the
  frame that was open at the moment you clicked Start), and watches the DOM
  with a `MutationObserver` that also recurses into open shadow roots.
- While recording, the toolbar icon shows a red **REC** badge so it's always
  clear whether it's currently capturing.
- As you click through a lesson normally, every DOM change is captured as a
  new "state": the extracted text and which element you clicked to get there
  (`trigger`). Unchanged/duplicate states are skipped automatically.
- **Export Text** downloads everything captured so far as one `.txt` file
  into `Downloads/scorm-capture/<session_id>.txt`.

No screenshots, no OCR, no images — just the DOM text (including image
`alt` text and `aria-label`s, which are themselves text) gathered into one
file.

## Setup

Open `chrome://extensions`, enable **Developer mode**, click **Load
unpacked**, and select the `extension/` folder.

## Usage

1. Open the SCORM lesson in a tab and bring it to the slide/state you want
   to start from.
2. Click the extension icon, type a lesson label (e.g.
   `module-3-lesson-2`), click **Start Capture**, and accept the permission
   prompt (first time only).
3. Click through the lesson as you normally would — every slide, every
   button/tab/hotspot. Each resulting DOM state is captured automatically.
4. Click **Export Text** when done (or at any checkpoint — captures keep
   accumulating until you hit **Clear Session**). Feed the downloaded
   `.txt` file straight to your summarizer.

## Output format

Plain text, one block per captured state:

```
### module-3-lesson-2 | state 0 | trigger: (initial load) | 2026-10-04T09:00:00.000Z
Welcome to Module 3...
[IMG:diagram of attack chain]
[ARIA:Next slide]

### module-3-lesson-2 | state 1 | trigger: button.btn-reveal:"Show Risks" | 2026-10-04T09:00:12.000Z
Risk 1: ...
Risk 2: ...
```

`trigger` names the element that was clicked to reach that state, so an AI
reading the file can tell which text belongs to the base slide vs. which
was revealed by a particular button/tab.

## Known limitations

- Text-in-images (e.g. a slide rendered as a flat image with no alt text)
  won't be captured — this version does not do OCR.
- Coverage is only as complete as your clicking — the extension doesn't
  auto-discover or auto-click buttons, it just records whatever you trigger.
- Shadow DOM content only works for **open** shadow roots (the common
  default). A component using a closed shadow root is unreadable from
  outside it, by design — if a slide's text still isn't showing up, this is
  the most likely reason.
