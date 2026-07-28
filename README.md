# QR Sweep Pro

QR Sweep Pro is a Manifest V3 browser extension project built from your current QR scanner codebase, focused on popularity-oriented features:

- Page sweep: extract QR values from all image and canvas candidates in the active page
- Camera scanning with duplicate throttling
- Image upload scanning
- Local history persistence and JSON export
- Fully local decoding via bundled qr-scanner + worker

## Project structure

- manifest.json
- panel.html
- src/panel.js
- src/panel.css
- src/qr-engine.js
- src/history.js
- src/background.js
- libs/qr-scanner/*

## Run in Chrome

1. Open Chrome extensions page: chrome://extensions
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this folder: qrcode-popular-plus
5. Pin the extension and open panel.

## MVP roadmap

1. Add per-item tags (URL, text, payment, contact)
2. Add one-click workflows (copy + open + save)
3. Add result filters and search in panel history
4. Add optional cloud backup (opt-in only)

## Notes

- `host_permissions` uses `<all_urls>` for robust page image sweeping.
- For strict privacy posture in store review, you can move this to optional host permissions and ask only when user runs page sweep.

## Related links

- More Chrome tools and extensions: https://chrome-tool.github.io/
