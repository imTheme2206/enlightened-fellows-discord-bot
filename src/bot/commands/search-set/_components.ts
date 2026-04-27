import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import {
  loadArmorSkills,
  loadGroupSkillOptions,
  loadSetSkillOptions,
} from "../../services/search-set";
import type { SearchState } from "./_state";
import { MAX_SKILLS } from "./_state";
import { cancelRow } from "./_ui";

export type AnyRow = ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>;

function buildWeaponSkillComponents(state: SearchState): AnyRow[] {
  const setOptions = loadSetSkillOptions();
  const groupOptions = loadGroupSkillOptions();

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("search-set:gogma-set-pick")
        .setPlaceholder(
          state.gogmaSkills.setSkill
            ? `Set skill: ${state.gogmaSkills.setSkill}`
            : "Weapon's set skill contribution…",
        )
        .addOptions(
          setOptions.length
            ? setOptions
            : [{ label: "None available", value: "__none__" }],
        ),
    ),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("search-set:gogma-group-pick")
        .setPlaceholder(
          state.gogmaSkills.groupSkill
            ? `Group skill: ${state.gogmaSkills.groupSkill}`
            : "Weapon's group skill contribution…",
        )
        .addOptions(
          groupOptions.length
            ? groupOptions
            : [{ label: "None available", value: "__none__" }],
        ),
    ),
    cancelRow(),
  ];
}

function buildSetSkillComponents(state: SearchState): AnyRow[] {
  const rows: AnyRow[] = [];
  const addedSetSkills = new Set(state.setSkills);
  const addedGroupSkills = new Set(state.groupSkills);

  const setOptions = loadSetSkillOptions().filter(
    (o) => !addedSetSkills.has(o.value),
  );
  const groupOptions = loadGroupSkillOptions().filter(
    (o) => !addedGroupSkills.has(o.value),
  );

  if (setOptions.length) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("search-set:set-pick")
          .setPlaceholder("Add a set bonus…")
          .addOptions(setOptions),
      ),
    );
  }

  if (groupOptions.length) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("search-set:group-pick")
          .setPlaceholder("Add a group skill…")
          .addOptions(groupOptions),
      ),
    );
  }

  rows.push(cancelRow());
  return rows;
}

function buildHistoryComponents(state: SearchState): AnyRow[] {
  const entries = state.historyEntries ?? [];
  const options =
    entries.length > 0
      ? entries.map((e) => ({
          label: e.label,
          description: `Searched: ${e.searchedAt.slice(0, 16)}`,
          value: e.id,
        }))
      : [{ label: "No search history found", value: "__none__" }];

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("search-set:history-pick")
        .setPlaceholder("Load a previous search…")
        .addOptions(options),
    ),
    cancelRow(),
  ];
}

function buildRemoveSkillComponents(state: SearchState): AnyRow[] {
  const options = state.skills.map((s) => ({
    label: `[Slot ${s.slotSize}] ${s.name} Lv ${s.level}`,
    value: s.name,
  }));

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("search-set:remove-pick")
        .setPlaceholder("Choose a skill to remove…")
        .addOptions(options),
    ),
    cancelRow(),
  ];
}

function buildMainComponents(state: SearchState): AnyRow[] {
  const rows: AnyRow[] = [];
  const skillCount = state.skills.length;
  const hasSkills = skillCount > 0;
  const atMax = skillCount >= MAX_SKILLS;
  const addedSkills = new Set(state.skills.map((s) => s.name));

  for (const slot of [1, 2, 3] as const) {
    const allOptions = loadArmorSkills(slot).filter(
      (s) => !addedSkills.has(s.value),
    );
    const displayOptions = allOptions.length
      ? allOptions
      : [{ label: `All slot ${slot} skills added`, value: "__none__" }];

    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`search-set:slot-${slot}-pick`)
          .setPlaceholder(`Add Slot ${slot} skill…`)
          .setDisabled(atMax)
          .setMinValues(1)
          .setMaxValues(Math.min(5, displayOptions.length))
          .addOptions(displayOptions),
      ),
    );
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("search-set:btn-remove")
        .setLabel("Remove Skill")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!hasSkills),
      new ButtonBuilder()
        .setCustomId("search-set:btn-history")
        .setLabel("History")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("search-set:btn-weapon")
        .setLabel("Weapon Skills")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("search-set:btn-set-bonus")
        .setLabel("Set/Group Bonus")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("search-set:btn-search")
        .setLabel("Search")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!hasSkills),
    ),
  );

  return rows;
}

export function buildComponents(state: SearchState): AnyRow[] {
  switch (state.step) {
    case "weapon-skill":
      return buildWeaponSkillComponents(state);
    case "set-skill":
      return buildSetSkillComponents(state);
    case "history":
      return buildHistoryComponents(state);
    case "remove-skill":
      return buildRemoveSkillComponents(state);
    default:
      return buildMainComponents(state);
  }
}
