import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { cp, mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createContext, runInContext } from 'node:vm'
import { chromium } from 'playwright'

const projectRoot = resolve(import.meta.dirname, '..')
const extensionRoot = join(projectRoot, 'extension')
const fixturePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8Dwn4GBgYGJAQoAHxcCA8KaR3YAAAAASUVORK5CYII=',
  'base64',
)

async function main() {
  await verifyRightClickFallbacks()

  const tempRoot = await mkdtemp(join(tmpdir(), 'werbl-smoke-'))
  const userDataDir = join(tempRoot, 'chrome-profile')
  const runtimeExtensionRoot = join(tempRoot, 'extension')
  const inputOneDir = join(tempRoot, 'input-one')
  const inputTwoDir = join(tempRoot, 'input-two')
  const queueInputDir = join(tempRoot, 'queue-input')

  await cp(extensionRoot, runtimeExtensionRoot, { recursive: true })
  await mkdir(inputOneDir)
  await mkdir(inputTwoDir)
  await mkdir(queueInputDir)

  const inputOne = join(inputOneDir, 'sample.png')
  const inputTwo = join(inputTwoDir, 'sample.png')
  await writeFile(inputOne, fixturePng)
  await writeFile(inputTwo, fixturePng)

  const context = await chromium.launchPersistentContext(userDataDir, {
    acceptDownloads: true,
    headless: false,
    args: [
      `--disable-extensions-except=${runtimeExtensionRoot}`,
      `--load-extension=${runtimeExtensionRoot}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  })

  try {
    const browserPng = await createBrowserPng(context)
    await writeFile(inputOne, browserPng)
    await writeFile(inputTwo, browserPng)
    const queueInputs = await createQueueInputs(queueInputDir, browserPng, 12)

    const extensionId = await readExtensionId(context, userDataDir, runtimeExtensionRoot)
    await verifyToolbarPopupHeights(context, extensionId)
    await verifySettingsDefaultsAndContactLinks(context, extensionId)
    await verifyFullQueueRender(context, extensionId, queueInputs)
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/popup.html?view=test`)
    await verifyZipLimitErrors(page)
    await page.locator('#fileInput').setInputFiles([inputOne, inputTwo])
    await page.locator('#formatSelect').selectOption('image/jpeg')
    await expectText(page, '#convertButton', 'Convert')
    await page.waitForFunction(() => {
      const button = document.querySelector('#convertButton')
      return button !== null && !button.disabled
    })
    await page.locator('#convertButton').click()
    await waitForZipReady(page)

    const testDownloadBeforeSave = await page.evaluate(async () => {
      const values = await chrome.storage.session.get('lastTestDownload')
      return values.lastTestDownload ?? null
    })
    assert(testDownloadBeforeSave === null, 'Convert should not trigger a ZIP download before Save ZIP is clicked.')

    const storedZip = await page.evaluate(async () => {
      const zip = await readCachedZip()
      if (zip === null) {
        return {
          error: 'Smoke test ZIP was not cached.',
          statusText: document.querySelector('#statusLine')?.textContent ?? '',
          summaryText: document.querySelector('#summaryLine')?.textContent ?? '',
        }
      }

      const buffer = await zip.blob.arrayBuffer()
      return {
        bytes: Array.from(new Uint8Array(buffer)),
        imageCount: zip.imageCount,
        name: zip.name,
      }
    })

    if (storedZip.error !== undefined) {
      throw new Error(`${storedZip.error} Status: ${storedZip.statusText} Summary: ${storedZip.summaryText}`)
    }

    const zipBytes = Uint8Array.from(storedZip.bytes)
    const names = readStoredZipNames(zipBytes)
    assert(storedZip.imageCount === 2, `Expected 2 images, found ${storedZip.imageCount}.`)
    assert(storedZip.name.endsWith('.zip'), `Expected ZIP output name, found ${storedZip.name}.`)
    assert(names.includes('sample.jpg'), `Expected sample.jpg in ZIP, found ${names.join(', ')}.`)
    assert(names.includes('sample-2.jpg'), `Expected sample-2.jpg in ZIP, found ${names.join(', ')}.`)

    await expectText(page, '#convertButton', 'Save ZIP')
    await page.locator('#convertButton').click()
    await page.waitForFunction(async () => {
      const values = await chrome.storage.session.get('lastTestDownload')
      return values.lastTestDownload?.bytes > 0
    })

    console.log(`Smoke test passed: ${storedZip.name} (${zipBytes.length} bytes)`)
    console.log(`ZIP entries: ${names.join(', ')}`)
  } finally {
    await context.close()
    await rm(tempRoot, { recursive: true, force: true })
  }
}

async function createQueueInputs(directory, bytes, count) {
  const paths = []
  for (let index = 1; index <= count; index += 1) {
    const path = join(directory, `queue-${index}.png`)
    await writeFile(path, bytes)
    paths.push(path)
  }

  return paths
}

async function verifyRightClickFallbacks() {
  const backgroundSource = await readFile(join(extensionRoot, 'background.js'), 'utf8')
  await verifyOffscreenSetupFailureFallsBack(backgroundSource)
  await verifyRuntimeMessageFailureFallsBack(backgroundSource)
}

async function verifyOffscreenSetupFailureFallsBack(backgroundSource) {
  let executeScriptCalls = 0
  const chrome = createBackgroundChrome({
    createDocument: async () => {
      throw new Error('Offscreen createDocument should not run after getContexts fails.')
    },
    executeScript: async () => {
      executeScriptCalls += 1
      return [{ result: { ok: true, dataUrl: 'data:image/png;base64,AA==' } }]
    },
    getContexts: async () => {
      throw new Error('offscreen contexts unavailable')
    },
    sendMessage: async () => {
      throw new Error('runtime sendMessage should not run after getContexts fails.')
    },
  })
  const background = loadBackgroundScript(backgroundSource, chrome)
  const response = await background.convertImageWithFallbacks(
    { srcUrl: 'https://example.test/source.png' },
    { id: 11 },
    { extension: 'png', mimeType: 'image/png' },
    1,
  )

  assert(response.ok === true, `Rendered fallback should recover from offscreen setup failure: ${JSON.stringify(response)}.`)
  assert(executeScriptCalls === 1, `Rendered fallback should run once after offscreen setup failure, ran ${executeScriptCalls} times.`)
}

async function verifyRuntimeMessageFailureFallsBack(backgroundSource) {
  let createDocumentCalls = 0
  let executeScriptCalls = 0
  const chrome = createBackgroundChrome({
    createDocument: async () => {
      createDocumentCalls += 1
    },
    executeScript: async () => {
      executeScriptCalls += 1
      return [{ result: { ok: false, error: 'rendered image was blocked' } }]
    },
    getContexts: async () => [],
    sendMessage: async () => {
      throw new Error('runtime message channel closed')
    },
  })
  const background = loadBackgroundScript(backgroundSource, chrome)
  const response = await background.convertImageWithFallbacks(
    { srcUrl: 'https://example.test/source.png' },
    { id: 12 },
    { extension: 'webp', mimeType: 'image/webp' },
    1,
  )

  assert(createDocumentCalls === 1, `Offscreen document should be created once, created ${createDocumentCalls} times.`)
  assert(executeScriptCalls === 1, `Rendered fallback should run once after sendMessage failure, ran ${executeScriptCalls} times.`)
  assert(response.ok === false, 'Fallback failure should return an explicit failed response.')
  assert(
    response.error.includes('Offscreen conversion failed: runtime message channel closed')
      && response.error.includes('rendered-page fallback failed: rendered image was blocked'),
    `Fallback failure should include both root causes, found: ${response.error}`,
  )
}

function createBackgroundChrome(handlers) {
  return {
    action: {
      setBadgeBackgroundColor: async () => {},
      setBadgeText: async () => {},
    },
    contextMenus: {
      create: () => {},
      onClicked: createChromeEvent(),
      removeAll: (callback) => callback(),
    },
    downloads: {
      download: async () => 1,
      onChanged: createChromeEvent(),
      onCreated: createChromeEvent(),
    },
    offscreen: {
      createDocument: handlers.createDocument,
    },
    runtime: {
      getContexts: handlers.getContexts,
      getURL: (path) => `chrome-extension://test-extension/${path}`,
      id: 'test-extension',
      onInstalled: createChromeEvent(),
      onMessage: createChromeEvent(),
      onStartup: createChromeEvent(),
      sendMessage: handlers.sendMessage,
    },
    scripting: {
      executeScript: handlers.executeScript,
    },
    storage: {
      session: {
        remove: async () => {},
        set: async () => {},
      },
      sync: {
        get: async () => ({ quality: 1 }),
      },
    },
  }
}

function createChromeEvent() {
  return {
    addListener: () => {},
  }
}

function loadBackgroundScript(backgroundSource, chrome) {
  const context = createContext({
    chrome,
    console,
    Date,
    Error,
    Promise,
    Set,
    URL,
  })
  runInContext(backgroundSource, context, { filename: 'extension/background.js' })
  if (typeof context.convertImageWithFallbacks !== 'function') {
    throw new Error('Background fallback function was not available to the smoke harness.')
  }

  return context
}

function assertRangeError(errorInfo, label) {
  assert(errorInfo !== null, `${label} should throw before writing an unsupported ZIP.`)
  assert(errorInfo.name === 'RangeError', `${label} should throw RangeError, found ${errorInfo.name}: ${errorInfo.message}`)
}

async function verifyFullQueueRender(context, extensionId, paths) {
  const page = await context.newPage()
  try {
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await page.locator('#fileInput').setInputFiles(paths)
    await page.waitForFunction((expectedCount) => {
      return document.querySelectorAll('#queue .file-row').length === expectedCount
    }, paths.length)

    const queueText = await page.locator('#queue').textContent()
    assert(queueText.includes('queue-1.png'), 'Queue should show the first selected image.')
    assert(queueText.includes(`queue-${paths.length}.png`), 'Queue should show the last selected image.')
    assert(!queueText.includes('Plus '), 'Queue should not collapse selected images into a summary row.')
  } finally {
    await page.close()
  }
}

async function createBrowserPng(context) {
  const page = await context.newPage()
  try {
    const base64 = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 160
      canvas.height = 120
      const context2d = canvas.getContext('2d')
      if (context2d === null) {
        throw new Error('Canvas rendering context was unavailable while creating smoke fixture.')
      }

      context2d.fillStyle = '#1f5a45'
      context2d.fillRect(0, 0, canvas.width, canvas.height)
      context2d.fillStyle = '#f8fafc'
      context2d.fillRect(20, 20, 120, 64)
      context2d.fillStyle = '#eeb347'
      context2d.beginPath()
      context2d.arc(116, 42, 13, 0, Math.PI * 2)
      context2d.fill()
      return canvas.toDataURL('image/png').split(',')[1]
    })
    return Buffer.from(base64, 'base64')
  } finally {
    await page.close()
  }
}

