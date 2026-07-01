# Werbl Extension

This folder is the Chrome Manifest V3 extension that gets packaged for release.

## Manual Install

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this `extension` folder.

## What To Review

- `manifest.json` lists the Chrome permissions.
- `background.js` owns the right-click conversion flow.
- `offscreen.js` performs direct image conversion with browser APIs.
- `popup.html`, `popup.css`, and `popup.js` power the batch converter.

The extension does not include remote scripts or a backend endpoint. Downloads go
through Chrome's downloads API.

## Limits

Browser image access is not universal. Some sites use protected or expiring URLs,
and some images cannot be drawn to canvas because of browser security rules.
