import { useMemo, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import './App.css'

type OutputFormat = 'image/png' | 'image/jpeg' | 'image/webp'

type PresetId = 'original' | 'discord' | 'shopify' | 'thumbnail'

type ImageJobStatus = 'queued' | 'ready' | 'converted' | 'failed'

type ImageJob = {
  id: string
  file: File
  name: string
  originalBytes: number
  width: number | null
  height: number | null
  status: ImageJobStatus
  error: string | null
  outputUrl: string | null
  outputName: string | null
  outputBytes: number | null
}

type ExportSettings = {
  format: OutputFormat
  quality: number
  presetId: PresetId
  stripTransparency: boolean
}

type Preset = {
  id: PresetId
  label: string
  maxWidth: number | null
  maxHeight: number | null
}

type ConversionTarget = {
  width: number
  height: number
}

const presets: Preset[] = [
  { id: 'original', label: 'Original', maxWidth: null, maxHeight: null },
  { id: 'discord', label: 'Discord', maxWidth: 4096, maxHeight: 4096 },
  { id: 'shopify', label: 'Shopify', maxWidth: 2048, maxHeight: 2048 },
  { id: 'thumbnail', label: 'Thumbnail', maxWidth: 1280, maxHeight: 720 },
]

const formatOptions: { label: string; value: OutputFormat }[] = [
  { label: 'PNG', value: 'image/png' },
  { label: 'JPG', value: 'image/jpeg' },
  { label: 'WebP', value: 'image/webp' },
]

const initialSettings: ExportSettings = {
  format: 'image/png',
  quality: 1,
  presetId: 'original',
  stripTransparency: false,
}

const productName = 'Werbl'
const bugReportEmail = 'Bugs4Werbl@gmail.com'
const customSolutionEmail = 'alezworks.dev@gmail.com'

function App() {
  const [jobs, setJobs] = useState<ImageJob[]>([])
  const [settings, setSettings] = useState<ExportSettings>(initialSettings)
  const [isDragging, setIsDragging] = useState(false)
  const [isConverting, setIsConverting] = useState(false)

  const readyCount = useMemo<number>(
    () => jobs.filter((job: ImageJob) => job.status === 'ready').length,
    [jobs],
  )

  const convertedCount = useMemo<number>(
    () => jobs.filter((job: ImageJob) => job.status === 'converted').length,
    [jobs],
  )

  const liveStatus = useMemo<string>(() => {
    if (jobs.length === 0) {
      return 'No files loaded.'
    }

    if (isConverting) {
      return `Converting ${readyCount + convertedCount} files.`
    }

    return `${jobs.length} files loaded. ${readyCount} ready. ${convertedCount} converted.`
  }, [convertedCount, isConverting, jobs.length, readyCount])

  function handleFiles(selectedFiles: FileList): void {
    const imageFiles: File[] = Array.from(selectedFiles).filter((file: File) =>
      file.type.startsWith('image/'),
    )

    if (imageFiles.length === 0) {
      return
    }

    const nextJobs: ImageJob[] = imageFiles.map((file: File) => ({
      id: createJobId(file),
      file,
      name: file.name,
      originalBytes: file.size,
      width: null,
      height: null,
      status: 'queued',
      error: null,
      outputUrl: null,
      outputName: null,
      outputBytes: null,
    }))

    setJobs((currentJobs: ImageJob[]) => [...currentJobs, ...nextJobs])
    void hydrateImageSizes(nextJobs)
  }

  async function hydrateImageSizes(nextJobs: ImageJob[]): Promise<void> {
    const hydratedJobs: ImageJob[] = await Promise.all(
      nextJobs.map(async (job: ImageJob): Promise<ImageJob> => {
        try {
          const bitmap: ImageBitmap = await createImageBitmap(job.file)
          const width: number = bitmap.width
          const height: number = bitmap.height
          bitmap.close()
          return { ...job, width, height, status: 'ready' }
        } catch (error) {
          return {
            ...job,
            status: 'failed',
            error: getErrorMessage(error),
          }
        }
      }),
    )

    setJobs((currentJobs: ImageJob[]) =>
      currentJobs.map((job: ImageJob) => {
        const hydratedJob: ImageJob | undefined = hydratedJobs.find(
          (candidate: ImageJob) => candidate.id === job.id,
        )

        if (hydratedJob === undefined) {
          return job
        }

        return hydratedJob
      }),
    )
  }

  async function convertReadyJobs(): Promise<void> {
    const jobsToConvert: ImageJob[] = jobs.filter(
      (job: ImageJob) => job.status === 'ready' || job.status === 'converted',
    )

    if (jobsToConvert.length === 0) {
      return
    }

    setIsConverting(true)

    const convertedJobs: ImageJob[] = []

    for (const job of jobsToConvert) {
      if (job.outputUrl !== null) {
        URL.revokeObjectURL(job.outputUrl)
      }

      try {
        const convertedJob: ImageJob = await convertImageJob(job, settings)
        convertedJobs.push(convertedJob)
      } catch (error) {
        convertedJobs.push({
          ...job,
          status: 'failed',
          error: getErrorMessage(error),
          outputUrl: null,
          outputName: null,
          outputBytes: null,
        })
      }
    }

    setJobs((currentJobs: ImageJob[]) =>
      currentJobs.map((job: ImageJob) => {
        const convertedJob: ImageJob | undefined = convertedJobs.find(
          (candidate: ImageJob) => candidate.id === job.id,
        )

        if (convertedJob === undefined) {
          return job
        }

        return convertedJob
      }),
    )

    setIsConverting(false)
  }

  function clearJobs(): void {
    jobs.forEach((job: ImageJob) => {
      if (job.outputUrl !== null) {
        URL.revokeObjectURL(job.outputUrl)
      }
    })
    setJobs([])
  }

  function updateFormat(event: ChangeEvent<HTMLSelectElement>): void {
    const format: OutputFormat = parseOutputFormat(event.target.value)
    setSettings((currentSettings: ExportSettings) => ({
      ...currentSettings,
      format,
      stripTransparency:
        format === 'image/jpeg' ? true : currentSettings.stripTransparency,
    }))
  }

  function updatePreset(event: ChangeEvent<HTMLSelectElement>): void {
    const presetId: PresetId = parsePresetId(event.target.value)
    setSettings((currentSettings: ExportSettings) => ({
      ...currentSettings,
      presetId,
    }))
  }

  function updateQuality(event: ChangeEvent<HTMLInputElement>): void {
    const quality: number = Number(event.target.value) / 100
    setSettings((currentSettings: ExportSettings) => ({
      ...currentSettings,
      quality,
    }))
  }

  function updateTransparency(event: ChangeEvent<HTMLInputElement>): void {
    setSettings((currentSettings: ExportSettings) => ({
      ...currentSettings,
      stripTransparency: event.target.checked,
    }))
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>): void {
    event.preventDefault()
    setIsDragging(false)
    handleFiles(event.dataTransfer.files)
  }

  return (
    <main className="app-shell">
      <section className="workspace" aria-label="Image conversion workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{productName}</p>
            <h1>Local image conversion workspace</h1>
          </div>
          <nav className="contact-links" aria-label="Contact">
            <a className="service-link" href={createBugReportGmailUrl()} rel="noopener" target="_blank">
              Report bug
            </a>
            <a className="service-link" href={createCustomSolutionGmailUrl()} rel="noopener" target="_blank">
              Custom solution
            </a>
          </nav>
        </header>
        <p className="sr-only" role="status" aria-atomic="true" aria-live="polite">
          {liveStatus}
        </p>

        <div className="tool-grid">
          <section className="drop-panel" aria-label="Import images">
            <label
              className={isDragging ? 'drop-zone is-dragging' : 'drop-zone'}
              onDragOver={(event: DragEvent<HTMLLabelElement>) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input
                accept="image/*"
                aria-describedby="webDropMeta"
                aria-labelledby="webDropTitle"
                multiple
                type="file"
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  if (event.target.files !== null) {
                    handleFiles(event.target.files)
                  }
                }}
              />
              <span className="drop-icon" aria-hidden="true">
                +
              </span>
              <span className="drop-title" id="webDropTitle">Drop images</span>
              <span className="drop-meta" id="webDropMeta">WebP, PNG, JPG, GIF, AVIF</span>
            </label>

            <div className="stats-row" aria-label="Batch status">
              <Metric label="Files" value={jobs.length.toString()} />
              <Metric label="Ready" value={readyCount.toString()} />
              <Metric label="Done" value={convertedCount.toString()} />
            </div>
          </section>

          <section className="settings-panel" aria-label="Export settings">
            <div className="control-group">
              <label htmlFor="format">Format</label>
              <select id="format" value={settings.format} onChange={updateFormat}>
                {formatOptions.map((option: { label: string; value: OutputFormat }) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="control-group">
              <label htmlFor="preset">Preset</label>
              <select id="preset" value={settings.presetId} onChange={updatePreset}>
                {presets.map((preset: Preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="control-group">
              <label htmlFor="quality">JPG/WebP quality {Math.round(settings.quality * 100)}</label>
              <input
                id="quality"
                max="100"
                min="40"
                type="range"
                value={Math.round(settings.quality * 100)}
                onChange={updateQuality}
              />
            </div>

            <label className="toggle-row">
              <input
                checked={settings.stripTransparency}
                disabled={settings.format === 'image/jpeg'}
                type="checkbox"
                onChange={updateTransparency}
              />
              <span>Flatten transparency</span>
            </label>

            <div className="action-row">
              <button
                className="primary-button"
                disabled={isConverting || readyCount + convertedCount === 0}
                type="button"
                onClick={() => void convertReadyJobs()}
              >
                {isConverting ? 'Converting' : 'Convert batch'}
              </button>
              <button
                className="ghost-button"
                disabled={jobs.length === 0}
                type="button"
                onClick={clearJobs}
              >
                Clear
              </button>
            </div>
          </section>
        </div>

        <section className="queue-panel" aria-label="Image queue">
          {jobs.length === 0 ? (
            <div className="empty-state">
              <p>No files loaded.</p>
            </div>
          ) : (
            <div className="job-list">
              {jobs.map((job: ImageJob) => (
                <ImageJobRow key={job.id} job={job} />
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  )
}

function Metric(props: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  )
}

function createBugReportGmailUrl(): string {
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
      `Browser: ${navigator.userAgent}`,
      'Source site or file type:',
      'Target format:',
    ].join('\n'),
  )
}

function createCustomSolutionGmailUrl(): string {
  return createGmailComposeUrl(
    customSolutionEmail,
    `${productName} custom solution inquiry`,
    [
      'What workflow should this solve?',
      '',
      'Business/team type:',
      'Current tools or platforms:',
      'Input file types:',
      'Output requirements:',
      'Timeline:',
      'Must work without outside vendors or outsourced services: yes/no',
    ].join('\n'),
  )
}

function createGmailComposeUrl(email: string, subject: string, body: string): string {
  const params: URLSearchParams = new URLSearchParams({
    body,
    fs: '1',
    su: subject,
    to: email,
    view: 'cm',
  })
  return `https://mail.google.com/mail/?${params.toString()}`
}

function ImageJobRow(props: { job: ImageJob }) {
  const dimensions: string =
    props.job.width === null || props.job.height === null
      ? 'Reading'
      : `${props.job.width} x ${props.job.height}`

  return (
    <article className="job-row">
      <div className="job-main">
        <strong>{props.job.name}</strong>
        <span>
          {dimensions} - {formatBytes(props.job.originalBytes)}
        </span>
        {props.job.error !== null ? <em>{props.job.error}</em> : null}
      </div>
      <div className="job-status">
        <span className={`status-pill status-${props.job.status}`}>{props.job.status}</span>
        {props.job.outputUrl !== null && props.job.outputName !== null ? (
          <button
            className="download-button"
            type="button"
            onClick={() => downloadImageJob(props.job)}
          >
            Download
          </button>
        ) : null}
        {props.job.outputBytes !== null ? <span>{formatBytes(props.job.outputBytes)}</span> : null}
      </div>
    </article>
  )
}

function downloadImageJob(job: ImageJob): void {
  if (job.outputUrl === null || job.outputName === null) {
    throw new Error(`Converted download is missing for image: ${job.name}`)
  }

  downloadConvertedFile(job.outputUrl, job.outputName)
}

function downloadConvertedFile(outputUrl: string, outputName: string): void {
  const link: HTMLAnchorElement = document.createElement('a')
  link.href = outputUrl
  link.download = outputName
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
}

async function convertImageJob(job: ImageJob, settings: ExportSettings): Promise<ImageJob> {
  const bitmap: ImageBitmap = await createImageBitmap(job.file)
  const target: ConversionTarget = calculateTargetSize(bitmap.width, bitmap.height, settings.presetId)
  const canvas: HTMLCanvasElement = document.createElement('canvas')
  canvas.width = target.width
  canvas.height = target.height

  const context: CanvasRenderingContext2D | null = canvas.getContext('2d')
  if (context === null) {
    bitmap.close()
    throw new Error('Canvas rendering context was unavailable.')
  }

  if (settings.format === 'image/jpeg' || settings.stripTransparency) {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, target.width, target.height)
  }

  context.drawImage(bitmap, 0, 0, target.width, target.height)
  bitmap.close()

  const blob: Blob = await createCanvasBlob(canvas, settings)
  const outputUrl: string = URL.createObjectURL(blob)
  const outputName: string = createOutputName(job.name, settings.format)

  return {
    ...job,
    width: target.width,
    height: target.height,
    status: 'converted',
    error: null,
    outputUrl,
    outputName,
    outputBytes: blob.size,
  }
}

function calculateTargetSize(width: number, height: number, presetId: PresetId): ConversionTarget {
  const preset: Preset | undefined = presets.find((candidate: Preset) => candidate.id === presetId)
  if (preset === undefined) {
    throw new Error(`Unsupported preset: ${presetId}`)
  }

  if (preset.maxWidth === null || preset.maxHeight === null) {
    return { width, height }
  }

  const ratio: number = Math.min(preset.maxWidth / width, preset.maxHeight / height, 1)
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}

function createCanvasBlob(canvas: HTMLCanvasElement, settings: ExportSettings): Promise<Blob> {
  return new Promise<Blob>((resolve: (blob: Blob) => void, reject: (reason: Error) => void) => {
    canvas.toBlob(
      (blob: Blob | null) => {
        if (blob === null) {
          reject(new Error(`Browser could not encode output format: ${settings.format}`))
          return
        }

        resolve(blob)
      },
      settings.format,
      settings.quality,
    )
  })
}

function createOutputName(fileName: string, format: OutputFormat): string {
  const dotIndex: number = fileName.lastIndexOf('.')
  const baseName: string = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
  return `${baseName}.${getExtension(format)}`
}

function getExtension(format: OutputFormat): string {
  if (format === 'image/png') {
    return 'png'
  }

  if (format === 'image/jpeg') {
    return 'jpg'
  }

  return 'webp'
}

function parseOutputFormat(value: string): OutputFormat {
  const match: { label: string; value: OutputFormat } | undefined = formatOptions.find(
    (option: { label: string; value: OutputFormat }) => option.value === value,
  )

  if (match === undefined) {
    throw new Error(`Unsupported output format: ${value}`)
  }

  return match.value
}

function parsePresetId(value: string): PresetId {
  const match: Preset | undefined = presets.find((preset: Preset) => preset.id === value)

  if (match === undefined) {
    throw new Error(`Unsupported preset: ${value}`)
  }

  return match.id
}

function createJobId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Image conversion failed.'
}

export default App
