#!/usr/bin/env python3
"""Merge OCR text from captured screenshots into the extension's exported JSONL.

Usage:
    python ocr_merge.py <session_folder> [--min-text-len 30] [--force]

<session_folder> is the folder the extension downloaded into, e.g.
~/Downloads/scorm-capture/session_1234567890/, containing export.jsonl and
one PNG per captured state. Writes merged.jsonl in the same folder, with an
added "ocr_text" field per record.
"""
import argparse
import json
import sys
from pathlib import Path

from PIL import Image
import pytesseract


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('session_folder', type=Path)
    parser.add_argument(
        '--min-text-len',
        type=int,
        default=30,
        help='Only OCR screenshots whose DOM text is shorter than this (default: 30)'
    )
    parser.add_argument('--force', action='store_true', help='OCR every screenshot regardless of DOM text length')
    args = parser.parse_args()

    export_path = args.session_folder / 'export.jsonl'
    if not export_path.exists():
        sys.exit(f'export.jsonl not found in {args.session_folder}')

    merged_path = args.session_folder / 'merged.jsonl'
    ocr_count = 0

    with export_path.open() as src, merged_path.open('w') as dst:
        for line in src:
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)
            record['ocr_text'] = None

            needs_ocr = args.force or len(record.get('text', '')) < args.min_text_len
            if needs_ocr:
                screenshot_path = args.session_folder / Path(record['screenshot']).name
                if screenshot_path.exists():
                    record['ocr_text'] = pytesseract.image_to_string(Image.open(screenshot_path)).strip()
                    ocr_count += 1
                else:
                    print(f'warning: screenshot missing for {record["id"]} ({screenshot_path})', file=sys.stderr)

            dst.write(json.dumps(record) + '\n')

    print(f'wrote {merged_path} (ran OCR on {ocr_count} states)')


if __name__ == '__main__':
    main()
