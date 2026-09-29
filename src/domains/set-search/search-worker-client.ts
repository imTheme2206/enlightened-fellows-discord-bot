import { Worker } from 'node:worker_threads'
import { SEARCH_TIME_BUDGET_MS } from './logic/constants'
import type { ArmorPiece, SearchInput, SearchResult, SetSearchIndex } from './types'
import type { SearchWorkerRequest, SearchWorkerResponse } from './search-worker-protocol'

/**
 * Hard kill for a hung or crashed worker only. The DFS stops itself at
 * SEARCH_TIME_BUDGET_MS and returns its best results so far, so a healthy
 * search never reaches this — derived from the budget so the two cannot drift.
 */
const SEARCH_TIMEOUT_MS = SEARCH_TIME_BUDGET_MS + 5_000

export class SetSearchTimeoutError extends Error {
  constructor() {
    super(`Set search exceeded the ${SEARCH_TIMEOUT_MS}ms compute budget`)
    this.name = 'SetSearchTimeoutError'
  }
}

interface QueuedSearch {
  id: number
  input: SearchInput
  index: SetSearchIndex
  customTalismans: ArmorPiece[]
  resolve: (results: SearchResult[]) => void
  reject: (error: Error) => void
}

let worker: Worker | null = null
let syncedIndex: SetSearchIndex | null = null
let nextRequestId = 1
// The worker runs one search at a time, so searches are dispatched one at a
// time: each request's hard timeout then covers only its own run, never time
// spent queued behind another search.
const queue: QueuedSearch[] = []
let active: { search: QueuedSearch; timeout: ReturnType<typeof setTimeout> } | null = null

function resetWorker(error: Error): void {
  const staleWorker = worker
  worker = null
  syncedIndex = null
  if (active) {
    clearTimeout(active.timeout)
    active.search.reject(error)
    active = null
  }
  void staleWorker?.terminate()
  // Queued searches never reached the dead worker — run them on a fresh one.
  dispatchNext()
}

function createWorker(): Worker {
  const workerFile = import.meta.url.endsWith('.ts') ? './search-worker.ts' : './domains/set-search/search-worker.js'
  const nextWorker = new Worker(new URL(workerFile, import.meta.url))

  nextWorker.on('message', (message: SearchWorkerResponse) => {
    if (!active || active.search.id !== message.id) return
    const { search, timeout } = active
    clearTimeout(timeout)
    active = null
    if (message.type === 'result') search.resolve(message.results)
    else search.reject(new Error(message.message))
    dispatchNext()
  })
  nextWorker.on('error', (error) => {
    if (worker === nextWorker) resetWorker(error)
  })
  nextWorker.on('exit', (code) => {
    if (worker === nextWorker) resetWorker(new Error(`Set-search worker exited with code ${code}`))
  })

  return nextWorker
}

function dispatchNext(): void {
  if (active) return
  const search = queue.shift()
  if (!search) return

  worker ??= createWorker()
  if (syncedIndex !== search.index) {
    worker.postMessage({
      type: 'set-index',
      index: search.index,
    } satisfies SearchWorkerRequest)
    syncedIndex = search.index
  }

  active = {
    search,
    timeout: setTimeout(() => resetWorker(new SetSearchTimeoutError()), SEARCH_TIMEOUT_MS),
  }
  worker.postMessage({
    type: 'search',
    id: search.id,
    input: search.input,
    customTalismans: search.customTalismans,
  } satisfies SearchWorkerRequest)
}

export function runSearchInWorker(input: SearchInput, index: SetSearchIndex, customTalismans: ArmorPiece[] = []): Promise<SearchResult[]> {
  return new Promise<SearchResult[]>((resolve, reject) => {
    queue.push({ id: nextRequestId++, input, index, customTalismans, resolve, reject })
    dispatchNext()
  })
}
