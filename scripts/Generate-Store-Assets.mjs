import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'

const projectRoot = resolve(import.meta.dirname, '..')
const brandRoot = join(projectRoot, 'brand', 'werbl')
const extensionIconRoot = join(projectRoot, 'extension', 'icons')
const storeRoot = join(projectRoot, 'brand', 'store')
const sourceLogoPath = join(brandRoot, 'werbl-original-source-1254.png')
const logoPath = join(brandRoot, 'werbl-extension-icon-512.png')

async function main() {
  await mkdir(storeRoot, { recursive: true })
  await mkdir(extensionIconRoot, { recursive: true })

  const browser = await chromium.launch()

  try {
    await generateCleanLogoAssets(browser)
    const logoDataUrl = await readPngDataUrl(logoPath)
    await renderAsset(
      browser,
      {
        height: 280,
        html: createPromoHtml(logoDataUrl, 440, 280, false),
        outputPath: join(storeRoot, 'werbl-small-promo-440x280.png'),
        width: 440,
      },
    )
    await renderAsset(
      browser,
      {
        height: 560,
        html: createPromoHtml(logoDataUrl, 1400, 560, true),
        outputPath: join(storeRoot, 'werbl-marquee-promo-1400x560.png'),
        width: 1400,
      },
    )
    await renderAsset(
      browser,
      {
        height: 800,
        html: createMainScreenshotHtml(logoDataUrl),
        outputPath: join(storeRoot, 'werbl-screenshot-main-1280x800.png'),
        width: 1280,
      },
    )
    await renderAsset(
      browser,
      {
        height: 800,
        html: createSettingsScreenshotHtml(logoDataUrl),
        outputPath: join(storeRoot, 'werbl-screenshot-settings-1280x800.png'),
        width: 1280,
      },
    )
  } finally {
    await browser.close()
  }

  console.log(`Created clean Werbl icons and Chrome Web Store assets in ${storeRoot}`)
}

async function readPngDataUrl(path) {
  const bytes = await readFile(path)
  return `data:image/png;base64,${bytes.toString('base64')}`
}

async function renderAsset(browser, asset) {
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    viewport: {
      height: asset.height,
      width: asset.width,
    },
  })

  try {
    await page.setContent(asset.html, { waitUntil: 'load' })
    await page.screenshot({
      animations: 'disabled',
      fullPage: false,
      path: asset.outputPath,
      type: 'png',
    })
  } finally {
    await page.close()
  }
}

