const formatExtensions = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const productName = 'Werbl'
const bugReportEmail = 'Bugs4Werbl@gmail.com'
const cacheDatabaseName = 'werbl-cache'
const cacheStoreName = 'zip-cache'
const latestZipKey = 'latest'
const maxStoredZipEntryCount = 0xffff
const maxStoredZipFieldValue = 0xffffffff
const maxStoredZipFileNameBytes = 0xffff

const fileInput = document.querySelector('#fileInput')
const dropZone = document.querySelector('#dropZone')
const settingsButton = document.querySelector('#settingsButton')
const closeSettingsButton = document.querySelector('#closeSettingsButton')
const openWindowButton = document.querySelector('#openWindowButton')
const formatSelect = document.querySelector('#formatSelect')
const qualityInput = document.querySelector('#qualityInput')
const qualityValue = document.querySelector('#qualityValue')
const convertButton = document.querySelector('#convertButton')
const clearButton = document.querySelector('#clearButton')
const forgetButton = document.querySelector('#forgetButton')
const bugReportLink = document.querySelector('#bugReportLink')
const queue = document.querySelector('#queue')
const warningLine = document.querySelector('#warningLine')
const statusLine = document.querySelector('#statusLine')
const summaryLine = document.querySelector('#summaryLine')
const progressBar = document.querySelector('#progressBar')
const metricsPanel = document.querySelector('#metricsPanel')
const settingsPanel = document.querySelector('#settingsPanel')
const elapsedMetric = document.querySelector('#elapsedMetric')
const imageMetric = document.querySelector('#imageMetric')
const pixelMetric = document.querySelector('#pixelMetric')
const zipMetric = document.querySelector('#zipMetric')
const rightClickErrorPanel = document.querySelector('#rightClickErrorPanel')
const rightClickErrorMessage = document.querySelector('#rightClickErrorMessage')
const dismissRightClickErrorButton = document.querySelector('#dismissRightClickErrorButton')

let selectedFiles = []
let cachedZip = null
let lastFocusedBeforeSettings = null
const dimensionsByFileKey = new Map()
const pendingZipDownloadIds = new Set()
const lastRightClickErrorKey = 'lastRightClickError'
const settingsFocusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')
const searchParams = new URLSearchParams(window.location.search)
const isWindowView = searchParams.get('view') === 'window'
const isTestView = searchParams.get('view') === 'test'

if (isWindowView || isTestView) {
  document.body.classList.add('is-window')
  openWindowButton.hidden = true
}

if (isWindowView) {
  settingsButton.hidden = true
}

void hydrateSavedSettings()
void hydrateSessionState()
void hydrateRightClickFailure()
hydrateContactLinks()

openWindowButton.addEventListener('click', () => {
  window.open(
    chrome.runtime.getURL('popup.html?view=window'),
    'werbl-window',
    'popup,width=480,height=860',
  )
})

settingsButton.addEventListener('click', () => {
  openSettings()
})

closeSettingsButton.addEventListener('click', () => {
  closeSettings()
})

settingsPanel.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeSettings()
    return
  }

  if (event.key === 'Tab') {
    keepSettingsFocusInside(event)
  }
})

fileInput.addEventListener('change', () => {
  if (cachedZip === null) {
    addFiles(fileInput.files)
  }
  fileInput.value = ''
})

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault()
  if (cachedZip !== null) {
    return
  }

  dropZone.classList.add('is-dragging')
})

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('is-dragging')
})

dropZone.addEventListener('drop', (event) => {
  event.preventDefault()
  dropZone.classList.remove('is-dragging')
  if (cachedZip !== null) {
    return
  }

  addFiles(event.dataTransfer.files)
})

qualityInput.addEventListener('input', () => {
  if (cachedZip !== null) {
    return
  }

  qualityValue.textContent = qualityInput.value
  invalidateCachedZip()
  void saveQualitySetting(Number(qualityInput.value) / 100)
})

formatSelect.addEventListener('change', () => {
  if (cachedZip !== null) {
    return
  }

  invalidateCachedZip()
})

async function hydrateSavedSettings() {
  const values = await chrome.storage.sync.get({ quality: 1 })
  if (typeof values.quality !== 'number') {
    return
  }

  const percent = Math.round(Math.min(Math.max(values.quality, 0.4), 1) * 100)
  qualityInput.value = percent.toString()
  qualityValue.textContent = percent.toString()
}

