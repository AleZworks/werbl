# Chrome Web Store Submission

This file contains the copy and checklist needed to publish Werbl. The generated
package is:

```text
artifacts\werbl-extension.zip
```

## Pre-Submission Commands

```powershell
npm run assets:store
npm run setup:smoke
npm run check
npm run package:extension
```

## Required Local Files

```text
brand\store\werbl-small-promo-440x280.png
brand\store\werbl-screenshot-main-1280x800.png
brand\store\werbl-screenshot-settings-1280x800.png
brand\store\werbl-marquee-promo-1400x560.png
docs\privacy-policy.md
artifacts\werbl-extension.zip
```

The marquee promo image is optional. The small promo image and at least one
screenshot are required by Chrome Web Store.

## Listing Copy

Name:

```text
Werbl
```

Short description:

```text
Convert browser and local images to PNG, JPG, or WebP locally in Chrome.
```

Detailed description:

```text
Werbl converts browser images and local image batches into PNG, JPG, or WebP
without uploading files to a server.

Use the right-click menu to save a browser image in another format, or open the
extension popup to convert a batch of local files into one ZIP. JPG/WebP quality
is saved globally, and longer batches can be run in a dedicated extension window.

Werbl is intentionally focused on image conversion:
- Right-click browser images into PNG, JPG, or WebP.
- Batch local images into one downloadable ZIP.
- Convert locally in Chrome with browser image APIs.
- Keep files in the user's browser instead of uploading them to Werbl.

Known limits:
- Some websites block browser-based image reading or canvas conversion.
- Protected, expiring, or cross-origin image URLs may fail.
- Closing the popup during an active batch cancels that batch. Use the Window
  button for longer work.
- Output is limited to PNG, JPG, and WebP.

Bug reports: Bugs4Werbl@gmail.com
Business inquiries for custom workflow software: alezworks.dev@gmail.com
```

Category:

```text
Productivity
```

Language:

```text
English
```

Visibility:

```text
Public
```

Pricing:

```text
Free
```

## Privacy Tab

Single purpose:

```text
Werbl converts user-selected browser images and local image files to PNG, JPG,
or WebP locally in Chrome.
```

Data collection disclosure:

```text
Werbl does not collect, transmit, sell, or share user data with a
Werbl-controlled server. Image conversion happens locally in Chrome. Selected
local files, generated ZIP files, image URLs, and rendered image pixels are used
only to complete user-invoked conversion actions.
```

Remote code:

```text
No remote code is used. Werbl's extension code is bundled in the submitted
package.
```

Limited use:

```text
Werbl uses user data only to provide user-invoked image conversion and bug-report
support when the user voluntarily sends an email.
```

Privacy policy URL:

```text
Use the public GitHub URL for docs/privacy-policy.md after the repository is
published.
```

## Permission Justifications

`contextMenus`:

```text
Adds user-invoked right-click menu commands for saving the selected image as PNG,
JPG, or WebP.
```

`downloads`:

```text
Saves the converted image or generated batch ZIP to the user's Chrome downloads
folder after the user starts a conversion.
```

`offscreen`:

```text
Creates a bundled offscreen document so Werbl can use browser canvas APIs to
convert images locally from the Manifest V3 service worker flow.
```

`scripting`:

```text
Runs a rendered-page fallback only after direct image conversion fails, so Werbl
can convert already-loaded blob, data, or temporary page images selected by the
user.
```

`storage`:

```text
Stores the JPG/WebP quality setting, short-lived conversion status, and temporary
ZIP cache needed to retry saving a completed batch without converting it again.
```

`<all_urls>`:

```text
Allows Werbl to read the user-selected image URL across websites for right-click
conversion. The host access is used only after the user chooses a Werbl
right-click conversion command.
```

## Test Instructions For Reviewers

```text
No account is required.

1. Install the extension.
2. Right-click a browser image and choose "Save image as PNG", "Save image as
   JPG", or "Save image as WebP".
3. Click the extension toolbar icon, select several local images, choose an
   output format, click Convert, then click Save ZIP.
4. Click Settings to adjust JPG/WebP quality or submit a bug report.

Some websites intentionally block browser image reading. If a right-click
conversion fails on one site, try a normal public image or use the popup batch
converter with a local file.
```
