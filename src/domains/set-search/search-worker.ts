import { parentPort } from 'node:worker_threads'
import { search } from './logic'
import type { SetSearchIndex } from './types'
import type { SearchWorkerRequest, SearchWorkerResponse } from './search-worker-protocol'

let currentIndex: SetSearchIndex | null = null

parentPort?.on('message', (message: SearchWorkerRequest) => {
  if (message.type === 'set-index') {
    currentIndex = message.index
    return
  }

  let response: SearchWorkerResponse
  try {
    if (!currentIndex) throw new Error('Set-search worker index is not initialized')
    const index =
      message.customTalismans.length === 0
        ? currentIndex
        : {
            ...currentIndex,
            byType: {
              ...currentIndex.byType,
              talisman: [...currentIndex.byType.talisman, ...message.customTalismans],
            },
          }
    response = {
      type: 'result',
      id: message.id,
      results: search(message.input, index),
    }
  } catch (error) {
    response = {
      type: 'error',
      id: message.id,
      message: error instanceof Error ? error.message : String(error),
    }
  }
  parentPort?.postMessage(response)
})