function hydrateContactLinks() {
  bugReportLink.href = createBugReportGmailUrl()
  bugReportLink.target = '_blank'
  bugReportLink.rel = 'noopener'
}

function setConvertButtonToConvert() {
  convertButton.textContent = 'Convert'
  convertButton.setAttribute('aria-label', 'Convert selected images to a ZIP')
  convertButton.title = 'Convert selected images to a ZIP'
}

function setConvertButtonToSaveZip() {
  convertButton.textContent = 'Save ZIP'
  convertButton.setAttribute('aria-label', 'Save the ready ZIP file')
  convertButton.title = 'Save the ready ZIP file'
}

function openSettings() {
  if (!settingsPanel.hidden) {
    return
  }

  lastFocusedBeforeSettings = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null
  settingsPanel.hidden = false
  document.body.classList.add('is-settings-open')
  settingsButton.setAttribute('aria-expanded', 'true')
  closeSettingsButton.focus()
  enableSettingsModalMode()
}

function closeSettings() {
  if (settingsPanel.hidden) {
    return
  }

  disableSettingsModalMode()
  settingsPanel.hidden = true
  document.body.classList.remove('is-settings-open')
  settingsButton.setAttribute('aria-expanded', 'false')
  restoreSettingsFocus()
}

function keepSettingsFocusInside(event) {
  const focusableElements = getSettingsFocusableElements()
  if (focusableElements.length === 0) {
    event.preventDefault()
    settingsPanel.focus()
    return
  }

  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault()
    lastElement.focus()
    return
  }

  if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
  }
}

function getSettingsFocusableElements() {
  return Array.from(settingsPanel.querySelectorAll(settingsFocusableSelector))
    .filter((element) => element instanceof HTMLElement && element.offsetParent !== null)
}

function enableSettingsModalMode() {
  Array.from(document.querySelectorAll('main > *')).forEach((element) => {
    if (element instanceof HTMLElement && element !== settingsPanel) {
      element.inert = true
    }
  })
}

function disableSettingsModalMode() {
  Array.from(document.querySelectorAll('main > *')).forEach((element) => {
    if (element instanceof HTMLElement && element !== settingsPanel) {
      element.inert = false
    }
  })
}

function restoreSettingsFocus() {
  if (lastFocusedBeforeSettings instanceof HTMLElement && !lastFocusedBeforeSettings.hidden) {
    lastFocusedBeforeSettings.focus()
    lastFocusedBeforeSettings = null
    return
  }

  if (!settingsButton.hidden) {
    settingsButton.focus()
  }
  lastFocusedBeforeSettings = null
}

function createBugReportGmailUrl() {
  return createGmailComposeUrl(
    bugReportEmail,
    `${productName} bug report`,
    [
      'What happened?',
      '',
      'Steps to reproduce:',
      '1. ',
      '2. ',
      '3. ',
      '',
      `Product: ${productName}`,
      `Extension version: ${chrome.runtime.getManifest().version}`,
      `Browser: ${navigator.userAgent}`,
      'Source site or file type:',
      'Target format:',
    ].join('\n'),
  )
}

function createGmailComposeUrl(email, subject, body) {
  const params = new URLSearchParams({
    body,
    fs: '1',
    su: subject,
    to: email,
    view: 'cm',
  })
  return `https://mail.google.com/mail/?${params.toString()}`
}

async function saveQualitySetting(quality) {
  await chrome.storage.sync.set({ quality })
}

clearButton.addEventListener('click', () => {
  if (cachedZip !== null) {
    return
  }

  selectedFiles = []
  void invalidateCachedZip()
  dimensionsByFileKey.clear()
  warningLine.hidden = true
  statusLine.textContent = ''
  resetSummary()
  resetProgress()
  resetMetrics()
  renderQueue()
})

forgetButton.addEventListener('click', () => {
  void clearSessionCache()
})

dismissRightClickErrorButton.addEventListener('click', () => {
  void clearRightClickFailure()
})

convertButton.addEventListener('click', () => {
  void convertAndDownloadFiles().catch((error) => {
    handleConversionError(error)
  })
})

chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state === undefined || !pendingZipDownloadIds.has(delta.id)) {
    return
  }

  if (delta.state.current === 'complete') {
    pendingZipDownloadIds.delete(delta.id)
    cachedZip = null
    setConvertButtonToConvert()
    setCachedZipMode(false)
    void deleteCachedZip()
    return
  }

  if (delta.state.current === 'interrupted') {
    pendingZipDownloadIds.delete(delta.id)
  }
})

function addFiles(fileList) {
  const files = Array.from(fileList).filter((file) => file.type.startsWith('image/'))
  if (files.length === 0) {
    return
  }

  selectedFiles = [...selectedFiles, ...files]
  void invalidateCachedZip()
  resetSummary()
  renderQueue()
  void hydrateFileDimensions(files)
}

function renderQueue() {
  convertButton.disabled = selectedFiles.length === 0 && cachedZip === null
  clearButton.disabled = selectedFiles.length === 0 || cachedZip !== null
  renderBatchWarning()

  if (selectedFiles.length === 0) {
    queue.innerHTML = '<p class="empty">No images selected.</p>'
    return
  }

  const rows = selectedFiles.map((file) => {
      const row = document.createElement('article')
      row.className = 'file-row'

      const name = document.createElement('strong')
      name.textContent = file.name

      const meta = document.createElement('span')
      const dimensions = dimensionsByFileKey.get(createFileKey(file))
      const dimensionsText = dimensions === undefined
        ? 'reading size'
        : `${dimensions.width} x ${dimensions.height}`
      meta.textContent = `${file.type || 'unknown'} - ${dimensionsText} - ${formatBytes(file.size)}`

      row.append(name, meta)
      return row
    })

  queue.replaceChildren(...rows)
}

async function hydrateFileDimensions(files) {
  for (const file of files) {
    const key = createFileKey(file)
    if (dimensionsByFileKey.has(key)) {
      continue
    }

    try {
      const bitmap = await createImageBitmap(file)
      dimensionsByFileKey.set(key, {
        width: bitmap.width,
        height: bitmap.height,
      })
      bitmap.close()
    } catch {
      dimensionsByFileKey.set(key, {
        width: 0,
        height: 0,
      })
    }
  }

  renderQueue()
}

function renderBatchWarning() {
  const totalPixels = calculateSelectedPixels()

  if (selectedFiles.length > 100) {
    warningLine.textContent = `Large batch: ${selectedFiles.length} images selected. This can take longer on office PCs.`
    warningLine.hidden = false
    return
  }

  if (totalPixels > 150000000) {
    warningLine.textContent = `Large batch: about ${(totalPixels / 1000000).toFixed(0)} MP selected. Keep this window open while the ZIP is built.`
    warningLine.hidden = false
    return
  }

  warningLine.hidden = true
}

async function convertAndDownloadFiles() {
  const restoredZip = await readCachedZip()
  if (cachedZip === null && restoredZip !== null) {
    cachedZip = restoredZip
  }

  const signature = createBatchSignature()
  if (cachedZip !== null && selectedFiles.length === 0) {
    showCachedZipReady(cachedZip)
    await yieldForVisibleUpdate()
    pendingZipDownloadIds.add(await downloadBlob(cachedZip.blob, cachedZip.name))
    return
  }

  if (cachedZip !== null && cachedZip.signature === signature) {
    showCachedZipReady(cachedZip)
    await yieldForVisibleUpdate()
    pendingZipDownloadIds.add(await downloadBlob(cachedZip.blob, cachedZip.name))
    return
  }

  assertBatchFitsStoredZip(selectedFiles.length)

  const mimeType = formatSelect.value
  const extension = formatExtensions[mimeType]
  const quality = Number(qualityInput.value) / 100
  const startedAt = performance.now()
  const usedOutputNames = new Set()
  let processedPixels = 0

  convertButton.disabled = true

  try {
    const zipEntries = []
    setProgress(0, `Preparing ${selectedFiles.length} images`)
    await yieldToBrowser()

    for (const [index, file] of selectedFiles.entries()) {
      setProgress(calculateProgress(index, selectedFiles.length, 0.82), `Converting ${index + 1} of ${selectedFiles.length}`)
      await yieldToBrowser()
      const result = file.type === mimeType
        ? { blob: file, width: 0, height: 0 }
        : await convertFile(file, mimeType, quality)
      processedPixels += result.width * result.height
      zipEntries.push({
        name: createUniqueOutputName(file.name, extension, usedOutputNames),
        bytes: new Uint8Array(await result.blob.arrayBuffer()),
      })
      setProgress(calculateProgress(index + 1, selectedFiles.length, 0.82), `Converted ${index + 1} of ${selectedFiles.length}`)
      await yieldToBrowser()
    }

    setProgress(88, 'Building ZIP')
    await yieldToBrowser()
    const zipBlob = createStoredZip(zipEntries)
    const zipName = createBatchZipName(extension)
    cachedZip = {
      blob: zipBlob,
      imageCount: selectedFiles.length,
      name: zipName,
      signature,
    }
    await writeCachedZip(cachedZip)
    setConvertButtonToSaveZip()
    setCachedZipMode(true)
    const elapsedMs = performance.now() - startedAt
    const metrics = {
      elapsedMs,
      imageCount: selectedFiles.length,
      processedPixels,
      zipBytes: zipBlob.size,
    }
    const summary = `${selectedFiles.length} images converted in ${(elapsedMs / 1000).toFixed(1)}s`
    setSummary(summary)
    setMetrics(metrics)
    await writeLastTelemetry(summary, metrics)
    forgetButton.disabled = false
    setProgress(100, 'ZIP ready')
  } finally {
    convertButton.disabled = selectedFiles.length === 0 && cachedZip === null
  }
}

