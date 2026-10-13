export type QueuedFileStatus = 'pending' | 'uploading' | 'done' | 'error'

export interface QueuedFile {
  /** Client-side identity. `File` objects have no id and names aren't unique. */
  id: string
  file: File
  status: QueuedFileStatus
  /** 0–100, from the browser's upload progress events. */
  progress: number
  error: string | null
  /**
   * The server-side upload this file is going into, once it has one. Kept when
   * an attempt fails, so the next one carries on from the bytes that arrived
   * rather than from the start of the file.
   */
  uploadId: string | null
  /** True while the connection has dropped and the upload is waiting to carry on. */
  resuming: boolean
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
   * Optional per-transfer background image, replacing the member's default and
   * the instance's. Uploaded separately after the draft exists, since it needs a
   * transfer id.
   */
  background?: File | null
  /**
   * Whether the member's default background from their account settings goes on
   * the transfer. On unless they removed it in the composer; a `background`
   * above replaces it either way, so a failed upload of that one still leaves
   * the default rather than nothing.
   */
  useDefaultBackground?: boolean
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
 * Each file goes up on its own, and in pieces: a series of requests that each
 * append to what the server already has. A connection that drops costs one
 * piece rather than the file — it is retried by itself, from the last byte that
 * reached the disk — and pressing Send again after a failure carries on too,
 * instead of starting a three-gigabyte upload over.
 *
 * Uploads run sequentially. For the large files this app exists to move,
 * parallelism doesn't add throughput on a single connection — it just splits the
 * same bandwidth, making every file finish late instead of one at a time, and
 * makes the progress display meaningless.
 */
export function useTransferUpload() {
  const { t, te } = useI18n()
  const { errorCode } = useApiError()
  const settings = useSettings()

  const maxFileSize = settings.value.maxFileSizeMb * 1024 * 1024
  const maxFiles = settings.value.maxFilesPerTransfer

  const files = ref<QueuedFile[]>([])
  const state = ref<UploadState>('idle')
  const errorMessage = ref<string | null>(null)
  const result = ref<TransferResult | null>(null)

  /**
   * The draft a failed attempt left on the server, so that a retry carries on
   * with it.
   *
   * A retry used to create a fresh draft every time while still skipping the
   * files that had already uploaded — to the *previous* draft. The second
   * attempt then "succeeded" with only the files that had failed the first time,
   * and the recipient got an incomplete transfer nobody had been told about.
   *
   * `meta` is what the draft was created with and `uploaded` which queued files
   * it holds. A draft cannot be edited and a file cannot be taken back out of
   * one, so a retry may only continue it while both are still true of the form;
   * otherwise the draft is thrown away and everything goes up again.
   */
  let draft: { id: number, meta: string, uploaded: Set<string> } | null = null
  /** Set when the server turned out not to have the draft any more. */
  let draftLost = false

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
          size: `${settings.value.maxFileSizeMb} MB`
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
        error: null,
        uploadId: null,
        resuming: false
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
    draft = null
    draftLost = false
  }

