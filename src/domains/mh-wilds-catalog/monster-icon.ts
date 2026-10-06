import { existsSync } from 'fs'
import path from 'path'

/** Where the large-monster icons live (relative to the process cwd, like the bot's icon loader). */
export const MONSTER_ICON_DIR = 'assets/icons/large'

export const UNKNOWN_MONSTER_ICON = 'Unknown_Icon.png'

/** `Yian Kut-Ku` -> `Yian_Kut-Ku_Icon.png`; shared by the Discord embeds and the monsters API. */
export const resolveMonsterIcon = (monsterName: string): string => {
  return monsterName !== 'Unknown' ? `${monsterName.split(' ').join('_')}_Icon.png` : UNKNOWN_MONSTER_ICON
}

/** Same as `resolveMonsterIcon`, but falls back to the Unknown icon when no such file exists. */
export const resolveExistingMonsterIcon = (monsterName: string, dir: string = MONSTER_ICON_DIR): string => {
  const file = resolveMonsterIcon(monsterName)
  return existsSync(path.join(dir, file)) ? file : UNKNOWN_MONSTER_ICON
}

/** Public URL path of a monster's icon, served by `monster-icons` route. */
export const monsterIconUrl = (monsterName: string): string =>
  `/api/mh-wilds/monster-icons/${resolveExistingMonsterIcon(monsterName)}`