async function invalidateCachedZip() {
  cachedZip = null
  setConvertButtonToConvert()
  forgetButton.disabled = metricsPanel.hidden
  await deleteCachedZip()
}

function showCachedZipReady(zip) {
  summaryLine.textContent = `Existing ZIP ready: ${zip.imageCount} images`
  summaryLine.hidden = false
  setProgress(100, 'ZIP ready')
  setConvertButtonToSaveZip()
  setCachedZipMode(true)
}

function setCachedZipMode(isCachedZipReady) {
  fileInput.disabled = isCachedZipReady
  dropZone.classList.toggle('is-locked', isCachedZipReady)
  formatSelect.disabled = isCachedZipReady
  qualityInput.disabled = isCachedZipReady
  clearButton.disabled = isCachedZipReady || selectedFiles.length === 0
  convertButton.disabled = !isCachedZipReady && selectedFiles.length === 0
  forgetButton.disabled = !isCachedZipReady && metricsPanel.hidden
}

function handleConversionError(error) {
  if (cachedZip !== null) {
    setProgress(100, 'ZIP ready')
    setCachedZipMode(true)
    return
  }

  statusLine.textContent = error instanceof Error
    ? error.message
    : 'Batch conversion failed.'
  convertButton.disabled = selectedFiles.length === 0
}

async function hydrateRightClickFailure() {
  const values = await chrome.storage.session.get(lastRightClickErrorKey)
  const lastError = values[lastRightClickErrorKey]
  if (!isRightClickFailure(lastError)) {
    return
  }

  rightClickErrorMessage.textContent = lastError.message
  rightClickErrorPanel.hidden = false
}

async function clearRightClickFailure() {
  await Promise.all([
    chrome.storage.session.remove(lastRightClickErrorKey),
    chrome.action.setBadgeText({ text: '' }),
  ])
  rightClickErrorMessage.textContent = ''
  rightClickErrorPanel.hidden = true
}

function isRightClickFailure(value) {
  return typeof value === 'object'
    && value !== null
    && typeof value.message === 'string'
    && typeof value.rawMessage === 'string'
    && typeof value.targetFormat === 'string'
    && typeof value.occurredAt === 'string'
}

function setProgress(value, text) {
  progressBar.hidden = false
  progressBar.value = Math.max(0, Math.min(100, Math.round(value)))
  statusLine.textContent = text
}

function resetProgress() {
  progressBar.hidden = true
  progressBar.value = 0
}

function setMetrics(metrics) {
  metricsPanel.hidden = false
  elapsedMetric.textContent = `${(metrics.elapsedMs / 1000).toFixed(1)}s`
  imageMetric.textContent = metrics.imageCount.toString()
  pixelMetric.textContent = `${(metrics.processedPixels / 1000000).toFixed(1)} MP`
  zipMetric.textContent = formatBytes(metrics.zipBytes)
}

function setSummary(summary) {
  summaryLine.textContent = summary
  summaryLine.hidden = false
}

