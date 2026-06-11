import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js'
import type { PendingSkill } from '../../../bot/commands/mhwilds/search-set/state'
import { truncate } from '../../../bot/utils/text-truncate'
import { getSkillMaxLevels } from '../interface'

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

export { getSkillMaxLevels }