async function generateCleanLogoAssets(browser) {
  const sourceLogoDataUrl = await readPngDataUrl(sourceLogoPath)
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    viewport: {
      height: 1400,
      width: 1400,
    },
  })

  try {
    await page.setContent('<main></main>', { waitUntil: 'load' })
    const assets = await page.evaluate(async (dataUrl) => {
      const sourceImage = await loadImage(dataUrl)
      const cleanCanvas = document.createElement('canvas')
      cleanCanvas.width = sourceImage.naturalWidth
      cleanCanvas.height = sourceImage.naturalHeight
      const cleanContext = cleanCanvas.getContext('2d')
      if (cleanContext === null) {
        throw new Error('Canvas context was unavailable while cleaning the logo.')
      }

      cleanContext.drawImage(sourceImage, 0, 0)
      const imageData = cleanContext.getImageData(0, 0, cleanCanvas.width, cleanCanvas.height)
      removeNeutralCheckerboardPixels(imageData)
      cleanContext.putImageData(imageData, 0, 0)

      return {
        extension1024: resizePng(cleanCanvas, 1024, false),
        extension512: resizePng(cleanCanvas, 512, false),
        extension128: resizePng(cleanCanvas, 128, false),
        extension48: resizePng(cleanCanvas, 48, false),
        extension32: resizePng(cleanCanvas, 32, false),
        extension16: resizePng(cleanCanvas, 16, false),
        profileCircle1024: resizePng(cleanCanvas, 1024, true),
        profileSquare1024: resizePng(cleanCanvas, 1024, false),
        profileSquare512: resizePng(cleanCanvas, 512, false),
      }

      function loadImage(src) {
        return new Promise((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error('Source logo could not be loaded.'))
          image.src = src
        })
      }

      function removeNeutralCheckerboardPixels(imageData) {
        const data = imageData.data
        for (let index = 0; index < data.length; index += 4) {
          if (isNeutralCheckerboardPixel(data[index], data[index + 1], data[index + 2])) {
            data[index + 3] = 0
          }
        }
      }

      function isNeutralCheckerboardPixel(red, green, blue) {
        const max = Math.max(red, green, blue)
        const min = Math.min(red, green, blue)
        return min >= 238 && max - min <= 5
      }

      function resizePng(sourceCanvas, size, clipCircle) {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const context = canvas.getContext('2d')
        if (context === null) {
          throw new Error(`Canvas context was unavailable while resizing logo to ${size}.`)
        }

        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = 'high'
        if (clipCircle) {
          context.beginPath()
          context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
          context.clip()
        }
        context.drawImage(sourceCanvas, 0, 0, size, size)
        return canvas.toDataURL('image/png')
      }
    }, sourceLogoDataUrl)

    await writePngDataUrl(join(brandRoot, 'werbl-extension-icon-1024.png'), assets.extension1024)
    await writePngDataUrl(join(brandRoot, 'werbl-extension-icon-512.png'), assets.extension512)
    await writePngDataUrl(join(brandRoot, 'werbl-extension-icon-128.png'), assets.extension128)
    await writePngDataUrl(join(brandRoot, 'werbl-extension-icon-48.png'), assets.extension48)
    await writePngDataUrl(join(brandRoot, 'werbl-extension-icon-32.png'), assets.extension32)
    await writePngDataUrl(join(brandRoot, 'werbl-extension-icon-16.png'), assets.extension16)
    await writePngDataUrl(join(brandRoot, 'werbl-google-profile-circle-preview-1024.png'), assets.profileCircle1024)
    await writePngDataUrl(join(brandRoot, 'werbl-google-profile-square-1024.png'), assets.profileSquare1024)
    await writePngDataUrl(join(brandRoot, 'werbl-google-profile-square-512.png'), assets.profileSquare512)
    await writePngDataUrl(join(extensionIconRoot, 'icon128.png'), assets.extension128)
    await writePngDataUrl(join(extensionIconRoot, 'icon48.png'), assets.extension48)
    await writePngDataUrl(join(extensionIconRoot, 'icon32.png'), assets.extension32)
    await writePngDataUrl(join(extensionIconRoot, 'icon16.png'), assets.extension16)
  } finally {
    await page.close()
  }
}

async function writePngDataUrl(path, dataUrl) {
  const marker = 'data:image/png;base64,'
  if (!dataUrl.startsWith(marker)) {
    throw new Error(`Generated asset was not a PNG data URL: ${path}`)
  }

  await writeFile(path, Buffer.from(dataUrl.slice(marker.length), 'base64'))
}

function createBaseStyle(width, height) {
  return `
    <style>
      :root {
        color: #172026;
        background: #f8fafc;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      body {
        width: ${width}px;
        height: ${height}px;
        margin: 0;
        overflow: hidden;
        background: #f8fafc;
      }

      .stage {
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
        background:
          linear-gradient(135deg, rgba(31, 90, 69, 0.10), rgba(238, 179, 71, 0.12)),
          #f8fafc;
      }

      .brand-mark {
        display: block;
        object-fit: contain;
      }

      .eyebrow {
        margin: 0 0 8px;
        color: #446f5f;
        font-size: 16px;
        font-weight: 850;
        letter-spacing: 0;
        text-transform: uppercase;
      }

      h1,
      h2,
      p {
        margin: 0;
      }
    </style>
  `
}

