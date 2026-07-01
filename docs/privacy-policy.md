# Werbl Privacy Policy

Effective date: 2026-06-29

Werbl is a Chrome extension for converting browser images and local image files
to PNG, JPG, or WebP. Werbl is designed to run locally in Chrome without a
Werbl-controlled server.

## Data Werbl Processes

Werbl processes image data only when you use the extension:

- When you use the right-click menu, Werbl reads the selected image URL or the
  already-rendered image pixels so Chrome can convert and download the image.
- When you use the batch converter, Werbl reads the local image files you select
  or drop into the extension.
- Werbl stores your JPG/WebP quality setting in Chrome extension sync storage.
- Werbl stores short-lived conversion status in Chrome extension session storage.
- Werbl temporarily stores the most recent generated ZIP in browser IndexedDB so
  you can retry saving it without converting the same batch again.

## Data Collection And Sharing

Werbl does not upload your images, selected files, generated ZIP files, image
URLs, conversion settings, or conversion history to a Werbl-controlled server.

Werbl does not sell user data. Werbl does not share user data with advertisers,
analytics providers, or data brokers.

If you click the bug report link, Chrome opens a Gmail compose page. Sending that
email is optional. Any information you choose to include is sent through Google
Gmail to the Werbl bug report inbox and is used to understand, reproduce, and fix
the reported issue.

## Chrome Permissions

Werbl requests these Chrome permissions:

- `contextMenus`: adds right-click image conversion commands.
- `downloads`: saves converted images and generated ZIP files.
- `offscreen`: converts images locally with browser canvas APIs from an
  extension offscreen document.
- `scripting`: runs a fallback conversion step for already-rendered images when
  direct image reading fails.
- `storage`: saves the quality setting, recent status, and temporary ZIP cache.
- `<all_urls>` host access: supports user-invoked right-click conversion across
  websites where the selected image may appear.

## Data Retention

Werbl's local settings and temporary cache remain in your browser until Chrome
clears them, the extension clears them, or you uninstall Werbl. The extension
clears the temporary ZIP cache after a successful ZIP download or when you use
the clear-ZIP control.

Bug report emails are retained only as long as needed to investigate, fix, and
track reported extension issues.

## Children

Werbl is not directed to children and does not knowingly collect personal
information from children.

## Changes

This policy may be updated when Werbl changes how it handles data. The effective
date above will be updated when this policy changes.

## Contact

Bug reports: Bugs4Werbl@gmail.com

Privacy or business inquiries: alezworks.dev@gmail.com