async function verifyToolbarPopupHeights(context, extensionId) {
  const page = await context.newPage()
  try {
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    const closedHeight = await readPopupContentHeight(page)
    assert(closedHeight <= 600, `Toolbar popup closed height is too tall: ${closedHeight}px.`)
    await page.locator('#settingsButton').click()
    const openHeight = await readPopupContentHeight(page)
    assert(openHeight === closedHeight, `Settings overlay changed popup height from ${closedHeight}px to ${openHeight}px.`)

    await page.goto(`chrome-extension://${extensionId}/popup.html?view=window`)
    const settingsHiddenInWindow = await page.locator('#settingsButton').evaluate((button) => button.hidden)
    assert(settingsHiddenInWindow === true, 'Settings button should be hidden in window mode.')
  } finally {
    await page.close()
  }
}

async function verifySettingsDefaultsAndContactLinks(context, extensionId) {
  const page = await context.newPage()
  try {
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await page.locator('#settingsButton').click()
    await verifySettingsDialogBehavior(page)

    const qualityValue = await page.locator('#qualityInput').inputValue()
    assert(qualityValue === '100', `Expected default quality 100, found ${qualityValue}.`)

    const bugHref = await page.locator('#bugReportLink').getAttribute('href')
    const solutionLinkCount = await page.locator('#customSolutionLink').count()
    assert(
      typeof bugHref === 'string'
        && bugHref.startsWith('https://mail.google.com/mail/?')
        && bugHref.includes('to=Bugs4Werbl%40gmail.com'),
      `Bug report link should open Gmail for Bugs4Werbl@gmail.com, found ${bugHref}.`,
    )
    assert(solutionLinkCount === 0, `Extension UI should not ship a custom-solution CTA, found ${solutionLinkCount}.`)
  } finally {
    await page.close()
  }
}

