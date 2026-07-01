# Werbl

Werbl is a Chrome extension for a very specific annoyance: you have an image in
the browser, or a batch of local images, and you need clean PNG, JPG, or WebP
files without sending them through an upload site.

There is no Werbl server. Conversion happens in Chrome with the browser's own
image APIs.

![Werbl batch conversion screenshot](brand/store/werbl-screenshot-main-1280x800.png)

## What It Does

- Adds right-click options for saving browser images as PNG, JPG, or WebP.
- Converts batches of local image files into one ZIP.
- Keeps downloads in Chrome's normal download flow.
- Lets you retry saving a completed ZIP without converting the same batch again.
- Offers a dedicated extension window for longer batches, since toolbar popups
  close when focus changes.
- Shows progress, elapsed time, image count, processed megapixels, and ZIP size.

## What It Does Not Do

- It does not upload images to a Werbl server.
- It does not use analytics.
- It does not sell or share user data.
- It does not claim every website can be converted. Some sites intentionally
  block browser image access.

## Permissions, In Plain English

Werbl asks for broad-looking permissions because browser image conversion is
messy in practice. The extension only uses them after you choose a Werbl action.

- `contextMenus`: adds the right-click conversion menu.
- `downloads`: saves converted images and ZIP files.
- `offscreen`: gives the Manifest V3 service worker a hidden page where Chrome's
  canvas APIs can run.
- `scripting`: tries a rendered-page fallback when a direct image read fails.
  This runs only after you pick a Werbl right-click action, and it looks for the
  clicked image on that tab.
- `storage`: saves the JPG/WebP quality setting and short-lived conversion
  status.
- `<all_urls>`: lets the right-click workflow work across normal websites instead
  of only a small allowlist.

For right-click conversion, Chrome may request the selected image URL with the
same site access your browser already has. That request goes to the image's
source site, not to a Werbl server.

You can read the implementation in `extension/`. The privacy policy is in
[docs/privacy-policy.md](docs/privacy-policy.md).

## Known Limits

- Some protected, expiring, cross-origin, or script-generated image URLs will
  fail.
- Images that taint browser canvas security cannot be converted by the rendered
  fallback.
- Closing the toolbar popup during an active batch cancels that batch. Use the
  `Window` button for longer work.
- Output is intentionally limited to PNG, JPG, and WebP.

## Review Or Run Locally

Install dependencies:

```powershell
npm install
npm run setup:smoke
```

Load the extension manually:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `extension` folder in this repository.

Run the checks:

```powershell
npm run check
```

That command checks the extension JavaScript, runs linting, and launches a
Chromium smoke test for the popup and ZIP workflow.

Package the extension:

```powershell
npm run package:extension
```

The ZIP is written to:

```text
artifacts\werbl-extension.zip
```

The package script includes only runtime extension files.

## Repository Layout

```text
extension/                         Chrome MV3 extension
scripts/                           Packaging and smoke-test scripts
brand/store/werbl-screenshot-main-1280x800.png
                                   Screenshot used in this README
docs/privacy-policy.md             Privacy policy source
```

## Security

Please do not post security issues publicly. See [SECURITY.md](SECURITY.md) for
reporting details.

## License

Werbl is released under the [MIT License](LICENSE).
