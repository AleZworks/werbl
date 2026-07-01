# Werbl Privacy Policy

Effective date: 2026-07-01

Werbl converts browser images and local image files to PNG, JPG, or WebP. The
extension is designed to do that work locally in Chrome.

## What Werbl Handles

Werbl handles image data only when you use it:

- Right-click conversion reads the image URL, or the already-rendered image
  pixels, for the image you selected.
- When Werbl fetches a selected browser image, Chrome may include normal site
  credentials for that image's source site. Those requests go to the source site,
  not to a Werbl server.
- Batch conversion reads the local image files you choose or drop into the
  extension.
- The JPG/WebP quality setting is stored in Chrome extension sync storage.
- Recent conversion status is stored briefly in Chrome extension session storage.
- A completed ZIP may be stored temporarily in browser IndexedDB so you can retry
  saving it without rebuilding the batch.

## What Werbl Does Not Do

Werbl does not upload your images, selected files, generated ZIP files, image
URLs, conversion settings, or conversion history to a Werbl server.

Werbl does not sell user data. Werbl does not share user data with advertisers,
analytics providers, or data brokers.

## Bug Reports

If you click the bug report link, Werbl opens a Gmail compose page. Sending that
email is optional. Anything you choose to include is sent through Gmail to the
Werbl bug report inbox and is used to understand and fix the reported problem.

## Chrome Permissions

- `contextMenus`: adds right-click image conversion commands.
- `downloads`: saves converted images and generated ZIP files.
- `offscreen`: lets Werbl use browser canvas APIs from a Manifest V3 offscreen
  document.
- `scripting`: runs a fallback on the current tab after a Werbl right-click
  action when direct image conversion fails.
- `storage`: saves the quality setting, short-lived status, and temporary ZIP
  cache.
- `<all_urls>`: supports user-invoked right-click conversion across websites.

## Retention

Local settings and temporary cache data remain in your browser until Chrome
clears them, Werbl clears them, or you uninstall the extension. Werbl clears the
temporary ZIP cache after a successful ZIP download or when you use the clear-ZIP
control.

Bug report emails are kept only as long as needed to investigate, fix, and track
reported issues.

## Children

Werbl is not directed to children and does not knowingly collect personal
information from children.

## Contact

Bug reports and privacy questions:

```text
Bugs4Werbl@gmail.com
```