async function verifySettingsDialogBehavior(page) {
  const panelRole = await page.locator('#settingsPanel').getAttribute('role')
  const panelModal = await page.locator('#settingsPanel').getAttribute('aria-modal')
  const expanded = await page.locator('#settingsButton').getAttribute('aria-expanded')
  const activeElementId = await page.evaluate(() => document.activeElement?.id ?? '')

  assert(panelRole === 'dialog', `Settings panel should have dialog role, found ${panelRole}.`)
  assert(panelModal === 'true', `Settings panel should be modal, found ${panelModal}.`)
  assert(expanded === 'true', `Settings button should be expanded while settings are open, found ${expanded}.`)
  assert(activeElementId === 'closeSettingsButton', `Settings should focus the close button, found ${activeElementId}.`)

  await page.keyboard.press('Escape')
  const hiddenAfterEscape = await page.locator('#settingsPanel').evaluate((panel) => panel.hidden)
  const collapsedAfterEscape = await page.locator('#settingsButton').getAttribute('aria-expanded')
  assert(hiddenAfterEscape === true, 'Escape should close the settings dialog.')
  assert(collapsedAfterEscape === 'false', `Settings button should collapse after Escape, found ${collapsedAfterEscape}.`)

  await page.locator('#settingsButton').click()
}