function resetMetrics() {
  metricsPanel.hidden = true
  elapsedMetric.textContent = '0.0s'
  imageMetric.textContent = '0'
  pixelMetric.textContent = '0 MP'
  zipMetric.textContent = '0 KB'
}

function resetSummary() {
  summaryLine.hidden = true
  summaryLine.textContent = ''
}

async function hydrateSessionState() {
  const [values, restoredZip] = await Promise.all([
    chrome.storage.session.get('lastTelemetry'),
    readCachedZip(),
  ])

  if (restoredZip !== null) {
    cachedZip = restoredZip
    setConvertButtonToSaveZip()
    setCachedZipMode(true)
  }

  if (values.lastTelemetry !== undefined) {
    setSummary(values.lastTelemetry.summary)
    setMetrics(values.lastTelemetry.metrics)
    setProgress(100, restoredZip === null ? 'Last conversion' : 'ZIP ready')
    setCachedZipMode(restoredZip !== null)
  }
}

async function clearSessionCache() {
  cachedZip = null
  await Promise.all([
    deleteCachedZip(),
    chrome.storage.session.remove(['cachedZip', 'lastTelemetry']),
  ])
  forgetButton.disabled = true
  setConvertButtonToConvert()
  statusLine.textContent = ''
  resetProgress()
  resetSummary()
  resetMetrics()
  setCachedZipMode(false)
}

async function writeCachedZip(zip) {
  const database = await openCacheDatabase()
  await runCacheTransaction(database, 'readwrite', (store) => {
    store.put({
      blob: zip.blob,
      id: latestZipKey,
      imageCount: zip.imageCount,
      name: zip.name,
      signature: zip.signature,
    })
  })
}

async function writeLastTelemetry(summary, metrics) {
  await chrome.storage.session.set({
    lastTelemetry: {
      metrics,
      summary,
    },
  })
}

async function readCachedZip() {
  const database = await openCacheDatabase()
  return runCacheTransaction(database, 'readonly', (store, resolve, reject) => {
    const request = store.get(latestZipKey)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      if (request.result === undefined) {
        resolve(null)
        return
      }

      resolve({
        blob: request.result.blob,
        imageCount: request.result.imageCount,
        name: request.result.name,
        signature: request.result.signature,
      })
    }
  })
}

async function deleteCachedZip() {
  const database = await openCacheDatabase()
  await runCacheTransaction(database, 'readwrite', (store) => {
    store.delete(latestZipKey)
  })
}

function openCacheDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(cacheDatabaseName, 1)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(cacheStoreName, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
  })
}

function runCacheTransaction(database, mode, run) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(cacheStoreName, mode)
    const store = transaction.objectStore(cacheStoreName)
    transaction.onerror = () => reject(transaction.error)
    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onabort = () => {
      database.close()
      reject(transaction.error)
    }
    run(store, resolve, reject)
  })
}

function createBatchSignature() {
  const files = selectedFiles.map((file) => createFileKey(file)).join('|')
  return `${formatSelect.value}:${qualityInput.value}:${files}`
}

function calculateProgress(completedCount, totalCount, conversionWeight) {
  if (totalCount === 0) {
    return 0
  }

  return (completedCount / totalCount) * conversionWeight * 100
}

function yieldToBrowser() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

async function yieldForVisibleUpdate() {
  await yieldToBrowser()
  await new Promise((resolve) => {
    setTimeout(() => resolve(), 75)
  })
}

async function convertFile(file, mimeType, quality) {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height

  const context = canvas.getContext('2d')
  if (context === null) {
    bitmap.close()
    throw new Error('Canvas rendering context was unavailable.')
  }

  if (mimeType === 'image/jpeg') {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  context.drawImage(bitmap, 0, 0)
  bitmap.close()

  const blob = await createCanvasBlob(canvas, mimeType, quality)
  return {
    blob,
    width: canvas.width,
    height: canvas.height,
  }
}

function createCanvasBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new Error(`Browser could not encode output format: ${mimeType}`))
          return
        }

        resolve(blob)
      },
      mimeType,
      quality,
    )
  })
}

