import { Worker } from 'node:worker_threads'
import type { ArmorPiece, SearchInput, SearchResult, SetSearchIndex } from './types'
import type { SearchWorkerRequest, SearchWorkerResponse } from './search-worker-protocol'

const SEARCH_TIMEOUT_MS = 4_000

export class SetSearchTimeoutError extends Error {
  constructor() {
    super(`Set search exceeded the ${SEARCH_TIMEOUT_MS}ms compute budget`)
    this.name = 'SetSearchTimeoutError'
  }
}

interface PendingSearch {
  resolve: (results: SearchResult[]) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

let worker: Worker | null = null
let syncedIndex: SetSearchIndex | null = null
let nextRequestId = 1
const pending = new Map<number, PendingSearch>()

function rejectPending(error: Error): void {
  for (const request of pending.values()) {
    clearTimeout(request.timeout)
    request.reject(error)
  }
  pending.clear()
}

function resetWorker(error: Error): void {
  const staleWorker = worker
  worker = null
  syncedIndex = null
  rejectPending(error)
  void staleWorker?.terminate()
}

function createWorker(): Worker {
  const workerFile = import.meta.url.endsWith('.ts') ? './search-worker.ts' : './domains/set-search/search-worker.js'
  const nextWorker = new Worker(new URL(workerFile, import.meta.url))

  nextWorker.on('message', (message: SearchWorkerResponse) => {
    const request = pending.get(message.id)
    if (!request) return
    clearTimeout(request.timeout)
    pending.delete(message.id)
    if (message.type === 'result') request.resolve(message.results)
    else request.reject(new Error(message.message))
  })
  nextWorker.on('error', (error) => resetWorker(error))
  nextWorker.on('exit', (code) => {
    if (worker === nextWorker) resetWorker(new Error(`Set-search worker exited with code ${code}`))
  })

  return nextWorker
}

export function runSearchInWorker(input: SearchInput, index: SetSearchIndex, customTalismans: ArmorPiece[] = []): Promise<SearchResult[]> {
  worker ??= createWorker()
  if (syncedIndex !== index) {
    worker.postMessage({
      type: 'set-index',
      index,
    } satisfies SearchWorkerRequest)
    syncedIndex = index
  }

  const id = nextRequestId++
  return new Promise<SearchResult[]>((resolve, reject) => {
    const timeout = setTimeout(() => resetWorker(new SetSearchTimeoutError()), SEARCH_TIMEOUT_MS)
    pending.set(id, { resolve, reject, timeout })
    worker?.postMessage({
      type: 'search',
      id,
      input,
      customTalismans,
    } satisfies SearchWorkerRequest)
  })
}
