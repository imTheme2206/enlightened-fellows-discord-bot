/**
 * One-off generator for the set-search test fixture.
 *
 * Connects to the live database (DATABASE_URL), builds the real search index via
 * the production `buildIndexFromDb()`, and writes a JSON snapshot next to this
 * file. The committed snapshot lets the test suite run hermetically — no DB.
 *
 * Run: `bun run gen:search-fixture` (or `tsx <this file>`).
 * Re-run whenever the underlying armor/skill/decoration data changes.
 */
import fs from 'fs'
import path from 'path'
import { buildIndexFromDb } from '../../build-index'
import { serializeIndex } from './index-serde'

async function main() {
  const index = await buildIndexFromDb()
  const out = path.join(import.meta.dirname, 'search-index.json')
  fs.writeFileSync(out, JSON.stringify(serializeIndex(index)))
  // eslint-disable-next-line no-console
  console.log(`Wrote ${out}\n  ${index.allArmor.length} armor, ${index.decorations.length} decorations, ${index.skills.size} skills`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
