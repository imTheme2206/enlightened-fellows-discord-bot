import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import type { SearchState, Step } from "../../../bot/commands/search-set/state";
import { buildPaginationComponents } from "../../../bot/utils/embed-pagination";

export function buildHistoryLabel(state: SearchState): string {
  const parts = [
    ...state.skills.map((s) => `${s.name} ${s.level}`),
    ...state.setSkills,
    ...state.groupSkills,
  ];
  const base = parts.length > 0 ? parts.join(", ") : "Empty search";
  const labeled = `[${state.rank.toUpperCase()}] ${base}`;
  return labeled.length > 100 ? labeled.slice(0, 97) + "…" : labeled;
}

export function buildEmbed(state: SearchState): EmbedBuilder {
  const skillLines = state.skills.length
    ? state.skills.map((s) => `•  ${s.name} Lv ${s.level}`).join("\n")
    : "_None_";

  const setLines = state.setSkills.length
    ? state.setSkills.map((s) => `• ${s}`).join("\n")
    : "_None_";

  const weaponLines = `${state.gogmaSkills.groupSkill || "_None_"} + ${state.gogmaSkills.setSkill || "_None_"}`;

  const groupLines = state.groupSkills.length
    ? state.groupSkills.map((g) => `• ${g}`).join("\n")
    : "_None_";

  const descriptions: Record<Step, string> = {
    main: `Pick skills from the dropdowns below, then hit **Search**.`,
    "weapon-skill":
      "Pick the set and group skills your weapon already provides (counts as 1 level each toward your desired skills).",
    "set-skill":
      "Pick desired set bonuses and group skills. Hit **← Back** when done.",
    history: "Select a previous search to reload.",
    "remove-skill": "Pick a skill to remove.",
  };

  return new EmbedBuilder()
    .setTitle("Armor Set Search")
    .setColor(0x5865f2)
    .setDescription(descriptions[state.step])
    .addFields(
      { name: "Gogma Weapon Skills", value: weaponLines, inline: false },
      { name: "Skills", value: skillLines, inline: false },
      { name: "Set Bonuses", value: setLines, inline: true },
      { name: "Group Skills", value: groupLines, inline: true },
      {
        name: "Rank",
        value: state.rank.charAt(0).toUpperCase() + state.rank.slice(1),
        inline: true,
      },
    )
    .setFooter({ text: "Session expires in 10 min" });
}

export function cancelRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("search-set:btn-cancel")
      .setLabel("← Back")
      .setStyle(ButtonStyle.Secondary),
  );
}

export function buildResultRows(
  page: number,
  totalPages: number,
  buttonIds: { prev: string; next: string },
): ActionRowBuilder<ButtonBuilder>[] {
  const rows = buildPaginationComponents(page, totalPages, buttonIds);
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("search-set:btn-modify")
        .setLabel("← Edit")
        .setStyle(ButtonStyle.Secondary),
    ),
  );
  return rows;
}
