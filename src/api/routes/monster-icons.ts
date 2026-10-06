import { readFile } from 'fs/promises'
import path from 'path'
import { Elysia } from 'elysia'
import { MONSTER_ICON_DIR, UNKNOWN_MONSTER_ICON } from '../../domains/mh-wilds-catalog/monster-icon'

const ICON_FILE = /^[A-Za-z0-9_-]+_Icon\.png$/

const serve = async (file: string) =>
  new Response(await readFile(path.join(MONSTER_ICON_DIR, file)), {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' },
  })

/**
 * `GET /api/mh-wilds/monster-icons/:file` serves the existing bot icon assets
 * (`assets/icons/large`); unknown or malformed names return the Unknown icon.
 */
export const monsterIconsRoutes = new Elysia({ tags: ['mh-wilds'] }).get('/monster-icons/:file', async ({ params }) => {
  if (ICON_FILE.test(params.file)) {
    try {
      return await serve(params.file)
    } catch {
      // fall through to the Unknown icon
    }
  }
  return serve(UNKNOWN_MONSTER_ICON)
})
