# Werbl Release Checklist

Use this checklist before publishing or sharing a release build.

## Build Gate

```powershell
git --no-pager status --short
npm run assets:store
npm run setup:smoke
npm run check
npm run package:extension
```

Expected package:

```text
artifacts\werbl-extension.zip
```

Review the package contents before sharing. The ZIP should contain only runtime
extension files directly at the root: `manifest.json`, `background.js`,
`offscreen.html`, `offscreen.js`, `popup.html`, `popup.css`, `popup.js`, and
`icons/`.

`npm run check` includes `npm run smoke:extension`, which launches a temporary
Chromium profile with the unpacked extension. The smoke test checks extension
JavaScript syntax, the web app build, linting, popup height behavior, settings
defaults, contact links, full queue rendering, cached ZIP behavior, and duplicate
filename handling inside the generated ZIP.

`npm run assets:store` regenerates clean logo files, extension icons, and Chrome
Web Store listing assets from the tracked Werbl source logo.

## Version Bookkeeping

Use `extension\manifest.json` as the extension release-version source of truth.
Before publishing, confirm:

- `manifest.json` has the intended public version.
- Store listing notes, release notes, and support templates name the same version.
- `package.json` can stay on the local web workspace version unless the web app
  package is being released separately.

## Smoke Test

Install from a fresh unpacked extension folder or from the packaged ZIP contents.

Test right-click conversion:

- Save a normal remote image as PNG.
- Save a normal remote image as JPG.
- Save a normal remote image as WebP.
- Open `http://127.0.0.1:5173/image-url-test.html` and test the `data:` image.
- Open `http://127.0.0.1:5173/image-url-test.html` and test the `blob:` image.

The weird-URL fixture requires the Vite dev server. Start it with:

```powershell
npm run dev
```

Do not open `public\image-url-test.html` directly from disk for this check.

Test popup conversion:

- Convert 3-5 mixed local images to PNG.
- Convert 3-5 mixed local images to JPG at quality 100.
- Convert 3-5 mixed local images to WebP at quality 100.
- Confirm conversion stops at `ZIP ready`, then click `Save ZIP`.
- Click `Clear ZIP` and confirm the file picker and controls unlock.
- Open the dedicated `Window` view and run a batch there.

Test large-batch behavior before broad release:

- 25 images.
- 100 images.
- At least one batch near or above 150 MP total.

## Store Listing Notes

Position this as a local workflow tool, not a generic converter.

Recommended promise:

```text
Right-click browser images or batch local files into PNG, JPG, or WebP. Files are
converted locally in Chrome and are not uploaded to a server.
```

Mention known limits plainly:

- Some sites block browser-based image reading or canvas conversion.
- Closing the popup during an active batch cancels the task.
- Longer batches should use the dedicated extension window.
- Output is intentionally limited to PNG, JPG, and WebP.

Use the full listing copy in `docs\chrome-web-store-submission.md`.

Required listing assets are generated here:

```text
brand\store\werbl-small-promo-440x280.png
brand\store\werbl-screenshot-main-1280x800.png
brand\store\werbl-screenshot-settings-1280x800.png
```

Optional listing asset:

```text
brand\store\werbl-marquee-promo-1400x560.png
```

The privacy policy source is:

```text
docs\privacy-policy.md
```

Before submitting, publish that privacy policy at a public URL and paste the URL
into the Chrome Web Store Privacy tab.

## Chrome Web Store Review Checklist

Permissions to justify:

- `contextMenus`: adds right-click image conversion commands.
- `downloads`: saves converted image files and generated ZIP files.
- `offscreen`: performs canvas conversion in an MV3 offscreen document.
- `scripting`: runs the rendered-page fallback when direct image fetching fails.
- `storage`: saves quality settings and short-lived conversion status.
- `<all_urls>` host access: attempts to read the user-selected image URL and
  support right-click conversion across sites.

Privacy and data disclosures:

- State that conversion happens locally in Chrome.
- State that files are not uploaded to Werbl or any Werbl-controlled server.
- Disclose that the extension reads image URLs or rendered image pixels only when
  the user invokes a right-click conversion.
- Disclose that local files selected in the popup stay in the browser and are
  packed into a local ZIP.
- Disclose stored data: JPG/WebP quality setting in `chrome.storage.sync`, recent
  status/telemetry in `chrome.storage.session`, and temporary completed ZIP data
  in IndexedDB until save or clear.
- Do not claim that every site works; protected CDNs, canvas-tainted images, and
  expiring URLs can fail.
- Keep the single-purpose description focused on image conversion.
- Prepare short permission justifications for the Chrome Web Store submission
  instead of relying on the public listing copy alone.
- Re-check the current Chrome Web Store policies and privacy fields before final
  submission.

## Contact And Inquiry Links

Use separate public inboxes:

- Bug reports: one support address for reproducible extension problems.
- Custom solutions: one business address for paid workflow inquiries.

Do not use the same inbox for both. The shipped extension UI should keep the
bug-report path only, so Chrome can review the extension as a narrow image
conversion tool. The business inquiry email belongs in the Chrome Web Store
listing and public docs.

Bug reports should ask for browser version, extension version, source site when
relevant, target format, and reproduction steps. Custom solution inquiries should
ask for the business workflow, file types, target platforms, timeline, and
whether the project must work without external vendors or outsourced services.

Final public email addresses:

```text
Bugs4Werbl@gmail.com
alezworks.dev@gmail.com
```

## Name Clearance

`Werbl` is a working release name, not a legal opinion. Before public
release, run a final exact-name search across:

- Chrome Web Store.
- USPTO Trademark Search.
- Common search engines.
- Major social profiles if the brand will be used there.

Do not publish if an existing image, design, or software product is already using
the same or confusingly similar name.

## Service Inquiry Boundary

The free extension can advertise a public service email, but custom work should
stay scoped and paid.

Offer:

- Chrome extension customization.
- Workflow automation for image-heavy businesses and teams.
- File naming, platform presets, and compression recipes.
- Small private tools for creators, marketplaces, operators, and content teams.
- Paid diagnosis when a specific site blocks or breaks an image workflow.

Avoid:

- Open-ended unpaid support.
- Promising support for every website or protected CDN.
- Maintaining customer-specific forks without a paid maintenance agreement.
- Taking custody of customer private data unless a separate legal and security
  process exists.
- Work that requires external outsourcing to complete the promised product.
- Fixed-price work before seeing the actual workflow, site, files, and edge cases.

Default paid structure:

- Free: bug reports with clear reproduction steps.
- Paid diagnostic: reproduce and explain a site-specific workflow problem.
- Paid implementation: build or modify a workflow after diagnosis.
- Paid maintenance: ongoing fixes for customer-specific workflows.