async function verifyZipLimitErrors(page) {
  const errors = await page.evaluate(() => {
    const createZip = globalThis.createStoredZip
    if (typeof createZip !== 'function') {
      throw new Error('createStoredZip was not available on the popup page.')
    }

    function readThrownError(run) {
      try {
        run()
        return null
      } catch (error) {
        if (error instanceof Error) {
          return {
            message: error.message,
            name: error.name,
          }
        }

        return {
          message: String(error),
          name: 'ThrownValue',
        }
      }
    }

    return {
      entryCount: readThrownError(() => {
        createZip(Array.from({ length: 0x10000 }, (_value, index) => ({
          bytes: new Uint8Array(),
          name: `too-many-${index}.txt`,
        })))
      }),
      entrySize: readThrownError(() => {
        createZip([{ bytes: { length: 0x100000000 }, name: 'huge.png' }])
      }),
      nameLength: readThrownError(() => {
        createZip([{ bytes: new Uint8Array(), name: `${'a'.repeat(0x10000)}.txt` }])
      }),
    }
  })

  assertRangeError(errors.entryCount, 'entry-count ZIP guard')
  assertRangeError(errors.entrySize, 'entry-size ZIP guard')
  assertRangeError(errors.nameLength, 'entry-name ZIP guard')
  assert(errors.entryCount.message.includes('65535'), `Entry-count guard should include the ZIP entry limit, found: ${errors.entryCount.message}`)
  assert(errors.entrySize.message.includes('4294967295'), `Entry-size guard should include the ZIP size limit, found: ${errors.entrySize.message}`)
  assert(errors.nameLength.message.includes('65535'), `Entry-name guard should include the ZIP name limit, found: ${errors.nameLength.message}`)
}

async function readPopupContentHeight(page) {
  return page.evaluate(() => {
    const main = document.querySelector('main')
    if (main === null) {
      throw new Error('Popup main element was missing.')
    }

    return Math.ceil(main.getBoundingClientRect().height)
  })
}

async function readExtensionId(context, userDataDir, runtimeExtensionRoot) {
  const manifestExtensionId = await readExtensionIdFromManifest()
  if (manifestExtensionId !== null) {
    return manifestExtensionId
  }

  let serviceWorker = context.serviceWorkers()[0]
  if (serviceWorker !== undefined) {
    return readExtensionIdFromUrl(serviceWorker.url())
  }

  try {
    serviceWorker = await context.waitForEvent('serviceworker', { timeout: 3000 })
    return readExtensionIdFromUrl(serviceWorker.url())
  } catch (error) {
    if (error.name !== 'TimeoutError') {
      throw error
    }
  }

  return readExtensionIdFromPreferences(userDataDir, runtimeExtensionRoot)
}

