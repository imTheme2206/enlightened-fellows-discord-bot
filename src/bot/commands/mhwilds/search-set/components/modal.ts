import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js'
import type { PendingSkill } from '../state'
import { truncate } from '../../../../utils/text-truncate'
import { getSkillMaxLevels } from '../../../../../services/set-search/queries'

export function buildLevelModal(pending: PendingSkill[], maxLevels: Map<string, number>): ModalBuilder {
  const builder = new ModalBuilder().setCustomId('search-set:level-modal').setTitle('Enter Skill Levels')

  for (let i = 0; i < Math.min(pending.length, 5); i++) {
    const { name } = pending[i]
    const maxLevel = maxLevels.get(name) ?? 7
    const rawLabel = `${name} (max ${maxLevel})`
    const label = truncate(rawLabel)

    const skillLevelInput = new TextInputBuilder()
      .setCustomId(`level_${i}`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(`1–${maxLevel}`)
      .setRequired(true)

    const skillLabel = new LabelBuilder().setLabel(label).setTextInputComponent(skillLevelInput)

    builder.addLabelComponents(skillLabel)
  }

  return builder
}

export function buildSetRankModal(skillName: string, maxLevel: number): ModalBuilder {
  const label = truncate(`${skillName} rank (1–${maxLevel})`)

  const rankInput = new TextInputBuilder()
    .setCustomId('set_rank')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(`1–${maxLevel}`)
    .setRequired(true)

  const rankLabel = new LabelBuilder().setLabel(label).setTextInputComponent(rankInput)

  return new ModalBuilder().setCustomId('search-set:set-rank-modal').setTitle('Set Bonus Rank').addLabelComponents(rankLabel)
}

export { getSkillMaxLevels }
