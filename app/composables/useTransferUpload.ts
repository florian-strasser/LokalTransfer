export type QueuedFileStatus = 'pending' | 'uploading' | 'done' | 'error'

export interface QueuedFile {
  /** Client-side identity. `File` objects have no id and names aren't unique. */
  id: string
  file: File
  status: QueuedFileStatus
  /** 0–100, from the browser's upload progress events. */
  progress: number
  error: string | null
}

export type UploadState = 'idle' | 'creating' | 'uploading' | 'sending' | 'done' | 'error'

export interface SubmitPayload {
  subject?: string | null
  message?: string | null
  /** Free-text addresses. Members only. */
  recipients?: string[]
  /** Chosen team members. Guests only. */
  recipientUserIds?: string[]
  /** Days, or 0 for unlimited. Ignored for guests, who get the instance default. */
  retentionDays?: number
  /** Optional share password. Empty or omitted means the link alone is enough. */
  password?: string | null
  /** How the download page presents the files. */
  layout?: 'list' | 'gallery'
  /**
   * Optional per-transfer background image, overriding the instance default.
   * Uploaded separately after the draft exists, since it needs a transfer id.
   */
  background?: File | null
}

export interface TransferResult {
  id: number
  token: string
  downloadUrl: string
  expiresAt: string | null
  recipientCount: number
}

/**
 * Drives the whole send: create the draft, upload each file, then send.
 *
 * Files go up one request each rather than in a single multipart body. That is
 * what makes real per-file progress possible, keeps one failure from costing the
 * whole upload, and lets the server enforce the size limit mid-stream instead of
 * after everything has already arrived.
 *
 * Uploads run sequentially. For the large files this app exists to move,
 * parallelism doesn't add throughput on a single connection — it just splits the
 * same bandwidth, making every file finish late instead of one at a time, and
 * makes the progress display meaningless.
 */