function createPromoHtml(logoDataUrl, width, height, isWide) {
  const logoSize = isWide ? 260 : 128
  const titleSize = isWide ? 78 : 46
  const bodySize = isWide ? 28 : 17
  const gap = isWide ? 44 : 18
  const padding = isWide ? 86 : 28

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        ${createBaseStyle(width, height)}
        <style>
          .stage {
            display: flex;
            align-items: center;
            gap: ${gap}px;
            padding: ${padding}px;
          }

          .brand-mark {
            width: ${logoSize}px;
            height: ${logoSize}px;
          }

          h1 {
            color: #111827;
            font-size: ${titleSize}px;
            line-height: 0.95;
          }

          p {
            max-width: ${isWide ? 760 : 230}px;
            margin-top: ${isWide ? 20 : 10}px;
            color: #344054;
            font-size: ${bodySize}px;
            font-weight: 680;
            line-height: 1.28;
          }
        </style>
      </head>
      <body>
        <main class="stage">
          <img class="brand-mark" alt="" src="${logoDataUrl}" />
          <section>
            <p class="eyebrow">Local image conversion</p>
            <h1>Werbl</h1>
            <p>Right-click browser images or batch local files into PNG, JPG, or WebP.</p>
          </section>
        </main>
      </body>
    </html>
  `
}

function createMainScreenshotHtml(logoDataUrl) {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        ${createBaseStyle(1280, 800)}
        <style>
          .stage {
            display: grid;
            grid-template-columns: 540px 1fr;
            gap: 52px;
            padding: 54px 70px;
          }

          .app {
            display: grid;
            grid-template-rows: auto auto auto auto auto 1fr;
            gap: 13px;
            width: 460px;
            height: 692px;
            padding: 14px;
            border: 1px solid #d7e1dc;
            background: #ffffff;
            box-shadow: 0 24px 60px rgba(15, 23, 42, 0.16);
          }

          .top {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
          }

          .top img {
            width: 42px;
            height: 42px;
          }

          .top p {
            color: #446f5f;
            font-size: 12px;
            font-weight: 850;
            text-transform: uppercase;
          }

          .top h1 {
            color: #111827;
            font-size: 24px;
            line-height: 1.05;
          }

          .button-row,
          .metrics {
            display: grid;
            grid-template-columns: 1fr 72px 90px;
            gap: 8px;
          }

          .drop {
            display: grid;
            place-items: center;
            min-height: 110px;
            border: 1px dashed #8fb0a4;
            background: #f7fbf9;
            color: #111827;
            font-weight: 850;
          }

          .drop span {
            display: block;
            margin-top: 8px;
            color: #667085;
            font-size: 12px;
            font-weight: 600;
          }

          label {
            display: grid;
            gap: 6px;
            color: #344054;
            font-size: 13px;
            font-weight: 800;
          }

          select,
          button,
          .metric,
          .row,
          .notice {
            border: 1px solid #d7e1dc;
            background: #ffffff;
          }

          select,
          button {
            min-height: 42px;
            color: #344054;
            font: inherit;
            font-weight: 850;
          }

          .primary {
            border-color: #1f5a45;
            background: #1f5a45;
            color: #ffffff;
          }

          .bar {
            height: 10px;
            background: linear-gradient(90deg, #1f5a45 88%, #d7e1dc 88%);
          }

          .notice {
            padding: 11px 12px;
            background: #f1faf5;
            color: #1f5a45;
            font-size: 13px;
          }

          .metrics {
            grid-template-columns: repeat(4, 1fr);
          }

          .metric {
            padding: 10px;
          }

          .metric span {
            display: block;
            color: #667085;
            font-size: 10px;
            font-weight: 850;
            text-transform: uppercase;
          }

          .metric strong {
            display: block;
            margin-top: 3px;
            color: #111827;
            font-size: 13px;
          }

          .queue {
            min-height: 0;
            overflow: hidden;
            border: 1px solid #e4ebe7;
            background: #ffffff;
          }

          .row {
            display: grid;
            gap: 3px;
            padding: 12px;
            border-width: 0 0 1px;
          }

          .row strong {
            color: #111827;
            font-size: 14px;
          }

          .row span {
            color: #667085;
            font-size: 12px;
          }

          .copy {
            align-self: center;
            max-width: 520px;
          }

          .copy h2 {
            color: #111827;
            font-size: 60px;
            line-height: 1.02;
          }

          .copy p {
            margin-top: 22px;
            color: #344054;
            font-size: 22px;
            font-weight: 620;
            line-height: 1.38;
          }

          .chips {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 30px;
          }

          .chip {
            padding: 10px 14px;
            border: 1px solid #cbd5d0;
            background: rgba(255, 255, 255, 0.74);
            color: #344054;
            font-weight: 820;
          }
        </style>
      </head>
      <body>
        <main class="stage">
          <section class="app" aria-label="Werbl batch converter">
            <div class="top">
              <div>
                <p>Werbl</p>
                <h1>Batch convert</h1>
              </div>
              <img class="brand-mark" alt="" src="${logoDataUrl}" />
            </div>
            <div class="drop">Choose or drop images<span>PNG, JPG, WebP, AVIF, GIF, BMP</span></div>
            <label>Format<select><option>JPG</option></select></label>
            <div class="button-row">
              <button class="primary">Save ZIP</button>
              <button>Clear</button>
              <button>Clear ZIP</button>
            </div>
            <div class="bar"></div>
            <p class="notice">31 images converted in 2.0s</p>
            <div class="metrics">
              <div class="metric"><span>Time</span><strong>2.0s</strong></div>
              <div class="metric"><span>Images</span><strong>31</strong></div>
              <div class="metric"><span>Pixels</span><strong>47.7 MP</strong></div>
              <div class="metric"><span>ZIP</span><strong>38.48 MB</strong></div>
            </div>
            <div class="queue">
              <div class="row"><strong>hero-image.webp</strong><span>image/webp - 1536 x 1024 - 206.4 KB</span></div>
              <div class="row"><strong>catalog-02.webp</strong><span>image/webp - 1536 x 1024 - 238.5 KB</span></div>
              <div class="row"><strong>listing-thumb.png</strong><span>image/png - 900 x 600 - 114.4 KB</span></div>
            </div>
          </section>
          <section class="copy">
            <p class="eyebrow">Chrome extension</p>
            <h2>Convert image work without uploading files.</h2>
            <p>Right-click browser images, batch local files, and save clean PNG, JPG, or WebP output from Chrome.</p>
            <div class="chips">
              <span class="chip">Right-click saves</span>
              <span class="chip">Batch ZIPs</span>
              <span class="chip">Local processing</span>
            </div>
          </section>
        </main>
      </body>
    </html>
  `
}

