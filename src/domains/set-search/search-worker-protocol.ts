import type { ArmorPiece, SearchInput, SearchResult, SetSearchIndex } from './types'

export type SearchWorkerRequest =
  | { type: 'set-index'; index: SetSearchIndex }
  | {
      type: 'search'
      id: number
      input: SearchInput
      customTalismans: ArmorPiece[]
    }

export type SearchWorkerResponse = { type: 'result'; id: number; results: SearchResult[] } | { type: 'error'; id: number; message: string }