export function useTransferUpload() {
  const { t } = useI18n()
  const { errorCode } = useApiError()
  const config = useRuntimeConfig().public

  const maxFileSize = (Number(config.maxFileSizeMb) || 2048) * 1024 * 1024
  const maxFiles = Number(config.maxFilesPerTransfer) || 50

  const files = ref<QueuedFile[]>([])
  const state = ref<UploadState>('idle')
  const errorMessage = ref<string | null>(null)
  const result = ref<TransferResult | null>(null)

  const totalSize = computed(() => files.value.reduce((sum, item) => sum + item.file.size, 0))
  const uploadedCount = computed(() => files.value.filter(item => item.status === 'done').length)

  /**
   * Overall progress weighted by file size, so a 2 GB video doesn't advance the
   * bar by the same amount as a 4 KB text file.
   */
  const overallProgress = computed(() => {
    if (totalSize.value === 0) return 0
    const done = files.value.reduce(
      (sum, item) => sum + item.file.size * (item.progress / 100),
      0
    )
    return Math.min(100, Math.round((done / totalSize.value) * 100))
  })

  const isBusy = computed(() =>
    state.value === 'creating' || state.value === 'uploading' || state.value === 'sending')

  function addFiles(incoming: FileList | File[]) {
    errorMessage.value = null
    const list = Array.from(incoming)

    for (const file of list) {
      if (files.value.length >= maxFiles) {
        errorMessage.value = t('compose.errors.TOO_MANY_FILES', { count: maxFiles })
        break
      }

      // Rejected here rather than at upload time so the person finds out while
      // choosing files, not after waiting through the rest of the queue.
      if (file.size > maxFileSize) {
        errorMessage.value = t('compose.errors.FILE_TOO_LARGE', {
          filename: file.name,
          size: `${config.maxFileSizeMb} MB`
        })
        continue
      }

      // Same name *and* size *and* modified time: as close to "the same file
      // picked twice" as the browser lets us get. Deliberately conservative —
      // two genuinely different files would have to match on all three.
      const duplicate = files.value.some(
        item =>
          item.file.name === file.name
          && item.file.size === file.size
          && item.file.lastModified === file.lastModified
      )
      if (duplicate) continue

      files.value.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        file,
        status: 'pending',
        progress: 0,
        error: null
      })
    }
  }

  function removeFile(id: string) {
    files.value = files.value.filter(item => item.id !== id)
  }

  function reset() {
    files.value = []
    state.value = 'idle'
    errorMessage.value = null
    result.value = null
  }

  /**
   * Upload one file.
   *
   * XMLHttpRequest rather than fetch: fetch still has no upload progress event in
   * any shipping browser, and a file transfer tool without a progress bar during
   * a multi-gigabyte upload is not usable.
   */
  function uploadFile(transferId: number, item: QueuedFile): Promise<void> {
    return new Promise((resolve, reject) => {
      const formData = new FormData()
      // Sent explicitly as well as in the part header: some clients mangle
      // non-ASCII filenames in the multipart header, and the server prefers this.
      formData.append('filename', item.file.name)
      formData.append('file', item.file)

      const xhr = new XMLHttpRequest()
      xhr.open('POST', `/api/transfers/${transferId}/files`)
      xhr.withCredentials = true

      xhr.upload.addEventListener('progress', (progressEvent) => {
        if (!progressEvent.lengthComputable) return
        item.progress = Math.round((progressEvent.loaded / progressEvent.total) * 100)
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          item.progress = 100
          item.status = 'done'
          resolve()
          return
        }

        // The server's error code is mapped to a translated message; anything
        // unrecognised falls back to a generic upload failure.
        let code = 'UPLOAD_FAILED'
        try {
          code = JSON.parse(xhr.responseText)?.error || code
        } catch {
          // Not JSON — a proxy error page, most likely. Keep the fallback.
        }

        item.status = 'error'
        item.error = t(`compose.errors.${code}`, {
          filename: item.file.name,
          size: `${config.maxFileSizeMb} MB`,
          count: maxFiles
        })
        reject(new Error(code))
      })

      xhr.addEventListener('error', () => {
        item.status = 'error'
        item.error = t('compose.errors.UPLOAD_FAILED', { filename: item.file.name })
        reject(new Error('NETWORK_ERROR'))
      })

      xhr.addEventListener('abort', () => reject(new Error('ABORTED')))

      item.status = 'uploading'
      xhr.send(formData)
    })
  }

  async function submit(payload: SubmitPayload): Promise<TransferResult | null> {
    errorMessage.value = null

    if (files.value.length === 0) {
      errorMessage.value = t('compose.errors.NO_FILES')
      return null
    }

    try {
      state.value = 'creating'

      // The background is a file, not JSON, so it is kept out of the create body
      // and uploaded against the draft below.
      const { background, ...meta } = payload

      const created = await $fetch<{ data: { id: number, token: string } }>('/api/transfers', {
        method: 'POST',
        body: meta
      })
      const transferId = created.data.id

      if (background) {
        const form = new FormData()
        form.append('background', background)
        // Not fatal: a transfer that sends without its decoration is far better
        // than losing an upload over a background image.
        await $fetch(`/api/transfers/${transferId}/background`, {
          method: 'POST',
          body: form
        }).catch(() => {})
      }

      state.value = 'uploading'
      for (const item of files.value) {
        // Skip anything already uploaded, so retrying after a mid-queue failure
        // doesn't send the earlier files a second time.
        if (item.status === 'done') continue
        await uploadFile(transferId, item)
      }

      state.value = 'sending'
      const sent = await $fetch<{
        data: {
          token: string
          downloadUrl: string
          expiresAt: string | null
          recipientCount: number
        }
      }>(`/api/transfers/${transferId}/send`, { method: 'POST' })

      result.value = {
        id: transferId,
        token: sent.data.token,
        downloadUrl: sent.data.downloadUrl,
        expiresAt: sent.data.expiresAt,
        recipientCount: sent.data.recipientCount
      }
      state.value = 'done'
      return result.value
    } catch (error) {
      state.value = 'error'

      // A per-file error already has its message on the file row; showing it
      // again at the top would just be noise.
      const failedFile = files.value.find(item => item.status === 'error')
      if (!failedFile) {
        const code = errorCode(error) || (error instanceof Error ? error.message : '')
        const translated = t(`compose.errors.${code}`)
        // `t` echoes the key back when there's no translation for it.
        errorMessage.value = translated.startsWith('compose.errors.')
          ? t('common.unknownError')
          : translated
      }

      return null
    }
  }

  return {
    files,
    state,
    errorMessage,
    result,
    totalSize,
    uploadedCount,
    overallProgress,
    isBusy,
    maxFiles,
    maxFileSize,
    addFiles,
    removeFile,
    reset,
    submit
  }
}