function createSettingsScreenshotHtml(logoDataUrl) {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        ${createBaseStyle(1280, 800)}
        <style>
          .stage {
            display: grid;
            grid-template-columns: 1fr 480px;
            gap: 58px;
            padding: 70px 84px;
          }

          .copy {
            align-self: center;
          }

          .copy img {
            width: 112px;
            height: 112px;
          }

          .copy h1 {
            max-width: 560px;
            margin-top: 28px;
            color: #111827;
            font-size: 58px;
            line-height: 1.02;
          }

          .copy p {
            max-width: 560px;
            margin-top: 22px;
            color: #344054;
            font-size: 22px;
            font-weight: 620;
            line-height: 1.38;
          }

          .panel {
            align-self: center;
            display: grid;
            gap: 16px;
            width: 460px;
            padding: 18px;
            border: 1px solid #d7e1dc;
            background: #ffffff;
            box-shadow: 0 24px 60px rgba(15, 23, 42, 0.16);
          }

          .panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }

          .panel h2 {
            color: #111827;
            font-size: 24px;
          }

          .close {
            min-height: 34px;
            padding: 0 14px;
            border: 1px solid #cbd5d0;
            background: #ffffff;
            color: #344054;
            font: inherit;
            font-weight: 850;
          }

          .description {
            color: #667085;
            font-size: 14px;
            line-height: 1.4;
          }

          label {
            display: grid;
            gap: 10px;
            color: #344054;
            font-size: 15px;
            font-weight: 850;
          }

          .value {
            color: #111827;
          }

          .slider {
            height: 10px;
            background: linear-gradient(90deg, #1f5a45 100%, #d7e1dc 100%);
          }

          small {
            color: #667085;
            font-size: 12px;
            font-weight: 600;
          }

          .bug {
            display: grid;
            gap: 4px;
            min-height: 72px;
            padding: 12px;
            border: 1px solid #cbd5d0;
            background: #ffffff;
            color: #344054;
            text-decoration: none;
          }

          .bug strong {
            color: #111827;
            font-size: 15px;
          }

          .bug span {
            color: #667085;
            font-size: 13px;
            line-height: 1.35;
          }
        </style>
      </head>
      <body>
        <main class="stage">
          <section class="copy">
            <img class="brand-mark" alt="" src="${logoDataUrl}" />
            <h1>Quality settings stay simple and global.</h1>
            <p>Set JPG/WebP quality once. Werbl uses it for local batches and right-click saves, while PNG output stays lossless.</p>
          </section>
          <section class="panel" aria-label="Werbl settings">
            <div class="panel-header">
              <h2>Settings</h2>
              <button class="close">Close</button>
            </div>
            <p class="description">These settings apply to batch conversion and right-click JPG/WebP saves.</p>
            <label>
              JPG/WebP quality <span class="value">100</span>
              <span class="slider"></span>
              <small>Saved globally. PNG ignores quality.</small>
            </label>
            <a class="bug" href="#">
              <strong>Experiencing a bug?</strong>
              <span>Send what happened, steps to reproduce, browser version, source site, and target format.</span>
            </a>
          </section>
        </main>
      </body>
    </html>
  `
}

await main()
