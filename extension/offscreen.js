chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'convert-image') {
    return false
  }

  convertImage(message)
    .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
    .catch((error) => sendResponse({ ok: false, error: getErrorMessage(error) }))

  return true
})

async function convertImage(message) {
  const response = await fetch(message.srcUrl, { credentials: 'include' })
  if (!response.ok) {
    throw new Error(`Image fetch failed with status ${response.status} for ${message.srcUrl}`)
  }

  const blob = await response.blob()
  if (blob.type === message.mimeType) {
    return readBlobAsDataUrl(blob)
  }

  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height

  const context = canvas.getContext('2d')
  if (context === null) {
    bitmap.close()
    throw new Error('Canvas rendering context was unavailable.')
  }

  if (message.mimeType === 'image/jpeg') {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  context.drawImage(bitmap, 0, 0)
  bitmap.close()

  const outputBlob = await createCanvasBlob(canvas, message.mimeType, message.quality)
  return readBlobAsDataUrl(outputBlob)
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

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Image conversion failed.'
}
