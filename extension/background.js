const menuItems = [
  { id: 'save-as-png', title: 'Save image as PNG', mimeType: 'image/png', extension: 'png' },
  { id: 'save-as-jpg', title: 'Save image as JPG', mimeType: 'image/jpeg', extension: 'jpg' },
  { id: 'save-as-webp', title: 'Save image as WebP', mimeType: 'image/webp', extension: 'webp' },
]

const defaultQuality = 1
const batchDownloadIds = new Set()
const productName = 'Werbl'
const protocolFallbackName = 'image'
const lastRightClickErrorKey = 'lastRightClickError'

chrome.runtime.onInstalled.addListener(() => {
  void clearStaleZipCache()
  chrome.contextMenus.removeAll(() => {
    for (const item of menuItems) {
      chrome.contextMenus.create({
        id: item.id,
        title: item.title,
        contexts: ['image'],
      })
    }
  })
})

chrome.runtime.onStartup.addListener(() => {
  void clearStaleZipCache()
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const item = menuItems.find((candidate) => candidate.id === info.menuItemId)
  if (item === undefined || info.srcUrl === undefined) {
    return
  }

  void convertAndDownloadImage(info, tab, item).catch((error) => {
    void reportRightClickFailure(item, error)
  })
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'track-batch-download') {
    return false
  }

  if (typeof message.downloadId !== 'number') {
    sendResponse({ ok: false, error: 'downloadId must be a number.' })
    return false
  }

  batchDownloadIds.add(message.downloadId)
  sendResponse({ ok: true })
  return false
})

chrome.downloads.onCreated.addListener((downloadItem) => {
  if (isBatchZipDownload(downloadItem)) {
    batchDownloadIds.add(downloadItem.id)
  }
})

chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state === undefined || !batchDownloadIds.has(delta.id)) {
    return
  }

  if (delta.state.current === 'complete') {
    batchDownloadIds.delete(delta.id)
    void deleteCachedZip()
    return
  }

  if (delta.state.current === 'interrupted') {
    batchDownloadIds.delete(delta.id)
  }
})

async function convertAndDownloadImage(info, tab, item) {
  await clearRightClickFailure()
  const quality = await readSavedQuality()
  const responseContentType = await readContentType(info.srcUrl)
  if (responseContentType !== null && normalizeMimeType(responseContentType) === item.mimeType) {
    await chrome.downloads.download({
      url: info.srcUrl,
      filename: createDownloadName(info.srcUrl, item.extension),
      saveAs: false,
    })
    return
  }

  const response = await convertImageWithFallbacks(info, tab, item, quality)

  if (response.ok !== true) {
    throw new Error(response.error)
  }

  await chrome.downloads.download({
    url: response.dataUrl,
    filename: createDownloadName(info.srcUrl, item.extension),
    saveAs: false,
  })
}

async function reportRightClickFailure(item, error) {
  const rawMessage = getErrorMessage(error)
  const message = createRightClickFailureMessage(item, rawMessage)
  await chrome.storage.session.set({
    [lastRightClickErrorKey]: {
      message,
      rawMessage,
      targetFormat: item.extension.toUpperCase(),
      occurredAt: new Date().toISOString(),
    },
  })
  await chrome.action.setBadgeBackgroundColor({ color: '#B42318' })
  await chrome.action.setBadgeText({ text: '!' })
  console.warn('Werbl right-click conversion failed.', {
    targetFormat: item.extension,
    error: rawMessage,
  })
}

async function clearRightClickFailure() {
  await Promise.all([
    chrome.storage.session.remove(lastRightClickErrorKey),
    chrome.action.setBadgeText({ text: '' }),
  ])
}

function createRightClickFailureMessage(item, rawMessage) {
  if (isLikelyCanvasSecurityFailure(rawMessage)) {
    return `This site blocked browser canvas access, so ${productName} could not save the image as ${item.extension.toUpperCase()}. Download the image first, then convert the local file in the extension window.`
  }

  if (isLikelyNetworkImageFailure(rawMessage)) {
    return `${productName} could not read this image URL for ${item.extension.toUpperCase()} conversion. The site may use protected or expiring image links. Try opening the image in a new tab or downloading it first.`
  }

  return `${productName} could not save this image as ${item.extension.toUpperCase()}: ${rawMessage}`
}