async function downloadBlob(blob, outputName) {
  if (isTestView) {
    await chrome.storage.session.set({
      lastTestDownload: {
        bytes: blob.size,
        name: outputName,
      },
    })
    return 0
  }

  const dataUrl = await readBlobAsDataUrl(blob)
  const downloadId = await chrome.downloads.download({
    url: dataUrl,
    filename: outputName,
    saveAs: false,
  })
  await chrome.runtime.sendMessage({
    downloadId,
    type: 'track-batch-download',
  })
  return downloadId
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Converted image could not be read for download.'))
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Converted image produced an unexpected download payload.'))
        return
      }

      resolve(reader.result)
    }
    reader.readAsDataURL(blob)
  })
}

function createUniqueOutputName(fileName, extension, usedNames) {
  const baseName = createOutputBaseName(fileName)
  const firstName = `${baseName}.${extension}`
  if (!usedNames.has(firstName.toLowerCase())) {
    usedNames.add(firstName.toLowerCase())
    return firstName
  }

  let suffix = 2
  while (true) {
    const candidateName = `${baseName}-${suffix}.${extension}`
    const comparableName = candidateName.toLowerCase()
    if (!usedNames.has(comparableName)) {
      usedNames.add(comparableName)
      return candidateName
    }

    suffix += 1
  }
}

function createOutputBaseName(fileName) {
  const dotIndex = fileName.lastIndexOf('.')
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
  return sanitizeFileName(baseName)
}

function sanitizeFileName(baseName) {
  const sanitized = Array.from(baseName)
    .map((character) => isUnsafeFileNameCharacter(character) ? '-' : character)
    .join('')
    .trim()
  return sanitized.length === 0 ? 'image' : sanitized.slice(0, 120)
}

function isUnsafeFileNameCharacter(character) {
  const codePoint = character.codePointAt(0)
  if (codePoint === undefined) {
    return true
  }

  return codePoint < 32 || '<>:"/\\|?*'.includes(character)
}

function createBatchZipName(extension) {
  const now = new Date()
  const stamp = [
    now.getFullYear(),
    padNumber(now.getMonth() + 1),
    padNumber(now.getDate()),
    padNumber(now.getHours()),
    padNumber(now.getMinutes()),
    padNumber(now.getSeconds()),
  ].join('')

  return `converted-${extension}-${stamp}.zip`
}

function createStoredZip(entries) {
  assertEntriesFitStoredZip(entries)

  const localParts = []
  const centralParts = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name)
    const crc = calculateCrc32(entry.bytes)
    const localHeader = createLocalFileHeader(nameBytes, crc, entry.bytes.length)

    localParts.push(localHeader, entry.bytes)
    centralParts.push(createCentralDirectoryHeader(nameBytes, crc, entry.bytes.length, offset))

    offset += localHeader.length + entry.bytes.length
  }

  const centralDirectorySize = centralParts.reduce((sum, part) => sum + part.length, 0)
  const endRecord = createEndOfCentralDirectory(entries.length, centralDirectorySize, offset)
  return new Blob([...localParts, ...centralParts, endRecord], { type: 'application/zip' })
}

function assertBatchFitsStoredZip(fileCount) {
  if (fileCount > maxStoredZipEntryCount) {
    throw new RangeError(
      `This batch has ${fileCount} files, but standard ZIP supports up to ${maxStoredZipEntryCount} entries. Split the batch and try again.`,
    )
  }
}

function assertEntriesFitStoredZip(entries) {
  assertBatchFitsStoredZip(entries.length)

  let localOffset = 0
  let centralDirectorySize = 0

  for (const entry of entries) {
    const entryLabel = formatZipEntryNameForError(entry.name)
    const nameBytes = new TextEncoder().encode(entry.name)
    assertStoredZipNameLength(nameBytes.length, entryLabel)
    assertStoredZipFieldValue(`ZIP entry size for ${entryLabel}`, entry.bytes.length)
    assertStoredZipFieldValue('ZIP local header offset', localOffset)

    const nextLocalOffset = localOffset + 30 + nameBytes.length + entry.bytes.length
    assertStoredZipFieldValue('ZIP local data size', nextLocalOffset)

    localOffset = nextLocalOffset
    centralDirectorySize += 46 + nameBytes.length
    assertStoredZipFieldValue('ZIP central directory size', centralDirectorySize)
  }

  assertStoredZipFieldValue('ZIP archive size', localOffset + centralDirectorySize)
}

