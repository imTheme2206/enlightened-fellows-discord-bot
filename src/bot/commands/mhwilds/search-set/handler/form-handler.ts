import { MessageComponentInteraction, ModalSubmitInteraction } from 'discord.js'
import { saveSession, SearchState, SetSkillEntry } from '../state'
import { buildPendingSkills, restoreFromHistory } from '../session-store'
import { buildComponents } from '../components/form'
import { buildLevelModal, buildSetRankModal } from '../components/modal'
import { buildEmbed } from '../components/ui'
import { getSkillMaxLevels } from '../../../../../domains/set-search/repository'

export const updateSession = async (interaction: MessageComponentInteraction, next: SearchState): Promise<void> => {
  saveSession(interaction.user.id, next)
  await interaction.update({
    embeds: [buildEmbed(next)],
    components: await buildComponents(next),
  })
}

export const handleSlotPick = async (state: SearchState, interaction: MessageComponentInteraction): Promise<void> => {
  if (!interaction.isStringSelectMenu()) return
  const id = interaction.customId
  const slotSize = parseInt(id.split('-')[2], 10) as 1 | 2 | 3
  const values = interaction.values

  if (values.length === 1 && values[0] === '__prev__') {
    await updateSession(interaction, {
      ...state,
      slotPages: {
        ...state.slotPages,
        [slotSize]: Math.max(0, (state.slotPages[slotSize] ?? 0) - 1),
      },
    })
    return
  }
  if (values.length === 1 && values[0] === '__next__') {
    await updateSession(interaction, {
      ...state,
      slotPages: {
        ...state.slotPages,
        [slotSize]: (state.slotPages[slotSize] ?? 0) + 1,
      },
    })
    return
  }

  if (values.length === 0) {
    await interaction.deferUpdate()
    return
  }

  const pending = buildPendingSkills(state, values, slotSize)

  saveSession(interaction.user.id, { ...state, pendingSkills: pending })
  const maxLevels = await getSkillMaxLevels(pending.map((p) => p.name))
  await interaction.showModal(buildLevelModal(pending, maxLevels))
}

function parseSetSkillValue(value: string): SetSkillEntry {
  const sep = value.lastIndexOf('|')
  if (sep === -1) return { name: value, rank: 1 }
  return { name: value.slice(0, sep), rank: parseInt(value.slice(sep + 1), 10) || 1 }
}

export const handleSetPick = async (state: SearchState, interaction: MessageComponentInteraction): Promise<void> => {
  if (!interaction.isStringSelectMenu()) return
  const name = interaction.values[0]
  const maxLevels = await getSkillMaxLevels([name])
  const maxLevel = maxLevels.get(name) ?? 2
  saveSession(interaction.user.id, { ...state, pendingSetSkill: { name, maxLevel } })
  await interaction.showModal(buildSetRankModal(name, maxLevel))
}

export const handleSetRankModal = async (state: SearchState, interaction: ModalSubmitInteraction): Promise<void> => {
  const pending = state.pendingSetSkill
  if (!pending) {
    await interaction.reply({ content: 'Session expired — run /search-set again.', flags: ['Ephemeral'] })
    return
  }

  const raw = parseInt(interaction.fields.getTextInputValue('set_rank'), 10)
  const rank = Math.min(pending.maxLevel, Math.max(1, isNaN(raw) ? 1 : raw))

  const next: SearchState = {
    ...state,
    setSkills: [...state.setSkills, { name: pending.name, rank }],
    pendingSetSkill: null,
  }
  saveSession(interaction.user.id, next)

  if (interaction.isFromMessage()) {
    await interaction.update({ embeds: [buildEmbed(next)], components: await buildComponents(next) })
  } else {
    await interaction.reply({ embeds: [buildEmbed(next)], components: await buildComponents(next), ephemeral: true })
  }
}

export const handleGroupPick = async (state: SearchState, interaction: MessageComponentInteraction): Promise<void> => {
  if (!interaction.isStringSelectMenu()) return
  await updateSession(interaction, {
    ...state,
    groupSkills: [...state.groupSkills, interaction.values[0]],
  })
}

export const handleGogmaSetPick = async (state: SearchState, interaction: MessageComponentInteraction): Promise<void> => {
  if (!interaction.isStringSelectMenu()) return
  const picked = interaction.values[0]
  await updateSession(interaction, {
    ...state,
    gogmaSkills: {
      ...state.gogmaSkills,
      setSkill: picked === '__none__' ? '' : picked,
    },
  })
}

export const handleGogmaGroupPick = async (state: SearchState, interaction: MessageComponentInteraction): Promise<void> => {
  if (!interaction.isStringSelectMenu()) return
  const picked = interaction.values[0]
  await updateSession(interaction, {
    ...state,
    gogmaSkills: {
      ...state.gogmaSkills,
      groupSkill: picked === '__none__' ? '' : picked,
    },
    step: 'main',
  })
}

export const handleHistoryPick = async (state: SearchState, interaction: MessageComponentInteraction): Promise<void> => {
  if (!interaction.isStringSelectMenu()) return
  const picked = interaction.values[0]
  if (picked === '__none__') {
    await updateSession(interaction, {
      ...state,
      step: 'main',
      historyEntries: undefined,
    })
    return
  }
  const entry = state.historyEntries?.find((e) => e.id === picked)
  if (!entry) {
    await updateSession(interaction, {
      ...state,
      step: 'main',
      historyEntries: undefined,
    })
    return
  }
  await updateSession(interaction, restoreFromHistory(state, entry))
}

export const handleRemovePick = async (state: SearchState, interaction: MessageComponentInteraction): Promise<void> => {
  if (!interaction.isStringSelectMenu()) return
  await updateSession(interaction, {
    ...state,
    skills: state.skills.filter((s) => s.name !== interaction.values[0]),
    step: 'main',
  })
}

export const handleRemoveSetPick = async (state: SearchState, interaction: MessageComponentInteraction): Promise<void> => {
  if (!interaction.isStringSelectMenu()) return
  const { name, rank } = parseSetSkillValue(interaction.values[0])
  await updateSession(interaction, {
    ...state,
    setSkills: state.setSkills.filter((s) => !(s.name === name && s.rank === rank)),
  })
}

export const handleRemoveGroupPick = async (state: SearchState, interaction: MessageComponentInteraction): Promise<void> => {
  if (!interaction.isStringSelectMenu()) return
  await updateSession(interaction, {
    ...state,
    groupSkills: state.groupSkills.filter((g) => g !== interaction.values[0]),
  })
}