function isLikelyCanvasSecurityFailure(message) {
  const normalizedMessage = message.toLowerCase()
  return normalizedMessage.includes('tainted')
    || normalizedMessage.includes('cross-origin')
    || normalizedMessage.includes('operation is insecure')
    || normalizedMessage.includes('security')
}

function isLikelyNetworkImageFailure(message) {
  const normalizedMessage = message.toLowerCase()
  return normalizedMessage.includes('fetch')
    || normalizedMessage.includes('failed to fetch')
    || normalizedMessage.includes('load failed')
    || normalizedMessage.includes('status ')
}

async function convertImageWithFallbacks(info, tab, item, quality) {
  const offscreenResponse = await convertImageWithOffscreenDocument(info, item, quality)

  if (offscreenResponse.ok === true) {
    return offscreenResponse
  }

  const pageResponse = await convertRenderedImage(info, tab, item, quality)
  if (pageResponse.ok === true) {
    return pageResponse
  }

  return {
    ok: false,
    error: `${offscreenResponse.error}; rendered-page fallback failed: ${pageResponse.error}`,
  }
}

async function convertImageWithOffscreenDocument(info, item, quality) {
  try {
    await ensureOffscreenDocument()
    const response = await chrome.runtime.sendMessage({
      type: 'convert-image',
      srcUrl: info.srcUrl,
      mimeType: item.mimeType,
      quality,
    })

    if (isConversionResponse(response)) {
      return response
    }

    return { ok: false, error: 'Offscreen conversion failed: conversion returned an invalid response.' }
  } catch (error) {
    return { ok: false, error: `Offscreen conversion failed: ${getErrorMessage(error)}` }
  }
}

function isConversionResponse(value) {
  if (typeof value !== 'object' || value === null || typeof value.ok !== 'boolean') {
    return false
  }

  if (value.ok === true) {
    return typeof value.dataUrl === 'string'
  }

  return typeof value.error === 'string'
}

async function convertRenderedImage(info, tab, item, quality) {
  if (tab === undefined || tab.id === undefined) {
    return { ok: false, error: 'No active tab was available for rendered-image fallback.' }
  }

  try {
    const target = { tabId: tab.id }
    if (info.frameId !== undefined) {
      target.frameIds = [info.frameId]
    }

    const results = await chrome.scripting.executeScript({
      target,
      func: convertMatchingRenderedImage,
      args: [info.srcUrl, item.mimeType, quality],
    })

    const result = results[0]?.result
    if (result === undefined) {
      return { ok: false, error: 'Rendered-image fallback returned no result.' }
    }

    return result
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) }
  }
}

async function readSavedQuality() {
  const values = await chrome.storage.sync.get({ quality: defaultQuality })
  if (typeof values.quality !== 'number') {
    return defaultQuality
  }

  return Math.min(Math.max(values.quality, 0.4), 1)
}

async function readContentType(srcUrl) {
  try {
    const response = await fetch(srcUrl, {
      credentials: 'include',
      method: 'HEAD',
    })

    if (!response.ok) {
      return null
    }

    const contentType = response.headers.get('content-type')
    if (contentType === null) {
      return null
    }

    return normalizeMimeType(contentType.split(';')[0].trim())
  } catch {
    return null
  }
}

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL('offscreen.html')
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl],
  })

  if (existingContexts.length > 0) {
    return
  }

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['BLOBS'],
    justification: 'Convert right-clicked images locally with browser image APIs.',
  })
}

function createDownloadName(srcUrl, extension) {
  const baseName = readDownloadBaseName(srcUrl)
  return `${baseName}.${extension}`
}

function readDownloadBaseName(srcUrl) {
  const url = new URL(srcUrl)
  if (url.protocol === 'blob:' || url.protocol === 'data:') {
    return protocolFallbackName
  }

  const pathName = url.pathname.split('/').filter(Boolean).pop()
  const sourceName = pathName === undefined || pathName.length === 0 ? protocolFallbackName : pathName
  const cleanName = sourceName.split('?')[0].split('#')[0]
  const dotIndex = cleanName.lastIndexOf('.')
  const baseName = dotIndex > 0 ? cleanName.slice(0, dotIndex) : cleanName
  return sanitizeFileName(baseName)
}

