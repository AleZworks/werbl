# Werbl Extension

This folder contains the runtime Chrome Manifest V3 extension.

## Manual Install

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this `extension` folder.

## What It Does

- Adds right-click image conversion commands for PNG, JPG, and WebP.
- Opens a popup batch converter for local image files.
- Converts local batches into one ZIP.
- Uses an offscreen document for local browser canvas conversion.
- Uses a rendered-page fallback for some already-loaded `blob:` and `data:`
  images when direct extension fetching fails.

## Known Limits

- Some sites use protected, expiring, or script-generated image URLs that may not
  be fetchable by the extension.
- The rendered-page fallback cannot convert images that taint canvas security.
- Right-click output is intentionally limited to PNG, JPG, and WebP.
- Closing the popup during conversion cancels the popup task. Use the dedicated
  extension window for longer batches.
