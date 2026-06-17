import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js'
import type { SearchState } from '../state'
import { MAX_SKILLS } from '../state'
import { loadArmorSkills, loadGroupSkillOptions, loadSetSkillOptions } from '../../../../../domains/set-search/repository'
import { cancelRow } from './ui'

export type AnyRow = ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>

async function buildWeaponSkillComponents(state: SearchState): Promise<AnyRow[]> {
  const [setData, groupOptions] = await Promise.all([loadSetSkillOptions(), loadGroupSkillOptions()])
  const setOptions = setData.map((s) => ({
    label: s.name,
    description: s.effectName ? `→ ${s.effectName}` : s.name,
    value: s.name,
  }))
  const hasGogma = !!(state.gogmaSkills.setSkill || state.gogmaSkills.groupSkill)

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('search-set:gogma-set-pick')
        .setPlaceholder(state.gogmaSkills.setSkill ? `Set skill: ${state.gogmaSkills.setSkill}` : "Weapon's set skill contribution…")
        .addOptions(setOptions.length ? setOptions : [{ label: 'None available', value: '__none__' }])
    ),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('search-set:gogma-group-pick')
        .setPlaceholder(
          state.gogmaSkills.groupSkill ? `Group skill: ${state.gogmaSkills.groupSkill}` : "Weapon's group skill contribution…"
        )
        .addOptions(groupOptions.length ? groupOptions : [{ label: 'None available', value: '__none__' }])
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('search-set:btn-cancel').setLabel('← Back').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('search-set:btn-clear-gogma')
        .setLabel('Clear Weapon Skills')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!hasGogma)
    ),
  ]
}

const RANK_LABELS = ['I', 'II', 'III', 'IV', 'V']

async function buildSetSkillComponents(state: SearchState): Promise<AnyRow[]> {
  const rows: AnyRow[] = []
  const addedSetNames = new Set(state.setSkills.map((s) => s.name))
  const addedGroupSkills = new Set(state.groupSkills)

  const [allSetData, allGroupOptions] = await Promise.all([loadSetSkillOptions(), loadGroupSkillOptions()])

  const setOptions = allSetData
    .filter((s) => !addedSetNames.has(s.name))
    .map((s) => ({
      label: s.name,
      description: s.effectName ? `→ ${s.effectName}` : s.name,
      value: s.name,
    }))
  const groupOptions = allGroupOptions.filter((o) => !addedGroupSkills.has(o.value))

  if (setOptions.length) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId('search-set:set-pick').setPlaceholder('Add a set bonus…').addOptions(setOptions)
      )
    )
  }

  if (groupOptions.length) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId('search-set:group-pick').setPlaceholder('Add a group skill…').addOptions(groupOptions)
      )
    )
  }

  if (state.setSkills.length > 0) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('search-set:remove-set-pick')
          .setPlaceholder('Remove a set bonus…')
          .addOptions(
            state.setSkills.map((s) => ({
              label: `${s.name} (${RANK_LABELS[s.rank - 1] ?? s.rank})`,
              value: `${s.name}|${s.rank}`,
            }))
          )
      )
    )
  }

  if (state.groupSkills.length > 0) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('search-set:remove-group-pick')
          .setPlaceholder('Remove a group skill…')
          .addOptions(state.groupSkills.map((g) => ({ label: g, value: g })))
      )
    )
  }

  rows.push(cancelRow())
  return rows
}

function buildHistoryComponents(state: SearchState): AnyRow[] {
  const entries = state.historyEntries ?? []
  const options =
    entries.length > 0
      ? entries.map((e) => ({
          label: e.label,
          description: `Searched: ${e.searchedAt.toISOString().slice(0, 16)}`,
          value: e.id,
        }))
      : [{ label: 'No search history found', value: '__none__' }]

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder().setCustomId('search-set:history-pick').setPlaceholder('Load a previous search…').addOptions(options)
    ),
    cancelRow(),
  ]
}

function buildRemoveSkillComponents(state: SearchState): AnyRow[] {
  const options = state.skills.map((s) => ({
    label: ` ${s.name} Lv ${s.level}`,
    value: s.name,
  }))

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder().setCustomId('search-set:remove-pick').setPlaceholder('Choose a skill to remove…').addOptions(options)
    ),
    cancelRow(),
  ]
}

async function buildMainComponents(state: SearchState): Promise<AnyRow[]> {
  const rows: AnyRow[] = []
  const skillCount = state.skills.length
  const hasSkills = skillCount > 0
  const atMax = skillCount >= MAX_SKILLS
  const addedSkills = new Set(state.skills.map((s) => s.name))

  const [slot1, slot2, slot3] = await Promise.all([loadArmorSkills(1), loadArmorSkills(2), loadArmorSkills(3)])

  const slotOneOptions = slot1.filter((s) => !addedSkills.has(s.value))
  const displaySlotOneOptions = slotOneOptions.length ? slotOneOptions : [{ label: 'All slot 1 skills added', value: '__none__' }]

  rows.push(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('search-set:slot-1-pick')
        .setPlaceholder('Add Slot 1 skill…')
        .setDisabled(atMax)
        .setMinValues(1)
        .setMaxValues(Math.min(5, displaySlotOneOptions.length))
        .addOptions(displaySlotOneOptions)
    )
  )

  const slotTwoThreeOptions = [...slot2, ...slot3].filter((s) => !addedSkills.has(s.value))
  const displaySlotTwoThreeOptions = slotTwoThreeOptions.length ? slotTwoThreeOptions : [{ label: 'All slot 2/3 skills added', value: '__none__' }]

  rows.push(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('search-set:slot-2-pick')
        .setPlaceholder('Add Slot 2 or 3 skill…')
        .setDisabled(atMax)
        .setMinValues(1)
        .setMaxValues(Math.min(5, displaySlotTwoThreeOptions.length))
        .addOptions(displaySlotTwoThreeOptions)
    )
  )

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('search-set:btn-remove').setLabel('Remove Skill').setStyle(ButtonStyle.Danger).setDisabled(!hasSkills),
      new ButtonBuilder().setCustomId('search-set:btn-history').setLabel('History').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('search-set:btn-weapon').setLabel('Weapon Skills').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('search-set:btn-set-bonus').setLabel('Set/Group Bonus').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('search-set:btn-search').setLabel('Search').setStyle(ButtonStyle.Success).setDisabled(!hasSkills)
    )
  )

  return rows
}

export async function buildComponents(state: SearchState): Promise<AnyRow[]> {
  switch (state.step) {
    case 'weapon-skill':
      return buildWeaponSkillComponents(state)
    case 'set-skill':
      return buildSetSkillComponents(state)
    case 'history':
      return buildHistoryComponents(state)
    case 'remove-skill':
      return buildRemoveSkillComponents(state)
    default:
      return buildMainComponents(state)
  }
}