function sanitizeFileName(baseName) {
  const sanitized = Array.from(baseName)
    .map((character) => isUnsafeFileNameCharacter(character) ? '-' : character)
    .join('')
    .trim()
  return sanitized.length === 0 ? protocolFallbackName : sanitized.slice(0, 120)
}

function isUnsafeFileNameCharacter(character) {
  const codePoint = character.codePointAt(0)
  if (codePoint === undefined) {
    return true
  }

  return codePoint < 32 || '<>:"/\\|?*'.includes(character)
}

function normalizeMimeType(mimeType) {
  const normalized = mimeType.toLowerCase()
  if (normalized === 'image/jpg' || normalized === 'image/pjpeg') {
    return 'image/jpeg'
  }

  return normalized
}

function isBatchZipDownload(downloadItem) {
  if (downloadItem.byExtensionId !== chrome.runtime.id) {
    return false
  }

  const normalizedName = downloadItem.filename.replaceAll('\\', '/').toLowerCase()
  const baseName = normalizedName.split('/').pop()
  return baseName !== undefined && baseName.startsWith('converted-') && baseName.endsWith('.zip')
}

function convertMatchingRenderedImage(srcUrl, mimeType, quality) {
  function normalizeComparableUrl(value) {
    try {
      const url = new URL(value, document.baseURI)
      url.hash = ''
      return url.toString()
    } catch {
      return value
    }
  }

  function findMatchingImage(targetSrcUrl) {
    const candidates = Array.from(document.images)
    const exactMatch = candidates.find((image) => image.currentSrc === targetSrcUrl || image.src === targetSrcUrl)
    if (exactMatch !== undefined) {
      return exactMatch
    }

    const normalizedTarget = normalizeComparableUrl(targetSrcUrl)
    const normalizedMatch = candidates.find((image) => {
      return normalizeComparableUrl(image.currentSrc) === normalizedTarget
        || normalizeComparableUrl(image.src) === normalizedTarget
    })

    return normalizedMatch === undefined ? null : normalizedMatch
  }

  function getRenderedFallbackError(error) {
    if (error instanceof Error) {
      return error.message
    }

    return 'Rendered-image fallback failed.'
  }

  const image = findMatchingImage(srcUrl)
  if (image === null) {
    return { ok: false, error: `Could not find rendered image for ${srcUrl}` }
  }

  if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
    return { ok: false, error: `Rendered image is not fully loaded for ${srcUrl}` }
  }

  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight

  const context = canvas.getContext('2d')
  if (context === null) {
    return { ok: false, error: 'Canvas rendering context was unavailable in page fallback.' }
  }

  if (mimeType === 'image/jpeg') {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  try {
    context.drawImage(image, 0, 0)
    const dataUrl = canvas.toDataURL(mimeType, quality)
    if (dataUrl.startsWith('data:image/png') && mimeType !== 'image/png') {
      return { ok: false, error: `Browser did not support encoded output type ${mimeType}` }
    }

    return { ok: true, dataUrl }
  } catch (error) {
    return { ok: false, error: getRenderedFallbackError(error) }
  }
}

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Image conversion failed.'
}

async function clearStaleZipCache() {
  await Promise.all([
    deleteCachedZip(),
    chrome.storage.session.remove('cachedZip'),
  ])
}

async function deleteCachedZip() {
  const database = await openCacheDatabase()
  await runCacheTransaction(database, 'readwrite', (store) => {
    store.delete('latest')
  })
}

function openCacheDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('werbl-cache', 1)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('zip-cache', { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
  })
}

function runCacheTransaction(database, mode, run) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('zip-cache', mode)
    const store = transaction.objectStore('zip-cache')
    transaction.onerror = () => reject(transaction.error)
    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onabort = () => {
      database.close()
      reject(transaction.error)
    }
    run(store)
  })
}