  /** Give up on the draft of a failed attempt: nothing it holds is reused. */
  async function discardDraft() {
    if (!draft) return
    const { id } = draft
    draft = null
    for (const item of files.value) {
      item.status = 'pending'
      item.progress = 0
      item.error = null
      // Its uploads went with the draft.
      item.uploadId = null
      item.resuming = false
    }
    // Best effort. A draft that survives this is swept with the other abandoned
    // ones; what matters is that nothing is uploaded into it any more.
    await $fetch(`/api/transfers/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  // The piece size comes from the server with the first upload; this is only
  // what is assumed until then.
  let chunkSize = 16 * 1024 * 1024

  // How long to wait before each new try once a piece has failed: about a
  // minute in all. Long enough to ride out a router restarting or a laptop
  // changing networks; short enough that a server that is really gone is
  // reported while the person is still looking. The count starts again whenever
  // a piece gets through, so it is a budget per interruption, not per file.
  const RETRY_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000]

  const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

  /** A translated message for a server error code, or the generic one. */
  function uploadError(code: string, item: QueuedFile): string {
    const key = te(`compose.errors.${code}`) ? `compose.errors.${code}` : 'compose.errors.UPLOAD_FAILED'
    return t(key, {
      filename: item.file.name,
      size: `${settings.value.maxFileSizeMb} MB`,
      count: maxFiles
    })
  }

  type PieceResult
    = { kind: 'accepted' | 'corrected', offset: number, complete: boolean }
      | { kind: 'retry' }
      | { kind: 'failed', code: string }

  /**
   * Send one piece of a file, at `offset`.
   *
   * XMLHttpRequest rather than fetch: fetch still has no upload progress event in
   * any shipping browser, and a file transfer tool without a progress bar during
   * a multi-gigabyte upload is not usable.
   */
  function sendPiece(transferId: number, item: QueuedFile, offset: number, piece: Blob): Promise<PieceResult> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PATCH', `/api/transfers/${transferId}/uploads/${item.uploadId}`)
      xhr.withCredentials = true
      xhr.setRequestHeader('Upload-Offset', String(offset))
      xhr.setRequestHeader('Content-Type', 'application/octet-stream')

      xhr.upload.addEventListener('progress', (progressEvent) => {
        if (!progressEvent.lengthComputable) return
        item.progress = Math.round(((offset + progressEvent.loaded) / item.file.size) * 100)
      })

      xhr.addEventListener('load', () => {
        let body: { data?: { offset: number, complete: boolean }, error?: string, offset?: number, complete?: boolean } = {}
        try {
          body = JSON.parse(xhr.responseText)
        } catch {
          // Not JSON — a proxy error page, most likely.
        }

        if (xhr.status >= 200 && xhr.status < 300 && body.data) {
          resolve({ kind: 'accepted', offset: body.data.offset, complete: body.data.complete })
          return
        }

        // The server has more, or less, of the file than was assumed, and says
        // where it really ends. Not a failure: just where to carry on from.
        if (xhr.status === 409 && body.error === 'OFFSET_MISMATCH' && typeof body.offset === 'number') {
          resolve({ kind: 'corrected', offset: body.offset, complete: Boolean(body.complete) })
          return
        }

        // Still finishing with the request that just died, or a server or proxy
        // that is briefly unwell: worth another try.
        const temporary = (xhr.status === 409 && body.error === 'UPLOAD_BUSY')
          || xhr.status === 408 || xhr.status === 429 || xhr.status >= 500
        resolve(temporary ? { kind: 'retry' } : { kind: 'failed', code: body.error || 'UPLOAD_FAILED' })
      })

      // No response at all: the connection dropped.
      xhr.addEventListener('error', () => resolve({ kind: 'retry' }))
      xhr.addEventListener('abort', () => resolve({ kind: 'retry' }))

      xhr.send(piece)
    })
  }

  /** Ask the server how much of an upload it has. Null when it cannot be reached. */
  async function askOffset(transferId: number, item: QueuedFile) {
    try {
      const status = await $fetch<{ data: { offset: number, complete: boolean } }>(
        `/api/transfers/${transferId}/uploads/${item.uploadId}`
      )
      return { known: true as const, offset: status.data.offset, complete: status.data.complete }
    } catch (error) {
      // An upload the server has no record of cannot be carried on with.
      if (errorCode(error) === 'NOT_FOUND') return { known: false as const, gone: true }
      return { known: false as const, gone: false }
    }
  }

  /**
   * Whether the browser can still read the file. A file that was renamed, moved
   * or changed after it was picked cannot be, and no amount of retrying will
   * change that — so this is asked before waiting, to say so at once instead of
   * reporting a connection problem that is not one.
   */
  async function isReadable(file: File, offset: number): Promise<boolean> {
    if (offset >= file.size) return true
    try {
      // One byte from where the upload has got to: the part that is still needed.
      await file.slice(offset, offset + 1).arrayBuffer()
      return true
    } catch {
      return false
    }
  }

  /** Upload one file, in pieces, carrying on from wherever it had got to. */
  async function uploadFile(transferId: number, item: QueuedFile): Promise<void> {
    item.status = 'uploading'
    item.error = null
    item.resuming = false

    const fail = (code: string) => {
      item.status = 'error'
      item.resuming = false
      item.error = uploadError(code, item)
      return new Error(code)
    }

    const size = item.file.size
    let offset = 0
    let complete = false

    // Either a file from a failed attempt, which is asked after, or a new one,
    // which is announced. `problem` rather than a throw from inside the `try`:
    // a refusal by the server and an unreachable server end the same way.
    let problem: string | null = null
    try {
      if (item.uploadId) {
        const status = await askOffset(transferId, item)
        if (status.known) {
          offset = status.offset
          complete = status.complete
        } else if (status.gone) {
          item.uploadId = null
        } else {
          problem = 'UPLOAD_FAILED'
        }
      }

      if (!problem && !item.uploadId) {
        const created = await $fetch<{
          data: { id: string, offset: number, chunkSize: number, complete: boolean }
        }>(`/api/transfers/${transferId}/uploads`, {
          method: 'POST',
          body: { filename: item.file.name, size, mimeType: item.file.type || undefined }
        })
        item.uploadId = created.data.id
        chunkSize = created.data.chunkSize || chunkSize
        offset = created.data.offset
        complete = created.data.complete
      }
    } catch (error) {
      problem = errorCode(error) || 'UPLOAD_FAILED'
    }
    if (problem) throw fail(problem)

    let failures = 0
    while (!complete) {
      item.progress = size ? Math.round((offset / size) * 100) : 100

      const result = await sendPiece(transferId, item, offset, item.file.slice(offset, offset + chunkSize))

      if (result.kind === 'failed') throw fail(result.code)

      if (result.kind === 'accepted' || (result.kind === 'corrected' && result.offset !== offset)) {
        if (result.kind === 'accepted') failures = 0
        offset = result.offset
        complete = result.complete
        item.resuming = false
        continue
      }

      // A dropped connection, or a server that asked for patience.
      if (!(await isReadable(item.file, offset))) throw fail('FILE_UNREADABLE')
      if (failures >= RETRY_DELAYS.length) throw fail('UPLOAD_FAILED')

      item.resuming = true
      await wait(RETRY_DELAYS[failures++]!)

      // The piece that failed may have arrived in part, in full, or not at all.
      // Only the server knows; if it cannot be asked, the next try finds out.
      const status = await askOffset(transferId, item)
      if (status.known) {
        offset = status.offset
        complete = status.complete
      } else if (status.gone) {
        throw fail('UPLOAD_FAILED')
      }
    }

    item.progress = 100
    item.resuming = false
    item.status = 'done'
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

      // Everything the draft was created from, as one comparable string.
      const metaKey = JSON.stringify(meta)
        + (background ? `|${background.name}:${background.size}:${background.lastModified}` : '')

      // A draft from a failed attempt is only continued if it is still the
      // transfer being asked for: same details, and every file it already holds
      // still in the list.
      if (draft) {
        const kept = [...draft.uploaded].every(id => files.value.some(item => item.id === id))
        if (draftLost || draft.meta !== metaKey || !kept) await discardDraft()
      }
      draftLost = false

      if (!draft) {
        const created = await $fetch<{ data: { id: number, token: string } }>('/api/transfers', {
          method: 'POST',
          body: meta
        })
        draft = { id: created.data.id, meta: metaKey, uploaded: new Set() }

        if (background) {
          const form = new FormData()
          form.append('background', background)
          // Not fatal: a transfer that sends without its decoration is far better
          // than losing an upload over a background image.
          await $fetch(`/api/transfers/${draft.id}/background`, {
            method: 'POST',
            body: form
          }).catch(() => {})
        }
      }

      const transferId = draft.id
      const uploaded = draft.uploaded

      state.value = 'uploading'
      for (const item of files.value) {
        // Skip what this draft already holds, so retrying after a mid-queue
        // failure doesn't send the earlier files a second time.
        if (uploaded.has(item.id)) continue
        await uploadFile(transferId, item)
        uploaded.add(item.id)
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
      draft = null
      return result.value
    } catch (error) {
      state.value = 'error'

      const code = errorCode(error) || (error instanceof Error ? error.message : '')

      // The server no longer has this draft — swept after a day of waiting, or
      // sent from another tab. There is nothing to carry on with, so the next
      // attempt starts a new one rather than asking after this one again.
      if (code === 'NOT_FOUND' || code === 'TRANSFER_ALREADY_SENT') draftLost = true

      // A per-file error already has its message on the file row; showing it
      // again at the top would just be noise.
      const failedFile = files.value.find(item => item.status === 'error')
      if (!failedFile) {
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