function assertStoredZipNameLength(byteLength, entryName) {
  if (byteLength <= maxStoredZipFileNameBytes) {
    return
  }

  throw new RangeError(
    `ZIP entry name for ${entryName} is ${byteLength} bytes, but standard ZIP supports up to ${maxStoredZipFileNameBytes} bytes per name. Use a shorter file name and try again.`,
  )
}

function formatZipEntryNameForError(entryName) {
  if (entryName.length <= 120) {
    return entryName
  }

  return `${entryName.slice(0, 120)}...`
}

function assertStoredZipFieldValue(label, value) {
  if (value <= maxStoredZipFieldValue) {
    return
  }

  throw new RangeError(
    `${label} is ${value} bytes, but standard ZIP fields support up to ${maxStoredZipFieldValue} bytes. Split the batch and try again.`,
  )
}

function createLocalFileHeader(nameBytes, crc, size) {
  assertStoredZipNameLength(nameBytes.length, 'local file header')
  assertStoredZipFieldValue('ZIP entry size', size)

  const header = new Uint8Array(30 + nameBytes.length)
  const view = new DataView(header.buffer)
  view.setUint32(0, 0x04034b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(6, 0x0800, true)
  view.setUint16(8, 0, true)
  view.setUint16(10, 0, true)
  view.setUint16(12, 0, true)
  view.setUint32(14, crc, true)
  view.setUint32(18, size, true)
  view.setUint32(22, size, true)
  view.setUint16(26, nameBytes.length, true)
  view.setUint16(28, 0, true)
  header.set(nameBytes, 30)
  return header
}

function createCentralDirectoryHeader(nameBytes, crc, size, offset) {
  assertStoredZipNameLength(nameBytes.length, 'central directory header')
  assertStoredZipFieldValue('ZIP entry size', size)
  assertStoredZipFieldValue('ZIP entry offset', offset)

  const header = new Uint8Array(46 + nameBytes.length)
  const view = new DataView(header.buffer)
  view.setUint32(0, 0x02014b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(6, 20, true)
  view.setUint16(8, 0x0800, true)
  view.setUint16(10, 0, true)
  view.setUint16(12, 0, true)
  view.setUint16(14, 0, true)
  view.setUint32(16, crc, true)
  view.setUint32(20, size, true)
  view.setUint32(24, size, true)
  view.setUint16(28, nameBytes.length, true)
  view.setUint16(30, 0, true)
  view.setUint16(32, 0, true)
  view.setUint16(34, 0, true)
  view.setUint16(36, 0, true)
  view.setUint32(38, 0, true)
  view.setUint32(42, offset, true)
  header.set(nameBytes, 46)
  return header
}

function createEndOfCentralDirectory(entryCount, centralDirectorySize, centralDirectoryOffset) {
  assertBatchFitsStoredZip(entryCount)
  assertStoredZipFieldValue('ZIP central directory size', centralDirectorySize)
  assertStoredZipFieldValue('ZIP central directory offset', centralDirectoryOffset)

  const record = new Uint8Array(22)
  const view = new DataView(record.buffer)
  view.setUint32(0, 0x06054b50, true)
  view.setUint16(4, 0, true)
  view.setUint16(6, 0, true)
  view.setUint16(8, entryCount, true)
  view.setUint16(10, entryCount, true)
  view.setUint32(12, centralDirectorySize, true)
  view.setUint32(16, centralDirectoryOffset, true)
  view.setUint16(20, 0, true)
  return record
}

function calculateCrc32(bytes) {
  let crc = 0xffffffff

  for (const byte of bytes) {
    crc = (crc >>> 8) ^ crc32Table[(crc ^ byte) & 0xff]
  }

  return (crc ^ 0xffffffff) >>> 0
}

function createCrc32Table() {
  const table = new Uint32Array(256)

  for (let index = 0; index < 256; index += 1) {
    let crc = index

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }

    table[index] = crc >>> 0
  }

  return table
}

function padNumber(value) {
  return value.toString().padStart(2, '0')
}

function calculateSelectedPixels() {
  return selectedFiles.reduce((totalPixels, file) => {
    const dimensions = dimensionsByFileKey.get(createFileKey(file))
    if (dimensions === undefined) {
      return totalPixels
    }

    return totalPixels + dimensions.width * dimensions.height
  }, 0)
}

function createFileKey(file) {
  return `${file.name}:${file.size}:${file.lastModified}:${file.type}`
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const crc32Table = createCrc32Table()