async function readExtensionIdFromManifest() {
  const manifestPath = join(extensionRoot, 'manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  if (typeof manifest.key !== 'string') {
    return null
  }

  const publicKey = Buffer.from(manifest.key, 'base64')
  const digest = createHash('sha256').update(publicKey).digest()
  const idBytes = digest.subarray(0, 16)
  return Array.from(idBytes)
    .map((byte) => {
      const high = String.fromCharCode('a'.charCodeAt(0) + (byte >> 4))
      const low = String.fromCharCode('a'.charCodeAt(0) + (byte & 0x0f))
      return `${high}${low}`
    })
    .join('')
}

function readExtensionIdFromUrl(url) {
  const match = url.match(/^chrome-extension:\/\/([^/]+)\//)
  if (match === null) {
    throw new Error(`Could not read extension id from service worker URL: ${url}`)
  }

  return match[1]
}

async function readExtensionIdFromPreferences(userDataDir, runtimeExtensionRoot) {
  const preferencesPath = await waitForPreferencesPath(userDataDir)
  const rawPreferences = await readFile(preferencesPath, 'utf8')
  const preferences = JSON.parse(rawPreferences)
  const settings = preferences.extensions?.settings

  if (typeof settings !== 'object' || settings === null) {
    throw new Error(`Chrome extension settings were missing from: ${preferencesPath}`)
  }

  for (const [extensionId, extensionSettings] of Object.entries(settings)) {
    const manifest = extensionSettings?.manifest
    const path = extensionSettings?.path
    if (manifest?.name === 'Werbl' || path === runtimeExtensionRoot) {
      return extensionId
    }
  }

  throw new Error(`Could not find Werbl in Chrome preferences: ${preferencesPath}`)
}

async function waitForPreferencesPath(userDataDir) {
  const deadline = Date.now() + 10000

  while (Date.now() < deadline) {
    const preferencesPath = await findPreferencesPath(userDataDir)
    if (preferencesPath !== null) {
      return preferencesPath
    }

    await wait(250)
  }

  throw new Error(`Chrome preferences were not created under: ${userDataDir}`)
}

async function findPreferencesPath(userDataDir) {
  const candidates = [
    join(userDataDir, 'Default', 'Preferences'),
    join(userDataDir, 'Profile 1', 'Preferences'),
  ]

  for (const candidate of candidates) {
    if (await canReadFile(candidate)) {
      return candidate
    }
  }

  const entries = await readdir(userDataDir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const candidate = join(userDataDir, entry.name, 'Preferences')
    if (await canReadFile(candidate)) {
      return candidate
    }
  }

  return null
}

async function canReadFile(path) {
  try {
    await readFile(path, 'utf8')
    return true
  } catch {
    return false
  }
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), milliseconds)
  })
}

async function expectText(page, selector, expectedText) {
  const text = await page.locator(selector).textContent()
  assert(text === expectedText, `Expected ${selector} text "${expectedText}", found "${text}".`)
}

async function waitForZipReady(page) {
  try {
    await page.waitForFunction(() => {
      const statusText = document.querySelector('#statusLine')?.textContent ?? ''
      return statusText.startsWith('ZIP ready')
    })
  } catch (error) {
    if (error.name !== 'TimeoutError') {
      throw error
    }

    const state = await page.evaluate(() => {
      return {
        buttonDisabled: document.querySelector('#convertButton')?.disabled ?? null,
        queueText: document.querySelector('#queue')?.textContent ?? '',
        statusText: document.querySelector('#statusLine')?.textContent ?? '',
        summaryText: document.querySelector('#summaryLine')?.textContent ?? '',
      }
    })
    throw new Error(`ZIP was not ready before timeout: ${JSON.stringify(state)}`)
  }
}

function readStoredZipNames(bytes) {
  const names = []
  let offset = 0

  while (offset < bytes.length - 4) {
    const signature = readUint32(bytes, offset)
    if (signature !== 0x02014b50) {
      offset += 1
      continue
    }

    const nameLength = readUint16(bytes, offset + 28)
    const extraLength = readUint16(bytes, offset + 30)
    const commentLength = readUint16(bytes, offset + 32)
    const nameStart = offset + 46
    const nameEnd = nameStart + nameLength
    names.push(new TextDecoder().decode(bytes.slice(nameStart, nameEnd)))
    offset = nameEnd + extraLength + commentLength
  }

  return names
}

function readUint16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function readUint32(bytes, offset) {
  return (
    bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24)
  ) >>> 0
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

await main()
